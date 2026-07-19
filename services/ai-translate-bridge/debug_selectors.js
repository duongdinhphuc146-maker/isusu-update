const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.resolve('C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions');
const profileDir = path.join(USER_DATA_DIR, 'aistudio-profile');
const AI_STUDIO_URL = 'https://aistudio.google.com/';

async function dumpSelectors() {
  console.log('[DEBUG] Launching Chrome to inspect selectors...');
  
  const lockFile = path.join(profileDir, 'SingletonLock');
  if (fs.existsSync(lockFile)) {
    try { fs.unlinkSync(lockFile); } catch(_) {}
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true, // Run headless to be fast
    channel: 'chrome',
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(AI_STUDIO_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait a bit for page to load fully
    await page.waitForTimeout(5000);

    // Get all contenteditables and textareas
    const info = await page.evaluate(() => {
      const elList = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], input, button'));
      return elList.map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        placeholder: el.getAttribute('placeholder') || '',
        innerText: (el.innerText || '').substring(0, 100),
        contentEditable: el.getAttribute('contenteditable') || ''
      }));
    });

    console.log('[DEBUG] Elements found on page:');
    console.log(JSON.stringify(info, null, 2));

  } finally {
    await context.close();
  }
}

dumpSelectors().catch(console.error);
