const fs = require('fs');
let code = fs.readFileSync('src/components/modals/TokenBillingModal.tsx', 'utf8');
code = code.replace(
  /const uToday = Number\(u.tokens_used_today \|\| 0\);/g,
  `const todayStr = new Date().toISOString().split('T')[0];\n      const uToday = u.last_token_reset_date === todayStr ? Number(u.tokens_used_today || 0) : 0;`
);
fs.writeFileSync('src/components/modals/TokenBillingModal.tsx', code);
