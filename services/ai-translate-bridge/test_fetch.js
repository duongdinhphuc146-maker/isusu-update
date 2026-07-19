const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const profileDir = 'C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions/aistudio-profile';
const templatePath = 'C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions/aistudio_captured.json';

function generateSapisidHash(sapisid, origin) {
  const time = Math.round(Date.now() / 1000);
  const sha1 = crypto.createHash('sha1').update(`${time} ${sapisid} ${origin}`).digest('hex');
  return `${time}_${sha1}`;
}

async function testFetch() {
  if (!fs.existsSync(templatePath)) {
    console.error('Captured template does not exist!');
    return;
  }
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  console.log('Launching browser...');
  try { fs.unlinkSync(path.join(profileDir, 'SingletonLock')); } catch(_) {}

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://aistudio.google.com/prompts/new_chat', { waitUntil: 'networkidle' });

  // Wait and submit prompt to load grandchild frame
  const inputSelector = 'textarea[placeholder*="Start typing a prompt"]';
  const inputLoc = page.locator(inputSelector).first();
  await inputLoc.waitFor({ state: 'visible', timeout: 20000 });
  await inputLoc.click();
  await inputLoc.fill('Translate target "Hello" to Vietnamese.');
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+Enter');

  console.log('Waiting 5 seconds for frames to load...');
  await page.waitForTimeout(5000);

  // Find bscframe and its grandchild
  const mainFrame = page.mainFrame();
  const bscFrame = mainFrame.childFrames().find(f => f.url().includes('bscframe'));
  let targetFrame = mainFrame;

  if (bscFrame) {
    console.log(`Found bscframe: ${bscFrame.url()}`);
    const grandchild = bscFrame.childFrames()[0];
    if (grandchild) {
      targetFrame = grandchild;
      console.log(`Found grandchild frame. url(): "${grandchild.url()}"`);
      try {
        const evalLoc = await grandchild.evaluate(() => window.location.href);
        const evalOrigin = await grandchild.evaluate(() => window.origin);
        console.log(`Grandchild evaluated location: "${evalLoc}", origin: "${evalOrigin}"`);
      } catch (e) {
        console.log(`Failed to evaluate grandchild frame: ${e.message}`);
      }
    } else {
      console.log('No grandchild frame found under bscframe.');
    }
  } else {
    console.log('bscframe not found.');
  }

  // Get active SAPISID cookie
  const cookies = await context.cookies();
  const sapisidCookie = cookies.find(c => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID');
  if (!sapisidCookie) {
    console.error('No SAPISID cookie found!');
    await context.close();
    return;
  }

  const origin = 'https://aistudio.google.com';
  const authHeader = `SAPISIDHASH ${generateSapisidHash(sapisidCookie.value, origin)} SAPISID1PHASH ${generateSapisidHash(sapisidCookie.value, origin)} SAPISID3PHASH ${generateSapisidHash(sapisidCookie.value, origin)}`;

  console.log(`\nEvaluating fetch inside frame with url(): "${targetFrame.url()}"`);
  try {
    const res = await targetFrame.evaluate(async ({ url, headers, body, auth }) => {
      const reqHeaders = {
        'content-type': 'application/json+protobuf',
        'x-user-agent': 'grpc-web-javascript/0.1',
        'authorization': auth,
        'x-goog-api-key': headers['x-goog-api-key'] || 'AIzaSyDdP816MREB3SkjZO04QXbjsigfcI0GWOs',
        'x-goog-authuser': '0'
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: reqHeaders,
        body: body,
        credentials: 'include'
      });
      return { status: response.status, text: await response.text() };
    }, { url: template.url, headers: template.headers, body: template.body, auth: authHeader });
    
    console.log(`Replay Status: ${res.status}`);
    console.log(`Replay Response snippet: ${res.text.substring(0, 300)}`);
  } catch (err) {
    console.error('Replay evaluation failed:', err.message);
  }

  await context.close();
}

testFetch().catch(console.error);
