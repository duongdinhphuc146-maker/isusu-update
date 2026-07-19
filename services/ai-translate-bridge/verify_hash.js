const crypto = require('crypto');

const time = '1781997836';
const sapisid = '757HdPxG12SkJ6gM/AeASiCueXabdCBRWJ';
const expectedHash = '930e684d39ef4bf2a6d5ad0b4ef8b3b493407221';

const origins = [
  'https://aistudio.google.com',
  'https://aistudio.google-b197145817.com',
  'https://alkalimakersuite-pa.clients6.google.com',
  'https://aistudio.google.com/',
  'https://aistudio.google-b197145817.com/',
  'https://alkalimakersuite-pa.clients6.google.com/',
  'aistudio.google.com',
  'aistudio.google-b197145817.com'
];

console.log(`Expected: ${expectedHash}\n`);

for (const origin of origins) {
  const format = `${time} ${sapisid} ${origin}`;
  const hash = crypto.createHash('sha1').update(format).digest('hex');
  console.log(`Origin: "${origin}" -> ${hash} -> ${hash === expectedHash ? 'MATCH!!!' : 'no'}`);
}
