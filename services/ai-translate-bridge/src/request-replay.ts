import { chromium } from 'playwright';
import { getSessionProfilePath, getCapturedTemplatePath } from './session-manager';
import { STEALTH_LAUNCH_ARGS, applyStealth } from './stealth';
import { parseResponse } from './response-parser';
import fs from 'fs';

// Replays a captured request using headless chromium with persistent context to preserve cookies and security headers.
export async function replayRequest(providerId: string, prompt: string): Promise<string> {

  const templatePath = getCapturedTemplatePath(providerId);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`No captured session template found for provider: ${providerId}`);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const profileDir = getSessionProfilePath(providerId);

  // Launch browser in headless mode with stealth args
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: [
      ...STEALTH_LAUNCH_ARGS,
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  await applyStealth(context);

  try {
    const page = context.pages()[0] || await context.newPage();
    await applyStealth(page);

    context.on('page', async (p) => {
      await applyStealth(p);
    });

    // Navigate to origin first to bind cookies and local storage
    const parsedURL = new URL(template.url);
    await page.goto(parsedURL.origin);

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

    console.log(`[REPLAY] Replaying captured request to: ${template.url}`);

    // Evaluate fetch in page context
    const resultText = await page.evaluate(async ({ url, method, headers, body }) => {
      const response = await fetch(url, {
        method,
        headers: headers as Record<string, string>,
        body
      });
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} - ${await response.text()}`);
      }
      return await response.text();
    }, {
      url: template.url,
      method: template.method,
      headers: template.headers,
      body: requestBody
    });

    console.log(`[REPLAY] Replay request finished successfully.`);
    return parseResponse(resultText, providerId);

  } finally {
    await context.close();
  }
}

