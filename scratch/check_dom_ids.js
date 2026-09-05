const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');
const loginHtml = fs.readFileSync('login.html', 'utf8');

function checkMissingIds(jsCode, htmlCode, label) {
  const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
  const missing = [];
  let match;
  while ((match = regex.exec(jsCode)) !== null) {
    const id = match[1];
    if (!htmlCode.includes('id="' + id + '"') && !htmlCode.includes("id='" + id + "'")) {
      missing.push(id);
    }
  }
  const uniqueMissing = [...new Set(missing)];
  console.log(label + ' Missing IDs count: ' + uniqueMissing.length);
  if (uniqueMissing.length > 0) {
    console.log('Missing IDs:', uniqueMissing);
  }
}

checkMissingIds(appJs, indexHtml, 'app.js vs index.html:');
checkMissingIds(loginHtml, loginHtml, 'login.html internal:');
