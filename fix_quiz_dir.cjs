const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace question text
code = code.replace(
  /<div className="leading-relaxed"><MathText text={q\.text \|\| 'سؤال بدون نص'} \/><\/div>/g,
  '<div className="leading-relaxed" dir="auto"><MathText text={q.text || "سؤال بدون نص"} /></div>'
);

// Replace options text
code = code.replace(
  /<div className="text-slate-700 text-sm sm:text-base"><MathText text={opt \|\| \`الخيار \$\{optIndex \+ 1\}\`} \/><\/div>/g,
  '<div className="text-slate-700 text-sm sm:text-base w-full" dir="auto"><MathText text={opt || \`الخيار \${optIndex + 1}\`} /></div>'
);

// Replace essay textarea
code = code.replace(
  /className="w-full p-3 sm:p-4 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500\/20 outline-none transition-all h-32 text-sm sm:text-base"/g,
  'className="w-full p-3 sm:p-4 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all h-32 text-sm sm:text-base" dir="auto"'
);

fs.writeFileSync('src/App.tsx', code);
console.log('Quiz directions updated.');
