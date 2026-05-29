import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Stripe from "stripe";
import { readFileSync } from "fs";
import { resolve } from "path";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY environment variable");
  process.exit(1);
}
const stripe = new Stripe(STRIPE_SECRET_KEY);

// Load catalog from CATALOG_PATH env var, or look next to this file, or use empty fallback
function loadCatalog() {
  const candidates = [
    process.env.CATALOG_PATH,
    resolve(process.cwd(), "catalog.json"),
    resolve(import.meta.dirname ?? __dirname, "catalog.json"),
    resolve(import.meta.dirname ?? __dirname, "../catalog.json"),
    resolve(import.meta.dirname ?? __dirname, "../../catalog.json"),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf-8");
      return JSON.parse(raw);
    } catch {
      // try next
    }
  }
  console.error("Warning: No catalog.json found — using empty catalog");
  return { currency: "usd", products: [], quickPrompts: [] };
}

const catalog = loadCatalog();

const server = new McpServer({
  name: "onsite-agent-mcp",
  version: "1.0.0",
});

server.registerTool(
  "get_products",
  {
    title: "Get Products",
    description: "Get available products from the store catalog, optionally filtered by category",
    inputSchema: {
      category: z.string().optional().describe("Optional: filter by product category"),
    },
  },
  async ({ category }) => {
    const products = category
      ? catalog.products.filter((p: any) => p.category?.toLowerCase() === category.toLowerCase())
      : catalog.products;

    const summary = products.map((p: any) =>
      `- ${p.name} ($${p.price}): ${p.description}` +
      (p.options?.models?.length ? `\n  Models: ${p.options.models.join(", ")}` : "") +
      (p.options?.colors?.length ? `\n  Colors: ${p.options.colors.join(", ")}` : "") +
      (p.options?.designCategories?.length ? `\n  Designs: ${p.options.designCategories.join(", ")}` : "")
    ).join("\n\n");

    return {
      content: [{ type: "text", text: `Available products:\n\n${summary}` }],
      structuredContent: { products, currency: catalog.currency }
    };
  }
);

server.registerTool(
  "configure_product",
  {
    title: "Configure Product",
    description: "Lock in the customer's product selection with their chosen options. Call this before create_payment_intent.",
    inputSchema: {
      productId: z.string().describe("Product ID from get_products"),
      model: z.string().optional().describe("Selected model or variant (e.g. iPhone 16 Pro)"),
      color: z.string().optional().describe("Selected color"),
      designCategory: z.string().optional().describe("Selected design category"),
      customText: z.string().optional().describe("Custom text to engrave or print"),
    },
  },
  async ({ productId, model, color, designCategory, customText }) => {
    const product = catalog.products.find((p: any) => p.id === productId);
    if (!product) {
      return {
        content: [{ type: "text", text: `Product "${productId}" not found in catalog` }],
        structuredContent: { error: "Product not found" }
      };
    }

    const config = {
      configId: `config_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      model: model || null,
      color: color || null,
      designCategory: designCategory || null,
      customText: customText || null,
      price: product.price,
      imageUrl: product.imageUrl || null,
      category: product.category || null,
    };

    const description = [
      product.name,
      model,
      color,
      designCategory,
      customText ? `"${customText}"` : null,
    ].filter(Boolean).join(" — ");

    return {
      content: [{ type: "text", text: `Configured: ${description} ($${product.price})` }],
      structuredContent: config
    };
  }
);

server.registerTool(
  "create_payment_intent",
  {
    title: "Create Payment Intent",
    description: "Create a Stripe Payment Intent for checkout. The checkout form will appear automatically in the chat.",
    inputSchema: {
      configId: z.string(),
      productId: z.string(),
      productName: z.string(),
      price: z.number().positive(),
      customerEmail: z.string().email().optional(),
    },
  },
  async ({ configId, productId, productName, price, customerEmail }) => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: catalog.currency || "usd",
      description: productName,
      automatic_payment_methods: { enabled: true },
      metadata: { configId, productId },
      receipt_email: customerEmail || undefined,
    });

    return {
      content: [{ type: "text", text: `Payment Intent created for ${productName} — $${price}` }],
      structuredContent: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: price,
        currency: catalog.currency || "usd",
        product: { configId, productId, productName, price }
      }
    };
  }
);

server.registerTool(
  "verify_payment_status",
  {
    title: "Verify Payment Status",
    description: "Check the status of a payment",
    inputSchema: {
      paymentIntentId: z.string(),
    },
  },
  async ({ paymentIntentId }) => {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      content: [{
        type: "text",
        text: `Payment ${paymentIntent.id}: ${paymentIntent.status}${paymentIntent.status === "succeeded" ? " ✅" : ""}`
      }],
      structuredContent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        paid: paymentIntent.status === "succeeded"
      }
    };
  }
);

server.registerTool(
  "create_order",
  {
    title: "Create Order",
    description: "Create an order record after payment is confirmed",
    inputSchema: {
      paymentIntentId: z.string(),
      customerEmail: z.string().email().optional(),
    },
  },
  async ({ paymentIntentId, customerEmail }) => {
    const orderId = `ORD-${Date.now()}`;

    return {
      content: [{ type: "text", text: `Order ${orderId} confirmed.` }],
      structuredContent: {
        orderId,
        paymentIntentId,
        customerEmail: customerEmail || null,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      }
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Onsite Agent MCP Server started");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
