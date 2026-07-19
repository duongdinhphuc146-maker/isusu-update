import { chromium, BrowserContext } from 'playwright';
import { getSessionProfilePath, getCapturedTemplatePath } from './session-manager';
import { PROVIDERS } from './providers/configs';
import { STEALTH_LAUNCH_ARGS, applyStealth } from './stealth';
import fs from 'fs';
import path from 'path';

let currentContext: BrowserContext | null = null;
let lastCapturedRequest: any = null;
let capturingProviderId: string | null = null;

function filterCookiesArray(cookiesList: any[], requestUrl: string): any[] {
  try {
    const host = new URL(requestUrl).hostname;
    const cookieMap = new Map<string, any>();
    for (const c of cookiesList) {
      const domain = c.domain || '';
      if (domain === '.google.com' || host.endsWith(domain)) {
        if (!cookieMap.has(c.name) || domain === '.google.com') cookieMap.set(c.name, c);
      }
    }
    return Array.from(cookieMap.values());
  } catch (e) {
    return cookiesList;
  }
}

const setupPageListeners = (p: any, providerId: string) => {
  p.on('request', async (request: any) => {
    try {
      if (request.method() !== 'POST') return;
      const url = request.url();
      const body = request.postData() || '';
      const postBuffer = request.postDataBuffer();
      const contentType = (request.headers()['content-type'] || '').toLowerCase();

      let isMatching = false;
      let modifiedBody = body;
      let bodyFormat = 'utf8';

      if (url.includes('baidu.com') || url.includes('paddleocr') || url.includes('baidubce.com') || url.includes('bcebos.com')) {
        console.log(`[CAPTURE-DEBUG] Method: ${request.method()} | URL: ${url} | Content-Type: ${contentType} | Size: ${postBuffer?.length || 0}`);
      }

      // OCR Providers: match files (>1KB or multipart) from target domains
      if (providerId === 'baidu-paddleocr' && (url.includes('baidu.com') || url.includes('paddleocr') || url.includes('baidubce.com') || url.includes('bcebos.com'))) {
        if (contentType.includes('multipart/form-data') || (postBuffer && postBuffer.length > 1000)) {
          isMatching = true;
          if (postBuffer) {
            modifiedBody = postBuffer.toString('base64');
            bodyFormat = 'base64';
          }
        }
      } else if (providerId === 'z-ai-ocr' && (url.includes('z.ai') || url.includes('zalo'))) {
        if (contentType.includes('multipart/form-data') || (postBuffer && postBuffer.length > 1000)) {
          isMatching = true;
          if (postBuffer) {
            modifiedBody = postBuffer.toString('base64');
            bodyFormat = 'base64';
          }
        }
      } else if (providerId === 'aistudio' && url.includes('MakerSuiteService/CreatePrompt')) {
        isMatching = true;
        try {
          const parsed = JSON.parse(body);
          const replaceUserMsg = (obj: any): boolean => {
            if (Array.isArray(obj)) {
              if (obj.length >= 9 && typeof obj[0] === 'string' && obj[8] === 'user') {
                obj[0] = 'TRANSLATE_ME';
                return true;
              }
              for (let i = 0; i < obj.length; i++) if (replaceUserMsg(obj[i])) return true;
            } else if (obj !== null && typeof obj === 'object') {
              for (const key of Object.keys(obj)) if (replaceUserMsg(obj[key])) return true;
            }
            return false;
          };
          replaceUserMsg(parsed);
          modifiedBody = JSON.stringify(parsed);
        } catch (e) {
          console.warn('[CAPTURE] Failed to parse AI Studio JSON body, capturing raw.');
        }
      } else if (body.includes('TRANSLATE_ME')) {
        isMatching = true;
      }

      if (isMatching) {
        console.log(`[CAPTURE] Intercepted matching request for ${providerId}:`, url);
        let filteredCookies: any[] = [];
        if (currentContext) {
          try {
            filteredCookies = filterCookiesArray(await currentContext.cookies(), url);
          } catch (_) {}
        }
        lastCapturedRequest = {
          url,
          method: request.method(),
          headers: request.headers(),
          cookies: filteredCookies,
          body: modifiedBody,
          bodyFormat
        };
      }
    } catch (_) {}
  });
};

export async function startCapture(providerId: string): Promise<void> {
  if (currentContext) await stopCapture();
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  capturingProviderId = providerId;
  lastCapturedRequest = null;
  const profileDir = getSessionProfilePath(providerId);
  const launchArgs = ['--start-maximized', '--disable-gpu', '--disable-software-rasterizer', ...STEALTH_LAUNCH_ARGS];

  try {
    currentContext = await chromium.launchPersistentContext(profileDir, {
      headless: false, channel: 'chrome', args: launchArgs, ignoreDefaultArgs: ['--enable-automation'], viewport: null
    });
  } catch (err) {
    console.warn('[CAPTURE] Falling back to default Chromium:', err);
    const lockFile = path.join(profileDir, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
      try { fs.unlinkSync(lockFile); } catch(_) {}
    }
    currentContext = await chromium.launchPersistentContext(profileDir, {
      headless: false, args: launchArgs, ignoreDefaultArgs: ['--enable-automation'], viewport: null
    });
  }

  await applyStealth(currentContext);
  currentContext.on('page', async (p) => setupPageListeners(p, providerId));
  const page = currentContext.pages()[0] || await currentContext.newPage();
  await applyStealth(page);
  setupPageListeners(page, providerId);
  await page.goto(provider.url);
}

export async function stopCapture(): Promise<{ success: boolean; requestCaptured: boolean; error?: string }> {
  if (!currentContext || !capturingProviderId) {
    return { success: false, requestCaptured: false, error: 'No active capture session' };
  }
  const providerId = capturingProviderId;
  try {
    await currentContext.close();
  } catch (e: any) {
    console.error('[CAPTURE] Error closing context', e);
  } finally {
    currentContext = null;
    capturingProviderId = null;
  }

  if (lastCapturedRequest) {
    const templatePath = getCapturedTemplatePath(providerId);
    const cleanedHeaders = { ...lastCapturedRequest.headers };
    delete cleanedHeaders['content-length'];
    delete cleanedHeaders['host'];
    delete cleanedHeaders['connection'];
    delete cleanedHeaders['content-encoding'];

    const templateData = {
      url: lastCapturedRequest.url,
      method: lastCapturedRequest.method,
      headers: cleanedHeaders,
      cookies: lastCapturedRequest.cookies,
      body: lastCapturedRequest.body,
      bodyFormat: lastCapturedRequest.bodyFormat || 'utf8'
    };

    fs.writeFileSync(templatePath, JSON.stringify(templateData, null, 2), 'utf8');
    console.log(`[CAPTURE] Saved request template to: ${templatePath}`);
    return { success: true, requestCaptured: true };
  }
  return { success: true, requestCaptured: false };
}
