const fs = require('fs');

const lines = fs.readFileSync('youtube-titles.txt', 'utf16le').split('\n');
const ids = new Array(3601).fill("");

for (const line of lines) {
    const parts = line.trim().split(' ');
    if (parts.length >= 5 && parts.slice(1, 4).join(' ') === 'Password Game Video') {
        const id = parts[0];
        const num = parseInt(parts[4], 10);
        
        if (!isNaN(num) && num >= 0 && num <= 3600) {
            ids[num] = id;
        }
    }
}

const tsContent = `export const youtubeIds: string[] = ${JSON.stringify(ids)};\n`;
fs.writeFileSync('src/content/handlers/youtube-ids.ts', tsContent);
console.log('Successfully generated youtube-ids.ts');
