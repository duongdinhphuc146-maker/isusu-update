const fs = require('fs');
const path = require('path');

const templatePath = path.resolve('C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions/aistudio_captured.json');

function printBody() {
  if (!fs.existsSync(templatePath)) {
    console.error('No template found!');
    return;
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  console.log('[DEBUG] Captured Body:');
  console.log(template.body);
}

printBody();
