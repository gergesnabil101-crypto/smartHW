const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `          if (!res.ok) {
            alert('هذا الاختبار غير موجود أو تم حذفه.');
            setIsLoading(false);
            return;
          }`;

const replaceStr = `          if (!res.ok) {
            alert('هذا الاختبار غير موجود أو تم حذفه.');
            setQuizLoadError('هذا الاختبار غير موجود أو تم حذفه.');
            setMode('take-intro');
            setIsLoading(false);
            return;
          }`;

code = code.replace(targetStr, replaceStr);

const targetStr2 = `        } catch (error: any) {
          console.error("Error fetching shared quiz:", error);
          alert('حدث خطأ أثناء تحميل الاختبار. تأكد من اتصالك بالإنترنت.');
        } finally {
          setIsLoading(false);
        }`;

const replaceStr2 = `        } catch (error: any) {
          console.error("Error fetching shared quiz:", error);
          alert('حدث خطأ أثناء تحميل الاختبار. تأكد من اتصالك بالإنترنت.');
          setQuizLoadError('حدث خطأ أثناء تحميل الاختبار. يرجى المحاولة مرة أخرى.');
          setMode('take-intro');
        } finally {
          setIsLoading(false);
        }`;

code = code.replace(targetStr2, replaceStr2);

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed shared link blank screen bug!");
