import { getCapturedTemplatePath } from './session-manager';
import { parseResponse } from './response-parser';
import fs from 'fs';
import crypto from 'crypto';

import { translateChatGPT } from './providers/chatgpt';
import { translateAIStudio } from './providers/aistudio';

function getCookieValue(cookieStr: string, name: string): string {
  const matches = cookieStr.match(new RegExp(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`));
  return matches ? matches[2] : '';
}

function generateSapisidHash(sapisid: string, origin: string): string {
  const time = Math.round(Date.now() / 1000);
  const sha1 = crypto.createHash('sha1').update(`${time} ${sapisid} ${origin}`).digest('hex');
  return `${time}_${sha1}`;
}

// Replays a captured request directly using Node's native fetch.
export async function replayRequest(providerId: string, prompt: string): Promise<string> {
  if (providerId === 'chatgpt') {
    const rawResult = await translateChatGPT(prompt);
    return parseResponse(rawResult, providerId);
  }

  if (providerId === 'aistudio') {
    const rawResult = await translateAIStudio(prompt);
    return parseResponse(rawResult, providerId);
  }

  const templatePath = getCapturedTemplatePath(providerId);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`No captured session template found for provider: ${providerId}`);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  // AI Studio dynamic SAPISIDHASH authorization updates to bypass 401 expired signature errors
  if (providerId === 'aistudio') {
    const cookieStr = template.headers['cookie'] || '';
    let sapisid = getCookieValue(cookieStr, 'SAPISID');
    if (!sapisid) {
      sapisid = getCookieValue(cookieStr, '__Secure-3PAPISID');
    }
    if (sapisid) {
      // Extract dynamic origin from referer header (Google sandbox domains like aistudio.google-b197145817.com)
      const referer = template.headers['referer'] || 'https://aistudio.google.com';
      let origin = 'https://aistudio.google.com';
      try {
        const urlObj = new URL(referer);
        origin = urlObj.origin;
      } catch (e) {}

      const freshHash = generateSapisidHash(sapisid, origin);
      template.headers['authorization'] = `SAPISIDHASH ${freshHash} SAPISID1PHASH ${freshHash} SAPISID3PHASH ${freshHash}`;
      console.log(`[AISTUDIO] Automatically generated fresh authorization SAPISIDHASH signature with origin: ${origin}`);
    } else {
      console.warn('[AISTUDIO] WARNING: SAPISID/3PAPISID cookie was not found in captured template. Replay might return 401.');
    }
  }

  let requestBody = template.body;

  // Check if body is URL-encoded or JSON to handle proper escaping
  const contentType = (template.headers['content-type'] || '').toLowerCase();
  const isUrlEncoded = contentType.includes('application/x-www-form-urlencoded') || requestBody.includes('f.req=');

  if (isUrlEncoded) {
    try {
      const params = new URLSearchParams(requestBody);
      const fReq = params.get('f.req');
      if (fReq) {
        // Gemini's double-JSON format
        const outer = JSON.parse(fReq);
        const inner = JSON.parse(outer[1]);
        inner[0][0] = prompt;
        outer[1] = JSON.stringify(inner);
        params.set('f.req', JSON.stringify(outer));
        requestBody = params.toString();
      } else {
        // Generic URL-encoded body: replace in all matching parameters
        for (const key of params.keys()) {
          const val = params.get(key) || '';
          if (val.includes('TRANSLATE_ME')) {
            params.set(key, val.split('TRANSLATE_ME').join(prompt));
          }
        }
        requestBody = params.toString();
      }
    } catch (e) {
      requestBody = requestBody.split('TRANSLATE_ME').join(encodeURIComponent(prompt));
    }
  } else {
    try {
      // Check if body is JSON
      const parsed = JSON.parse(requestBody);

      // Custom handling for Qwen/OpenAI-like chat messages structures
      if (providerId === 'qwen' && parsed.messages && Array.isArray(parsed.messages)) {
        const userMessages = parsed.messages.filter((m: any) => m.role === 'user');
        if (userMessages.length > 0) {
          userMessages[userMessages.length - 1].content = prompt;
        }
        requestBody = JSON.stringify(parsed);
      } else {
        const replaceInJson = (obj: any): any => {
          if (typeof obj === 'string') {
            return obj.split('TRANSLATE_ME').join(prompt);
          }
          if (Array.isArray(obj)) {
            return obj.map(replaceInJson);
          }
          if (obj !== null && typeof obj === 'object') {
            const res: any = {};
            for (const key of Object.keys(obj)) {
              res[key] = replaceInJson(obj[key]);
            }
            return res;
          }
          return obj;
        };
        const updated = replaceInJson(parsed);
        requestBody = JSON.stringify(updated);
      }
    } catch {
      requestBody = requestBody.split('TRANSLATE_ME').join(prompt);
    }
  }

  console.log(`[REPLAY] Replaying captured request directly via HTTPS fetch to: ${template.url}`);

  const response = await fetch(template.url, {
    method: template.method,
    headers: template.headers as Record<string, string>,
    body: requestBody
  });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} - ${await response.text()}`);
  }

  const resultText = await response.text();
  console.log(`[REPLAY] Replay request finished successfully.`);
  return parseResponse(resultText, providerId);
}

