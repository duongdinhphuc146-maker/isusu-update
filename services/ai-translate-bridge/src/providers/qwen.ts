import { chromium } from 'playwright';
import { getSessionProfilePath, getCapturedTemplatePath } from '../session-manager';
import { STEALTH_LAUNCH_ARGS, applyStealth } from '../stealth';
import fs from 'fs';

/**
 * Translates via Qwen using optimized UI automation.
 * Uses browser cookies for auth (no expired token issues),
 * but minimizes all unnecessary delays to be as fast as possible.
 */
export async function translateQwen(prompt: string): Promise<string> {
  const profileDir = getSessionProfilePath('qwen');
  const templatePath = getCapturedTemplatePath('qwen');

  console.log(`[QWEN] Browser automation mode. Profile: ${profileDir}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: [
      ...STEALTH_LAUNCH_ARGS,
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: null
  });

  await applyStealth(context);

  let capturedRequest: any = null;

  // Intercept the real API call to refresh the captured template
  context.on('request', request => {
    try {
      if (request.method() === 'POST' && request.url().includes('/api/v2/chat/completions')) {
        const postData = request.postData() || '';
        const headers = { ...request.headers() };
        delete headers['content-length'];
        delete headers['host'];
        delete headers['connection'];
        delete headers['content-encoding'];
        capturedRequest = { url: request.url(), method: request.method(), headers, body: postData };
      }
    } catch {}
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    await applyStealth(page);

    console.log('[QWEN] Loading page...');
    await page.goto('https://chat.qwen.ai', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for textarea to be ready
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });

    // Try to set Fast mode if not already set (best-effort, non-blocking)
    try {
      const modeBtn = page.locator('button, div[role="button"]').filter({ hasText: /^(Auto|Thinking)$/ }).first();
      const visible = await modeBtn.isVisible({ timeout: 2000 });
      if (visible) {
        await modeBtn.click();
        const fastOpt = page.locator('div[role="option"], li, div').filter({ hasText: /^Fast$/ }).first();
        await fastOpt.click({ timeout: 2000 });
      }
    } catch {}

    // Fill the prompt and trigger send
    console.log('[QWEN] Typing prompt...');
    await textarea.fill(prompt);

    // Use keyboard Enter to send (most reliable cross-UI method)
    // Qwen sends on Ctrl+Enter or just Enter (without shift)
    await page.keyboard.press('Enter');
    console.log('[QWEN] Prompt sent, waiting for response...');

    // Wait for response to start appearing
    const responseLocator = page.locator(
      '.markdown-content, .message-bubble-content, [class*="bubble-content"], .message-content'
    ).last();

    // Poll until response stops growing (streaming complete)
    let lastText = '';
    let stableCount = 0;
    let responseText = '';

    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1500);

      try {
        const allBubbles = await page.locator(
          '.markdown-content, .message-bubble-content, [class*="bubble-content"], .message-content'
        ).all();

        if (allBubbles.length === 0) {
          // Try alternate: look for any AI response container
          continue;
        }

        const lastBubble = allBubbles[allBubbles.length - 1];
        const text = (await lastBubble.textContent()) || '';

        if (text && text.trim() === lastText.trim() && text.trim().length > 10) {
          stableCount++;
          if (stableCount >= 2) { // 2 * 1500ms = 3 seconds stable = done
            responseText = text;
            break;
          }
        } else {
          stableCount = 0;
          lastText = text;
        }
      } catch {}
    }

    console.log(`[QWEN] Response received: ${responseText.length} chars`);

    // Refresh captured template
    if (capturedRequest) {
      fs.writeFileSync(templatePath, JSON.stringify(capturedRequest, null, 2), 'utf8');
      console.log('[QWEN] Template refreshed.');
    }

    // Delete conversation via API using page context (fastest method)
    try {
      const chatIdMatch = capturedRequest?.url?.match(/chat_id=([a-f0-9-]+)/);
      if (chatIdMatch) {
        await page.evaluate(async (id: string) => {
          await fetch(`https://chat.qwen.ai/api/v2/chats/${id}`, { method: 'DELETE' });
        }, chatIdMatch[1]);
        console.log('[QWEN] Conversation deleted.');
      }
    } catch {}

    return responseText;

  } finally {
    await context.close();
  }
}
