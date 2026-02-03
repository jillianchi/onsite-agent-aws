import {
  BedrockRuntimeClient,
  ConverseCommand,
  Tool,
  ToolConfiguration,
  Message,
  ContentBlock
} from "@aws-sdk/client-bedrock-runtime";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

// MCP Tools converted to Bedrock tool format
const BEDROCK_TOOLS: Tool[] = [
  {
    toolSpec: {
      name: "get_available_products",
      description: "Get list of available phone case models, types, and designs",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            phoneModel: {
              type: "string",
              description: "Optional: Filter by phone model"
            }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: "configure_custom_case",
      description: "Configure a custom phone case with specific options chosen by the customer",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            phoneModel: { type: "string", description: "Phone model (e.g., iPhone 15 Pro)" },
            caseType: { type: "string", description: "Case type (e.g., clear, ultra-impact)" },
            designCategory: { type: "string", description: "Design category (e.g., Floral, Animals)" },
            customText: { type: "string", description: "Optional custom text to add" },
            color: { type: "string", description: "Optional color choice" }
          },
          required: ["phoneModel", "caseType", "designCategory"]
        }
      }
    }
  },
  {
    toolSpec: {
      name: "create_payment_intent",
      description: "Create a payment intent for the configured case so customer can pay in the chat",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            configId: { type: "string", description: "Configuration ID from configure_custom_case" },
            phoneModel: { type: "string" },
            caseType: { type: "string" },
            designCategory: { type: "string" },
            price: { type: "number" },
            customerEmail: { type: "string", description: "Optional customer email" }
          },
          required: ["configId", "phoneModel", "caseType", "designCategory", "price"]
        }
      }
    }
  }
];

/**
 * Call MCP server tool
 * Note: In Lambda, the MCP server needs to be packaged with the function
 */
async function callMCPTool(toolName: string, args: any): Promise<any> {
  const transport = new StdioClientTransport({
    command: "node",
    // In Lambda, use relative path to bundled MCP server
    args: [process.env.MCP_SERVER_PATH || "./mcp-server/index.js"],
    env: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!
    }
  });

  const client = new Client(
    { name: "bedrock-integration", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  // Convert tool name from Bedrock format to MCP format
  const mcpToolName = toolName.replace(/_/g, "-");

  const result = await client.callTool({
    name: mcpToolName,
    arguments: args
  });

  await client.close();

  // Convert to plain object to avoid JSON serialization issues with TypeScript types
  const data = result.structuredContent || result.content;
  return JSON.parse(JSON.stringify(data));
}

/**
 * Main handler for Bedrock conversation
 */
export async function handler(event: any) {
  try {
    console.log("Received event:", JSON.stringify(event));

    const body = JSON.parse(event.body || "{}");
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message is required" })
      };
    }

    // Build conversation messages
    const messages: Message[] = [
      ...conversationHistory,
      {
        role: "user",
        content: [{ text: message }]
      }
    ];

    // System prompt for Casetify AI Concierge
    const systemPrompt = `You are a friendly AI shopping assistant for Casetify, helping customers design and purchase custom phone cases.

Your goal is to:
1. Help customers choose their phone model
2. Guide them through case type selection (Clear, Ultra Impact, Leather, Mirror)
3. Help them pick a design category or custom design
4. Confirm the configuration and price
5. Create a payment intent so they can checkout directly in the chat

Be conversational, helpful, and enthusiastic about their choices. When they're ready to purchase, use the create_payment_intent tool to enable checkout.

Available products:
- Phone Models: iPhone 15 Pro, iPhone 15, iPhone 14 Pro, Samsung S24, Samsung S23
- Case Types: Clear ($29.99), Ultra Impact ($44.99), Leather ($54.99), Mirror ($39.99)
- Design Categories: Floral, Abstract, Animals, Custom Photo, Solid Colors, Patterns

Always summarize their choices before creating a payment intent.`;

    // Call Bedrock
    const command = new ConverseCommand({
      modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      messages,
      system: [{ text: systemPrompt }],
      toolConfig: {
        tools: BEDROCK_TOOLS
      },
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.7
      }
    });

    const response = await bedrockClient.send(command);

    // Handle tool calls
    if (response.stopReason === "tool_use") {
      const toolResults: ContentBlock[] = [];

      for (const content of response.output?.message?.content || []) {
        if (content.toolUse && content.toolUse.name) {
          console.log("Tool called:", content.toolUse.name, content.toolUse.input);

          try {
            const mcpResult = await callMCPTool(
              content.toolUse.name,
              content.toolUse.input
            );

            console.log("MCP Result:", JSON.stringify(mcpResult, null, 2));

            // Ensure it's a plain object for Bedrock
            const plainResult = JSON.parse(JSON.stringify(mcpResult));

            toolResults.push({
              toolResult: {
                toolUseId: content.toolUse.toolUseId,
                content: [{ json: plainResult }]
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

      // Send tool results back to Bedrock for final response
      if (toolResults.length > 0) {
        if (response.output?.message) {
          messages.push(response.output.message);
        }
        messages.push({
          role: "user",
          content: toolResults
        });

        const followUpCommand = new ConverseCommand({
          modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          messages,
          system: [{ text: systemPrompt }],
          toolConfig: {
            tools: BEDROCK_TOOLS
          }
        });

        const followUpResponse = await bedrockClient.send(followUpCommand);
        
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            message: followUpResponse.output?.message?.content?.[0]?.text || "Processing...",
            conversationHistory: messages,
            toolResults: toolResults,
            requiresPayment: toolResults.some(r => {
              const json = r.toolResult?.content?.[0]?.json;
              return json && typeof json === 'object' && 'clientSecret' in json;
            }),
            paymentData: toolResults.find(r => {
              const json = r.toolResult?.content?.[0]?.json;
              return json && typeof json === 'object' && 'clientSecret' in json;
            })?.toolResult?.content?.[0]?.json
          })
        };
      }
    }

    // Regular text response
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        message: response.output?.message?.content?.[0]?.text || "I'm here to help!",
        conversationHistory: response.output?.message ? [...messages, response.output.message] : messages
      })
    };

  } catch (error: any) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message
      })
    };
  }
}

