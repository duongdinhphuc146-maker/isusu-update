const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const USER_DATA_DIR = path.resolve('C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions');
const profileDir = path.join(USER_DATA_DIR, 'aistudio-profile');
const templatePath = path.join(USER_DATA_DIR, 'aistudio_captured.json');
const AI_STUDIO_URL = 'https://aistudio.google.com/prompts/new_chat';

const STEALTH_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--lang=vi-VN,vi,en-US,en',
  '--hide-crash-restore-bubble',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--disable-software-rasterizer'
];

function getCookieValue(cookieStr, name) {
  const matches = cookieStr.match(new RegExp(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`));
  return matches ? matches[2] : '';
}

function generateSapisidHash(sapisid, origin) {
  const time = Math.round(Date.now() / 1000);
  const sha1 = crypto.createHash('sha1').update(`${time} ${sapisid} ${origin}`).digest('hex');
  return `${time}_${sha1}`;
}

function cleanAndFilterCookies(cookiesList, requestUrl) {
  try {
    const urlObj = new URL(requestUrl);
    const host = urlObj.hostname;
    const cookieMap = new Map();
    for (const c of cookiesList) {
      const domain = c.domain || '';
      if (domain === '.google.com' || host.endsWith(domain)) {
        if (!cookieMap.has(c.name) || domain === '.google.com') {
          cookieMap.set(c.name, c.value);
        }
      }
    }
    return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  } catch (e) {
    return cookiesList.map(c => `${c.name}=${c.value}`).join('; ');
  }
}

async function runAutoCapture() {
  console.log(`[TEST] Launching browser to auto-capture AI Studio session...`);
  console.log(`[TEST] Profile directory: ${profileDir}`);

  // Clear SingletonLock first
  const lockFile = path.join(profileDir, 'SingletonLock');
  if (fs.existsSync(lockFile)) {
    try { fs.unlinkSync(lockFile); } catch(_) {}
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false, // Let user see browser
    channel: 'chrome',
    args: STEALTH_LAUNCH_ARGS,
    ignoreDefaultArgs: ['--enable-automation']
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    page.on('console', msg => console.log(`[BROWSER-CONSOLE] ${msg.text()}`));
    
    let capturedRequest = null;

    page.on('request', async (request) => {
      try {
        const url = request.url();
        const method = request.method();
        
        if (method === 'POST') {
          console.log(`[TEST-DEBUG-REQUEST] POST: ${url}`);
        }

        if (request.method() === 'POST' && (url.includes('MakerSuiteService/CreatePrompt') || url.includes('generateContent') || url.includes('alkalimakersuite'))) {
          const body = request.postData() || '';
          console.log(`[TEST] Found matching prompt request: ${url}`);
          console.log(`[TEST-HEADERS] Headers:`, JSON.stringify(request.headers(), null, 2));
          
          const cookies = await context.cookies();
          const cookieHeader = cleanAndFilterCookies(cookies, url);

          // Get filtered cookies array
          let filteredCookies = [];
          try {
            const urlObj = new URL(url);
            const host = urlObj.hostname;
            const cookieMap = new Map();
            for (const c of cookies) {
              const domain = c.domain || '';
              if (domain === '.google.com' || host.endsWith(domain)) {
                if (!cookieMap.has(c.name) || domain === '.google.com') {
                  cookieMap.set(c.name, c);
                }
              }
            }
            filteredCookies = Array.from(cookieMap.values());
          } catch (e) {
            filteredCookies = cookies;
          }

          const parsed = JSON.parse(body);
          const replaceUserMsgWithPlaceholder = (obj) => {
            if (Array.isArray(obj)) {
              if (obj.length >= 9 && typeof obj[0] === 'string' && obj[8] === 'user') {
                obj[0] = 'TRANSLATE_ME';
                return true;
              }
              for (let i = 0; i < obj.length; i++) {
                if (replaceUserMsgWithPlaceholder(obj[i])) return true;
              }
            } else if (obj !== null && typeof obj === 'object') {
              for (const key of Object.keys(obj)) {
                if (replaceUserMsgWithPlaceholder(obj[key])) return true;
              }
            }
            return false;
          };
          replaceUserMsgWithPlaceholder(parsed);

          capturedRequest = {
            url: url,
            method: request.method(),
            headers: {
              ...request.headers(),
              'cookie': cookieHeader
            },
            cookies: filteredCookies,
            body: JSON.stringify(parsed)
          };
          console.log('[TEST] Request successfully prepared with fresh cookies!');
        }
      } catch (e) {
        console.error('[TEST] Error intercepting request:', e);
      }
    });

    console.log('[TEST] Navigating to Google AI Studio...');
    await page.goto(AI_STUDIO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the input box
    console.log('[TEST] Waiting for chat input box...');
    const inputSelector = 'textarea[placeholder*="Start typing a prompt"]';
    const inputLoc = page.locator(inputSelector).first();
    try {
      await inputLoc.waitFor({ state: 'visible', timeout: 15000 });
    } catch (err) {
      console.log('[TEST] Timeout waiting for input box. Taking screenshot for debug...');
      await page.screenshot({ path: path.resolve('C:/Users/ASUS ROD/Downloads/Capcut tool/services/ai-translate-bridge/screenshot.png') });
      console.log('[TEST] Screenshot saved to screenshot.png');
      throw err;
    }

    console.log('[TEST] Typing test prompt...');
    await inputLoc.click();
    await inputLoc.fill('Translate target "Hello, testing system auto replay" to Vietnamese.');
    await page.waitForTimeout(500);

    console.log('[TEST] Pressing Ctrl+Enter to run...');
    await page.keyboard.press('Control+Enter');

    // Wait up to 10 seconds for the request to get captured
    for (let i = 0; i < 20; i++) {
      if (capturedRequest) break;
      await page.waitForTimeout(500);
    }

    if (capturedRequest) {
      // Clean headers
      const cleanedHeaders = { ...capturedRequest.headers };
      delete cleanedHeaders['content-length'];
      delete cleanedHeaders['host'];
      delete cleanedHeaders['connection'];
      delete cleanedHeaders['content-encoding'];

      fs.writeFileSync(templatePath, JSON.stringify({
        url: capturedRequest.url,
        method: capturedRequest.method,
        headers: cleanedHeaders,
        cookies: capturedRequest.cookies,
        body: capturedRequest.body
      }, null, 2), 'utf8');
      console.log(`[TEST] SUCCESS! Captured session saved to: ${templatePath}`);
      
      // Perform immediate Replay test inside the Chromium page context
      console.log('[TEST] Testing HTTP request replay inside browser context...');
      const sapisid = getCookieValue(cleanedHeaders.cookie, 'SAPISID') || getCookieValue(cleanedHeaders.cookie, '__Secure-3PAPISID');
      let authHeader = '';
      if (sapisid) {
        const pageUrl = page.url();
        let origin = 'https://aistudio.google.com';
        try {
          const urlObj = new URL(pageUrl);
          origin = urlObj.origin;
        } catch (e) {}

        const freshHash = generateSapisidHash(sapisid, origin);
        authHeader = `SAPISIDHASH ${freshHash} SAPISID1PHASH ${freshHash} SAPISID3PHASH ${freshHash}`;
        console.log(`[TEST] Generated dynamic SAPISIDHASH signature with origin: ${origin}`);
      }

      const testPrompt = '{"translations": [{"id": 1, "text": "Hello, how are you today?"}]}';
      const requestBody = JSON.parse(capturedRequest.body.replace('TRANSLATE_ME', testPrompt));

      console.log('[TEST] Finding the sandboxed iframe recursively...');
      function printFramesRecursively(frame, indent = '') {
        console.log(`${indent}- Frame: name="${frame.name()}", url="${frame.url()}"`);
        for (const child of frame.childFrames()) {
          printFramesRecursively(child, indent + '  ');
        }
      }
      printFramesRecursively(page.mainFrame());

      let targetFrame = page;
      const findTargetFrame = (frame) => {
        if (frame.url().includes('google-b197145817') || frame.url().includes('aistudio.google-') || frame.name().includes('sandbox')) {
          return frame;
        }
        for (const child of frame.childFrames()) {
          const found = findTargetFrame(child);
          if (found) return found;
        }
        return null;
      };
      const foundFrame = findTargetFrame(page.mainFrame());
      if (foundFrame) {
        targetFrame = foundFrame;
        console.log(`[TEST] Selected target frame: name="${targetFrame.name()}", url="${targetFrame.url()}"`);
      }

      console.log('[TEST] Sending Fetch Replay request inside target frame context...');
      try {
        const replayResult = await targetFrame.evaluate(async ({ apiUrl, method, headers, bodyData, authHeaderVal }) => {
          console.log("TEST EVALUATING FETCH inside browser context.");
          console.log("TEST EVALUATING cookies:", document.cookie);
          const requestHeaders = {
            'content-type': 'application/json+protobuf',
            'x-user-agent': 'grpc-web-javascript/0.1'
          };
          for (const key of Object.keys(headers)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.startsWith('x-goog-') || lowerKey.startsWith('x-aistudio-')) {
              requestHeaders[lowerKey] = headers[key];
            }
          }
          if (authHeaderVal) {
            requestHeaders['authorization'] = authHeaderVal;
          }
          const response = await fetch(apiUrl, {
            method: method,
            headers: requestHeaders,
            body: JSON.stringify(bodyData),
            credentials: 'include'
          });
          if (!response.ok) {
            throw new Error(`Browser fetch failed: ${response.status} - ${await response.text()}`);
          }
          return await response.text();
        }, {
          apiUrl: capturedRequest.url,
          method: capturedRequest.method,
          headers: cleanedHeaders,
          bodyData: requestBody,
          authHeaderVal: authHeader
        });
        console.log('[TEST] Replay Response:', replayResult.substring(0, 500));
        console.log('[TEST] ALL TESTS PASSED SUCCESSFULLY! HTTPS Replay is functional.');
      } catch (replayErr) {
        console.error('[TEST] Replay failed:', replayErr);
      }
    } else {
      console.error('[TEST] FAILED: Request was not captured. Are you logged in?');
    }

  } finally {
    await context.close();
  }
}

runAutoCapture().catch(console.error);
