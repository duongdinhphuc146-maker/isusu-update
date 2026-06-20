/**
 * Response Parser Utility
 * Extracts translation array JSON from raw provider HTTP responses.
 */
export function parseResponse(rawText: string, providerId: string): string {
  let cleaned = rawText.trim();
  
  // If provider is qwen, parse the SSE streamed lines first
  if (providerId === 'qwen') {
    let accumulatedText = '';
    const lines = cleaned.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr) {
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              accumulatedText += content;
            }
          } catch (e) {
            // Ignore parsing errors of individual lines
          }
        }
      }
    }
    if (accumulatedText) {
      cleaned = accumulatedText.trim();
    }
  }

  // If provider is gemini, apply boq parsing first
  if (providerId === 'gemini') {
    const lines = cleaned.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[[') || trimmed.startsWith('[')) {
        try {
          const arr = JSON.parse(trimmed);
          for (const item of arr) {
            if (item[0] === 'wrb.fr' && typeof item[2] === 'string') {
              const inner = JSON.parse(item[2]);
              const scan = (obj: any): string | null => {
                if (typeof obj === 'string') {
                  if (obj.includes('translations')) return obj;
                }
                if (Array.isArray(obj)) {
                  for (const x of obj) {
                    const res = scan(x);
                    if (res) return res;
                  }
                }
                return null;
              };
              const found = scan(inner);
              if (found) {
                cleaned = found.trim();
                break;
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  }

  // 1. Try our highly-robust Regex parser to extract {"id": N, "text": "..."} elements
  // even if they have unescaped quotes inside the text field!
  const list: Array<{ id: number; text: string }> = [];
  const regex = /\{\s*["']?id["']?\s*:\s*(\d+)\s*,\s*["']?text["']?\s*:\s*["']([\s\S]*?)["']\s*\}\s*(?=,\s*\{\s*["']?id["']?\s*:|\]|\})/gi;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const id = parseInt(match[1], 10);
    const text = match[2].trim();
    list.push({ id, text });
  }

  if (list.length > 0) {
    return JSON.stringify({ translations: list });
  }

  // Fallback regex searching if array parsing didn't find it (escaped JSON)
  if (providerId === 'gemini') {
    const regexEscaped = /\\"?\{\s*\\"?translations\\"?\s*:\s*\[[\s\S]*?\]\s*\\"?\}/g;
    const matchEscaped = rawText.match(regexEscaped);
    if (matchEscaped) {
      try {
        let rawMatch = matchEscaped[matchEscaped.length - 1];
        rawMatch = rawMatch.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        return rawMatch;
      } catch (e) {}
    }
  }

  // Fallback for ChatGPT, Qwen, Minimax, or if Gemini parsed failed:
  // Look for any raw JSON structure containing "translations"
  const regexRaw = /\{\s*"translations"\s*:\s*\[[\s\S]*?\]\s*\}/g;
  const matchRaw = rawText.match(regexRaw);
  if (matchRaw) {
    return matchRaw[matchRaw.length - 1];
  }

  return rawText;
}
