const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `            if (!params.get('id') && !params.get('q')) {
              setIsLoading(false);
            }
          }
        } catch (error: any) {`;

const replaceStr = `            if (!params.get('id') && !params.get('q')) {
              setIsLoading(false);
            }
          }
          }, (e: any) => {
             if (e?.message?.toLowerCase().includes('quota') || e?.code === 'failed-precondition') setIsQuotaExceeded(true);
          });
        } catch (error: any) {`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log("Syntax fixed!");
