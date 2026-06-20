import { chromium, BrowserContext } from 'playwright';
import { getSessionProfilePath, getCapturedTemplatePath } from './session-manager';
import { PROVIDERS } from './providers/configs';
import { STEALTH_LAUNCH_ARGS, applyStealth } from './stealth';
import fs from 'fs';

let currentContext: BrowserContext | null = null;
let lastCapturedRequest: any = null;
let capturingProviderId: string | null = null;

export async function startCapture(providerId: string): Promise<void> {
  if (currentContext) {
    await stopCapture();
  }

  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  capturingProviderId = providerId;
  lastCapturedRequest = null;

  const profileDir = getSessionProfilePath(providerId);

  // Launch Chromium in non-headless mode with stealth args
  currentContext = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      '--start-maximized',
      ...STEALTH_LAUNCH_ARGS
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: null
  });

  await applyStealth(currentContext);

  // Listen to new pages/popups to apply listeners automatically
  currentContext.on('page', async (p) => {
    setupPageListeners(p);
  });

  const setupPageListeners = (p: any) => {
    p.on('request', async (request: any) => {
      try {
        if (request.method() === 'POST') {
          const body = request.postData() || '';
          if (body.includes('TRANSLATE_ME')) {
            console.log(`[CAPTURE] Intercepted matching request for ${providerId}:`, request.url());
            lastCapturedRequest = {
              url: request.url(),
              method: request.method(),
              headers: request.headers(),
              body: body
            };
          }
        }
      } catch (e) {
        // Ignored: request might be aborted/cancelled
      }
    });
  };

  const page = currentContext.pages()[0] || await currentContext.newPage();
  await applyStealth(page);
  setupPageListeners(page);

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
    
    // Clean headers to let fetch handle connection/content length
    const cleanedHeaders = { ...lastCapturedRequest.headers };
    delete cleanedHeaders['content-length'];
    delete cleanedHeaders['host'];
    delete cleanedHeaders['connection'];
    delete cleanedHeaders['content-encoding'];

    const templateData = {
      url: lastCapturedRequest.url,
      method: lastCapturedRequest.method,
      headers: cleanedHeaders,
      body: lastCapturedRequest.body
    };

    fs.writeFileSync(templatePath, JSON.stringify(templateData, null, 2), 'utf8');
    console.log(`[CAPTURE] Successfully saved request template to: ${templatePath}`);
    return { success: true, requestCaptured: true };
  }

  console.log(`[CAPTURE] No request containing 'TRANSLATE_ME' was captured.`);
  return { success: true, requestCaptured: false };
}
