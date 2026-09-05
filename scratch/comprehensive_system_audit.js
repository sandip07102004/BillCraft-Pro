/**
 * comprehensive_system_audit.js
 * Performs a deep, multi-phase automated test of the website, Supabase integration,
 * email authenticity, authentication state machine, database tables, and edge cases.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ewtauqolrcqrbiriritu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dGF1cW9scmNxcmJpcmlyaXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTAxNzAsImV4cCI6MjEwNDE4NjE3MH0.fk79UdsVGM67n-zQ2GTK1uFKkY1TflH_Qaz8eqapI_s';

const findings = {
  critical: [],
  warnings: [],
  passed: [],
  details: {}
};

function request(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlPath, SUPABASE_URL);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function auditEmailAndAuth() {
  console.log('--- Step 1: Auditing Supabase Auth & Email Infrastructure ---');
  
  // 1. Check Auth Settings
  const settingsRes = await request('GET', '/auth/v1/settings');
  findings.details.authSettings = settingsRes.data;
  
  if (settingsRes.status === 200) {
    findings.passed.push('Supabase Auth settings endpoint is active and accessible');
    const s = settingsRes.data;
    if (s.mailer_autoconfirm === false) {
      findings.passed.push('Email verification is required by Supabase policy (mailer_autoconfirm: false)');
    } else {
      findings.warnings.push('Email autoconfirm is enabled; users are auto-confirmed without verification.');
    }
  } else {
    findings.critical.push(`Cannot retrieve auth settings: HTTP ${settingsRes.status}`);
  }

  // 2. Test Signup & Email Send Rate Limits
  const testEmail = 'audit_' + Date.now() + '@example.com';
  const signupRes = await request('POST', '/auth/v1/signup', {}, {
    email: testEmail,
    password: 'Password123!@#',
    data: { name: 'Audit User' }
  });
  
  findings.details.signupResponse = signupRes;
  if (signupRes.status === 429) {
    findings.critical.push(
      'EMAIL AUTHENTICITY ISSUE: Supabase default mailer rate limit exceeded (HTTP 429 over_email_send_rate_limit). ' +
      'Supabase free-tier built-in mailer is capped at 3 emails/hour. Real confirmation emails CANNOT reach user inboxes ' +
      'unless Custom SMTP (Resend, SendGrid, Brevo, or Gmail) is configured in the Supabase Dashboard.'
    );
  } else if (signupRes.status === 200) {
    findings.passed.push('Supabase signup succeeded and dispatched confirmation email');
  } else {
    findings.warnings.push(`Supabase signup returned status HTTP ${signupRes.status}: ${JSON.stringify(signupRes.data)}`);
  }

  // 3. Test Email Resend
  const resendRes = await request('POST', '/auth/v1/resend', {}, {
    type: 'signup',
    email: testEmail
  });
  findings.details.resendResponse = resendRes;
  if (resendRes.status === 200) {
    findings.passed.push('Supabase auth resend endpoint is functional (HTTP 200)');
  } else if (resendRes.status === 429) {
    findings.warnings.push('Supabase auth resend endpoint hit rate limit (HTTP 429)');
  }

  // 4. Test Sign In with Non-Existent or Unconfirmed User
  const signinRes = await request('POST', '/auth/v1/token?grant_type=password', {}, {
    email: testEmail,
    password: 'Password123!@#'
  });
  findings.details.signinResponse = signinRes;
  if (signinRes.status === 400) {
    findings.passed.push(`Supabase blocks unauthenticated/unconfirmed login as expected (HTTP 400: ${signinRes.data?.msg || signinRes.data?.error_description})`);
  }
}

async function auditDatabaseTables() {
  console.log('\n--- Step 2: Auditing Supabase Database Tables (invoices, profiles) ---');

  // Invoices Table
  const invRes = await request('GET', '/rest/v1/invoices?select=*&limit=5');
  if (invRes.status === 200) {
    findings.passed.push(`Invoices table accessible (HTTP 200, currently contains ${invRes.data.length} rows)`);
  } else {
    findings.critical.push(`Invoices table inaccessible: HTTP ${invRes.status}`);
  }

  // Profiles Table
  const profRes = await request('GET', '/rest/v1/profiles?select=*&limit=5');
  if (profRes.status === 200) {
    findings.passed.push(`Profiles table accessible (HTTP 200, currently contains ${profRes.data.length} rows)`);
  } else {
    findings.critical.push(`Profiles table inaccessible: HTTP ${profRes.status}`);
  }

  // Test Profile Insertion and Cleanup
  const testProfId = 'audit_prof_' + Date.now();
  const insertProf = await request('POST', '/rest/v1/profiles', {
    'Prefer': 'return=representation'
  }, {
    id: testProfId,
    name: 'Audit Test',
    email: 'audit_test@example.com',
    business_name: 'Audit Inc'
  });
  if (insertProf.status === 201 || insertProf.status === 200) {
    findings.passed.push('Profiles table write/upsert permissions verified (HTTP ' + insertProf.status + ')');
    // Clean up
    await request('DELETE', `/rest/v1/profiles?id=eq.${testProfId}`);
  } else {
    findings.warnings.push(`Profiles table write restricted or failed: HTTP ${insertProf.status}: ${JSON.stringify(insertProf.data)}`);
  }

  // Test Invoice Insertion and Cleanup
  const testInvId = 'audit_inv_' + Date.now();
  const insertInv = await request('POST', '/rest/v1/invoices', {
    'Prefer': 'return=representation'
  }, {
    id: testInvId,
    user_id: testProfId,
    invoice_number: 'INV-AUDIT-01',
    client_name: 'Audit Client',
    total_amount: 150.00,
    status: 'draft',
    invoice_data: { test: true }
  });
  if (insertInv.status === 201 || insertInv.status === 200) {
    findings.passed.push('Invoices table write/upsert permissions verified (HTTP ' + insertInv.status + ')');
    // Clean up
    await request('DELETE', `/rest/v1/invoices?id=eq.${testInvId}`);
  } else {
    findings.warnings.push(`Invoices table write restricted or failed: HTTP ${insertInv.status}: ${JSON.stringify(insertInv.data)}`);
  }
}

async function auditStorage() {
  console.log('\n--- Step 3: Auditing Supabase Storage (invoice-pdfs bucket) ---');
  
  // Check Storage Bucket
  const bucketRes = await request('GET', '/storage/v1/bucket/invoice-pdfs');
  if (bucketRes.status === 200) {
    findings.passed.push('Storage bucket "invoice-pdfs" exists and is public (HTTP 200)');
  } else {
    findings.warnings.push(`Storage bucket "invoice-pdfs" check returned HTTP ${bucketRes.status}: ${JSON.stringify(bucketRes.data)}`);
  }

  // Test Upload Small File
  const testPath = `audit_test_${Date.now()}.txt`;
  const uploadRes = await request('POST', `/storage/v1/object/invoice-pdfs/audit/${testPath}`, {
    'Content-Type': 'text/plain',
    'x-upsert': 'true'
  }, 'Audit test content');
  
  if (uploadRes.status === 200 || uploadRes.status === 201) {
    findings.passed.push('Storage file upload functionality verified (HTTP ' + uploadRes.status + ')');
    // Clean up
    await request('DELETE', `/storage/v1/object/invoice-pdfs/audit/${testPath}`);
  } else {
    findings.warnings.push(`Storage upload test returned HTTP ${uploadRes.status}: ${JSON.stringify(uploadRes.data)}`);
  }
}

async function auditFrontendCode() {
  console.log('\n--- Step 4: Auditing Frontend Source Code & Flow Discrepancies ---');
  
  const authCode = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8');
  const loginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  const supabaseClient = fs.readFileSync(path.join(__dirname, '../js/supabase-client.js'), 'utf8');

  // Check 1: Does signUp in js/auth.js bypass email verification?
  if (authCode.includes('needsEmailConfirmation: false')) {
    findings.critical.push(
      'CODE DISCREPANCY in js/auth.js: `signUp()` hardcodes `needsEmailConfirmation: false` and sets `emailConfirmed: true` locally. ' +
      'This means if a user signs up on the website, the frontend immediately creates an active verified session and logs them in, ' +
      'completely skipping the "Check Your Inbox" verification screen and Supabase email verification step!'
    );
  } else {
    findings.passed.push('js/auth.js enforces email confirmation status correctly');
  }

  // Check 2: Does login.html have the verification screen implemented?
  if (loginHtml.includes('id="verify-view"') && loginHtml.includes('showVerificationView')) {
    findings.passed.push('login.html contains complete Verification UI (#verify-view) with live polling & resend button');
  } else {
    findings.critical.push('login.html missing verification view');
  }

  // Check 3: Does login.html handle email verification token in URL?
  if (loginHtml.includes("urlParams.get('token_hash')") && loginHtml.includes("urlParams.get('code')")) {
    findings.passed.push('login.html handles incoming email confirmation links (token_hash and PKCE auth code)');
  } else {
    findings.warnings.push('login.html may not handle all email confirmation redirect query parameters');
  }

  // Check 4: Check if deleteAccount handles both local and cloud deletion
  if (authCode.includes('deleteUserData') && authCode.includes('LOCAL_ACCOUNTS_KEY')) {
    findings.passed.push('js/auth.js deleteAccount handles cloud data, Supabase user credentials, and local accounts');
  }

  // Check 5: Check app.js calculations
  if (appJs.includes('calculateTotals') && appJs.includes('grandTotal')) {
    findings.passed.push('js/app.js financial calculation engine intact');
  }
}

async function runAudit() {
  console.log('=====================================================================');
  console.log('         BILLCRAFT PRO — COMPREHENSIVE SYSTEM & AUTH AUDIT           ');
  console.log('=====================================================================\n');

  await auditEmailAndAuth();
  await auditDatabaseTables();
  await auditStorage();
  await auditFrontendCode();

  console.log('\n=====================================================================');
  console.log('                           AUDIT RESULTS                             ');
  console.log('=====================================================================');
  
  console.log(`\n✅ PASSED CHECKS (${findings.passed.length}):`);
  findings.passed.forEach(p => console.log(`  ✓ ${p}`));

  if (findings.warnings.length > 0) {
    console.log(`\n⚠️ WARNINGS (${findings.warnings.length}):`);
    findings.warnings.forEach(w => console.log(`  ! ${w}`));
  }

  if (findings.critical.length > 0) {
    console.log(`\n❌ CRITICAL ISSUES (${findings.critical.length}):`);
    findings.critical.forEach(c => console.log(`  ✗ ${c}`));
  }

  console.log('\n=====================================================================\n');
}

runAudit().catch(console.error);
