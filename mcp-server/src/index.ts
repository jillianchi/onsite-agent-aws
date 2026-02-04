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

// Tool 1: Get products
server.registerTool(
  "get-available-products",
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
  "configure-custom-case",
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
        configId: `config_${Date.now()}`
      }
    };
  }
);

// Tool 3: Create payment intent
server.registerTool(
  "create-payment-intent",
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
      automatic_payment_methods: { 
        enabled: true,
        allow_redirects: 'always' // Enable redirect-based methods like Klarna, Afterpay
      },
      payment_method_types: ['card', 'link', 'cashapp', 'klarna', 'afterpay_clearpay'],
      metadata: { configId, phoneModel, caseType, designCategory },
      receipt_email: customerEmail || undefined,
    });

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
        product: { configId, phoneModel, caseType, designCategory }
      }
    };
  }
);

// Tool 4: Verify payment
server.registerTool(
  "verify-payment-status",
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
  "create-order",
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
