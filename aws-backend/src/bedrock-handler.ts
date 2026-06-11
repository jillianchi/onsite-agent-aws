import {
  BedrockRuntimeClient,
  ConverseCommand,
  Tool,
  Message,
  ContentBlock
} from "@aws-sdk/client-bedrock-runtime";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const region = process.env.AWS_REGION || "us-east-1";

const bedrockClient = new BedrockRuntimeClient({ region });
const ssmClient = new SSMClient({ region });

const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0";

// Demo presets — only active in the demo branch deployment
const DEMO_PRESETS: Record<string, { name: string; personaName: string; personaDescription: string; catalogFile: string }> = {
  generic: {
    name: "Dunder Mifflin",
    personaName: "Recyclops",
    personaDescription: "I will aggressively calculate your precise shopping needs to eliminate retail waste — prepare to be recommended exactly what you require!",
    catalogFile: "catalog-generic.json",
  },
  ecoflow: {
    name: "EcoFlow",
    personaName: "Spark",
    personaDescription: "Your clean energy advisor at EcoFlow",
    catalogFile: "catalog-ecoflow.json",
  },
};

let cachedStripeKey: string | null = null;

async function getStripeSecretKey(): Promise<string> {
  if (cachedStripeKey) return cachedStripeKey;
  const paramPath = process.env.STRIPE_SECRET_KEY_PATH || "/onsite-concierge/stripe-secret-key";
  const response = await ssmClient.send(
    new GetParameterCommand({ Name: paramPath, WithDecryption: true })
  );
  cachedStripeKey = response.Parameter!.Value!;
  return cachedStripeKey;
}

const BEDROCK_TOOLS: Tool[] = [
  {
    toolSpec: {
      name: "get_products",
      description: "Get available products from the store catalog, optionally filtered by category",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            category: { type: "string", description: "Optional: filter by product category" }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: "configure_product",
      description: "Lock in the customer's product selection with their chosen options. Call this before create_payment_intent.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            productId: { type: "string", description: "Product ID from get_products" },
            model: { type: "string", description: "Selected model or variant (e.g. iPhone 16 Pro)" },
            color: { type: "string", description: "Selected color" },
            designCategory: { type: "string", description: "Selected design category" },
            customText: { type: "string", description: "Custom text to engrave or print" }
          },
          required: ["productId"]
        }
      }
    }
  },
  {
    toolSpec: {
      name: "create_payment_intent",
      description: "Create a Stripe Payment Intent so the customer can complete checkout in the chat. The payment form appears automatically.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            configId: { type: "string" },
            productId: { type: "string" },
            productName: { type: "string" },
            price: { type: "number" },
            customerEmail: { type: "string", description: "Optional customer email" }
          },
          required: ["configId", "productId", "productName", "price"]
        }
      }
    }
  }
];

