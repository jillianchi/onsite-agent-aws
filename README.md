# 🎁 Casetify AI Concierge POC

AI-powered conversational commerce platform for custom phone case purchases using AWS Bedrock (Claude 3.5 Sonnet) and Stripe embedded payments.

## 🚀 What's Built

- **AI Chat Interface** - Natural language product browsing and configuration
- **Embedded Payments** - Stripe payment form directly in chat (no redirects)
- **AWS Backend** - Lambda + API Gateway + Bedrock
- **MCP Server** - Tool calling for products, pricing, and orders

## 📁 Project Structure

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

## 🎯 Quick Start

### Prerequisites

1. **Set up environment variables**:
```bash
# Copy example env file
cp env.example .env

# Edit .env with your Stripe keys from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

### Local Testing

1. **Start frontend**:
```bash
cd chat-frontend
python3 -m http.server 8080
```

2. **Open**: http://localhost:8080

3. **Chat**: "Hello, I need an iPhone case"

### Edit Product Catalog

Open `mcp-server/src/index.ts`:
- **Line 15-24**: Edit products, prices, designs
- **Line 27-42**: Tool implementations

### Deploy to AWS

1. **Build package**:
```bash
cd infrastructure
bash package-for-ui.sh
```

2. **Upload** `casetify-lambda.zip` to Lambda

3. **Update** `chat-frontend/index.html` with your API Gateway URL (line 287)

## 🔑 Configuration

**Stripe Keys** (currently hardcoded for POC):
- `mcp-server/src/index.ts` line 6 (secret key)
- `chat-frontend/index.html` line 286 (publishable key)

**For production**: Use environment variables

## 🏗️ Tech Stack

- **Frontend**: Vanilla JS + Stripe Elements
- **Backend**: AWS Lambda (Node.js 20.x)
- **AI**: AWS Bedrock (Claude 3.5 Sonnet)
- **Payments**: Stripe Payment Intents
- **Tools**: MCP (Model Context Protocol)
- **Region**: US-EAST-1

## 📊 Current Deployment

- **Frontend**: http://localhost:8080 (local)
- **API**: https://p7wkohkhyk.execute-api.us-east-1.amazonaws.com/chat
- **Lambda**: casetify-bedrock-chat-us

## 🎤 Demo Flow

1. "Show me iPhone 15 Pro cases"
2. "I want a clear case with floral design"
3. "Let's checkout"
4. [Payment form appears]
5. Use test card: `4242 4242 4242 4242`

## 📖 Documentation

- **START_HERE.md** - Quick reference
- **CLEAN_SIMPLE_DONE.md** - Architecture details

## ⚠️ Known Limitations

- **Rate limiting**: Wait 30-60 seconds between rapid tests (AWS Bedrock default quota)
- **Test mode**: Stripe keys are for testing only
- **Local frontend**: For production, deploy to S3 + CloudFront

## 🚀 Next Steps for Production

1. Deploy frontend to S3 + CloudFront
2. Switch to production Stripe keys
3. Add DynamoDB for order persistence
4. Request Bedrock quota increase
5. Add custom domain

## 🛠️ Development

**Rebuild after changes**:
```bash
cd infrastructure
bash package-for-ui.sh
# Upload new casetify-lambda.zip to Lambda
```

**View logs**:
CloudWatch → Log groups → /aws/lambda/casetify-bedrock-chat-us

## 💰 Cost Estimate

**POC/Demo**: ~$5-10/month  
**Production** (1000 users/day): ~$150-200/month

## ✅ Status

- ✅ Core functionality working
- ✅ AI conversation flow
- ✅ Product browsing
- ✅ Embedded payments
- ✅ Order creation
- ⏳ Rate limits (US-EAST-1 default quotas)

---

**Built with AWS Bedrock, Stripe, and MCP**
