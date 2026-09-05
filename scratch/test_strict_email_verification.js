/**
 * test_strict_email_verification.js
 * Verifies that:
 * 1. New user registration returns needsEmailConfirmation: true and emailConfirmed: false.
 * 2. User is NOT logged in upon signup.
 * 3. User CANNOT sign in before email confirmation (rejected with isEmailNotConfirmed: true).
 * 4. Once confirmed via confirmUserEmail, user is activated and can sign in successfully.
 */

// Mock browser environment for BillCraftAuth
const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};
global.sessionStorage = {
  clear: () => {}
};
global.window = {
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  location: {
    origin: 'http://localhost:3000',
    pathname: '/login.html',
    search: '',
    hash: ''
  }
};
global.document = {
  readyState: 'complete',
  addEventListener: () => {}
};

// Load js/auth.js
const fs = require('fs');
const path = require('path');
const authSource = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8');
eval(authSource);

async function runTests() {
  console.log('===============================================================');
  console.log('       TESTING STRICT EMAIL VERIFICATION ENFORCEMENT          ');
  console.log('===============================================================\n');

  const testEmail = 'verify_gate_' + Date.now() + '@example.com';
  const testPassword = 'Password123!';
  const testName = 'Alice Gateway';

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

  // 1. Sign up new account
  console.log('Step 1: Signing up new user:', testEmail);
  const signupRes = await global.window.BillCraftAuth.signUp(testEmail, testPassword, { name: testName });
  
  assert(signupRes.success === true, 'signUp returned success: true');
  assert(signupRes.needsEmailConfirmation === true, 'signUp returned needsEmailConfirmation: true');
  assert(signupRes.user.emailConfirmed === false, 'signUp returned account with emailConfirmed: false');
  assert(global.window.BillCraftAuth.getCurrentUser() === null, 'User is NOT automatically signed in (currentUser is null)');

  // 2. Attempt login BEFORE verification
  console.log('\nStep 2: Attempting Sign In before email verification');
  const signinBefore = await global.window.BillCraftAuth.signIn(testEmail, testPassword);
  assert(signinBefore.success === false, 'signIn blocked before email verification');
  assert(signinBefore.isEmailNotConfirmed === true, 'signIn returned isEmailNotConfirmed: true');
  assert(global.window.BillCraftAuth.getCurrentUser() === null, 'currentUser remains null after blocked sign in');

  // 3. Confirm email
  console.log('\nStep 3: Confirming email address via confirmUserEmail()');
  const confirmRes = await global.window.BillCraftAuth.confirmUserEmail(testEmail);
  assert(confirmRes.success === true, 'confirmUserEmail succeeded');
  assert(confirmRes.user.emailConfirmed === true, 'user.emailConfirmed is now true');
  assert(global.window.BillCraftAuth.getCurrentUser() !== null, 'currentUser is now active after confirmation');

  // 4. Attempt login AFTER verification
  console.log('\nStep 4: Signing in after verification');
  // First sign out to test fresh login
  await global.window.BillCraftAuth.signOut();
  assert(global.window.BillCraftAuth.getCurrentUser() === null, 'Successfully signed out');

  const signinAfter = await global.window.BillCraftAuth.signIn(testEmail, testPassword);
  assert(signinAfter.success === true, 'signIn succeeded after verification');
  assert(signinAfter.user.email === testEmail, 'Logged in user email matches');
  assert(global.window.BillCraftAuth.getCurrentUser() !== null, 'currentUser is set and active');

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed.`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
