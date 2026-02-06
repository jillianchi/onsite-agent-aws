# Casetify AI Concierge

AI-powered conversational commerce platform for custom phone case purchases using AWS Bedrock (Claude 3.5 Sonnet) and Stripe embedded payments.

## Overview

- AI chat interface for product browsing and configuration
- Embedded Stripe payment form (no redirects)
- AWS Lambda + API Gateway + Bedrock backend
- MCP server for tool calling (products, pricing, orders)

## Project Structure

```
├── chat-frontend/          # Chat UI with embedded Stripe
│   ├── index.html         # Main chat interface
│   └── server.js          # Local dev server
│
├── aws-backend/           # Lambda function
│   └── src/
│       └── bedrock-handler.ts  # Bedrock + MCP integration
│
├── mcp-server/            # MCP tools
│   └── src/
│       └── index.ts       # Product catalog + Stripe tools
│
└── infrastructure/        # Deployment
    ├── package-for-ui.sh  # Build Lambda package
    └── casetify-lambda.zip # Deployable package
```

## Quick Start

### Prerequisites

Set up Stripe keys:
```bash
cp env.example .env
# Edit .env with your Stripe keys from https://dashboard.stripe.com/test/apikeys
```

### Local Testing

1. Start frontend:
```bash
cd chat-frontend
python3 -m http.server 8080
```

2. Open http://localhost:8080

3. Test with: "Hello, I need an iPhone case"

### Deploy to AWS

1. Build package:
```bash
cd infrastructure
bash package-for-ui.sh
```

2. Upload `casetify-lambda.zip` to Lambda console

3. Update `chat-frontend/index.html` with your API Gateway URL

## Configuration

Stripe keys are currently hardcoded for POC:
- `mcp-server/src/index.ts` (secret key)
- `chat-frontend/index.html` (publishable key)

For production, use environment variables.

## Tech Stack

- Frontend: Vanilla JS + Stripe Elements
- Backend: AWS Lambda (Node.js 20.x)
- AI: AWS Bedrock (Claude 3.5 Sonnet)
- Payments: Stripe Payment Intents + Payment Element
- Tools: MCP (Model Context Protocol)
- Region: US-EAST-1

### Why Payment Element?

We use Stripe Payment Element (not Checkout Session) because it embeds directly in the chat with no redirects, maintaining the conversational flow. Checkout Session would require redirects, breaking the UX.

## Current Deployment

- Frontend: http://localhost:8080 (local)
- API: https://p7wkohkhyk.execute-api.us-east-1.amazonaws.com/chat
- Lambda: casetify-bedrock-chat-us

## Development

Rebuild after changes:
```bash
cd infrastructure
bash package-for-ui.sh
# Upload new casetify-lambda.zip to Lambda
```

View logs: CloudWatch → Log groups → /aws/lambda/casetify-bedrock-chat-us

## Known Limitations

- Rate limiting: Wait 30-60 seconds between rapid tests (AWS Bedrock default quota)
- Test mode: Stripe keys are for testing only
- Local frontend: For production, deploy to S3 + CloudFront

## Production Checklist

- Deploy frontend to S3 + CloudFront
- Switch to production Stripe keys
- Add DynamoDB for order persistence
- Request Bedrock quota increase
- Add custom domain

## Cost Estimate

- POC/Demo: ~$5-10/month
- Production (1000 users/day): ~$150-200/month
