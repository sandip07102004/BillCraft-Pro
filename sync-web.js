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


// Stamp is-apk-native class for APK build
['index.html', 'login.html'].forEach(file => {
  const filePath = path.join(targetDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('<html lang="en">')) {
      content = content.replace('<html lang="en">', '<html lang="en" class="is-apk-native">');
    } else if (content.includes('<html')) {
      content = content.replace(/<html([^>]*)>/, '<html$1 class="is-apk-native">');
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[APK Build] Added is-apk-native class to www/${file}`);
  }
});

console.log('Web assets successfully synced to www folder!');
