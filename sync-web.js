const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'www');

// Ensure www folder exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Items to copy
const itemsToCopy = [
  'index.html',
  'login.html',
  'verified.html',
  'css',
  'js',
  'assets'
];

itemsToCopy.forEach(item => {
  const src = path.join(__dirname, item);
  const dest = path.join(targetDir, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`Copied ${item} -> www/${item}`);
  }
});

console.log('Web assets successfully synced to www folder!');
