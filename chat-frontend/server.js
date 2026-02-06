import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001; // Changed to avoid conflict with demo-frontend

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve the chat widget
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Chat endpoint - proxies to Bedrock Lambda (simulated for local dev)
app.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    console.log('Received message:', message);

    // Simulate Bedrock response for local testing
    // Note: In production, frontend calls API Gateway directly
    const aiResponse = simulateBedrockResponse(message, conversationHistory);
    
    res.json(aiResponse);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Simulate Bedrock AI response for local development
function simulateBedrockResponse(message, history) {
  const lowerMessage = message.toLowerCase();

  // Simple state machine for demo
  if (lowerMessage.includes('iphone') || lowerMessage.includes('samsung')) {
    return {
      message: "Great choice! Now, what type of case are you looking for? We have:\n• Clear Case ($29.99)\n• Ultra Impact Case ($44.99)\n• Leather Case ($54.99)\n• Mirror Case ($39.99)",
      conversationHistory: history
    };
  }

  if (lowerMessage.includes('clear') || lowerMessage.includes('impact') || lowerMessage.includes('leather') || lowerMessage.includes('mirror')) {
    return {
      message: "Perfect! What kind of design would you like? We offer:\n• Floral\n• Abstract\n• Animals\n• Custom Photo\n• Solid Colors\n• Patterns",
      conversationHistory: history
    };
  }

  if (lowerMessage.includes('floral') || lowerMessage.includes('abstract') || lowerMessage.includes('animal') || lowerMessage.includes('photo') || lowerMessage.includes('color') || lowerMessage.includes('pattern')) {
    // Simulate payment intent creation
    return {
      message: "Excellent choice! Your custom case will be $29.99. Ready to checkout?",
      conversationHistory: history,
      requiresPayment: true,
      paymentData: {
        clientSecret: "pi_test_secret_placeholder",
        amount: 29.99,
        currency: "usd",
        product: {
          phoneModel: "iPhone 15",
          caseType: "Clear",
          designCategory: "Floral"
        }
      }
    };
  }

  // Default response
  return {
    message: "I'm here to help you design your perfect phone case! Let's start with your phone model. Do you have an iPhone or Samsung?",
    conversationHistory: history
  };
}

app.listen(PORT, () => {
  console.log(`\n🚀 Casetify Chat Frontend running at http://localhost:${PORT}`);
  console.log(`📱 Open your browser to test the chat interface`);
  console.log(`\n⚠️  Note: This is local dev mode with simulated AI responses`);
  console.log(`   For full functionality, deploy to AWS with Bedrock integration\n`);
});

