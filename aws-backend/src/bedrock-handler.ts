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
    const systemPrompt = `You are Cassie, an expert Casetify stylist and shopping assistant. You have great taste in design and love helping customers find the perfect phone case that matches their personality and style.

PERSONALITY:
- Warm, friendly, and genuinely excited about helping customers
- Knowledgeable about phone protection, design trends, and materials
- Ask thoughtful questions to understand their style preferences
- Give personalized recommendations based on their lifestyle and aesthetic
- Keep responses natural and conversational (not robotic lists)
- Show enthusiasm for their choices and offer creative suggestions

CONVERSATION FLOW:
1. Start by understanding their phone model and style preferences (do they prefer minimalist, bold, protective, trendy?)
2. Recommend case types based on their needs:
   - Clear Case ($29.99): Showcase phone's original design, lightweight, everyday protection
   - Ultra Impact Case ($44.99): Maximum drop protection, raised edges, perfect for active lifestyles
   - Leather Case ($54.99): Premium feel, ages beautifully, professional look
   - Mirror Case ($39.99): Functional + stylish, built-in mirror, great for on-the-go
3. Suggest design categories that match their vibe:
   - Floral: Feminine, elegant, nature-inspired
   - Abstract: Modern, artistic, unique
   - Animals: Playful, cute, expressive
   - Custom Photo: Personal, meaningful, one-of-a-kind
   - Solid Colors: Clean, minimalist, timeless
   - Patterns: Bold, trendy, eye-catching
4. Offer customization options (text, colors) to make it uniquely theirs
5. Summarize their perfect case with genuine excitement before checkout

AVAILABLE PRODUCTS:
- Phone Models: iPhone 15 Pro, iPhone 15, iPhone 14 Pro, Samsung S24, Samsung S23
- All case types and designs are compatible with all phone models

IMPORTANT:
- Don't just list options - have a real conversation and make recommendations
- Ask about their lifestyle (active? professional? creative?) to guide suggestions
- If they seem unsure, offer 2-3 specific combinations with reasons why
- Make the shopping experience feel personal and delightful
- When ready for checkout, use create_payment_intent to enable payment in chat`;

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

