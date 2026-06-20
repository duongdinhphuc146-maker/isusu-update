/**
 * SRT Translation Test - Qwen Chat Interaction
 * 
 * Opens Qwen's chat UI using the existing persistent browser profile,
 * ensures Fast mode is enabled, types the translation prompt,
 * captures the outgoing API request to qwen_captured.json,
 * extracts response translations, and deletes the conversation.
 * 
 * Run from: services/ai-translate-bridge/
 * Command:  node tests/test-srt-translate-qwen-chat.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function parseSRT(content) {
  var normalized = content.replace(/\r\n/g, '\n');
  var blocks = normalized.split('\n\n').filter(Boolean);
  var timeRegex = /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/;
  return blocks.map(function(block) {
    var lines = block.trim().split('\n');
    if (lines.length < 3) return null;
    var m = lines[1].match(timeRegex);
    if (!m) return null;
    return { index: parseInt(lines[0]), start: m[1], end: m[2], text: lines.slice(2).join(' ') };
  }).filter(Boolean);
}

function reassembleSRT(segments) {
  return segments.map(s => `${s.index}\n${s.start} --> ${s.end}\n${s.translatedText}\n`).join('\n');
}

async function main() {
  console.log('=== Qwen AI Chat SRT Translator & Capturer ===\n');

  const srtPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, 'fixtures/sample_vi.srt');
  const segments = parseSRT(fs.readFileSync(srtPath, 'utf8'));
  console.log(`Parsed ${segments.length} segments from: ${srtPath}`);

  const targetLang = 'English';
  const jsonPayload = JSON.stringify({
    target_language: targetLang,
    segments: segments.map(s => ({ id: s.index, text: s.text }))
  });

  const systemInstructions = `You are a professional subtitle translator. Translate the "text" field of each segment in the input JSON list to ${targetLang}. Keep the original "id" exactly as is. Output MUST be valid JSON structure matching: {"translations": [{"id": N, "text": "translated text"}]}. Output only the JSON. Do not include markdown code block wrappers.`;
  // We use TRANSLATE_ME inside the payload to facilitate capturing
  const prompt = `${systemInstructions}\n\nInput segments JSON with TRANSLATE_ME:\n${jsonPayload}`;

  const profileDir = path.resolve(process.cwd(), '../../user_data/ai-sessions/qwen-profile');
  const templatePath = path.resolve(process.cwd(), '../../user_data/ai-sessions/qwen_captured.json');

  console.log(`Using profile: ${profileDir}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true, // Run in headless mode (no browser window opened)
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-session-crashed-bubble'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: null
  });

  // Apply stealth
  await context.addInitScript(() => {
    try { delete Object.getPrototypeOf(navigator).webdriver; } catch (e) {}
  });

  let capturedRequest = null;

  // Intercept the API call to save qwen_captured.json
  context.on('request', request => {
    try {
      if (request.method() === 'POST' && request.url().includes('/api/v2/chat/completions')) {
        const postData = request.postData() || '';
        if (postData.includes('TRANSLATE_ME')) {
          console.log('\n[CAPTURE] Intercepted Qwen API request!');
          const headers = { ...request.headers() };
          // Clean headers
          delete headers['content-length'];
          delete headers['host'];
          delete headers['connection'];
          delete headers['content-encoding'];

          capturedRequest = {
            url: request.url(),
            method: request.method(),
            headers: headers,
            body: postData
          };
        }
      }
    } catch (e) {}
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    console.log('Navigating to Qwen AI...');
    await page.goto('https://chat.qwen.ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`Page loaded: "${await page.title()}"`);

    // Ensure Fast Mode is selected
    console.log('Configuring Fast Mode...');
    try {
      // Find the mode selector dropdown trigger. Usually has text like "Auto", "Thinking", or "Fast"
      const modeBtn = page.locator('div.message-input-textarea-container, div.message-input').locator('button, div').filter({ hasText: /^(Auto|Thinking|Fast)$/ }).first();
      await modeBtn.waitFor({ timeout: 5000 });
      const currentMode = await modeBtn.textContent();
      console.log(`Current mode in UI: ${currentMode}`);

      if (currentMode !== 'Fast') {
        await modeBtn.click();
        await page.waitForTimeout(500);
        const fastOption = page.locator('div, li, span').filter({ hasText: /^Fast$/ }).first();
        await fastOption.click();
        console.log('Successfully set mode to Fast.');
        await page.waitForTimeout(500);
      } else {
        console.log('Already in Fast Mode.');
      }
    } catch (err) {
      console.log('Could not automate Fast Mode selection in UI (selectors might have changed). Continuing with default...');
    }

    // Input prompt
    console.log('Sending prompt...');
    const textarea = page.locator('textarea.message-input-textarea, textarea').first();
    await textarea.waitFor({ timeout: 10000 });
    await textarea.focus();
    await textarea.click();
    await page.waitForTimeout(500);
    await textarea.fill(prompt);
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);

    // Save debug screenshot of prompt entered
    const ssPromptPath = path.resolve(__dirname, 'output/qwen_prompt_entered.png');
    fs.mkdirSync(path.dirname(ssPromptPath), { recursive: true });
    await page.screenshot({ path: ssPromptPath });
    console.log(`Saved screenshot before sending: ${ssPromptPath}`);

    // Find the correct send button
    let sendBtn = null;
    const buttons = await page.locator('button').all();
    for (let btn of buttons) {
      try {
        const html = await btn.evaluate(el => el.outerHTML);
        if (html.includes('M12 3') || html.includes('M12') || html.includes('qwen-btn-primary') || html.includes('send') || html.includes('d="M12 3a1')) {
          sendBtn = btn;
          console.log(`Found send button matching pattern: ${html.substring(0, 100)}...`);
          break;
        }
      } catch (e) {}
    }

    if (!sendBtn) {
      sendBtn = page.locator('div.message-input-textarea-container button, div.message-input button, button').last();
      console.log('Using fallback selector for send button.');
    }

    const btnText = await sendBtn.evaluate(el => el.outerHTML);
    console.log(`Targeting send button: ${btnText}`);
    await sendBtn.focus();
    await sendBtn.click({ force: true });
    console.log('Clicked send button.');
    await page.waitForTimeout(2000);

    // Take screenshot after clicking send
    const ssSentPath = path.resolve(__dirname, 'output/qwen_prompt_sent.png');
    await page.screenshot({ path: ssSentPath });
    console.log(`Saved screenshot after sending: ${ssSentPath}`);

    // Wait for response completion
    console.log('Waiting for Qwen response...');
    let responseText = '';
    let lastResponseText = '';
    let stableCount = 0;

    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(2000);
      const bubbles = await page.locator('.qwen-chat-message, .message-bubble-content, .markdown-content, .message-content, [class*="bubble-content"]').all();
      let currentText = '';
      if (bubbles.length > 0) {
        const lastBubble = bubbles[bubbles.length - 1];
        currentText = await lastBubble.textContent() || '';
      }

      if (currentText && currentText.trim() === lastResponseText.trim()) {
        if (currentText.trim().length > 20) {
          stableCount++;
          if (stableCount >= 3) {
            responseText = currentText;
            console.log(`Response finished streaming (stable for 6s).`);
            break;
          }
        }
      } else {
        stableCount = 0;
        lastResponseText = currentText;
      }
    }

    console.log(`\n--- Raw Qwen Response ---\n${responseText.substring(0, 500)}...\n`);

    // Parse and print translations
    let translations = [];
    try {
      const cleaned = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.translations) translations = parsed.translations;
    } catch (e) {
      // Regexp fallback
      const regex = /\{\s*"id"\s*:\s*(\d+)\s*,\s*"text"\s*:\s*"([\s\S]*?)"\s*\}/g;
      let match;
      while ((match = regex.exec(responseText)) !== null) {
        translations.push({ id: parseInt(match[1]), text: match[2] });
      }
    }

    console.log(`Extracted ${translations.length} translations.`);

    // Reassemble and write translated SRT
    const translatedSegs = segments.map(seg => {
      const trans = translations.find(t => t.id === seg.index);
      return {
        index: seg.index,
        start: seg.start,
        end: seg.end,
        translatedText: trans ? trans.text : seg.text
      };
    });
    const finalSRT = reassembleSRT(translatedSegs);
    let outSRTPath = path.resolve(__dirname, 'output/translated_en.srt');
    if (process.argv[2]) {
      const dirName = path.dirname(srtPath);
      const extName = path.extname(srtPath);
      const baseName = path.basename(srtPath, extName);
      outSRTPath = path.join(dirName, `${baseName}_en${extName}`);
    }
    fs.mkdirSync(path.dirname(outSRTPath), { recursive: true });
    fs.writeFileSync(outSRTPath, finalSRT, 'utf8');
    console.log(`Saved translated SRT to: ${outSRTPath}`);

    // If request was captured, write it to file
    if (capturedRequest) {
      fs.writeFileSync(templatePath, JSON.stringify(capturedRequest, null, 2), 'utf8');
      console.log(`Saved captured template to: ${templatePath}`);
    } else {
      console.log('[WARN] Request containing TRANSLATE_ME was not captured in this session.');
    }

    // Task 4: Delete the conversation
    console.log('Cleaning up: deleting conversation...');
    try {
      const activeItem = page.locator('.chat-item-drag-link.chat-item-drag-active').first();
      await activeItem.waitFor({ timeout: 5000 });
      await activeItem.hover();
      
      const menuBtn = page.locator('button[aria-label="Chat Menu"], .chat-item-drag-web-default-btn').first();
      await menuBtn.click();
      await page.waitForTimeout(500);

      const deleteBtn = page.locator('.chat-menu-item-error, li.chat-menu-item-error').first();
      await deleteBtn.click();
      await page.waitForTimeout(500);

      const confirmBtn = page.locator('.qwen-modal-btn-actions.dangerprimary, button.dangerprimary, button:has-text("Delete"), button:has-text("Xác nhận")').first();
      await confirmBtn.click();
      console.log('Conversation deleted successfully.');
    } catch (deleteErr) {
      console.log('Could not automate conversation deletion in UI:', deleteErr.message);
    }

  } finally {
    await context.close();
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
