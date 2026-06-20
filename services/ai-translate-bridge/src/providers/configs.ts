export interface ProviderConfig {
  id: string;
  name: string;
  url: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com' },
  { id: 'qwen', name: 'Qwen AI', url: 'https://chat.qwen.ai' },
  { id: 'minimax', name: 'Minimax / Hailuo', url: 'https://hailuoai.video' }
];
