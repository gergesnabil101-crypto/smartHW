const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix 1: onAuthStateChanged else block
let marker1 = "} else {\n        setUser(null);\n        setMode('home');";
if (content.includes(marker1)) {
    content = content.replace(marker1, "} else {\n        setUser(null);\n        const params = new URLSearchParams(window.location.search);\n        if (!params.get('id') && !params.get('q')) {\n          setMode('home');\n        }");
    console.log("Fix 1 applied.");
} else {
    console.log("Marker 1 not found!");
}

// Fix 2: fetchSharedQuiz using API instead of Firestore client
let startMarker2 = "const fetchSharedQuiz = async () => {";
let endMarker2 = "fetchSharedQuiz();";

let idx1 = content.indexOf(startMarker2);
let idx2 = content.indexOf(endMarker2, idx1);

if (idx1 !== -1 && idx2 !== -1) {
    let before = content.substring(0, idx1);
    let after = content.substring(idx2);
    let newFetch = `const fetchSharedQuiz = async () => {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('token');
          const headers: any = {};
          if (token) headers['Authorization'] = \`Bearer \${token}\`;
          
          const res = await fetch(\`/api/quizzes/\${id}\`, { headers });
          if (!res.ok) {
            alert('هذا الاختبار غير موجود أو تم حذفه.');
            setIsLoading(false);
            return;
          }
          const data = await res.json();
          setQuiz(data);
          setMode('take-intro');
          setIsShared(true);
        } catch (error: any) {
          console.error("Error fetching shared quiz:", error);
          alert('حدث خطأ أثناء تحميل الاختبار. تأكد من اتصالك بالإنترنت.');
        } finally {
          setIsLoading(false);
        }
      };
      `;
      content = before + newFetch + after;
      console.log("Fix 2 applied.");
} else {
    console.log("Marker 2 not found!");
}

fs.writeFileSync('src/App.tsx', content);
