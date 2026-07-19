const fs = require('fs');

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function run() {
  const templatePath = 'C:\\Users\\ASUS ROD\\Downloads\\Capcut tool\\user_data\\ai-sessions\\z-ai-ocr_captured.json';
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  console.log('Sending debug test request...');
  const res = await fetch(template.url, {
    method: 'POST',
    headers: template.headers,
    body: 'test'
  });
  console.log('Response Status:', res.status);
  console.log('Response Headers:', JSON.stringify(Object.fromEntries(res.headers.entries())));
  const text = await res.text();
  console.log('Response Body:', text);
}

run().catch(console.error);
