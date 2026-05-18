const https = require('https');
const tests = [['admin','admin123'],['mostafa','123456'],['hamada','123456']];
async function run() {
  for (const [u, p] of tests) {
    const body = JSON.stringify({ username: u, password: p });
    const result = await new Promise((resolve) => {
      const r = https.request({
        hostname: 'cc-backend-2ogh.onrender.com',
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
      }, (res) => {
        let b = '';
        res.on('data', x => b += x);
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      });
      r.write(body);
      r.end();
    });
    console.log(u + '/' + p, result.status, result.status === 200 ? 'OK' : JSON.parse(result.body).message);
  }
}
run();
