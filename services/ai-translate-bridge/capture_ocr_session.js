const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const profileDir = path.resolve(__dirname, './user_data/ai-sessions/z-ai-ocr-profile');

  console.log('Launching browser in debug mode...');
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    args: ['--start-maximized'],
    viewport: null
  });

  context.on('page', (page) => {
    page.on('request', async (req) => {
      if (req.method() === 'POST') {
        const url = req.url();
        const contentType = req.headers()['content-type'] || '';
        const postData = req.postData() || '';
        console.log(`[POST] ${url} | Content-Type: ${contentType} | Body: ${postData.slice(0, 200)}`);
      }
    });
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://ocr.z.ai/');
}

run().catch(console.error);
