const fs = require('fs');
let code = fs.readFileSync('src/content/solver/elements.ts', 'utf8');

// Fix ELEMENTS_2 keys
code = code.replace(/const ELEMENTS_2: Record<string, number> = \{([\s\S]*?)\};/, (match, content) => {
  const newContent = content.replace(/([a-z]{2}):(\d+)/g, (m, sym, num) => {
    return sym[0].toUpperCase() + sym[1] + ':' + num;
  });
  return 'const ELEMENTS_2: Record<string, number> = {' + newContent + '};';
});

// Fix ELEMENTS_1 keys
code = code.replace(/const ELEMENTS_1: Record<string, number> = \{([\s\S]*?)\};/, (match, content) => {
  const newContent = content.replace(/([a-z]):(\d+)/g, (m, sym, num) => {
    return sym.toUpperCase() + ':' + num;
  });
  return 'const ELEMENTS_1: Record<string, number> = {' + newContent + '};';
});

// Fix scanElements
code = code.replace(/const lower = text\.toLowerCase\(\)\.replace\(\/\[\^a-z\]\/g, ""\);/g, 'const clean = text.replace(/[^a-zA-Z]/g, "");');
code = code.replace(/lower\./g, 'clean.');
code = code.replace(/lower\[/g, 'clean[');

fs.writeFileSync('src/content/solver/elements.ts', code);
console.log('Fixed elements.ts');
