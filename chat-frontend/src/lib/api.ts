import type { ApiResponse, ConversationTurn } from './types';

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || '';

export async function sendMessage(
  message: string,
  conversationHistory: ConversationTurn[]
): Promise<ApiResponse> {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationHistory }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
