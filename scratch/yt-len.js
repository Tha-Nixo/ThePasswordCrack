const https = require('https');
https.get('https://www.youtube.com/watch?v=feSxnGm_ymc', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const match = d.match(/"lengthSeconds":"(\d+)"/);
    console.log(match ? match[1] : "Not found");
  });
});
