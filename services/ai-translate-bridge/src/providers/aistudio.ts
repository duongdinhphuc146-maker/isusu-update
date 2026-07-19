import { chromium } from 'playwright';
import { getSessionProfilePath } from '../session-manager';
import { STEALTH_LAUNCH_ARGS, applyStealth } from '../stealth';
import crypto from 'crypto';
import fs from 'fs';

const AI_STUDIO_URL = 'https://aistudio.google.com/';

function generateSapisidHash(sapisid: string, origin: string): string {
  const time = Math.round(Date.now() / 1000);
  const sha1 = crypto.createHash('sha1').update(`${time} ${sapisid} ${origin}`).digest('hex');
  return `${time}_${sha1}`;
}

/**
 * Translates via Google AI Studio by executing a direct API fetch inside a headless Chromium instance.
 * This combines the reliability of Browser Session (proper HTTP/2, auto-managed cookies, dynamic SAPISIDHASH)
 * with the speed and stability of API Request (no UI automation, no selector failures, 100% headless).
 */
export async function translateAIStudio(prompt: string): Promise<string> {
  const profileDir = getSessionProfilePath('aistudio');

  console.log(`[AISTUDIO] Headless Browser API mode. Profile: ${profileDir}`);

  // Launch Chromium in silent headless mode
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    channel: 'chrome',
    args: [
      ...STEALTH_LAUNCH_ARGS,
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  await applyStealth(context);

  try {
    // Read and inject cookies from the captured session template
    const { getCapturedTemplatePath } = require('../session-manager');
    const templatePath = getCapturedTemplatePath('aistudio');
    let capturedCookies: any[] = [];
    let templateHeaders: Record<string, string> = {};

    if (fs.existsSync(templatePath)) {
      try {
        const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        templateHeaders = template.headers || {};
        if (template.cookies && Array.isArray(template.cookies)) {
          capturedCookies = template.cookies;
        } else {
          const cookieStr = template.headers['cookie'] || '';
          if (cookieStr) {
            capturedCookies = cookieStr.split(';').map((pair: string) => {
              const trimmed = pair.trim();
              if (!trimmed) return null;
              const eqIdx = trimmed.indexOf('=');
              if (eqIdx === -1) return null;
              const name = trimmed.substring(0, eqIdx).trim();
              const value = trimmed.substring(eqIdx + 1).trim();
              if (!name || !value) return null;
              
              // Strip wrapper quotes if they exist
              let cleanVal = value;
              if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
                cleanVal = cleanVal.substring(1, cleanVal.length - 1);
              }

              return {
                name,
                value: cleanVal,
                domain: '.google.com',
                path: '/'
              };
            }).filter(Boolean);
          }
        }
      } catch (e) {
        console.error('[AISTUDIO] Failed to parse captured cookies:', e);
      }
    }

    if (capturedCookies.length > 0) {
      await context.addCookies(capturedCookies);
      console.log(`[AISTUDIO] Injected ${capturedCookies.length} captured cookies into browser context.`);
    }

    const page = context.pages()[0] || await context.newPage();
    await applyStealth(page);

    console.log('[AISTUDIO] Navigating to Google AI Studio to restore credentials...');
    // We only need to load the page so that the browser context has the cookies and active session
    await page.goto(AI_STUDIO_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait a brief moment to ensure cookies are loaded
    await page.waitForTimeout(2000);

    // Get cookies to calculate SAPISIDHASH
    const cookies = await context.cookies();
    const sapisidCookie = cookies.find(c => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID');
    let authHeader = '';

    if (sapisidCookie) {
      const origin = 'https://aistudio.google.com';
      const freshHash = generateSapisidHash(sapisidCookie.value, origin);
      authHeader = `SAPISIDHASH ${freshHash} SAPISID1PHASH ${freshHash} SAPISID3PHASH ${freshHash}`;
      console.log('[AISTUDIO] Calculated dynamic SAPISIDHASH successfully.');
    } else {
      console.warn('[AISTUDIO] WARNING: SAPISID/3PAPISID cookie was not found in browser context. Fetch might fail.');
    }

    // Build the request body for GenerateContent API (Makersuite format)
    // This body matches Google's native protobuf format
    const requestBody = [
      "models/gemini-2.5-flash", // We use the official current Gemini 2.5 Flash model
      [[[[null, prompt]], "user"]],
      [[null, null, 7, 5], [null, null, 8, 5], [null, null, 9, 5], [null, null, 10, 5]],
      [null, null, null, 65536, 1, 0.75, 64, null, null, null, null, null, null, null, null, null, [1, null, null, 4]]
    ];

    console.log('[AISTUDIO] Executing native fetch inside the browser context...');
    
    const resultRaw = await page.evaluate(async ({ bodyData, authHeaderVal, templateHeadersVal }) => {
      const apiUrl = 'https://alkalimakersuite-pa.clients6.google.com/$rpc/google.internal.alkali.applications.makersuite.v1.MakerSuiteService/GenerateContent';
      
      // We read the x-goog-api-key dynamically from the page settings if possible, or fallback to the standard one
      let apiKey = 'AIzaSyDdP816MREB3SkjZO04QXbjsigfcI0GWOs';
      try {
        // Try to locate Google AI Studio's API Key from global variables or script tags
        const match = document.documentElement.innerHTML.match(/"API_KEY":"(AIzaSy[^"]+)"/);
        if (match) apiKey = match[1];
      } catch (e) {}

      const headers: Record<string, string> = {
        'content-type': 'application/json+protobuf',
        'x-user-agent': 'grpc-web-javascript/0.1'
      };

      // Dynamically copy all captured x-goog- and x-aistudio- headers
      for (const key of Object.keys(templateHeadersVal)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith('x-goog-') || lowerKey.startsWith('x-aistudio-')) {
          headers[lowerKey] = templateHeadersVal[key];
        }
      }

      // Ensure the correct/fresh API key and authuser index are set
      headers['x-goog-api-key'] = apiKey;
      if (!headers['x-goog-authuser']) {
        headers['x-goog-authuser'] = '0';
      }

      if (authHeaderVal) {
        headers['authorization'] = authHeaderVal;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(bodyData),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Browser fetch failed: ${response.status} - ${await response.text()}`);
      }

      return await response.text();
    }, { bodyData: requestBody, authHeaderVal: authHeader, templateHeadersVal: templateHeaders });

    console.log(`[AISTUDIO] API response received successfully (${resultRaw.length} chars).`);
    return resultRaw;

  } finally {
    await context.close();
  }
}
