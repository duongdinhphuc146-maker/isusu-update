const fs = require('fs');

async function run() {
  const url = 'https://ocr.z.ai/assets/OCRResults-Bk66QHgs.js';
  const response = await fetch(url);
  const text = await response.text();

  console.log('Searching for delete keywords...');
  
  // Find matches of "delete" or "DELETE"
  const regex = /delete|DELETE/g;
  let match;
  const indices = [];
  while ((match = regex.exec(text)) !== null) {
    indices.push(match.index);
  }

  console.log(`Found ${indices.length} matches.`);
  for (const idx of indices) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(text.length, idx + 100);
    console.log(`--- Match at ${idx} ---`);
    console.log(text.slice(start, end));
  }
}

run().catch(console.error);
