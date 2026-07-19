const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const templatePath = path.resolve('C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions/aistudio_captured.json');

function getCookieValue(cookieStr, name) {
  const matches = cookieStr.match(new RegExp(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`));
  return matches ? matches[2] : '';
}

function generateSapisidHash(sapisid, origin) {
  const time = Math.round(Date.now() / 1000);
  const sha1 = crypto.createHash('sha1').update(`${time} ${sapisid} ${origin}`).digest('hex');
  return `${time}_${sha1}`;
}

async function debugRequestReplay() {
  if (!fs.existsSync(templatePath)) {
    console.error('No template found!');
    return;
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const cookieStr = template.headers['cookie'] || '';

  // Get SAPISID
  const sapisid = getCookieValue(cookieStr, 'SAPISID');
  if (!sapisid) {
    console.error('SAPISID not found in cookie!');
    return;
  }

  const origin = 'https://aistudio.google.com';
  const freshHash = generateSapisidHash(sapisid, origin);
  
  const headers = {
    ...template.headers,
    'authorization': `SAPISIDHASH ${freshHash} SAPISID1PHASH ${freshHash} SAPISID3PHASH ${freshHash}`,
    'origin': origin,
    'referer': origin + '/'
  };

  // Clean headers
  delete headers['content-length'];
  delete headers['host'];
  delete headers['connection'];
  delete headers['content-encoding'];

  const testPrompt = '{"translations": [{"id": 1, "text": "Hello"}]}';
  
  // We will test 3 models: gemini-1.5-flash, gemini-2.5-flash, and the captured model
  const modelsToTest = [
    'models/gemini-2.5-flash',
    'models/gemini-1.5-flash',
    'models/gemini-3.1-flash-lite'
  ];

  for (const model of modelsToTest) {
    console.log(`\n[TESTING MODEL] ${model}`);
    
    // Replace model in body
    let requestBody = template.body.replace('TRANSLATE_ME', testPrompt);
    // Replace the captured model string (gemini-3.1-flash-lite) with our target model
    requestBody = requestBody.replace('models/gemini-3.1-flash-lite', model);

    try {
      const response = await fetch(template.url, {
        method: 'POST',
        headers: headers,
        body: requestBody
      });

      console.log(`[DEBUG] Response Status: ${response.status}`);
      const text = await response.text();
      if (response.ok) {
        console.log(`[SUCCESS!!!] Replay worked for model ${model}! Response:`, text.substring(0, 300));
        return;
      } else {
        console.log(`[FAILED] Response:`, text.substring(0, 250));
      }
    } catch (err) {
      console.error(`[ERROR]`, err.message);
    }
  }
}

debugRequestReplay().catch(console.error);
