const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldAlertStr = `alert('عذراً، لا يمكنك استخدام الذكاء الاصطناعي. يرجى الاشتراك أو تجديد اشتراكك للمتابعة.');`;
const newAlertStr = `alert(\`عذراً، لا يمكنك استخدام الذكاء الاصطناعي. يرجى الاشتراك أو تجديد اشتراكك للمتابعة.\\n(الحساب: \${user?.email || user?.phone || 'غير معروف'})\`);`;

code = code.replace(oldAlertStr, newAlertStr);
code = code.replace(oldAlertStr, newAlertStr); // For the second occurrence

fs.writeFileSync('src/App.tsx', code);
console.log('Done!');
