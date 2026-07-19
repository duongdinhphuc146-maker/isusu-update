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

async function debugReplay() {
  if (!fs.existsSync(templatePath)) {
    console.error('No template found!');
    return;
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const cookieStr = template.headers['cookie'] || '';

  // Get all potential SAPISID cookies
  const sapisid = getCookieValue(cookieStr, 'SAPISID');
  const secure3p = getCookieValue(cookieStr, '__Secure-3PAPISID');
  const secure1p = getCookieValue(cookieStr, '__Secure-1PAPISID');

  console.log(`[DEBUG] SAPISID: ${sapisid ? 'FOUND' : 'MISSING'}`);
  console.log(`[DEBUG] __Secure-3PAPISID: ${secure3p ? 'FOUND' : 'MISSING'}`);
  console.log(`[DEBUG] __Secure-1PAPISID: ${secure1p ? 'FOUND' : 'MISSING'}`);

  // We will try different cookies and origins to see which one works
  const cookiesToTry = [
    { name: 'SAPISID', value: sapisid },
    { name: '__Secure-3PAPISID', value: secure3p },
    { name: '__Secure-1PAPISID', value: secure1p }
  ].filter(c => c.value);

  // Extract base origin from referer or host
  const referer = template.headers['referer'] || '';
  let refOrigin = 'https://aistudio.google.com';
  if (referer) {
    try { refOrigin = new URL(referer).origin; } catch(e) {}
  }

  // Common origins to test
  const originsToTry = [
    refOrigin,
    'https://aistudio.google.com',
    'https://aistudio.google-b197145817.com' // Analytics sandbox domain
  ];

  for (const cookieItem of cookiesToTry) {
    for (const testOrigin of originsToTry) {
      console.log(`\n[TRYING] Cookie: ${cookieItem.name}, Origin: ${testOrigin}`);

      const freshHash = generateSapisidHash(cookieItem.value, testOrigin);
      const headers = {
        ...template.headers,
        'authorization': `SAPISIDHASH ${freshHash} SAPISID1PHASH ${freshHash} SAPISID3PHASH ${freshHash}`,
        'origin': testOrigin,
        'referer': testOrigin + '/'
      };

      // Clean headers
      delete headers['content-length'];
      delete headers['host'];
      delete headers['connection'];
      delete headers['content-encoding'];

      const testPrompt = '{"translations": [{"id": 1, "text": "Hello"}]}';
      // Replace prompt in body
      const requestBody = template.body.replace('TRANSLATE_ME', testPrompt);

      try {
        const response = await fetch(template.url, {
          method: 'POST',
          headers: headers,
          body: requestBody
        });

        const respText = await response.text();
        console.log(`[RESULT] Status: ${response.status}`);
        if (response.ok) {
          console.log(`[SUCCESS!!!] Replay worked! Response:`, respText.substring(0, 300));
          return;
        } else {
          console.log(`[FAILED] Response:`, respText.substring(0, 200));
        }
      } catch (err) {
        console.error(`[ERROR]`, err.message);
      }
    }
  }
}

debugReplay().catch(console.error);
