const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const marker = `            if (!params.get('id') && !params.get('q')) {
              setIsLoading(false);
            }
          }
        } catch (error: any) {`;

const endMarker = `    } else if (q) {`;

let startIdx = content.indexOf(marker);
let endIdx = content.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx);
    
    const replacement = `            if (!params.get('id') && !params.get('q')) {
              setIsLoading(false);
            }
          }
        } catch (error: any) {
          console.error("Auth error:", error);
        }
      } else {
        setUser(null);
        setMode('home');
        setAuthMode(null);
        setToken(null);
        localStorage.removeItem('token');
        setIsLoading(false);
      }
    });
    unsubscribeUserRef.current = unsubscribeAuth;
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const id = params.get('id');

    if (id) {
      const fetchSharedQuiz = async () => {
        setIsLoading(true);
        try {
          const quizDoc = await getDoc(doc(db, 'quizzes', id));
          if (quizDoc.exists()) {
            let data = quizDoc.data() as any;
            if (data.questions && Array.isArray(data.questions)) {
              data.questions = data.questions.map((q: any) => {
                const sq = { ...q };
                delete sq.correctOptionIndex;
                delete sq.modelAnswer;
                delete sq.correctExample;
                delete sq.explanation;
                return sq;
              });
            }
            setQuiz({ id, ...data });
            setMode('take-intro');
            setIsShared(true);
          } else {
            alert('هذا الاختبار غير موجود أو تم حذفه.');
          }
        } catch (error: any) {
          console.error("Error fetching shared quiz:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchSharedQuiz();
`;
    
    fs.writeFileSync('src/App.tsx', before + replacement + after);
    console.log("Restored successfully");
} else {
    console.log("Could not find markers to restore");
}
