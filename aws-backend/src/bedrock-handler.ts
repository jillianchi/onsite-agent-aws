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

  // Call MCP tool directly with snake_case name
  const result = await client.callTool({
    name: toolName,
    arguments: args
  });

  await client.close();

  // CRITICAL: Ensure we always return a plain JSON object for Bedrock
  // MCP tools return either structuredContent (object) or content (array)
  let data;
  if (result.structuredContent) {
    data = result.structuredContent;
  } else if (result.content && Array.isArray(result.content)) {
    // Extract text from content array format
    const textContent = result.content
      .filter((item: any) => item.text)
      .map((item: any) => item.text)
      .join('\n');
    data = { result: textContent };
  } else {
    data = result.content || {};
  }
  
  // Deep clone to ensure it's a plain object without any TypeScript metadata
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
    const systemPrompt = `You are Cassie, a Casetify stylist who's here to help people design their perfect phone case. Think personal shopper vibes but make it fun.

TONE & STYLE:
- Use casual language: "totally", "honestly", "omg", "ngl" (not gonna lie), "lowkey/highkey", "vibe"
- Be enthusiastic but authentic - no fake corporate energy
- Show personality and opinions ("I'm obsessed with that combo!", "That would look so good on you!")
- Keep it short and punchy - Gen Z attention span
- Use emojis sparingly but naturally when it makes sense
- NEVER say "Hello there!" for first message and after - just flow naturally
- Don't repeat yourself or over-explain

FORMATTING:
- Short messages (2-3 sentences per thought)
- Use line breaks to separate ideas
- Numbered lists when asking questions (makes it easier to answer)
- Casual but readable

CONVERSATION FLOW:
1. After they tell you their phone model (ALWAYS write "iPhone" not "Iphone"), jump right into understanding their vibe:
   - Are they more active/outdoorsy or chill at home vibes?
   - What's their aesthetic? (minimalist, bold, feminine, artsy, trendy)
   - Protection level needed or style first?
   
2. Based on their vibe, recommend 1-2 case types (NOT all of them):
   - Clear Case ($29.99): Show off that iPhone, lightweight, everyday protection
   - Ultra Impact Case ($44.99): Serious protection, perfect for clumsy people or active lifestyles
   - Leather Case ($54.99): Elevated, ages like fine wine, main character energy
   - Mirror Case ($39.99): Functional queen, always ready for a quick check
   
3. Suggest 1-2 designs that match THEIR vibe (don't dump the whole catalog):
   - Floral: Romantic, nature girl energy
   - Abstract: Artsy, unique, conversation starter
   - Animals: Playful, cute, brings joy
   - Custom Photo: Make it personal, memories on deck
   - Solid Colors: Clean, timeless, effortless
   - Patterns: Bold, trendy, statement piece

4. AFTER using configure_custom_case tool, ALWAYS continue the conversation:
   - Get hyped about their choice ("Omg yes! This combo is *chef's kiss*")
   - Paint a picture of how good it'll look
   - Ask if they want to checkout OR if they want to explore other options
   - Be supportive either way (no pressure)

5. When they say they want to checkout/pay (e.g., "checkout", "lets pay", "I'm ready"):
   - First, respond with a quick, friendly confirmation message like:
     * "Okay! Just confirm your details below and we're good to go 🎉"
     * "Let's do it! Check out your config and enter your payment info below"
     * "Perfect! Your details are all set - just fill in payment and we'll get this shipped!"
   - Then IMMEDIATELY call create_payment_intent tool in the SAME response
   - Use the data from the configure_custom_case result you got earlier
   - Required params: configId, phoneModel, caseType, designCategory, price
   - The payment form will appear automatically after the message

AVAILABLE PRODUCTS:
- Phone Models: iPhone 15 Pro, iPhone 15, iPhone 14 Pro, Samsung S24, Samsung S23
- All case types compatible with all models

RULES:
- Never be pushy or salesy
- If they want to explore more options, totally support that
- Don't explain technical stuff unless asked
- Keep the energy positive and helpful
- Make them feel good about their choice`;


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
        temperature: 0.9,
        topP: 0.95
      }
    });

    const response = await bedrockClient.send(command);

    // Handle tool calls
    if (response.stopReason === "tool_use") {
      const toolResults: ContentBlock[] = [];
      
      // Extract any text that came with the tool call
      let toolCallMessage = "";
      for (const content of response.output?.message?.content || []) {
        if (content.text) {
          toolCallMessage = content.text;
        }
      }

      for (const content of response.output?.message?.content || []) {
        if (content.toolUse && content.toolUse.name) {
          console.log("Tool called:", content.toolUse.name, content.toolUse.input);

          try {
            const mcpResult = await callMCPTool(
              content.toolUse.name,
              content.toolUse.input
            );

            console.log("[Tool Result] Type:", typeof mcpResult, "Is Array:", Array.isArray(mcpResult));
            console.log("[Tool Result] Keys:", mcpResult ? Object.keys(mcpResult) : 'null');
            console.log("[Tool Result] Value:", JSON.stringify(mcpResult));

            // CRITICAL: Validate result is a plain object (not array, not null)
            if (!mcpResult || typeof mcpResult !== 'object' || Array.isArray(mcpResult)) {
              const errorMsg = `Invalid tool result: expected object, got ${typeof mcpResult} (array: ${Array.isArray(mcpResult)})`;
              console.error(errorMsg);
              throw new Error(errorMsg);
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
        
        // Debug logging
        console.log('[Lambda] Tool Results:', JSON.stringify(toolResults, null, 2));
        const paymentData = toolResults.find(r => {
          const json = r.toolResult?.content?.[0]?.json;
          return json && typeof json === 'object' && 'clientSecret' in json;
        })?.toolResult?.content?.[0]?.json;
        console.log('[Lambda] Extracted paymentData:', paymentData);
        
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            message: toolCallMessage || followUpResponse.output?.message?.content?.[0]?.text || "Processing...",
            conversationHistory: messages,
            toolResults: toolResults,
            requiresPayment: toolResults.some(r => {
              const json = r.toolResult?.content?.[0]?.json;
              return json && typeof json === 'object' && 'clientSecret' in json;
            }),
            paymentData: toolResults.find(r => {
              const json = r.toolResult?.content?.[0]?.json;
              return json && typeof json === 'object' && 'clientSecret' in json;
            })?.toolResult?.content?.[0]?.json,
            config: toolResults.find(r => {
              const json = r.toolResult?.content?.[0]?.json;
              return json && typeof json === 'object' && 'configId' in json && !('clientSecret' in json);
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

