import { chromium } from 'playwright';
import { getSessionProfilePath, getCapturedTemplatePath } from '../session-manager';
import { STEALTH_LAUNCH_ARGS, applyStealth } from '../stealth';

/**
 * Translates via ChatGPT using UI automation.
 * This bypasses the time-sensitive sentinel token / 403 errors.
 */
export async function translateChatGPT(prompt: string): Promise<string> {
  const profileDir = getSessionProfilePath('chatgpt');

  console.log(`[CHATGPT] Browser automation mode. Profile: ${profileDir}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false, // Must be false to bypass Cloudflare easily
    channel: 'chrome',
    args: [
      ...STEALTH_LAUNCH_ARGS,
      '--window-position=-2000,-2000',
      '--window-size=1024,768',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  await applyStealth(context);

  try {
    const page = context.pages()[0] || await context.newPage();
    await applyStealth(page);

    console.log('[CHATGPT] Loading ChatGPT...');
    await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait for the textarea
    const textarea = page.locator('#prompt-textarea');
    await textarea.waitFor({ state: 'visible', timeout: 25000 });

    console.log('[CHATGPT] Filling prompt...');
    await textarea.focus();
    await textarea.fill(prompt);
    await page.waitForTimeout(500);

    console.log('[CHATGPT] Sending prompt...');
    try {
      const sendBtn = page.locator('button[data-testid="send-button"]');
      await sendBtn.waitFor({ state: 'visible', timeout: 4000 });
      await sendBtn.click();
    } catch (e) {
      console.log('[CHATGPT] Send button click failed or not found, falling back to keyboard Enter...');
      await page.keyboard.press('Enter');
    }

    console.log('[CHATGPT] Waiting for response...');
    // We locate the last assistant message wrapper
    const assistantBubble = page.locator('[data-message-author-role="assistant"], .markdown, .prose').last();

    let lastText = '';
    let stableCount = 0;
    let responseText = '';

    // Wait up to 60 seconds (40 * 1500ms)
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(1500);
      try {
        const count = await assistantBubble.count();
        if (count === 0) continue;
        const text = (await assistantBubble.textContent({ timeout: 1000 })) || '';
        if (text && text.trim() === lastText.trim() && text.trim().length > 10) {
          stableCount++;
          if (stableCount >= 2) {
            responseText = text;
            break;
          }
        } else {
          stableCount = 0;
          lastText = text;
        }
      } catch (e) {}
    }

    if (!responseText && lastText) {
      responseText = lastText;
    }

    console.log(`[CHATGPT] Response text parsed successfully (${responseText.length} chars).`);

    // Clean up: delete conversation from history
    try {
      const currentUrl = page.url();
      const match = currentUrl.match(/\/c\/([a-f0-9-]+)/);
      if (match) {
        const conversationId = match[1];
        console.log(`[CHATGPT] Deleting conversation: ${conversationId}`);
        await page.evaluate(async (id) => {
          let token = null;
          try {
            const sessionResp = await fetch('/api/auth/session');
            if (sessionResp.ok) {
              const sessionData = await sessionResp.json();
              token = sessionData.accessToken || null;
            }
          } catch (e) {}

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const res = await fetch(`/backend-api/conversation/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ is_visible: false })
          });
          if (!res.ok) {
            throw new Error(`Delete fetch status ${res.status}: ${await res.text()}`);
          }
        }, conversationId);
        console.log('[CHATGPT] Conversation deleted successfully.');
      }
    } catch (e) {
      console.warn('[CHATGPT] Failed to delete conversation:', e);
    }

    return responseText;

  } finally {
    await context.close();
  }
}
