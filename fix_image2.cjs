const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldCode = `                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const img = new Image();
                              img.onload = () => {`;

const newCode = `                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const img = new window.Image();
                              img.onload = () => {`;

code = code.replace(oldCode, newCode);

fs.writeFileSync('src/App.tsx', code);
console.log('Fixed second Image conflict!');
