#!/bin/bash

set -e

echo "🚀 Casetify AI Concierge - AWS Deployment Script"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ SAM CLI not found. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}\n"

# Build MCP Server
echo -e "${BLUE}📦 Building MCP Server...${NC}"
cd ../mcp-server
npm run build
echo -e "${GREEN}✅ MCP Server built${NC}\n"

# Build AWS Backend
echo -e "${BLUE}📦 Building AWS Backend...${NC}"
cd ../aws-backend
npm install
npm run build
echo -e "${GREEN}✅ AWS Backend built${NC}\n"

# Copy MCP Server into Lambda package
echo -e "${BLUE}📦 Packaging MCP Server with Lambda...${NC}"
cd ../aws-backend
mkdir -p dist/mcp-server
cp -r ../mcp-server/build/* dist/mcp-server/
cp ../mcp-server/package.json dist/mcp-server/
cd dist/mcp-server
npm install --production --silent
cd ../..
echo -e "${GREEN}✅ MCP Server packaged${NC}\n"

# Deploy with SAM
echo -e "${BLUE}🚀 Deploying to AWS...${NC}"
cd ../infrastructure

# Check if samconfig.toml exists
if [ -f samconfig.toml ]; then
    echo "Using existing SAM configuration..."
    sam build && sam deploy
else
    echo "First time deployment - guided mode..."
    sam build && sam deploy --guided
fi

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Deployment successful!${NC}\n"
    
    # Get API endpoint
    echo -e "${BLUE}📡 Getting API endpoint...${NC}"
    API_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name casetify-ai-concierge \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
        --output text 2>/dev/null)
    
    if [ -n "$API_ENDPOINT" ]; then
        echo -e "${GREEN}✅ API Endpoint: ${API_ENDPOINT}${NC}\n"
        echo -e "${BLUE}📝 Next steps:${NC}"
        echo "1. Update chat-frontend/index.html with this API endpoint:"
        echo "   const API_ENDPOINT = '${API_ENDPOINT}';"
        echo ""
        echo "2. Start the chat frontend:"
        echo "   cd chat-frontend && npm start"
        echo ""
        echo "3. Open http://localhost:3001 and test!"
        echo ""
    fi
else
    echo -e "\n${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 All done!${NC}"