async function callMCPTool(toolName: string, args: any, stripeSecretKey: string): Promise<any> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [process.env.MCP_SERVER_PATH || "./mcp-server/index.js"],
    env: {
      STRIPE_SECRET_KEY: stripeSecretKey,
      ...(process.env.CATALOG_PATH && { CATALOG_PATH: process.env.CATALOG_PATH }),
    }
  });

  const client = new Client(
    { name: "bedrock-integration", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  const result = await client.callTool({ name: toolName, arguments: args });
  await client.close();

  let data: any;
  if (result.structuredContent) {
    data = result.structuredContent;
  } else if (result.content && Array.isArray(result.content)) {
    const textContent = result.content
      .filter((item: any) => item.text)
      .map((item: any) => item.text)
      .join("\n");
    data = { result: textContent };
  } else {
    data = result.content || {};
  }

  return JSON.parse(JSON.stringify(data));
}

function buildSystemPrompt(preset?: string): string {
  const presetConfig = preset && DEMO_PRESETS[preset] ? DEMO_PRESETS[preset] : null;
  const personaName = presetConfig?.personaName || process.env.AI_PERSONA_NAME || "Alex";
  const merchantName = presetConfig?.name || process.env.MERCHANT_NAME || "our store";
  const personaDescription = presetConfig?.personaDescription || process.env.AI_PERSONA_DESCRIPTION || "shopping assistant";

  return `You are ${personaName}, a ${personaDescription} at ${merchantName}. Help customers find and purchase the right product.

STYLE:
- Warm, concise — 1-2 sentences per thought
- No emojis. No filler phrases like "Great choice!" or "Absolutely!"
- Never be pushy

CRITICAL RULES — follow without exception:
1. NEVER say a product is unavailable without calling get_products first. You have zero inventory knowledge without calling the tool.
2. NEVER ask for information the customer already gave you.
3. When message starts with "DIRECT_BUY:" — call configure_product immediately with the provided productId, model, color, and price, then immediately call create_payment_intent with the result. Do NOT ask any questions. Do NOT say anything except a brief one-line confirmation.
4. When message starts with "PAYMENT_CONFIRMED:" — the customer just completed a purchase. Respond with a warm, brief (2 sentences max), Dunder Mifflin-flavoured confirmation. Reference the product if provided. No tool calls needed.

CONVERSATION FLOW:
1. Customer asks about products → infer the category from their message (mugs, paper, awards, bags) and call get_products with that category filter. If unclear, call without a filter. Reply with ONE brief sentence only (e.g. "Here's our mug range:"). Do NOT list product details in text — product cards handle that automatically.
2. If a customer selects a product and you still need their color or quantity → ask for both in ONE message, never separately.
3. Once you have what you need → call configure_product, then ask if they want to checkout.
4. When ready to pay → call create_payment_intent using configId, productId, productName, and price from configure_product. Payment form appears automatically.`;
}

export async function handler(event: any) {
  try {
    console.log("Received event:", JSON.stringify(event));

    const body = JSON.parse(event.body || "{}");
    const { message, conversationHistory = [], preset } = body;

    // Set catalog path based on preset (demo branch only)
    if (preset && DEMO_PRESETS[preset]) {
      process.env.CATALOG_PATH = `${process.cwd()}/mcp-server/${DEMO_PRESETS[preset].catalogFile}`;
    }

    if (!message) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Message is required" })
      };
    }

    const stripeSecretKey = await getStripeSecretKey();
    const systemPrompt = buildSystemPrompt(preset);

    const messages: Message[] = [
      ...conversationHistory,
      { role: "user", content: [{ text: message }] }
    ];

    // Agentic loop — runs until Bedrock stops requesting tool calls
    let paymentData: any = null;
    let configData: any = null;
    let productListData: any = null;
    const MAX_TOOL_ROUNDS = 6;
    let rounds = 0;

    let response = await bedrockClient.send(new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      messages,
      system: [{ text: systemPrompt }],
      toolConfig: { tools: BEDROCK_TOOLS },
      inferenceConfig: { maxTokens: 1024, temperature: 0.7 }
    }));

    while (response.stopReason === "tool_use" && rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      const toolResults: ContentBlock[] = [];

      for (const content of response.output?.message?.content || []) {
        if (content.toolUse?.name) {
          console.log("Tool called:", content.toolUse.name, content.toolUse.input);

          try {
            const mcpResult = await callMCPTool(
              content.toolUse.name,
              content.toolUse.input,
              stripeSecretKey
            );

            // Capture results by type
            if (mcpResult && typeof mcpResult === "object") {
              if ("clientSecret" in mcpResult) paymentData = mcpResult;
              else if ("configId" in mcpResult) configData = mcpResult;
              else if ("products" in mcpResult) productListData = mcpResult;
            }

            toolResults.push({
              toolResult: {
                toolUseId: content.toolUse.toolUseId,
                content: [{ json: mcpResult }]
              }
            });
          } catch (error: any) {
            console.error("Tool execution error:", error);
            toolResults.push({
              toolResult: {
                toolUseId: content.toolUse.toolUseId,
                content: [{ text: `Error: ${error.message}` }],
                status: "error"
              }
            });
          }
        }
      }

      if (response.output?.message) messages.push(response.output.message);
      messages.push({ role: "user", content: toolResults });

      response = await bedrockClient.send(new ConverseCommand({
        modelId: BEDROCK_MODEL_ID,
        messages,
        system: [{ text: systemPrompt }],
        toolConfig: { tools: BEDROCK_TOOLS },
        inferenceConfig: { maxTokens: 1024, temperature: 0.7 }
      }));
    }

    const finalText = response.output?.message?.content?.[0]?.text || "Done!";
    if (response.output?.message) messages.push(response.output.message);

    const activePreset = preset && DEMO_PRESETS[preset] ? DEMO_PRESETS[preset] : null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: finalText,
        conversationHistory: messages,
        requiresPayment: !!paymentData,
        paymentData,
        config: configData,
        productList: productListData?.products || null,
        presetMeta: activePreset ? { name: activePreset.name, personaName: activePreset.personaName } : null,
      })
    };

  } catch (error: any) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Internal server error", message: error.message })
    };
  }
}
