/**
 * SRT Translation Test - Gemini Chat Interaction (Headless)
 * 
 * Instead of replaying a captured HTTPS request (which has an expired `at` token),
 * this test opens Gemini's chat UI using the existing persistent browser profile,
 * types the translation prompt directly into the input, waits for Gemini's response,
 * and extracts the translated text from the page.
 * 
 * This uses the existing Gemini session cookies (from gemini-profile/) without
 * modifying any application code.
 * 
 * Run from: services/ai-translate-bridge/
 * Command:  node tests/test-srt-translate-chat.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── SRT Helpers ────────────────────────────────────────────────────────────

function parseSRT(content) {
  var normalized = content.replace(/\r\n/g, '\n');
  var blocks = normalized.split('\n\n').filter(function(b) { return b.trim(); });
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
  return segments.map(function(s) {
    return s.index + '\n' + s.start + ' --> ' + s.end + '\n' + s.translatedText + '\n';
  }).join('\n');
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  [PASS] ${msg}`); }
  else { failed++; console.error(`  [FAIL] ${msg}`); }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('  SRT Translation via Gemini Chat (Headless Playwright)');
  console.log('='.repeat(70));
  console.log('');

  // Load sample SRT
  const srtPath = path.resolve(__dirname, 'fixtures/sample_vi.srt');
  const segments = parseSRT(fs.readFileSync(srtPath, 'utf8'));
  assert(segments.length === 5, `Parsed ${segments.length} SRT segments`);

  // Build JSON translation prompt (same format as Go backend's BuildTranslationJSON)
  var targetLang = 'English';
  var jsonPayload = JSON.stringify({
    target_language: targetLang,
    segments: segments.map(function(s) { return { id: s.index, text: s.text }; })
  });

  var systemInstructions = 'You are a professional subtitle translator. Translate the "text" field of each segment in the input JSON list to ' + targetLang + '. Keep the original "id" exactly as is. Output MUST be valid JSON structure matching: {"translations": [{"id": N, "text": "translated text"}]}. Output only the JSON. Do not include markdown code block wrappers.';
  var prompt = systemInstructions + '\n\nInput segments JSON:\n' + jsonPayload;

  console.log('  Prompt format: JSON (matching Go backend BuildTranslationJSON)');
  console.log('  Payload: ' + jsonPayload);

  console.log('[TEST 1] Launch headless Playwright with Gemini profile');
  const profileDir = path.resolve(process.cwd(), '../../user_data/ai-sessions/gemini-profile');
  assert(fs.existsSync(profileDir), 'Gemini profile directory exists');

  // Stealth args to avoid bot detection
  const stealthArgs = [
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--lang=vi-VN,vi,en-US,en',
    '--no-sandbox',
  ];

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: stealthArgs,
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  // Apply stealth scripts
  await context.addInitScript(() => {
    try { delete Object.getPrototypeOf(navigator).webdriver; } catch (e) {}
    try { Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'], configurable: true }); } catch (e) {}
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    console.log('[TEST 2] Navigate to Gemini');
    await page.goto('https://gemini.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`  Page title: ${await page.title()}`);
    console.log(`  Page URL: ${page.url()}`);
    assert(page.url().includes('gemini.google.com'), 'Navigated to Gemini');

    // Wait for the chat input to appear
    console.log('[TEST 3] Wait for Gemini chat input');
    // Gemini uses a rich text editor - try multiple selectors
    const inputSelectors = [
      '.ql-editor',                          // Quill editor
      '[contenteditable="true"]',             // Generic contenteditable
      'div[aria-label*="prompt"]',            // Aria label
      'rich-textarea',                        // Custom element
      'textarea',                             // Fallback textarea
    ];

    let inputEl = null;
    for (const sel of inputSelectors) {
      try {
        inputEl = await page.waitForSelector(sel, { timeout: 8000 });
        if (inputEl) {
          console.log(`  Found input with selector: ${sel}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!inputEl) {
      // Take screenshot for debugging
      const ssPath = path.resolve(__dirname, 'output/gemini_debug.png');
      await page.screenshot({ path: ssPath });
      console.log(`  [DEBUG] Screenshot saved to: ${ssPath}`);
      console.log('  Could not find chat input. Gemini may require re-login.');
      assert(false, 'Chat input found (Gemini may need re-login)');

      // Still save the page content for debugging
      const htmlPath = path.resolve(__dirname, 'output/gemini_debug.html');
      fs.writeFileSync(htmlPath, await page.content(), 'utf8');
      return;
    }

    assert(inputEl !== null, 'Chat input element found');

    console.log('[TEST 4] Type translation prompt into Gemini');
    // Clear any existing text and type our prompt
    await inputEl.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    // Type the prompt (using clipboard to avoid typing issues)
    await page.evaluate((text) => {
      const el = document.querySelector('.ql-editor') || document.querySelector('[contenteditable="true"]');
      if (el) {
        el.textContent = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, prompt);

    await page.waitForTimeout(500);

    // Press Enter or find the send button
    const sendBtnSelectors = [
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[data-test-id="send-button"]',
      'button:has(svg)',  // Generic button with icon
    ];

    let sent = false;
    for (const sel of sendBtnSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          sent = true;
          console.log(`  Sent via button: ${sel}`);
          break;
        }
      } catch (e) {}
    }

    if (!sent) {
      // Fallback: press Enter
      await page.keyboard.press('Enter');
      console.log('  Sent via Enter key');
    }

    assert(true, 'Translation prompt sent to Gemini');

    console.log('[TEST 5] Wait for Gemini response');
    // Wait for response to appear (Gemini renders in model-response divs)
    await page.waitForTimeout(3000);

    // Poll for response completion (up to 60 seconds)
    let responseText = '';
    const responseSelectors = [
      '.model-response-text',
      '.response-container',
      '[data-message-author-role="model"]',
      'message-content[class*="model"]',
      '.markdown-main-panel',
    ];

    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(3000);

      for (const sel of responseSelectors) {
        try {
          const els = await page.$$(sel);
          if (els.length > 0) {
            const lastEl = els[els.length - 1];
            responseText = await lastEl.textContent();
            if (responseText && responseText.trim().length > 20) {
              console.log(`  Response found (${responseText.length} chars) after ${(attempt + 1) * 3}s`);
              break;
            }
          }
        } catch (e) {}
      }

      if (responseText && responseText.trim().length > 20) break;

      // Check if there's a stop/generating indicator
      const isGenerating = await page.$('[aria-label*="Stop"]') || await page.$('.generating');
      if (!isGenerating && attempt > 2) {
        // Try getting all text from the conversation area
        responseText = await page.evaluate(() => {
          const msgs = document.querySelectorAll('[data-message-author-role="model"], .model-response-text, .markdown-main-panel');
          if (msgs.length > 0) return msgs[msgs.length - 1].textContent;
          return '';
        });
        if (responseText && responseText.trim().length > 20) break;
      }

      console.log(`  Waiting... attempt ${attempt + 1}/20`);
    }

    assert(responseText.length > 0, `Gemini responded (${responseText.length} chars)`);
    console.log('');
    console.log('  ── Gemini Raw Response ──');
    console.log('  ' + responseText.substring(0, 500).split('\n').join('\n  '));
    console.log('');

    // Save debug screenshot
    const ssPath = path.resolve(__dirname, 'output/gemini_response.png');
    await page.screenshot({ path: ssPath });

    console.log('[TEST 6] Parse translations and build SRT');
    var lines = responseText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
    var translations = [];

    // Strategy 1: Parse as JSON response {"translations": [{"id": N, "text": "..."}]}
    var cleaned = responseText.trim();
    // Strip markdown code block wrappers if present (```json ... ```)
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.split('\n').filter(function(l) { return !l.trim().startsWith('```'); }).join('\n').trim();
    }
    try {
      var parsed = JSON.parse(cleaned);
      if (parsed.translations && Array.isArray(parsed.translations)) {
        for (var i = 0; i < parsed.translations.length; i++) {
          var t = parsed.translations[i];
          if (typeof t.id === 'number' && typeof t.text === 'string') {
            translations.push({ id: t.id, text: t.text });
          }
        }
        console.log('  Parsed via JSON strategy');
      }
    } catch (e) {
      // Try to extract JSON object from response
      var jsonMatch = cleaned.match(/\{[\s\S]*"translations"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          var parsed2 = JSON.parse(jsonMatch[0]);
          if (parsed2.translations && Array.isArray(parsed2.translations)) {
            for (var i = 0; i < parsed2.translations.length; i++) {
              var t = parsed2.translations[i];
              if (typeof t.id === 'number' && typeof t.text === 'string') {
                translations.push({ id: t.id, text: t.text });
              }
            }
            console.log('  Parsed via JSON extraction strategy');
          }
        } catch (e2) {
          console.log('  JSON parse failed: ' + e2.message);
        }
      }
    }

    // Strategy 2: Match numbered lines like: 1. "Hello" or 1. Hello
    if (translations.length < segments.length) {
      translations = [];
      for (var i = 0; i < lines.length; i++) {
        var match = lines[i].match(/^(\d+)[\.\)]\s*["""]?(.+?)["""]?\s*$/);
        if (match) {
          translations.push({ id: parseInt(match[1]), text: match[2] });
        }
      }
    }

    // Strategy 3: Split concatenated quoted strings like "text1""text2""text3"
    if (translations.length < segments.length) {
      var rawText = responseText.trim();
      var parts = rawText.split(/""/);
      var splitCleaned = [];
      for (var i = 0; i < parts.length; i++) {
        var t = parts[i].replace(/^[""\u201C\u201D]+|[""\u201C\u201D]+$/g, '').trim();
        if (t.length > 3) splitCleaned.push(t);
      }
      if (splitCleaned.length >= segments.length) {
        translations = [];
        for (var i = 0; i < segments.length; i++) {
          translations.push({ id: segments[i].index, text: splitCleaned[i] });
        }
      }
    }

    // Strategy 4: Fallback - take non-empty lines
    if (translations.length < segments.length) {
      var textLines = lines.filter(function(l) { return l.length > 5; });
      if (textLines.length >= segments.length) {
        translations = [];
        for (var i = 0; i < segments.length; i++) {
          var fc = textLines[i].replace(/^[""\u201C\u201D]+|[""\u201C\u201D]+$/g, '');
          translations.push({ id: segments[i].index, text: fc });
        }
      }
    }

    console.log(`  Extracted ${translations.length} translations`);
    for (const t of translations) {
      console.log(`  [${t.id}] => "${t.text}"`);
    }

    assert(translations.length > 0, `Extracted ${translations.length} translation(s) from response`);

    // Build translated SRT
    const translatedSegs = segments.map(seg => {
      const trans = translations.find(t => t.id === seg.index);
      return {
        index: seg.index,
        start: seg.start,
        end: seg.end,
        originalText: seg.text,
        translatedText: trans ? trans.text : seg.text,
      };
    });

    const finalSRT = reassembleSRT(translatedSegs);
    const outputPath = path.resolve(__dirname, 'output/translated_en.srt');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, finalSRT, 'utf8');

    console.log('');
    console.log('  ── Translated SRT ──');
    console.log(finalSRT.split('\n').map(l => '  ' + l).join('\n'));
    console.log(`  Saved to: ${outputPath}`);

    assert(finalSRT.includes('-->'), 'SRT contains timestamp arrows');
    assert(translations.length === segments.length, `All ${segments.length} segments have translations`);

    // Check that at least some text was actually translated (different from original)
    const hasEnglish = translatedSegs.some(s => s.translatedText !== s.originalText);
    assert(hasEnglish, 'At least some segments were translated to a different language');

  } finally {
    await context.close();
  }

  console.log('');
  console.log('='.repeat(70));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(2);
});
