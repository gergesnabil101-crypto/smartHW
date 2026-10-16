const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace("ময়reducing", "reducing");

fs.writeFileSync('server.ts', content);
console.log('Fixed typo');
