const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `              <div className="flex items-center gap-2">
                {!isShared && user?.avatar_data && (`;

const replacement = `              <div className="flex items-center gap-2">
                {/* Token Counter Widget */}
                {!isShared && user?.subscription_type?.startsWith('token_') && (() => {
                  const match = user.subscription_type.match(/token_(\\d+)M/);
                  const limit = match ? parseInt(match[1]) * 1000000 : 0;
                  const used = user.tokens_used || 0;
                  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                  return (
                    <div className="flex flex-col items-end mx-1 sm:mx-2 bg-purple-50 px-2 py-0.5 sm:py-1 rounded-lg border border-purple-100">
                      <div className="text-[8px] sm:text-[10px] font-bold text-purple-800 flex items-center gap-1">
                        <Zap size={10} className="text-purple-600 hidden sm:block" />
                        <span>استهلاك الباقة: <span className="font-mono" dir="ltr">{used.toLocaleString()}</span> / <span className="font-mono" dir="ltr">{limit.toLocaleString()}</span></span>
                      </div>
                      <div className="w-full bg-purple-200 h-1 sm:h-1.5 rounded-full mt-0.5 sm:mt-1 overflow-hidden">
                        <div className={\`h-full \${percentage > 90 ? 'bg-red-500' : percentage > 75 ? 'bg-amber-500' : 'bg-purple-500'}\`} style={{ width: \`\${percentage}%\` }}></div>
                      </div>
                    </div>
                  );
                })()}

                {!isShared && user?.avatar_data && (`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Token counter added successfully.');
} else {
  console.log('Target string not found.');
}
