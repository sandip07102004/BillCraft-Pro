/**
 * test_email_verified_page_flow.js
 * Comprehensive automated verification for the new verified.html page and flow
 */
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  ✅ PASS:', msg);
    passed++;
  } else {
    console.error('  ❌ FAIL:', msg);
    failed++;
  }
}

console.log('===============================================================');
console.log('       TESTING EMAIL VERIFIED PAGE & SIGN-IN FLOW             ');
console.log('===============================================================\n');

// 1. Verify verified.html exists and has required elements
console.log('Step 1: Checking verified.html structure and elements');
const verifiedPath = path.join(__dirname, '../verified.html');
assert(fs.existsSync(verifiedPath), 'verified.html file exists');

const verifiedHtml = fs.readFileSync(verifiedPath, 'utf8');

assert(verifiedHtml.includes('Email Verified Successfully!'), 'verified.html has "Email Verified Successfully!" heading');
assert(verifiedHtml.includes('Please Sign In to Your Account') || verifiedHtml.includes('Please sign in with your password'), 'verified.html instructs the user to sign in');
assert(verifiedHtml.includes('Sign In to Your Account'), 'verified.html has "Sign In to Your Account" primary button');
assert(verifiedHtml.includes('login.html?verified=true'), 'verified.html links to login.html?verified=true');
assert(verifiedHtml.includes('verified-email-badge'), 'verified.html has email badge container');
assert(verifiedHtml.includes('token_hash'), 'verified.html handles token_hash OTP verification');
assert(verifiedHtml.includes('exchangeCodeForSession'), 'verified.html handles PKCE auth code');
assert(verifiedHtml.includes('access_token'), 'verified.html handles implicit access_token from hash');
assert(verifiedHtml.includes('billcraft-logo.png'), 'verified.html includes BillCraft logo');

// 2. Verify js/auth.js directs confirmation emails to verified.html
console.log('\nStep 2: Checking js/auth.js emailRedirectTo configuration');
const authSource = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8');
assert(authSource.includes("replace(/[^/]*$/, '') + 'verified.html'"), 'js/auth.js directs signUp & resend to verified.html');

// 3. Verify login.html handles ?verified=true and incoming confirmation tokens
console.log('\nStep 3: Checking login.html handling of verified=true and redirects');
const loginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');
assert(loginHtml.includes("urlParams.get('verified') === 'true'"), 'login.html checks for ?verified=true');
assert(loginHtml.includes("Email verified successfully!</strong> Please enter your password to sign in"), 'login.html displays email verified sign-in notice');
assert(loginHtml.includes("window.location.replace('verified.html'"), 'login.html forwards incoming confirmation tokens to verified.html');
assert(loginHtml.includes("window.location.href = `verified.html?email="), 'login.html verifyPollingInterval redirects to verified.html upon verification');

// 4. Verify js/app.js forwards incoming confirmation tokens
console.log('\nStep 4: Checking js/app.js token forwarding');
const appSource = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
assert(appSource.includes("window.location.replace('verified.html'"), 'js/app.js forwards incoming confirmation tokens to verified.html');

// 5. Verify vercel.json routing for /verified and cleanUrls
console.log('\nStep 5: Checking vercel.json configuration');
const vercelConfigPath = path.join(__dirname, '../vercel.json');
assert(fs.existsSync(vercelConfigPath), 'vercel.json file exists');
const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
assert(vercelConfig.cleanUrls === true, 'vercel.json has cleanUrls enabled');
assert(Array.isArray(vercelConfig.rewrites) && vercelConfig.rewrites.some(r => r.source === '/verified'), 'vercel.json has rewrite for /verified');
assert(Array.isArray(vercelConfig.rewrites) && vercelConfig.rewrites.some(r => r.source === '/login'), 'vercel.json has rewrite for /login');

console.log('\n===============================================================');
console.log(`SUMMARY: ${passed} Passed, ${failed} Failed.`);
console.log('===============================================================');

if (failed > 0) process.exit(1);
