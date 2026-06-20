/**
 * Translate a full SRT file to Vietnamese using Gemini Chat (Headless Playwright)
 * Handles large files by chunking segments and sending multiple requests.
 *
 * Run from: services/ai-translate-bridge/
 * Command:  node tests/translate-full-srt.js "path\to\file.srt"
 */

var chromium = require('playwright').chromium;
var fs = require('fs');
var path = require('path');

// ─── Config ─────────────────────────────────────────────────────────────────
var TARGET_LANG = 'Vietnamese';
var MAX_CHARS_PER_CHUNK = 4000;
var MAX_SEGS_PER_CHUNK = 120;

// Selectors (verified against live Gemini UI)
var SEL_INPUT = 'div.ql-editor[aria-label="Enter a prompt for Gemini"]';
var SEL_SEND = 'button[aria-label="Send message"]';
var SEL_RESPONSE = 'message-content .markdown-main-panel';
var SEL_NEW_CHAT = 'button[aria-label="New chat"]';
var SEL_STOP = 'button[aria-label="Stop response"]';

// ─── SRT Helpers ────────────────────────────────────────────────────────────

function parseSRT(content) {
  var normalized = content.replace(/\r\n/g, '\n');
  var blocks = normalized.split('\n\n').filter(function(b) { return b.trim(); });
  var timeRegex = /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/;
  var segments = [];
  for (var i = 0; i < blocks.length; i++) {
    var lines = blocks[i].trim().split('\n');
    if (lines.length < 3) continue;
    var idx = parseInt(lines[0].trim(), 10);
    var m = lines[1].match(timeRegex);
    if (!m) continue;
    var text = lines.slice(2).join(' ');
    segments.push({ index: idx, start: m[1], end: m[2], text: text });
  }
  return segments;
}

