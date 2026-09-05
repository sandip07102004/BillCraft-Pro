const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:3000/login.html', { waitUntil: 'networkidle0' });
    
    // Switch to Sign Up tab
    await page.click('#tab-signup');
    await new Promise(r => setTimeout(r, 600));
    
    // Fill in signup form
    const testEmail = 'verify_flow_' + Date.now() + '@gmail.com';
    await page.type('#signup-name', 'Jane Doe');
    await page.type('#signup-email', testEmail);
    await page.type('#signup-password', 'Secret123!');
    await page.type('#signup-confirm', 'Secret123!');
    
    console.log('Submitting signup for:', testEmail);
    await page.click('#btn-signup');
    
    await new Promise(r => setTimeout(r, 4500));
    
    const currentUrl = page.url();
    console.log('Current URL after signup:', currentUrl);
    
    const verifyViewDisplay = await page.$eval('#view-verify', el => window.getComputedStyle(el).display);
    console.log('Verification view display:', verifyViewDisplay);
    
    const state = await page.evaluate(() => {
      const toast = document.querySelector('.toast');
      const err = document.querySelector('#signup-general-error');
      const notice = document.querySelector('#auth-notice-box');
      return {
        toast: toast ? toast.textContent : null,
        generalError: err ? err.textContent : null,
        notice: notice ? notice.textContent : null,
        localAccounts: localStorage.getItem('billcraft_local_accounts'),
        activeUser: localStorage.getItem('billcraft_user')
      };
    });
    
    console.log('Page State:', JSON.stringify(state, null, 2));

    await browser.close();
  } catch (err) {
    console.error('Test error:', err);
  }
})();
