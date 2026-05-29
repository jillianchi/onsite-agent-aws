export interface ProductSummary {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  category?: string | null;
  options?: {
    models?: string[];
    colors?: string[];
    designCategories?: string[];
  };
}

export interface ProductConfig {
  configId: string;
  productId: string;
  productName: string;
  model?: string | null;
  color?: string | null;
  designCategory?: string | null;
  customText?: string | null;
  price: number;
  imageUrl?: string | null;
  category?: string | null;
}

export interface PaymentData {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  product: {
    configId: string;
    productId: string;
    productName: string;
    price: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  paymentData?: PaymentData;
  productConfig?: ProductConfig;
  productList?: ProductSummary[];
}

export interface ApiResponse {
  message: string;
  conversationHistory: ConversationTurn[];
  config?: ProductConfig;
  paymentData?: PaymentData;
  requiresPayment?: boolean;
  productList?: ProductSummary[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: { text: string }[];
}