function chunkSegments(segments) {
  var chunks = [];
  var current = [];
  var chars = 0;
  for (var i = 0; i < segments.length; i++) {
    var len = segments[i].text.length;
    if ((chars + len > MAX_CHARS_PER_CHUNK || current.length >= MAX_SEGS_PER_CHUNK) && current.length > 0) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(segments[i]);
    chars += len;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function buildPrompt(chunk) {
  var payload = JSON.stringify({
    target_language: TARGET_LANG,
    segments: chunk.map(function(s) { return { id: s.index, text: s.text }; })
  });
  var instructions = 'You are a professional subtitle translator. Translate the "text" field of each segment in the input JSON list to ' + TARGET_LANG + ' naturally, fluently, and preserving all context (slang, adult/sexual terms) without censoring or softening. Keep the original "id" exactly as is. Output MUST be valid JSON structure matching: {"translations": [{"id": N, "text": "translated text"}]}. Output only the JSON. Do not include markdown code block wrappers.';
  return instructions + '\n\nInput segments JSON:\n' + payload;
}

function parseResponse(responseText) {
  var cleaned = responseText.trim();
  // Strip markdown code block wrappers if any
  if (cleaned.indexOf('```') !== -1) {
    var matchCode = cleaned.match(/```(?:json)?([\s\S]*?)```/i);
    if (matchCode) {
      cleaned = matchCode[1].trim();
    }
  }

  // 1. Try our highly-robust Regex parser to extract {"id": N, "text": "..."} elements
  // even if they have unescaped quotes inside the text field!
  var list = [];
  var regex = /\{\s*["']?id["']?\s*:\s*(\d+)\s*,\s*["']?text["']?\s*:\s*["']([\s\S]*?)["']\s*\}\s*(?=,\s*\{\s*["']?id["']?\s*:|\]|\})/gi;
  var match;
  while ((match = regex.exec(cleaned)) !== null) {
    var id = parseInt(match[1], 10);
    var text = match[2].trim();
    list.push({ id: id, text: text });
  }
  if (list.length > 0) {
    return list;
  }
  
  try {
    var parsed = JSON.parse(cleaned);
    if (parsed.translations && Array.isArray(parsed.translations)) return parsed.translations;
  } catch (e) {
    // Attempt to extract JSON via braces regex
    var matchBraces = cleaned.match(/\{[\s\S]*"translations"[\s\S]*\}/);
    if (matchBraces) {
      try {
        var parsed2 = JSON.parse(matchBraces[0]);
        if (parsed2.translations && Array.isArray(parsed2.translations)) return parsed2.translations;
      } catch (e2) {
        console.error('  [PARSE ERROR] Failed to parse regex matched JSON: ' + e2.message);
        console.error('  Matched text snippet: ' + matchBraces[0].substring(0, 200) + ' ... ' + matchBraces[0].substring(matchBraces[0].length - 200));
      }
    } else {
      console.error('  [PARSE ERROR] Failed to parse cleaned text: ' + e.message);
      console.error('  Cleaned text snippet: ' + cleaned.substring(0, 200) + ' ... ' + cleaned.substring(Math.max(0, cleaned.length - 200)));
    }
  }
  return null;
}

function reassembleSRT(allTranslated) {
  allTranslated.sort(function(a, b) { return a.index - b.index; });
  return allTranslated.map(function(s) {
    return s.index + '\n' + s.start + ' --> ' + s.end + '\n' + s.translatedText + '\n';
  }).join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  var inputPath = process.argv[2] || "C:\\Users\\ASUS ROD\\Downloads\\Video\\[Reducing Mosaic]SKMJ-418 A Documentary-style AV Featuring Ordinary Men And Women Dking At Home With Slutty Nymphomaniacs And Cumming Inside Them Until Morning. A Harem Party Where Two Beautiful Women Will Fuck Your D.srt";
  if (!inputPath) {
    console.error('Usage: node tests/translate-full-srt.js "path\\to\\file.srt"');
    process.exit(1);
  }
  if (!fs.existsSync(inputPath)) {
    console.error('File not found: ' + inputPath);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('  Full SRT Translation - Japanese -> Vietnamese (Gemini Chat)');
  console.log('='.repeat(70));

  var srtContent = fs.readFileSync(inputPath, 'utf8');
  var segments = parseSRT(srtContent);
  console.log('  Input: ' + path.basename(inputPath));
  console.log('  Segments: ' + segments.length);

  var chunks = chunkSegments(segments);
  console.log('  Chunks: ' + chunks.length);
  console.log('');

  // Launch Playwright
  var profileDir = path.resolve(process.cwd(), '../../user_data/ai-sessions/gemini-profile');
  console.log('[SETUP] Launching headless Playwright...');

  var context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--disable-infobars', '--lang=vi-VN,vi,en-US,en', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  await context.addInitScript(function() {
    try { delete Object.getPrototypeOf(navigator).webdriver; } catch (e) {}
    try { Object.defineProperty(navigator, 'languages', { get: function() { return ['vi-VN', 'vi', 'en-US', 'en']; }, configurable: true }); } catch (e) {}
  });

  var page = context.pages()[0] || await context.newPage();

  // Navigate to fresh chat
  console.log('[SETUP] Navigating to fresh Gemini chat...');
  await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('  URL: ' + page.url());

  // Wait for input
  var inputEl = await page.waitForSelector(SEL_INPUT, { timeout: 15000 });
  console.log('[SETUP] Chat input ready');
  console.log('');

  var allTranslated = [];
  var failedChunks = 0;
  var startTime = Date.now();

  for (var ci = 0; ci < chunks.length; ci++) {
    var chunk = chunks[ci];
    var progress = Math.round(((ci + 1) / chunks.length) * 100);
    var elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log('[CHUNK ' + (ci + 1) + '/' + chunks.length + '] (' + progress + '%, ' + elapsed + 's) ' + chunk.length + ' segments (IDs ' + chunk[0].index + '-' + chunk[chunk.length - 1].index + ')');

    var prompt = buildPrompt(chunk);

    // ── Type prompt ──
    await inputEl.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    // Use evaluate to set text reliably
    await page.evaluate(function(args) {
      var el = document.querySelector(args.sel);
      if (el) {
        el.innerText = args.text;
        el.classList.remove('ql-blank');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { sel: SEL_INPUT, text: prompt });

    await page.waitForTimeout(300);

    // ── Send ──
    var sendClicked = false;
    try {
      var sendBtn = await page.waitForSelector(SEL_SEND, { timeout: 3000 });
      if (sendBtn) { await sendBtn.click(); sendClicked = true; }
    } catch (e) {}
    if (!sendClicked) {
      await page.keyboard.press('Enter');
    }

    // ── Wait for response ──
    // We expect exactly (ci + 1) message-content elements after this request
    var expectedResponseCount = ci + 1;
    var responseText = '';
    var maxWait = 90000; // 90s per chunk
    var waited = 0;
    var pollInterval = 1000; // Poll faster

    while (waited < maxWait) {
      await page.waitForTimeout(pollInterval);
      waited += pollInterval;

      // Check if still generating
      var isGenerating = false;
      try {
        var stopBtn = await page.$(SEL_STOP);
        isGenerating = !!stopBtn;
      } catch (e) {}

      // Count response elements
      var responseCount = 0;
      try {
        var responses = await page.$$(SEL_RESPONSE);
        responseCount = responses.length;
      } catch (e) {}

      // If we have enough responses and not generating, read the latest
      if (responseCount >= expectedResponseCount && !isGenerating) {
        try {
          var allResponses = await page.$$(SEL_RESPONSE);
          var latestResponse = allResponses[expectedResponseCount - 1];
          responseText = await latestResponse.textContent();
        } catch (e) {}
        if (responseText && responseText.trim().length > 10) break;
      }

      // Progress indicator every 10s
      if (waited % 10000 === 0) {
        console.log('  ...waiting (' + (waited / 1000) + 's, responses: ' + responseCount + '/' + expectedResponseCount + ', generating: ' + isGenerating + ')');
      }
    }

    // ── Parse response ──
    var translations = responseText ? parseResponse(responseText) : null;

    if (!translations || translations.length === 0) {
      console.error('  [WARN] No valid translation for chunk ' + (ci + 1) + ' (waited ' + (waited / 1000) + 's, got ' + (responseText ? responseText.length : 0) + ' chars)');
      if (responseText) console.error('  Response preview: ' + responseText.substring(0, 120));
      failedChunks++;
      // Fallback: use original text
      for (var k = 0; k < chunk.length; k++) {
        allTranslated.push({
          index: chunk[k].index, start: chunk[k].start, end: chunk[k].end,
          translatedText: chunk[k].text
        });
      }
    } else {
      // Map translations back to segments
      var transMap = {};
      for (var t = 0; t < translations.length; t++) {
        transMap[translations[t].id] = translations[t].text;
      }
      var matched = 0;
      for (var k = 0; k < chunk.length; k++) {
        var seg = chunk[k];
        var translated = transMap[seg.index];
        if (translated) {
          allTranslated.push({ index: seg.index, start: seg.start, end: seg.end, translatedText: translated });
          matched++;
        } else {
          allTranslated.push({ index: seg.index, start: seg.start, end: seg.end, translatedText: seg.text });
        }
      }
      console.log('  OK - ' + matched + '/' + chunk.length + ' translated (' + (waited / 1000) + 's)');
    }

    // Re-find input for next request (page may have updated)
    try {
      inputEl = await page.waitForSelector(SEL_INPUT, { timeout: 5000 });
    } catch (e) {
      console.error('  [WARN] Input lost, trying to re-find...');
      await page.waitForTimeout(1000);
      inputEl = await page.waitForSelector(SEL_INPUT, { timeout: 10000 });
    }

    // Jitter between requests
    if (ci < chunks.length - 1) {
      var jitter = 500 + Math.floor(Math.random() * 500);
      await page.waitForTimeout(jitter);
    }
  }

  await context.close();

  var totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  var translatedCount = allTranslated.filter(function(t) { return t.translatedText !== segments.find(function(s) { return s.index === t.index; }).text; }).length;

  console.log('');
  console.log('='.repeat(70));
  console.log('  Complete: ' + allTranslated.length + '/' + segments.length + ' segments');
  console.log('  Translated: ' + translatedCount + ', Failed chunks: ' + failedChunks);
  console.log('  Time: ' + totalElapsed + 's');
  console.log('='.repeat(70));

  // Save output
  var finalSRT = reassembleSRT(allTranslated);
  var outputDir = path.resolve(__dirname, 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  var baseName = path.basename(inputPath, '.srt');
  var outputPath = path.resolve(outputDir, baseName + '_vi.srt');
  fs.writeFileSync(outputPath, finalSRT, 'utf8');
  console.log('  Saved: ' + outputPath);
}

main().catch(function(err) {
  console.error('[FATAL]', err);
  process.exit(2);
});
