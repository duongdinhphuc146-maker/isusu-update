const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const profileDir = 'C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions/aistudio-profile';

async function testUiTranslate() {
  console.log('Launching browser for UI translation...');
  try { fs.unlinkSync(path.join(profileDir, 'SingletonLock')); } catch(_) {}

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = context.pages()[0] || await context.newPage();
  
  try {
    console.log('Navigating to Google AI Studio...');
    await page.goto('https://aistudio.google.com/prompts/new_chat', { waitUntil: 'networkidle' });

    // Wait longer for full initialization
    console.log('Waiting 10 seconds for initialization...');
    await page.waitForTimeout(10000);

    const inputSelector = 'textarea[placeholder*="Start typing a prompt"]';
    const inputLoc = page.locator(inputSelector).first();
    await inputLoc.waitFor({ state: 'visible', timeout: 20000 });

    console.log('Typing translation request...');
    await inputLoc.click();
    await inputLoc.fill('Translate to Vietnamese: Hello world');
    await page.waitForTimeout(1000);

    console.log('Submitting prompt (Control+Enter)...');
    await page.keyboard.press('Control+Enter');

    console.log('Waiting 12 seconds for response...');
    await page.waitForTimeout(12000);

    // Save screenshot after submit
    await page.screenshot({ path: 'ui_after_submit_delayed.png' });
    console.log('Saved screenshot after submit: ui_after_submit_delayed.png');

    const chatText = await page.evaluate(() => document.body.innerText);
    console.log('Chat body text sample:', chatText.substring(0, 1200));

  } finally {
    await context.close();
  }
}

testUiTranslate().catch(console.error);
