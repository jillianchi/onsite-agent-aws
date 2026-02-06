#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "📦 Creating Lambda Package for AWS Console Upload"
echo "================================================="
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd "$SCRIPT_DIR"
rm -rf lambda-package
rm -f casetify-lambda.zip

# Build AWS Backend
echo "📦 Building AWS Backend..."
cd "$PROJECT_ROOT/aws-backend"
npm install
npm run build

# Create package directory
cd "$SCRIPT_DIR"
mkdir -p lambda-package

# Copy backend
echo "📦 Packaging backend..."
cp -r "$PROJECT_ROOT/aws-backend/dist/"* lambda-package/
cp "$PROJECT_ROOT/aws-backend/package.json" lambda-package/
cd lambda-package
npm install --production --silent

# Copy MCP Server
echo "📦 Packaging MCP Server..."
cd "$SCRIPT_DIR"
mkdir -p lambda-package/mcp-server
cp -r "$PROJECT_ROOT/mcp-server/build/"* lambda-package/mcp-server/
cp "$PROJECT_ROOT/mcp-server/package.json" lambda-package/mcp-server/
cd lambda-package/mcp-server
npm install --production --silent

# Create ZIP
echo "🗜️  Creating ZIP file..."
cd "$SCRIPT_DIR/lambda-package"
zip -r -q ../casetify-lambda.zip .
cd "$SCRIPT_DIR"

rm -rf lambda-package

# Get file size
SIZE=$(du -h casetify-lambda.zip | cut -f1)

echo ""
echo "✅ Package created successfully!"
echo "📦 File: $SCRIPT_DIR/casetify-lambda.zip"
echo "📊 Size: $SIZE"
echo ""
echo "📋 Next steps:"
echo "1. Go to AWS Lambda Console"
echo "2. Select your function: casetify-bedrock-chat"
echo "3. Upload casetify-lambda.zip"
echo "4. Set Handler to: bedrock-handler.handler"
echo ""

