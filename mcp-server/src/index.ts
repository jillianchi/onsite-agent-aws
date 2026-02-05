import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Stripe from "stripe";

// Get Stripe key from environment variable
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY environment variable");
  process.exit(1);
}
const stripe = new Stripe(STRIPE_SECRET_KEY);

const server = new McpServer({
  name: "casetify-concierge-mcp",
  version: "1.0.0",
});

// Product catalog data
const PRODUCTS = {
  models: ["iPhone 15 Pro", "iPhone 15", "iPhone 14 Pro", "iPhone 14"],
  caseTypes: [
    { id: "clear", name: "Clear Case", price: 29.99 },
    { id: "ultra-impact", name: "Ultra Impact Case", price: 44.99 },
    { id: "leather", name: "Leather Case", price: 54.99 },
    { id: "mirror", name: "Mirror Case", price: 39.99 }
  ],
  designCategories: ["Floral", "Abstract", "Animals", "Custom Photo", "Solid Colors", "Patterns"]
};

// Helper function to get product image URL based on configuration
function getProductImageUrl(phoneModel: string, caseType: string, designCategory: string): string {
  // For iPhone models, return design-specific images
  if (phoneModel.toLowerCase().includes('iphone')) {
    const designImages: Record<string, string> = {
      'floral': 'https://cdn-image02.casetify.com/usr/13358/1723358/~v1356/3029305_iphone-17-pro-max_16009421__render888.png.500x500-r.m80.webp',
      'abstract': 'https://cdn-image02.casetify.com/usr/16571/16546571/~v136/35845118_iphone-17-pro-max_16010199__render888.png.500x500-r.m80.webp',
      'animals': 'https://cdn-image02.casetify.com/usr/11785/3671785/~v946/5606445_iphone-17-pro-max_16009421__render888.png.500x500-r.m80.webp',
    };
    
    const key = designCategory.toLowerCase();
    return designImages[key] || 'https://cdn-image02.casetify.com/usr/4787/34787/~v3414/12692439x2_iphone-16-pro-max_16007186__render888.png.1000x1000-r.m80.webp';
  }
  
  // For Samsung models, return a default Samsung case image
  if (phoneModel.toLowerCase().includes('samsung')) {
    return 'https://cdn-image02.casetify.com/usr/4787/34787/~v3414/12692439x2_iphone-16-pro-max_16007186__render888.png.1000x1000-r.m80.webp';
  }
  
  // Default fallback
  return 'https://cdn-image02.casetify.com/usr/4787/34787/~v3414/12692439x2_iphone-16-pro-max_16007186__render888.png.1000x1000-r.m80.webp';
}

// Tool 1: Get products
server.registerTool(
  "get_available_products",
  {
    title: "Get Available Products",
    description: "Get list of available phone case models, types, and designs",
    inputSchema: {
      phoneModel: z.string().optional(),
    },
  },
  async ({ phoneModel }) => {
    return {
      content: [{
        type: "text",
        text: `Available products:\n- Models: ${PRODUCTS.models.join(", ")}\n- Case Types: ${PRODUCTS.caseTypes.map(c => `${c.name} ($${c.price})`).join(", ")}\n- Design Categories: ${PRODUCTS.designCategories.join(", ")}`
      }],
      structuredContent: PRODUCTS
    };
  }
);

// Tool 2: Configure case
server.registerTool(
  "configure_custom_case",
  {
    title: "Configure Custom Case",
    description: "Configure a custom phone case",
    inputSchema: {
      phoneModel: z.string(),
      caseType: z.string(),
      designCategory: z.string(),
      customText: z.string().optional(),
      color: z.string().optional(),
    },
  },
  async ({ phoneModel, caseType, designCategory, customText, color }) => {
    const caseInfo = PRODUCTS.caseTypes.find(c => c.id === caseType);
    const price = caseInfo?.price || 29.99;
    const imageUrl = getProductImageUrl(phoneModel, caseType, designCategory);
    
    return {
      content: [{
        type: "text",
        text: `Case configured:\n- Phone: ${phoneModel}\n- Type: ${caseType}\n- Design: ${designCategory}\n${customText ? `- Text: ${customText}\n` : ''}- Price: $${price}`
      }],
      structuredContent: {
        phoneModel,
        caseType,
        designCategory,
        customText: customText || null,
        color: color || "default",
        price,
        configId: `config_${Date.now()}`,
        imageUrl
      }
    };
  }
);

// Tool 3: Create payment intent
server.registerTool(
  "create_payment_intent",
  {
    title: "Create Payment Intent",
    description: "Create a Payment Intent for checkout",
    inputSchema: {
      configId: z.string(),
      phoneModel: z.string(),
      caseType: z.string(),
      designCategory: z.string(),
      price: z.number().positive(),
      customerEmail: z.string().email().optional(),
    },
  },
  async ({ configId, phoneModel, caseType, designCategory, price, customerEmail }) => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: "usd",
      description: `${phoneModel} - ${caseType} - ${designCategory}`,
      automatic_payment_methods: { enabled: true },
      metadata: { configId, phoneModel, caseType, designCategory },
      receipt_email: customerEmail || undefined,
    });

    const imageUrl = getProductImageUrl(phoneModel, caseType, designCategory);

    return {
      content: [{
        type: "text",
        text: `Payment Intent created for ${phoneModel} ${caseType} case - $${price}`
      }],
      structuredContent: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: price,
        currency: "usd",
        product: { configId, phoneModel, caseType, designCategory, imageUrl, price }
      }
    };
  }
);

// Tool 4: Verify payment
server.registerTool(
  "verify_payment_status",
  {
    title: "Verify Payment Status",
    description: "Check payment status",
    inputSchema: {
      paymentIntentId: z.string(),
    },
  },
  async ({ paymentIntentId }) => {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      content: [{
        type: "text",
        text: `Payment ${paymentIntent.id}: ${paymentIntent.status}${paymentIntent.status === 'succeeded' ? ' ✅' : ''}`
      }],
      structuredContent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        paid: paymentIntent.status === 'succeeded'
      }
    };
  }
);

// Tool 5: Create order
server.registerTool(
  "create_order",
  {
    title: "Create Order",
    description: "Create an order after payment",
    inputSchema: {
      paymentIntentId: z.string(),
      customerEmail: z.string().email().optional(),
    },
  },
  async ({ paymentIntentId, customerEmail }) => {
    const orderId = `ORD-${Date.now()}`;
    
    return {
      content: [{
        type: "text",
        text: `Order ${orderId} created successfully! Estimated delivery: 7-10 business days.`
      }],
      structuredContent: {
        orderId,
        paymentIntentId,
        customerEmail: customerEmail || null,
        status: "confirmed",
        createdAt: new Date().toISOString(),
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Casetify MCP Server started");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
