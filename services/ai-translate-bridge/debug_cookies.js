const fs = require('fs');
const path = require('path');

const templatePath = path.resolve('C:/Users/ASUS ROD/Downloads/Capcut tool/user_data/ai-sessions/aistudio_captured.json');

function printCookies() {
  if (!fs.existsSync(templatePath)) {
    console.error('No template found!');
    return;
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const cookieStr = template.headers['cookie'] || '';
  
  console.log('[DEBUG] Raw Captured Cookie Header:');
  console.log(cookieStr);

  const cookies = cookieStr.split(';').map(c => c.trim().split('=')[0]);
  console.log('\n[DEBUG] List of cookie names captured:');
  console.log(cookies);
}

printCookies();
