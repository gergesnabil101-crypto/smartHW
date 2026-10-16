const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /<span><MathText text={opt \|\| \`الخيار \$\{optIndex \+ 1\}\`} \/><\/span>/g,
  '<span className="flex-1 text-right" dir="auto"><MathText text={opt || `الخيار ${optIndex + 1}`} /></span>'
);

code = code.replace(
  /<div className="text-sm sm:text-base text-slate-700 whitespace-pre-wrap">/g,
  '<div className="text-sm sm:text-base text-slate-700 whitespace-pre-wrap" dir="auto">'
);

code = code.replace(
  /<div className=\{\`text-sm sm:text-base \$\{isFullCorrect \? 'text-emerald-900' : isPartial \? 'text-amber-950' : 'text-indigo-900'\}\`\}>/g,
  '<div className={`text-sm sm:text-base ${isFullCorrect ? "text-emerald-900" : isPartial ? "text-amber-950" : "text-indigo-900"}`} dir="auto">'
);

code = code.replace(
  /<span className="text-slate-600"><MathText text=\{step\.description\} \/><\/span>/g,
  '<span className="text-slate-600 flex-1 text-right" dir="auto"><MathText text={step.description} /></span>'
);

code = code.replace(
  /<div className="text-sm sm:text-base text-emerald-900 whitespace-pre-wrap">/g,
  '<div className="text-sm sm:text-base text-emerald-900 whitespace-pre-wrap" dir="auto">'
);

// Review answers for manual grading
code = code.replace(
  /<p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">/g,
  '<p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed" dir="auto">'
);

code = code.replace(
  /<p className="text-emerald-900 text-sm whitespace-pre-wrap leading-relaxed">/g,
  '<p className="text-emerald-900 text-sm whitespace-pre-wrap leading-relaxed" dir="auto">'
);

fs.writeFileSync('src/App.tsx', code);
console.log('Results directions updated.');
