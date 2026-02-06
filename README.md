# Onsite Concierge POC

AI-powered conversational commerce for custom phone case purchases using AWS Bedrock (Claude 3.5 Sonnet) and Stripe payment elements

## Overview

- AI chat interface for product browsing and configuration
- Stripe payment elements (no redirects)
- AWS Lambda + API Gateway + Bedrock backend
- MCP server for tool calling (products, pricing, orders)

## Project Structure

```
├── chat-frontend/            # Chat UI with embedded Stripe
│   ├── index.html            # Main chat interface
│   └── server.js             # Local dev server
│
├── aws-backend/              # Lambda function
│   └── src/
│       └── bedrock-handler.ts  # Bedrock + MCP integration
│
├── mcp-server/               # MCP tools
│   └── src/
│       └── index.ts          # Product catalog + Stripe tools
│
└── infrastructure/           # Deployment
    ├── package-for-ui.sh     # Build Lambda package
    └── casetify-lambda.zip   # Deployable package
```

## Quick Start

1. Start frontend:
```bash
cd chat-frontend
python3 -m http.server 8080
```

2. Open http://localhost:8080


## Tech Stack

- Frontend: Vanilla JS + Stripe Elements
- Backend: AWS Lambda (Node.js 20.x)
- AI: AWS Bedrock (Claude 3.5 Sonnet)
- Payments: Stripe Payment Intents + Payment Element
- Tools: MCP (Model Context Protocol)

## More Information

For detailed documentation, see: https://confluence.corp.stripe.com/spaces/~jills/pages/2339700780/Onsite+Concierge+without+ACS+SPT+Support

