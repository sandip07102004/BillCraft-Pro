const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const ids = [
  'btn-new-invoice', 'btn-save-invoice', 'btn-print-invoice', 'btn-download-pdf',
  'btn-refresh-inv-num', 'invoice-status', 'btn-discount-percent', 'btn-discount-fixed',
  'logo-dropzone', 'logo-file-input', 'btn-remove-logo', 'tab-editor-btn', 'tab-preview-btn'
];
ids.forEach(id => {
  console.log(id + ': ' + (html.includes('id="' + id + '"') ? 'EXISTS' : 'MISSING'));
});
