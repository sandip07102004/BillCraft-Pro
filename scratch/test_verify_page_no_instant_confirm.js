const fs = require('fs');
const path = require('path');

const loginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');

console.log('Testing Verify Page Elements...');

// 1. Confirm Your Email button must NOT exist
if (loginHtml.includes('btn-instant-confirm') || loginHtml.includes('>Confirm Your Email<')) {
  console.error('❌ FAIL: "Confirm Your Email" button still found in login.html');
  process.exit(1);
} else {
  console.log('✅ PASS: "Confirm Your Email" button has been completely removed from verify page.');
}

// 2. Rate limit message handling in verify view
if (loginHtml.includes('Supabase email authentication limit is exceeded. Please try again later.') && loginHtml.includes('verify-notice-box')) {
  console.log('✅ PASS: "Supabase email authentication limit is exceeded. Please try again later." message is wired to verify view.');
} else {
  console.error('❌ FAIL: Rate limit message not found in login.html');
  process.exit(1);
}

// 3. Resend email handling has rate limit message
if (loginHtml.includes('btnResendEmail') && loginHtml.includes('Limit Exceeded')) {
  console.log('✅ PASS: Resend email action displays rate limit message properly.');
} else {
  console.error('❌ FAIL: Resend action missing rate limit handling.');
  process.exit(1);
}

console.log('\nAll checks PASSED successfully!');
