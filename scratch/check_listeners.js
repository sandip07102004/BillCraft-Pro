const fs = require('fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');

// Find all occurrences of .addEventListener in app.js and check if the target has an 'if' guard
const lines = appJs.split('\n');
const unguardedListeners = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('.addEventListener(')) {
    const targetMatch = line.match(/([a-zA-Z0-9_$.]+)\.addEventListener\(/);
    if (targetMatch) {
      const target = targetMatch[1];
      // Look back 1-4 lines for an 'if' guard
      const prevLines = lines.slice(Math.max(0, i - 4), i).join('\n');
      if (!prevLines.includes(`if (${target})`) && !prevLines.includes(`if (${target.replace('el.', 'el.')})`)) {
        unguardedListeners.push({ line: i + 1, code: line.trim(), target });
      }
    }
  }
}

console.log('Total addEventListener calls checked:', lines.filter(l => l.includes('.addEventListener(')).length);
console.log('Potential unguarded listeners count:', unguardedListeners.length);
unguardedListeners.forEach(u => console.log(`  Line ${u.line}: ${u.target} -> ${u.code}`));
