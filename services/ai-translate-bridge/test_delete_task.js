const fs = require('fs');

async function run() {
  const templatePath = 'C:\\Users\\ASUS ROD\\Downloads\\Capcut tool\\user_data\\ai-sessions\\z-ai-ocr_captured.json';
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  const taskId = '31d1ea1c-73db-11f1-8332-ba848d894b72'; // Chunk 1 task ID from user's screenshot
  const deleteUrl = `https://ocr.z.ai/api/v1/z-ocr/tasks/${taskId}`;

  console.log(`Sending DELETE request to: ${deleteUrl}`);
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: template.headers
  });

  const text = await response.text();
  console.log(`Delete Status: ${response.status} | Response: ${text}`);
}

run().catch(console.error);
