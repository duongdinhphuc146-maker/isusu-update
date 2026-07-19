const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const profileDir = 'C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions/aistudio-profile';

async function testFrames() {
  console.log('Launching browser to inspect frames...');
  try { fs.unlinkSync(path.join(profileDir, 'SingletonLock')); } catch(_) {}

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://aistudio.google.com/prompts/new_chat', { waitUntil: 'networkidle' });

  // Wait for input box to ensure loaded
  const inputSelector = 'textarea[placeholder*="Start typing a prompt"]';
  const inputLoc = page.locator(inputSelector).first();
  await inputLoc.waitFor({ state: 'visible', timeout: 20000 });

  console.log('Typing test prompt and submitting...');
  await inputLoc.click();
  await inputLoc.fill('Translate target "Hello, how are you" to Vietnamese.');
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+Enter');

  console.log('Waiting 5 seconds...');
  await page.waitForTimeout(5000);

  console.log('Listing all frames recursively and evaluating origin/href:');
  const printFrames = async (frame, indent = '') => {
    let loc = 'N/A';
    let origin = 'N/A';
    try {
      loc = await frame.evaluate(() => window.location.href);
      origin = await frame.evaluate(() => window.origin);
    } catch (e) {
      loc = `ERR: ${e.message}`;
    }
    console.log(`${indent}- Frame name="${frame.name()}", url()="${frame.url()}", evaluated_location="${loc}", origin="${origin}"`);
    for (const child of frame.childFrames()) {
      await printFrames(child, indent + '  ');
    }
  };

  await printFrames(page.mainFrame());
  await context.close();
}

testFrames().catch(console.error);
