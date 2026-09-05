const https = require('https');

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dGF1cW9scmNxcmJpcmlyaXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTAxNzAsImV4cCI6MjEwNDE4NjE3MH0.fk79UdsVGM67n-zQ2GTK1uFKkY1TflH_Qaz8eqapI_s';

function checkBucket() {
  https.get({
    hostname: 'ewtauqolrcqrbiriritu.supabase.co',
    path: '/storage/v1/bucket/invoice-pdfs',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      if (res.statusCode === 200) {
        console.log('✅ PASS: Bucket "invoice-pdfs" exists and is active!');
        console.log('Bucket Details:', d);
      } else {
        console.log('⚠️ Bucket "invoice-pdfs" does not exist yet (Status ' + res.statusCode + ')');
        console.log('Response:', d);
      }
    });
  });
}

checkBucket();
