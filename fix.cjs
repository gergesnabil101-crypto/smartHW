const fs = require("fs");
let content = fs.readFileSync("src/App.tsx", "utf8");

let startIdx = content.indexOf('        } catch (error: any) {');
let endIdx = content.indexOf('        } finally {', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let before = content.substring(0, startIdx);
    let after = content.substring(endIdx);
    let replacement = `        } catch (error: any) {
          let errorMsg = "حدث خطأ أثناء معالجة الصورة.";
          const is429 = error?.status === 429 || error.message?.includes('quota') || error.message?.includes('429');
          const errMsg = (error?.message || '').toLowerCase();
          const isInvalidKey = errMsg.includes('gemini_api_key') || errMsg.includes('غير صالح') || errMsg.includes('api key') || error?.status === 400 || error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('API_KEY_INVALID');
          if (isInvalidKey) {
            errorMsg = "مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير صالح أو منتهي الصلاحية. يرجى إضافة مفتاح صحيح في إعدادات التطبيق (Settings -> Secrets).";
          } else if (is429) {
            errorMsg = "تم تجاوز حصة الاستخدام المسموح بها. يرجى المحاولة لاحقاً.";
          } else {
            console.error("AI Generation Error:", error);
          }
          if (!isInvalidKey && !is429) {
             errorMsg += "\\nالتفاصيل: " + (error.message || 'غير معروف');
          }
          alert(errorMsg);
          setGenerationProgress('');
`;
    fs.writeFileSync("src/App.tsx", before + replacement + after);
    console.log("Success");
} else {
    console.log("Not found");
}
