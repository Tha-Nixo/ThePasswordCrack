const https = require('https');
https.get('https://www.youtube.com/results?search_query=28+minutes+9+seconds', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let m;
    const ids = [];
    while ((m = regex.exec(d)) !== null) {
      ids.push(m[1]);
    }
    const filtered = Array.from(new Set(ids)).filter(id => {
      const digitMatch = id.match(/\d/g);
      const digits = digitMatch ? digitMatch.reduce((a,b)=>a+parseInt(b),0) : 0;
      const romans = id.match(/[IVXLCDM]+/g);
      return digits === 0 && !romans;
    });
    console.log("Filtered IDs:", filtered);
  });
});
