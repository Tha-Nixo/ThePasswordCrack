const fs = require('fs');

const lines = fs.readFileSync('youtube-titles.txt', 'utf16le').split('\n');
const videoMap = {};

for (const line of lines) {
    const parts = line.trim().split(' ');
    if (parts.length >= 5 && parts.slice(1, 4).join(' ') === 'Password Game Video') {
        const id = parts[0];
        const num = parseInt(parts[4], 10);
        
        if (!isNaN(num)) {
            const minutes = num + 1; // Video 0 is 1 minute, Video 6 is 7 minutes
            // If we already have one, try to prefer the one WITHOUT roman numerals!
            const hasRoman = /[IVXLCDM]/.test(id);
            if (!videoMap[minutes] || (/[IVXLCDM]/.test(videoMap[minutes]) && !hasRoman)) {
                videoMap[minutes] = id;
            }
        }
    }
}

let tsMap = 'const videoMap: Record<number, string> = {\n';
for (const min of Object.keys(videoMap).sort((a,b) => Number(a) - Number(b))) {
    tsMap += `  ${min}: "https://www.youtube.com/watch?v=${videoMap[min]}",\n`;
}
tsMap += '};';

console.log(tsMap);
