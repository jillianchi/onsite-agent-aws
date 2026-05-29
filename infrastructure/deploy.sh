#!/bin/bash

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Onsite Agent — Deployment Script${NC}"
echo "======================================"
echo ""

# ── Prerequisites ────────────────────────────────────────────────────────────

echo -e "${BLUE}Checking prerequisites...${NC}"
for cmd in aws sam node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}Error: '$cmd' not found. Please install it first.${NC}"
    exit 1
  fi
done
echo -e "${GREEN}Prerequisites OK${NC}\n"

# ── Pre-deploy: Stripe secret in SSM ─────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SSM_PARAM_PATH="/onsite-concierge/stripe-secret-key"
if ! aws ssm get-parameter --name "$SSM_PARAM_PATH" --with-decryption &>/dev/null; then
  echo -e "${YELLOW}Stripe secret key not found in SSM at: $SSM_PARAM_PATH${NC}"
  echo -e "Please create it first:\n"
  echo "  aws ssm put-parameter \\"
  echo "    --name \"$SSM_PARAM_PATH\" \\"
  echo "    --type SecureString \\"
  echo "    --value \"sk_test_YOUR_KEY_HERE\""
  echo ""
  exit 1
fi
echo -e "${GREEN}Stripe secret found in SSM${NC}\n"

# ── Build ────────────────────────────────────────────────────────────────────

echo -e "${BLUE}Building MCP server...${NC}"
cd ../mcp-server
npm install --silent
npm run build
echo -e "${GREEN}MCP server built${NC}\n"

echo -e "${BLUE}Building Lambda handler...${NC}"
cd ../aws-backend
npm install --silent
npm run build
cp package.json dist/
echo -e "${GREEN}Lambda handler built${NC}\n"

echo -e "${BLUE}Bundling MCP server into Lambda package...${NC}"
mkdir -p dist/mcp-server
cp -r ../mcp-server/build/* dist/mcp-server/
cp ../mcp-server/package.json dist/mcp-server/
# Bundle catalog.json so the MCP server can find it at runtime
[ -f ../mcp-server/catalog.json ] && cp ../mcp-server/catalog.json dist/mcp-server/
cd dist/mcp-server && npm install --production --silent
cd ../..
echo -e "${GREEN}MCP server bundled${NC}\n"

# ── SAM deploy ───────────────────────────────────────────────────────────────

cd ../infrastructure

echo -e "${BLUE}Deploying to AWS...${NC}"
sam build

if [ -f samconfig.toml ]; then
  sam deploy || { echo -e "${YELLOW}SAM: no infrastructure changes to deploy${NC}"; }
else
  sam deploy --guided
fi

echo -e "${GREEN}SAM deploy complete${NC}\n"

# ── Read CloudFormation outputs ───────────────────────────────────────────────

STACK_NAME=$(grep -m1 'stack_name' samconfig.toml 2>/dev/null | sed 's/.*= *"\(.*\)"/\1/' || echo "onsite-agent")

echo -e "${BLUE}Reading deployment outputs...${NC}"
get_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey==\`$1\`].OutputValue" \
    --output text
}

API_ENDPOINT=$(get_output "ApiEndpoint")
BUCKET_NAME=$(get_output "FrontendBucketName")
CF_DOMAIN=$(get_output "CloudFrontDomain")
STRIPE_PK=$(get_output "StripePublishableKey")
CF_DIST_ID=$(get_output "CloudFrontDistributionId")

# Use values passed directly from the wizard (most reliable), fall back to samconfig
MERCHANT_NAME="${DEPLOY_MERCHANT_NAME:-My Store}"
AI_PERSONA_NAME="${DEPLOY_PERSONA_NAME:-Alex}"
AI_PERSONA_DESCRIPTION="${DEPLOY_PERSONA_DESCRIPTION:-Your shopping assistant}"

echo -e "${GREEN}Outputs read${NC}\n"

# ── Build Next.js frontend ────────────────────────────────────────────────────

echo -e "${BLUE}Building frontend...${NC}"

# Extract quickPrompts from catalog.json for the frontend
QUICK_PROMPTS=""
if [ -f ../mcp-server/catalog.json ]; then
  QUICK_PROMPTS=$(node -e "
    const c = require('../mcp-server/catalog.json');
    process.stdout.write(JSON.stringify(c.quickPrompts || []));
  " 2>/dev/null || echo "[]")
fi

cd ../chat-frontend
rm -rf .next
npm install --silent

# Pass NEXT_PUBLIC_* directly as env vars so Next.js inlines them at build time
NEXT_PUBLIC_API_ENDPOINT="$API_ENDPOINT" \
NEXT_PUBLIC_STRIPE_PK="$STRIPE_PK" \
NEXT_PUBLIC_MERCHANT_NAME="$MERCHANT_NAME" \
NEXT_PUBLIC_AI_PERSONA_NAME="$AI_PERSONA_NAME" \
NEXT_PUBLIC_AI_PERSONA_DESCRIPTION="$AI_PERSONA_DESCRIPTION" \
NEXT_PUBLIC_QUICK_PROMPTS="$QUICK_PROMPTS" \
NODE_ENV=production npm run build

echo -e "${GREEN}Frontend built${NC}\n"
cd ../infrastructure

# ── Upload frontend to S3 ─────────────────────────────────────────────────────

echo -e "${BLUE}Uploading frontend to S3...${NC}"
aws s3 sync ../chat-frontend/out/ "s3://$BUCKET_NAME/" --delete

echo -e "${GREEN}Frontend uploaded${NC}\n"

# ── CloudFront invalidation ───────────────────────────────────────────────────

if [ -n "$CF_DIST_ID" ]; then
  echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
  aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text
  echo -e "${GREEN}Cache invalidated${NC}\n"
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo -e "${GREEN}======================================"
echo -e "Deployment complete!"
echo -e "======================================${NC}"
echo ""
echo -e "  Frontend: ${BLUE}${CF_DOMAIN}${NC}"
echo -e "  API:      ${BLUE}${API_ENDPOINT}${NC}"
echo ""
echo -e "${YELLOW}Note: CloudFront may take 1-2 minutes to propagate.${NC}"
echo ""
# Machine-readable summary for the setup UI
echo "INFRA_STACK=${STACK_NAME}"
echo "INFRA_FRONTEND=${CF_DOMAIN}"
echo "INFRA_API=${API_ENDPOINT}"
echo "INFRA_BUCKET=${BUCKET_NAME}"
echo "INFRA_LAMBDA=onsite-agent-${STACK_NAME}"
echo "INFRA_CF_ID=${CF_DIST_ID}"
