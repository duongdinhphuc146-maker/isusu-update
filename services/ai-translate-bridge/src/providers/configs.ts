export interface ProviderConfig {
  id: string;
  name: string;
  url: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com' },
  { id: 'qwen', name: 'Qwen AI', url: 'https://chat.qwen.ai' },
  { id: 'minimax', name: 'Minimax / Hailuo', url: 'https://hailuoai.video' },
  { id: 'aistudio', name: 'Google AI Studio', url: 'https://aistudio.google.com' },
  { id: 'z-ai', name: 'Z.ai', url: 'https://z.ai' },
  { id: 'baidu-paddleocr', name: 'Baidu PaddleOCR', url: 'https://aistudio.baidu.com/paddleocr' },
  { id: 'z-ai-ocr', name: 'Z.ai OCR', url: 'https://ocr.z.ai/' }
];

