const { execSync } = require('child_process');

const tests = [
  'scratch/test_strict_email_verification.js',
  'scratch/test_verify_page_no_instant_confirm.js',
  'C:/Users/sandi/.gemini/antigravity-ide/brain/bd143dc7-377f-4dfd-b152-ce53b6018b73/scratch/test_full_website.js'
];

let allPassed = true;
tests.forEach(t => {
  try {
    console.log('\n--- Running: ' + t + ' ---');
    const out = execSync(`node "${t}"`, { encoding: 'utf8' });
    console.log(out);
  } catch (err) {
    console.error('FAILED:', t);
    console.error(err.stdout || err.message);
    allPassed = false;
  }
});

if (!allPassed) {
  console.error('\n❌ SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('\n🌟 ALL 3 TEST SUITES PASSED FLAWLESSLY WITH 0 ERRORS!');
}
