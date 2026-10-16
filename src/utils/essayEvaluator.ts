// Specialized Smart Evaluator for Chemistry, Math, Science & Language Questions

export function normalizeArabicText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Remove Arabic diacritics, Tashkeel & Tatweel
    .replace(/[إأآا]/g, 'ا') // Normalize Alef
    .replace(/ة/g, 'ه') // Normalize Ta' Marbuta
    .replace(/ى/g, 'ي') // Normalize Alef Maksura
    .replace(/[،,.;:!?؟"'\-_()]/g, ' ') // Punctuation to space
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeArabicGrammar(text: string): string {
  if (!text) return '';
  let s = normalizeArabicText(text);

  // 1. Strip trailing reasoning/justifications after an answer (e.g. "... لأنه مفرد", "... لأنه جمع مذكر سالم")
  s = s.replace(/\s+(?:و?ذلك\s+)?(?:لانه[ا]?|لكونه[ا]?|بسبب|لعل[هة])\s+.*$/g, ' ');

  // 2. Strip leading justification prefixes (e.g. "لأنه علم مؤنث" -> "علم مؤنث", "لأنها علم مؤنث" -> "علم مؤنث")
  s = s.replace(/^(?:و?ذلك\s+)?(?:لانه[ا]?|لكونه[ا]?|بسبب|لعل[هة])\s+/g, '');

  // 3. Strip filler words (e.g. "مثلا", "ايضا", "فقط")
  s = s.replace(/(?:^|\s)(?:مثلا|ايضا|فقط)(?:$|\s)/g, ' ');

  // 4. Strip "الظاهرة", "المقدرة", "على آخره", "في آخره", "نيابة عن..."
  s = s.replace(/الظاهره(\s+علي\s+اخره)?/g, ' ');
  s = s.replace(/المقدره(\s+علي\s+اخره)?/g, ' ');
  s = s.replace(/(علي|في)?\s*اخره/g, ' ');
  s = s.replace(/نيابه\s+عن\s+[^\s]+/g, ' ');

  // 5. Strip prepositions and prepositional phrases (e.g. "بحرف الجر في", "بحرف الجر", "بـ في", "بفي")
  s = s.replace(/ب?(حرف\s+(الجر|جر))(\s+[^\s]+)?/g, ' ');
  s = s.replace(/(?:^|\s)ب(في|من|الي|عن|علي|الباء|اللام|الكاف)(?:$|\s)/g, ' ');
  s = s.replace(/(?:^|\s)بـ\s*(في|من|الي|عن|علي|الباء|اللام|الكاف)(?:$|\s)/g, ' ');
  s = s.replace(/(?:^|\s)(?:في|من|الي|عن|علي)(?:$|\s)/g, ' ');

  // 6. Standardize "الممنوع من الصرف" علل (Equivalences between المصدر and الوصف):
  // "العلمية والتأنيث" / "علمية وتأنيث" <-> "علم مؤنث"
  s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?التانيث(?:$|\s)/g, ' علم مؤنث ');
  s = s.replace(/(?:^|\s)علم\s+مؤنث(?:\s+(?:لفظي|معنوي|لفظي\s+ومعنوي|حقيقي|مجازي))?(?:$|\s)/g, ' علم مؤنث ');

  // "العلمية والعجمة" <-> "علم أعجمي"
  s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?العجمه(?:$|\s)/g, ' علم اعجمي ');

  // "العلمية ووزن الفعل" <-> "علم على وزن الفعل"
  s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?وزن\s+الفعل(?:$|\s)/g, ' علم وزن الفعل ');
  s = s.replace(/(?:^|\s)علم\s+(?:علي\s+)?وزن\s+الفعل(?:$|\s)/g, ' علم وزن الفعل ');

  // "العلمية وزيادة الألف والنون" <-> "علم مزيد بالألف والنون"
  s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?زياده\s+الالف\s+والنون(?:$|\s)/g, ' علم مزيد بالالف والنون ');
  s = s.replace(/(?:^|\s)علم\s+(?:منتهي|مختوم)\s+بالف\s+ونون(?:\s+(?:زائدتين|زائده))?(?:$|\s)/g, ' علم مزيد بالالف والنون ');

  // "العلمية والتركيب المزجي" <-> "علم مركب مزجي"
  s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?التركيب\s+المزجي(?:$|\s)/g, ' علم مركب مزجي ');
  s = s.replace(/(?:^|\s)علم\s+مركب(?:\s+تركيبا?)?\s+مزجيا?(?:$|\s)/g, ' علم مركب مزجي ');

  // "العلمية ووزن فعل" <-> "علم على وزن فعل"
  s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?(?:وزن\s+فعل|العدل)(?:$|\s)/g, ' علم وزن فعل ');
  s = s.replace(/(?:^|\s)علم\s+(?:علي\s+)?وزن\s+فعل(?:$|\s)/g, ' علم وزن فعل ');

  // "الوصفية ووزن أفعل" <-> "صفة على وزن أفعل"
  s = s.replace(/(?:^|\s)(?:الوصفيه|وصفيه)\s+(?:و\s*)?وزن\s+افعل(?:$|\s)/g, ' صفه وزن افعل ');
  s = s.replace(/(?:^|\s)صفه\s+(?:علي\s+)?وزن\s+افعل(?:$|\s)/g, ' صفه وزن افعل ');

  // "الوصفية ووزن فعلان" <-> "صفة على وزن فعلان"
  s = s.replace(/(?:^|\s)(?:الوصفيه|وصفيه)\s+(?:و\s*)?(?:وزن\s+فعلان|زياده\s+الالف\s+والنون)(?:$|\s)/g, ' صفه وزن فعلان ');
  s = s.replace(/(?:^|\s)صفه\s+(?:علي\s+)?وزن\s+فعلان(?:$|\s)/g, ' صفه وزن فعلان ');

  // 7. Standardize grammatical signs and markers (handling "وعلامة جره الكسرة", "الكسر", etc.)
  s = s.replace(/(و?علامه\s+(الجر|جره|اعرابه))\s+(الكسره|الكسر)/g, ' بالكسره ');
  s = s.replace(/(و?علامه\s+(الرفع|رفعه|اعرابه))\s+(الضمه|الضم)/g, ' بالضمه ');
  s = s.replace(/(و?علامه\s+(النصب|نصبه|اعرابه))\s+(الفتحه|الفتح)/g, ' بالفتحه ');
  s = s.replace(/(و?علامه\s+(الجزم|جزمه|اعرابه))\s+السكون/g, ' بالسكون ');
  s = s.replace(/(و?علامه\s+(الجر|جره|النصب|نصبه|اعرابه))\s+الياء/g, ' بالياء ');
  s = s.replace(/(و?علامه\s+(الرفع|رفعه|اعرابه))\s+الالف/g, ' بالالف ');
  s = s.replace(/(و?علامه\s+(الرفع|رفعه|اعرابه))\s+الواو/g, ' بالواو ');
  s = s.replace(/(و?علامه\s+(الرفع|رفعه|اعرابه))\s+ثبوت\s+النون/g, ' بثبوت النون ');
  s = s.replace(/(و?علامه\s+(النصب|نصبه|الجزم|جزمه|اعرابه))\s+حذف\s+النون/g, ' بحذف النون ');
  s = s.replace(/(و?علامه\s+(الجزم|جزمه|اعرابه))\s+حذف\s+حرف\s+العله/g, ' بحذف حرف العله ');

  s = s.replace(/مجرور\s+وعلامه\s+جره\s+(الكسره|الكسر)/g, 'مجرور بالكسره');
  s = s.replace(/مرفوع\s+وعلامه\s+رفعه\s+(الضمه|الضم)/g, 'مرفوع بالضمه');
  s = s.replace(/منصوب\s+وعلامه\s+نصبه\s+(الفتحه|الفتح)/g, 'منصوب بالفتحه');

  // 8. Short forms & single markers
  s = s.replace(/(?:^|\s)بالكسر(?:$|\s)/g, ' بالكسره ');
  s = s.replace(/(?:^|\s)بالضم(?:$|\s)/g, ' بالضمه ');
  s = s.replace(/(?:^|\s)بالفتح(?:$|\s)/g, ' بالفتحه ');

  // 9. Prepend "اسم " to standalone "مجرور" (e.g. "مجرور بالكسرة" -> "اسم مجرور بالكسرة")
  s = s.replace(/^(?:اسم\s+)?مجرور(\s+|$)/g, 'اسم مجرور$1');

  // 8. Standardize synonyms
  s = s.replace(/صفه\s+مجروره/g, 'نعت مجرور');
  s = s.replace(/صفه\s+مرفوعه/g, 'نعت مرفوع');
  s = s.replace(/صفه\s+منصوبه/g, 'نعت منصوب');

  return s.replace(/\s+/g, ' ').trim();
}

export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}

export function normalizeEquationOrText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)') // normalize LaTeX fractions
    // LaTeX arrows with optional arguments: \xrightarrow{\Delta}, \xrightarrow[\Delta]{heat}, \xrightarrow{...}, \xrightarrow
    .replace(/\\xrightarrow(?:\[[^\]]*\])?\{[^{}]*\}/g, ' -> ')
    .replace(/\\xrightarrow\b/g, ' -> ')
    .replace(/\\(?:rightarrow|longrightarrow|to|Rightarrow|Longrightarrow|rightarrowfill)\b/g, ' -> ')
    .replace(/\\(?:uparrow|downarrow)\b/g, '')
    .replace(/\\(?:times|cdot)\b/g, '*')
    .replace(/\\div\b/g, '/')
    .replace(/\\sqrt(?:\[[^\]]*\])?\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\\pm\b/g, 'pm')
    .replace(/\\(?:delta|Delta)\b/g, 'delta')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\theta\b/g, 'theta')
    .replace(/\\lambda\b/g, 'lambda')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/[\$]/g, '')
    .replace(/[₀]/g, '0').replace(/[₁]/g, '1').replace(/[₂]/g, '2').replace(/[₃]/g, '3')
    .replace(/[₄]/g, '4').replace(/[₅]/g, '5').replace(/[₆]/g, '6').replace(/[₇]/g, '7')
    .replace(/[₈]/g, '8').replace(/[₉]/g, '9')
    .replace(/[⁰]/g, '0').replace(/[¹]/g, '1').replace(/[²]/g, '2').replace(/[³]/g, '3')
    .replace(/[⁴]/g, '4').replace(/[⁵]/g, '5').replace(/[⁶]/g, '6').replace(/[⁷]/g, '7')
    .replace(/[⁸]/g, '8').replace(/[⁹]/g, '9')
    .replace(/[٠]/g, '0').replace(/[١]/g, '1').replace(/[٢]/g, '2').replace(/[٣]/g, '3')
    .replace(/[٤]/g, '4').replace(/[٥]/g, '5').replace(/[٦]/g, '6').replace(/[٧]/g, '7')
    .replace(/[٨]/g, '8').replace(/[٩]/g, '9')
    .replace(/[⁺]/g, '+').replace(/[⁻]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[٫]/g, '.')
    .replace(/[،]/g, ',')
    .replace(/[×·]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[√]/g, 'sqrt')
    .replace(/[π]/g, 'pi')
    .replace(/[θ]/g, 'theta')
    .replace(/[λ]/g, 'lambda')
    .replace(/[Ω]/g, 'ohm')
    .replace(/[μµ]/g, 'micro')
    .replace(/[Δ]/g, 'delta')
    .replace(/(?:<[=\-—–]+>|<[=\-—–]+|[=\-—–]+>|→|⟶|↔|⇌|⇄|⇋)/g, ' -> ')
    // Normalize states of matter: (s), (l), (g), (aq), (صلب), (سائل), (غاز), (محلول), arrows ↑, ↓
    .replace(/\s*\((?:s|l|g|aq|ppt|صلب|سائل|غاز|محلول|مائي)\)/gi, '')
    .replace(/[↑↓]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface EssayMatchResult {
  matched: boolean;
  score: number;
  isCorrect: boolean;
  feedback: string;
  steps: Array<{ description: string; points: number; earned: number }>;
}

/**
 * Extracts and compares balanced chemical equations between student answer and model candidates.
 */
export function tryMatchChemicalEquation(
  studentStr: string,
  modelStr: string,
  points: number,
  isEnglishQ: boolean
): EssayMatchResult | null {
  if (!studentStr || !modelStr) return null;
  const normS = normalizeEquationOrText(studentStr);
  const normM = normalizeEquationOrText(modelStr);

  const extractEqLines = (text: string): string[] => {
    return text
      .split(/\n+|;/)
      .map(l => l.trim())
      .filter(l => l.includes('->') || l.includes('=') || /^[A-Za-z0-9\(\)\s\+\*]+(?:->|=|→)[A-Za-z0-9\(\)\s\+\*]+$/.test(l));
  };

  const sEqs = extractEqLines(normS);
  const mEqs = extractEqLines(normM);

  const candidateModels = mEqs.length > 0 ? mEqs : (normM.includes('->') || normM.includes('=') ? [normM] : []);
  const candidateStudents = sEqs.length > 0 ? sEqs : (normS.includes('->') || normS.includes('=') ? [normS] : []);

  if (candidateModels.length === 0 || candidateStudents.length === 0) return null;

  for (const mEq of candidateModels) {
    const candSides = (mEq.includes('->') ? mEq.split('->') : mEq.split('=')).map(p => p.trim());
    if (candSides.length !== 2) continue;

    for (const sEq of candidateStudents) {
      let studentSides: string[] = [];
      let studentUsedEquals = false;

      if (sEq.includes('->')) {
        studentSides = sEq.split('->').map(p => p.trim());
      } else if (sEq.includes('=')) {
        studentSides = sEq.split('=').map(p => p.trim());
        studentUsedEquals = true;
      }
      if (studentSides.length !== 2) continue;

      const sortTerms = (side: string) =>
        side
          .split('+')
          .map(t => t.replace(/\s+/g, '').trim())
          .filter(Boolean)
          .sort()
          .join('+');

      const sReactants = sortTerms(studentSides[0]);
      const sProducts = sortTerms(studentSides[1]);
      const cReactants = sortTerms(candSides[0]);
      const cProducts = sortTerms(candSides[1]);

      const fixChemZero = (side: string) =>
        side
          .replace(/([A-Za-z0-9])0([A-Za-z0-9]|$)/g, '$1O$2')
          .replace(/\b0(?=[0-9])/g, 'O')
          .replace(/(?<=[(])0(?=[A-Za-z])/g, 'O');

      const sReactantsZeroFixed = sortTerms(fixChemZero(studentSides[0]));
      const sProductsZeroFixed = sortTerms(fixChemZero(studentSides[1]));

      // Exact case and coefficient match
      if (sReactants === cReactants && sProducts === cProducts) {
        if (!studentUsedEquals) {
          return {
            matched: true,
            score: points,
            isCorrect: true,
            feedback: isEnglishQ ? 'Excellent! Accurate and balanced chemical equation matching the model answer.' : 'إجابة ممتازة! معادلة كيميائية موزونة ودقيقة ومطابقة للنموذج (Balanced chemical equation).',
            steps: [{ description: isEnglishQ ? 'Balanced chemical equation' : 'معادلة كيميائية موزونة (Balanced chemical equation)', points, earned: points }]
          };
        } else {
          return {
            matched: true,
            score: points,
            isCorrect: true,
            feedback: isEnglishQ ? 'Excellent! Balanced chemical equation; (Note: Reaction arrow → is preferred over = in chemical equations).' : 'إجابة ممتازة وصحيحة بالكامل! معادلة كيميائية موزونة؛ (ملاحظة: يُفضل استخدام سهم التفاعل → بدلاً من علامة = في المعادلات الكيميائية).',
            steps: [{
              description: isEnglishQ ? 'Fully balanced chemical equation' : 'معادلة كيميائية موزونة وصحيحة بالكامل (مع التنبيه لاستخدام السهم →)',
              points,
              earned: points
            }]
          };
        }
      }

      if (sReactantsZeroFixed === cReactants && sProductsZeroFixed === cProducts) {
        return {
          matched: true,
          score: points,
          isCorrect: true,
          feedback: isEnglishQ ? "Excellent! Balanced chemical equation. (Tip: Use capital letter 'O' for oxygen instead of digit '0')." : "إجابة ممتازة! معادلة كيميائية موزونة وصحيحة. (تنبيه: يُفضل كتابة حرف O الكبير لعنصر Oxygen بدلاً من الرقم 0).",
          steps: [{ description: isEnglishQ ? 'Balanced equation' : 'معادلة كيميائية موزونة (Balanced equation)', points, earned: points }]
        };
      }

      // Case-insensitive match (minor casing slip)
      if (
        (sReactants.toLowerCase() === cReactants.toLowerCase() && sProducts.toLowerCase() === cProducts.toLowerCase()) ||
        (sReactantsZeroFixed.toLowerCase() === cReactants.toLowerCase() && sProductsZeroFixed.toLowerCase() === cProducts.toLowerCase())
      ) {
        const partialScore = points <= 1 ? 0.75 : Math.round(points * 0.75 * 100) / 100;
        const deducted = Number((points - partialScore).toFixed(2));
        return {
          matched: true,
          score: partialScore,
          isCorrect: true,
          feedback: isEnglishQ
            ? `Balanced and correct equation. Deducted (${deducted} mark) for element symbols casing (Capital Letters, e.g. Mg instead of mg).`
            : `معادلة موزونة وصحيحة. تم خصم (${deducted} درجة) فقط لمراعاة كتابة رموز العناصر بالأحرف الكبيرة (Capital Letters مثل Mg بدلاً من mg).`,
          steps: [{
            description: isEnglishQ ? 'Balanced equation (minor casing deduction)' : 'معادلة موزونة (خصم طفيف لحالة الأحرف الكبيرة)',
            points,
            earned: partialScore
          }]
        };
      }
    }
  }
  return null;
}

export function checkEssayExactOrEquivalent(
  studentAns: string | undefined | null,
  modelAns: string | undefined | null,
  qPoints: number = 1,
  isEnglishQ: boolean = false,
  keywords?: string[]
): EssayMatchResult {
  const points = Math.max(1, Number(qPoints) || 1);

  if (!studentAns || !studentAns.toString().trim()) {
    return {
      matched: false,
      score: 0,
      isCorrect: false,
      feedback: isEnglishQ ? 'No answer was provided.' : 'لم يتم تقديم إجابة.',
      steps: []
    };
  }

  const rawStudent = studentAns.toString().trim();
  const rawModel = (modelAns || '').toString().trim();

  // Keyword-based automatic grading
  if (keywords && Array.isArray(keywords) && keywords.length > 0) {
    const normStudentForKw = normalizeArabicText(rawStudent).toLowerCase();
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check if any keyword matches
    const matchedKeyword = keywords.find(kw => {
      const cleanKw = normalizeArabicText(kw).toLowerCase().trim();
      if (!cleanKw) return false;
      
      // If it's a short word / chemical symbol or standard word, do a word-boundary-like check or simple inclusion
      if (cleanKw.length <= 3) {
        const regex = new RegExp(`\\b${escapeRegExp(cleanKw)}\\b|\\s${escapeRegExp(cleanKw)}\\s|^${escapeRegExp(cleanKw)}$|^${escapeRegExp(cleanKw)}\\s|\\s${escapeRegExp(cleanKw)}$`, 'i');
        return regex.test(normStudentForKw) || normStudentForKw.includes(cleanKw);
      }
      
      return normStudentForKw.includes(cleanKw);
    });

    if (matchedKeyword) {
      return {
        matched: true,
        score: points,
        isCorrect: true,
        feedback: isEnglishQ
          ? `Excellent! Correct answer verified by keyword match: "${matchedKeyword}".`
          : `إجابة صحيحة وممتازة تحتوي على الكلمة المفتاحية المعتمدة: "${matchedKeyword}".`,
        steps: [{
          description: isEnglishQ
            ? `Keyword match: "${matchedKeyword}"`
            : `مطابقة الكلمة المفتاحية: "${matchedKeyword}"`,
          points,
          earned: points
        }]
      };
    }
  }

  if (!rawModel) {
    return {
      matched: false,
      score: 0,
      isCorrect: false,
      feedback: isEnglishQ ? 'Official model answer not defined.' : 'الإجابة النموذجية غير محددة.',
      steps: []
    };
  }

  // 0. Try chemical equation matching first across lines/sub-parts
  const chemEqMatch = tryMatchChemicalEquation(rawStudent, rawModel, points, isEnglishQ);
  if (chemEqMatch && chemEqMatch.matched) {
    return chemEqMatch;
  }

  const rawNormStudent = normalizeEquationOrText(rawStudent);
  const normStudent = rawNormStudent.toLowerCase();
  const cleanStudentNoSpaces = normStudent.replace(/\s+/g, '');

  // Extract all acceptable variations from the model answer (ONLY explicit OR alternatives)
  const rawCandidates = rawModel
    .split(/\s+(?:or|OR|أو|\|)\s+/i)
    .map(c => c.trim())
    .filter(Boolean);

  const candidateOptions: string[] = [];
  for (const rc of rawCandidates) {
    candidateOptions.push(rc);
    // Extract inside parentheses if present e.g. "Oxygen gas (O2)" -> "O2" and "Oxygen gas"
    // only if the item does not contain line breaks or commas
    if (!rc.includes('\n') && !rc.includes(',') && !rc.includes('،')) {
      const parenMatches = rc.match(/\(([^)]+)\)/g);
      if (parenMatches) {
        parenMatches.forEach(pm => {
          const inner = pm.replace(/[()]/g, '').trim();
          if (inner && inner.length >= 2) candidateOptions.push(inner);
        });
        const withoutParen = rc.replace(/\([^)]+\)/g, '').trim();
        if (withoutParen && withoutParen.length >= 2) candidateOptions.push(withoutParen);
      }
    }
  }

  if (candidateOptions.length === 0) {
    candidateOptions.push(rawModel);
  }

  // 1. Direct and normalized check across all candidate alternatives (Full answer must match)
  for (const cand of candidateOptions) {
    const rawNormCand = normalizeEquationOrText(cand);
    const normCand = rawNormCand.toLowerCase();
    const cleanCandNoSpaces = normCand.replace(/\s+/g, '');

    // Exact string match - with or without spaces, casing, quotes, or outer punctuation
    const stripPunct = (s: string) => s.replace(/["'“”‘’`.,;:!؟?()\[\]{}]/g, '').trim();
    const sNoPunct = stripPunct(normStudent);
    const cNoPunct = stripPunct(normCand);
    const sCleanNoPunct = stripPunct(cleanStudentNoSpaces);
    const cCleanNoPunct = stripPunct(cleanCandNoSpaces);

    const isMatchWithoutCase =
      normStudent === normCand ||
      cleanStudentNoSpaces === cleanCandNoSpaces ||
      (sNoPunct.length > 0 && sNoPunct === cNoPunct) ||
      (sCleanNoPunct.length > 0 && sCleanNoPunct === cCleanNoPunct);

    if (isMatchWithoutCase) {
      // Check if candidate is specifically a chemical symbol or formula (like O2, CO2, H2O, Fe, NaCl, Mg, etc.)
      const rawCandStripped = stripPunct(rawNormCand).replace(/\s+/g, '');
      const rawStudentStripped = stripPunct(rawNormStudent).replace(/\s+/g, '');
      
      const isSingleWordCandidate = !cand.trim().includes(' ') && !rawNormCand.trim().includes(' ');
      const isOrdinaryEnglishWord = /^(oxygen|hydrogen|nitrogen|carbon|copper|iron|magnesium|calcium|sodium|potassium|silver|gold|water|helium|chlorine|sulfur|phosphorus|acid|gas|oxide|carbonate|chloride|sulfate|nitrate|hydroxide|true|false|yes|no|all|none)$/i.test(rawCandStripped);

      const isChemFormulaOrSymbol =
        isSingleWordCandidate &&
        !isOrdinaryEnglishWord &&
        (
          /[0-9₀-₉]/.test(rawCandStripped) ||
          /^[A-Z][a-z]?$/.test(rawCandStripped) ||
          (/^[A-Z][a-z]?(?:[A-Z][a-z]?[0-9₀-₉]*)+$/.test(rawCandStripped) && rawCandStripped.length <= 12)
        );

      // If it's a chemical formula/symbol and student missed capital letters (e.g. o2 vs O2, fe vs Fe, co2 vs CO2):
      if (isChemFormulaOrSymbol && rawStudentStripped !== rawCandStripped && rawStudentStripped.toLowerCase() === rawCandStripped.toLowerCase()) {
        const partialScore = points <= 1 ? 0.75 : Math.round(points * 0.75 * 100) / 100;
        const deducted = Number((points - partialScore).toFixed(2));
        return {
          matched: true,
          score: partialScore,
          isCorrect: true,
          feedback: isEnglishQ
            ? `Correct scientific concept! Deducted (${deducted} mark) for not capitalizing chemical element symbols (e.g., ${rawCandStripped} instead of ${rawStudentStripped}).`
            : `إجابة علمية صحيحة بالمعنى والمفهوم. تم خصم (${deducted} درجة) فقط لمراعاة كتابة رموز العناصر الكيميائية بالأحرف الكبيرة (Capital Letters مثل ${rawCandStripped} بدلاً من ${rawStudentStripped}).`,
          steps: [{
            description: isEnglishQ ? 'Correct chemical symbol (minor casing deduction)' : 'رمز كيميائي صحيح (خصم طفيف لعدم استخدام الأحرف الكبيرة Capital Letters)',
            points,
            earned: partialScore
          }]
        };
      }

      return {
        matched: true,
        score: points,
        isCorrect: true,
        feedback: isEnglishQ ? 'Excellent! Exact correct answer matching the official model answer.' : 'إجابة ممتازة ودقيقة مطابقة تماماً للإجابة النموذجية المعتمدة.',
        steps: [{ description: isEnglishQ ? 'Model answer match' : 'مطابقة الإجابة النموذجية (Model answer match)', points, earned: points }]
      };
    }

    // Check if only math operators/symbols differ (e.g. student wrote 5+2 instead of 5-2)
    // Only applies if the strings were NOT identical and contain actual mathematical/chemical symbols
    const sWithoutSymbols = cleanStudentNoSpaces.replace(/[-+*=:/→⟶]/g, '');
    const cWithoutSymbols = cleanCandNoSpaces.replace(/[-+*=:/→⟶]/g, '');
    const hasMathSymbol = /[-+*=:/→⟶]/.test(cleanStudentNoSpaces) || /[-+*=:/→⟶]/.test(cleanCandNoSpaces);
    if (hasMathSymbol && sWithoutSymbols.length >= 3 && sWithoutSymbols === cWithoutSymbols && cleanStudentNoSpaces !== cleanCandNoSpaces) {
      const partialScore = points <= 1 ? 0.75 : Math.round(points * 0.75 * 100) / 100;
      const deducted = Number((points - partialScore).toFixed(2));
      return {
        matched: true,
        score: partialScore,
        isCorrect: true,
        feedback: `إجابة صحيحة ومطابقة! تم خصم (${deducted} درجة) فقط لوجود خطأ في علامة أو رمز (Sign / Symbol).`,
        steps: [{
          description: 'خطأ طفيف في علامة أو رمز (Sign / Symbol)',
          points,
          earned: partialScore
        }]
      };
    }

    // 2. Mathematical & Numerical equality (Fractions, decimals, percentages, numbers)
    const parseFractionOrNumber = (val: string): number | null => {
      const clean = val.trim().replace(/,/g, '.').replace(/%/g, '');
      if (/^-?\d+(\.\d+)?$/.test(clean)) return parseFloat(clean);
      const fracMatch = clean.match(/^(-?\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)$/);
      if (fracMatch) {
        const denom = parseFloat(fracMatch[3]);
        if (denom !== 0) return parseFloat(fracMatch[1]) / denom;
      }
      return null;
    };

    const sNum = parseFractionOrNumber(normStudent);
    const cNum = parseFractionOrNumber(normCand);
    if (sNum !== null && cNum !== null && Math.abs(sNum - cNum) < 0.00001) {
      return {
        matched: true,
        score: points,
        isCorrect: true,
        feedback: 'إجابة رياضية صحيحة ودقيقة (Correct numerical value).',
        steps: [{ description: 'قيمة عددية صحيحة', points, earned: points }]
      };
    }

    // 3. Arabic normalized match (handling Alef variations, Ta Marbuta, Tashkeel)
    const arStudent = normalizeArabicText(rawStudent);
    const arCand = normalizeArabicText(cand);
    if (arStudent && arCand && arStudent === arCand) {
      return {
        matched: true,
        score: points,
        isCorrect: true,
        feedback: 'إجابة ممتازة ودقيقة مطابقة تماماً للإجابة النموذجية المعتمدة.',
        steps: [{ description: 'مطابقة الإجابة النموذجية', points, earned: points }]
      };
    }

    // 3.5. Arabic Grammar & I'rab Equivalence (e.g. "اسم مجرور وعلامة جره الكسرة" vs "اسم مجرور بحرف الجر (في) وعلامة جره الكسرة الظاهرة لأنه مفرد")
    const gramStudent = normalizeArabicGrammar(rawStudent);
    const gramCand = normalizeArabicGrammar(cand);
    if (gramStudent && gramCand && gramStudent.length >= 4 && gramCand.length >= 4) {
      if (gramStudent === gramCand) {
        return {
          matched: true,
          score: points,
          isCorrect: true,
          feedback: 'إجابة لغوية ونحوية ممتازة وصحيحة 100% ومطابقة للمطلوب.',
          steps: [{ description: 'إجابة صحيحة ومطابقة للنموذج (نحو وصرف وإعراب)', points, earned: points }]
        };
      }
    }

    // 4. Minor Typo Tolerance (ONLY for descriptive words/sentences - NEVER for equations, formulas, or numbers)
    const hasScientificOrNumbers = /[->=+\\^_{}\$\*\/]|\d|[a-zA-Z]/.test(rawStudent) || /[->=+\\^_{}\$\*\/]|\d|[a-zA-Z]/.test(cand);
    if (!hasScientificOrNumbers && arStudent && arCand) {
      const dist = levenshteinDistance(arStudent, arCand);
      if ((arCand.length >= 4 && dist === 1) || (arCand.length >= 10 && dist <= 2)) {
        return {
          matched: true,
          score: points,
          isCorrect: true,
          feedback: 'إجابة صحيحة ومطابقة علمياً مع التجاوز عن خطأ إملائي طفيف في حرف واحد.',
          steps: [{ description: 'إجابة صحيحة مع تجاوز خطأ حرف', points, earned: points }]
        };
      }
    }
  }

  // Fallback: If not an exact or equivalent match, pass to AI
  return {
    matched: false,
    score: 0,
    isCorrect: false,
    feedback: '',
    steps: []
  };
}

/**
 * Checks semantic and conceptual equivalence between student answer and model answer,
 * focusing on meaning rather than verbatim text or writing style.
 * Strictly checks for negations, contradictions, and completeness to NEVER grant full credit to incomplete answers.
 */
export function checkSemanticEquivalence(
  studentAns: string,
  modelAns: string,
  points: number,
  isEnglish: boolean
): EssayMatchResult {
  if (!studentAns || !modelAns) {
    return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
  }

  const sRaw = studentAns.toString().trim();
  const mRaw = modelAns.toString().trim();

  // Negation and contradiction detection
  const arabicNegations = ['لا', 'لم', 'لن', 'ليس', 'ليست', 'غير', 'بدون', 'دون', 'عدم'];
  const englishNegations = ['not', 'no', 'never', 'without', "didn't", "don't", "won't", "isn't", "aren't", "cannot"];

  const hasArabicNegation = (txt: string) => {
    const words = txt.split(/\s+/);
    return words.some(w => arabicNegations.includes(w.trim()));
  };
  const hasEnglishNegation = (txt: string) => {
    const words = txt.toLowerCase().split(/\s+/);
    return words.some(w => englishNegations.includes(w.trim()));
  };

  const studentHasNegation = isEnglish ? hasEnglishNegation(sRaw) : hasArabicNegation(sRaw);
  const modelHasNegation = isEnglish ? hasEnglishNegation(mRaw) : hasArabicNegation(mRaw);

  // If one has a negation and the other does not, they are likely contradictory; do not match heuristically
  if (studentHasNegation !== modelHasNegation) {
    return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
  }

  // Common Arabic stop words to ignore when comparing conceptual meaning
  const arabicStopWords = new Set([
    'في', 'من', 'الي', 'إلى', 'عن', 'علي', 'على', 'مع', 'بين', 'حول', 'تحت', 'فوق',
    'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي', 'الذين', 'هو', 'هي', 'هما', 'هم', 'هن',
    'انا', 'نحن', 'انت', 'انتم', 'كان', 'كانت', 'يكون', 'تكون', 'ان', 'أن', 'إن', 'بان', 'بأن',
    'قد', 'لقد', 'كل', 'جميع', 'بعض', 'غير', 'سوي', 'مثل', 'كما', 'كذلك', 'جدا', 'فقط',
    'ايضا', 'أيضا', 'تم', 'تمت', 'يتم', 'حيث', 'اذ', 'إذ', 'و', 'ف', 'ثم', 'أو', 'او'
  ]);

  // English stop words
  const englishStopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'in', 'on', 'at',
    'to', 'for', 'with', 'by', 'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'from', 'up', 'down', 'of', 'off', 'over', 'under', 'again', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'which',
    'that', 'who', 'whom', 'this', 'these', 'those', 'it', 'its', 'they', 'their', 'we', 'our'
  ]);

  // Strip parenthetical text & auxiliary gas test remarks from model answer to prevent penalizing unrequested details
  const stripAuxiliaryModelDetails = (text: string): string => {
    return text
      .replace(/\([^)]+\)/g, ' ') // strip optional parenthetical notes like (quicklime), (الجير الحي)
      .replace(/(?:that\s+|which\s+)?(?:turns|turned)\s+limewater\s+(?:turbid|milky|cloudy)/gi, ' ')
      .replace(/(?:which\s+|that\s+)?(?:relights|rekindles|re-lights)\s+(?:a\s+)?glowing\s+splint/gi, ' ')
      .replace(/(?:that\s+|which\s+)?(?:burns|ignites)\s+with\s+(?:a\s+)?pop\s+sound/gi, ' ')
      .replace(/causes\s+effervescence/gi, ' ')
      .replace(/(?:الذي\s+|التي\s+)?(?:يعكر|تعكر)\s+ماء\s+الجير(?:\s+الرائق)?/gi, ' ')
      .replace(/(?:الذي\s+|التي\s+)?(?:يشتعل|تشتعل)\s+بفرقعة(?:\s+مميزة)?/gi, ' ')
      .replace(/(?:الذي\s+|التي\s+)?(?:يزداد|تزيد)\s+توهج\s+(?:الشظية|عود\s+الثقاب)/gi, ' ')
      .replace(/\s+/g, ' ');
  };

  // Strip conversational wrappers & colloquial prefixes:
  const cleanStudent = studentAns
    .replace(/(?:^|\s)(?:عشان|علشان|عشان\s+كده|علشان\s+كدة|بسبب|نظرا\s+(?:لان|لأن|لـ)?|لانه[ا]?|لكي|من\s+اجل|حتي|حيث\s+ان|اذ\s+ان|وذلك\s+(?:لان|بسبب)?)(?:\s+|$)/gi, ' ')
    .replace(/\s+/g, ' ');

  const cleanModel = stripAuxiliaryModelDetails(modelAns)
    .replace(/(?:^|\s)(?:عشان|علشان|عشان\s+كده|علشان\s+كدة|بسبب|نظرا\s+(?:لان|لأن|لـ)?|لانه[ا]?|لكي|من\s+اجل|حتي|حيث\s+ان|اذ\s+ان|وذلك\s+(?:لان|بسبب)?)(?:\s+|$)/gi, ' ')
    .replace(/\s+/g, ' ');

  // Canonicalize common Arabic and Scientific conceptual synonyms
  const canonicalizeSynonyms = (text: string): string => {
    let t = normalizeArabicGrammar(text);
    // Chemical entities synonyms (English & Arabic)
    t = t.replace(/(?:^|\s)(?:calcium\s+carbonate|كربونات\s+الكالسيوم|caco3)(?:$|\s)/gi, ' caco3 ');
    t = t.replace(/(?:^|\s)(?:calcium\s+oxide|quicklime|اكسيد\s+الكالسيوم|الجير\s+الحي|cao)(?:$|\s)/gi, ' cao ');
    t = t.replace(/(?:^|\s)(?:carbon\s+dioxide(?:\s+gas)?|ثاني\s+اكسيد\s+الكربون|co2)(?:$|\s)/gi, ' co2 ');
    t = t.replace(/(?:^|\s)(?:copper\s+oxide|اكسيد\s+النحاس|cuo)(?:$|\s)/gi, ' cuo ');
    t = t.replace(/(?:^|\s)(?:copper\s+sulfate|كبريتات\s+النحاس|cuso4)(?:$|\s)/gi, ' cuso4 ');
    t = t.replace(/(?:^|\s)(?:copper\s+hydroxide|هيدروكسيد\s+النحاس|cu\(oh\)2)(?:$|\s)/gi, ' cuoh2 ');
    t = t.replace(/(?:^|\s)(?:water(?:\s+vapor)?|بخار\s+الماء|الماء|ماء|h2o)(?:$|\s)/gi, ' h2o ');
    t = t.replace(/(?:^|\s)(?:oxygen(?:\s+gas)?|غاز\s+الاكسجين|اكسجين|o2)(?:$|\s)/gi, ' o2 ');
    t = t.replace(/(?:^|\s)(?:hydrogen(?:\s+gas)?|غاز\s+الهيدروجين|هيدروجين|h2)(?:$|\s)/gi, ' h2 ');
    t = t.replace(/(?:^|\s)(?:magnesium\s+oxide|اكسيد\s+المغنسيوم|mgo)(?:$|\s)/gi, ' mgo ');
    t = t.replace(/(?:^|\s)(?:sodium\s+hydroxide|هيدروكسيد\s+الصوديوم|naoh)(?:$|\s)/gi, ' naoh ');
    t = t.replace(/(?:^|\s)(?:hydrochloric\s+acid|حمض\s+الهيدروكلوريك|hcl)(?:$|\s)/gi, ' hcl ');
    t = t.replace(/(?:^|\s)(?:decomposes\s+by\s+heat|thermal\s+decomposition|ينحل\s+بالحرارة|انحلال\s+حراري|يتفكك\s+بالحرارة|decomposes)(?:$|\s)/gi, ' انحلال_حراري ');

    // Synonyms for increase / rise / elevate / accelerate
    t = t.replace(/(?:^|\s)(?:يزداد|يرتفع|يكبر|يعلو|زياده|ارتفاع|صعود|تزايد|علو|يتسارع|تسارع|تضخم|مضاعفة|يتضاعف)(?:$|\s)/g, ' زيادة ');
    // Synonyms for decrease / drop / decline / decelerate
    t = t.replace(/(?:^|\s)(?:يقل|ينخفض|ينقص|يتناقص|هبوط|انخفاض|نقصان|تقليل|خفض|نقص|تباطؤ|يتباطأ|تثبيط|يقلل)(?:$|\s)/g, ' نقص ');
    // Synonyms for produce / form / secrete / emit / release / precipitate
    t = t.replace(/(?:^|\s)(?:يتكون|ينتج|يظهر|يحدث|يترسب|يفرز|انتاج|تكوين|افراز|خروج|ينبعث|يتصاعد|توليد|يتولد|تكون|راسب|انبعاث)(?:$|\s)/g, ' تكون ');
    // Synonyms for cause / help / lead to / function / role
    t = t.replace(/(?:^|\s)(?:يعمل\s+علي|يساعد\s+علي|يؤدي\s+الي|يتسبب\s+في|يسهم\s+في|يقوم\s+ب|وظيفته|اهميته|دوره|مسؤول\s+عن|مسئول\s+عن)(?:$|\s)/g, ' سبب ');
    // Synonyms for protect / maintain / preserve
    t = t.replace(/(?:^|\s)(?:يحمي|يقي|يحافظ\s+علي|حمايه|وقايه|حفظ|ابقاء|صيانة)(?:$|\s)/g, ' حماية ');
    // Synonyms for speed / fast / immediate
    t = t.replace(/(?:^|\s)(?:سريع|فوري|لحظي|بسرعه|فورا|مباشر|مباشرة)(?:$|\s)/g, ' سرعة ');
    // Synonyms for water / aqueous
    t = t.replace(/(?:^|\s)(?:الميه|المياه|الماء|ماء|مائي|محلول\s+مائي)(?:$|\s)/g, ' ماء ');
    // Synonyms for blood / bloodstream / vessels
    t = t.replace(/(?:^|\s)(?:مجرى\s+الدم|الدم|دم|وعاء\s+دموي|اوعية\s+دموية)(?:$|\s)/g, ' دم ');
    // Synonyms for sugar / glucose
    t = t.replace(/(?:^|\s)(?:سكر|جلوكوز|السكر|سكر\s+الدم)(?:$|\s)/g, ' سكر ');
    // Synonyms for heat / thermal / heating
    t = t.replace(/(?:^|\s)(?:حراره|تسخين|طاقه\s+حراريه|سخونه|حراري|انحلال\s+حراري)(?:$|\s)/g, ' حرارة ');
    // Synonyms for electricity / current / electric
    t = t.replace(/(?:^|\s)(?:كهرباء|تيار\s+كهربي|طاقة\s+كهربائية|كهربي|كهربائي)(?:$|\s)/g, ' كهرباء ');
    // Synonyms for reaction / chemical transformation
    t = t.replace(/(?:^|\s)(?:تفاعل|تحول\s+كيميائي|تغير\s+كيميائي)(?:$|\s)/g, ' تفاعل ');
    // Synonyms for catalyst / enzyme
    t = t.replace(/(?:^|\s)(?:عامل\s+حفاز|عامل\s+مساعد|انزيم|خميرة|محفز)(?:$|\s)/g, ' حفاز ');
    // Synonyms for acid / acidic
    t = t.replace(/(?:^|\s)(?:حمض|حمضي|حمضية|اقل\s+من\s+7)(?:$|\s)/g, ' حمض ');
    // Synonyms for base / alkaline
    t = t.replace(/(?:^|\s)(?:قلوي|قاعدي|قاعدة|قلوية|اكبر\s+من\s+7)(?:$|\s)/g, ' قلوي ');
    // Synonyms for neutral / neutralization
    t = t.replace(/(?:^|\s)(?:متعادل|تعادل|تفاعل\s+تعادل|يساوي\s+7)(?:$|\s)/g, ' تعادل ');
    // Synonyms for oxidation / loss of electrons
    t = t.replace(/(?:^|\s)(?:اكسدة|تاكسد|فقد\s+الكترونات)(?:$|\s)/g, ' اكسدة ');
    // Synonyms for reduction / gain of electrons
    t = t.replace(/(?:^|\s)(?:اختزال|اكتساب\s+الكترونات)(?:$|\s)/g, ' اختزال ');
    // Synonyms for photosynthesis
    t = t.replace(/(?:^|\s)(?:بناء\s+ضوئي|تمثيل\s+ضوئي)(?:$|\s)/g, ' بناء ضوئي ');
    // Synonyms for cell division
    t = t.replace(/(?:^|\s)(?:انقسام\s+خلوي|انقسام\s+ميتوزي|انقسام\s+ميوزي|انشطار)(?:$|\s)/g, ' انقسام ');
    return t;
  };

  const normS = isEnglish ? canonicalizeSynonyms(cleanStudent.toLowerCase()) : canonicalizeSynonyms(cleanStudent);
  const normM = isEnglish ? canonicalizeSynonyms(cleanModel.toLowerCase()) : canonicalizeSynonyms(cleanModel);

  // Stemming helper for Arabic to strip common prefixes and suffixes
  const stemArabicWord = (w: string): string => {
    let word = normalizeArabicText(w);
    if (word.startsWith('ال') && word.length >= 5) {
      word = word.slice(2);
    }
    // Strip leading conjunctions (و، ف، ب، ل، ك)
    if (word.length >= 5 && /^[وفبلك]/.test(word)) {
      word = word.slice(1);
    }
    // Strip trailing pronouns/plural suffixes (ها، هم، هن، نا، كم، ات، ون، ين، ه، ي)
    if (word.length >= 5) {
      word = word.replace(/(?:ها|هم|هن|نا|كم|ات|ون|ين|ية|يه)$/, '');
    }
    return word;
  };

  // Extract meaningful tokens
  const extractTokens = (t: string): string[] => {
    const rawTokens = t.split(/[\s,.;:!؟?()\[\]{}"'\-_/]+/).filter(w => w.length >= (isEnglish ? 3 : 2));
    const stopWords = isEnglish ? englishStopWords : arabicStopWords;
    return rawTokens
      .map(w => {
        let word = w;
        if (!isEnglish) {
          word = stemArabicWord(word);
        }
        return word;
      })
      .filter(w => w.length >= (isEnglish ? 3 : 2) && !stopWords.has(w));
  };

  const sTokens = extractTokens(normS);
  const mTokens = extractTokens(normM);

  if (mTokens.length === 0 || sTokens.length === 0) {
    return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
  }

  const sTokenSet = new Set(sTokens);
  // Exact token match or root equality - do NOT do loose substring matching on short words
  const matchedTokens = mTokens.filter(t => sTokenSet.has(t) || sTokens.some(st => (st.length >= 4 && t.length >= 4 && (st.startsWith(t) || t.startsWith(st)))));
  const uniqueModelTokens = Array.from(new Set(mTokens));
  const uniqueMatchedTokens = Array.from(new Set(matchedTokens));

  const coverageRatio = uniqueMatchedTokens.length / uniqueModelTokens.length;

  // Strict Rule 1: FULL CREDIT only if student covers 85% or more of core concepts AND answer has substantive content
  if (coverageRatio >= 0.85 && sTokens.length >= Math.min(uniqueModelTokens.length, 3)) {
    return {
      matched: true,
      score: points,
      isCorrect: true,
      feedback: isEnglish
        ? 'Excellent! Comprehensive correct answer expressing the required concept in your own style.'
        : 'إجابة ممتازة ومكتملة وصحيحة بالمعنى والمفهوم المطلوب، معبراً عنها بأسلوبك الخاص.',
      steps: [{
        description: isEnglish ? 'Full conceptual and semantic accuracy' : 'صحة واكتمال الإجابة بالمعنى والمفهوم المطلوب',
        points,
        earned: points
      }]
    };
  }

  // Strict Rule 2: INCOMPLETE ANSWER (Partial credit: 50% to 84% coverage) - NEVER give full credit!
  if (coverageRatio >= 0.50 && uniqueMatchedTokens.length >= 2) {
    const partialScore = Math.max(0.25, Math.round(points * coverageRatio * 100) / 100);
    return {
      matched: true,
      score: partialScore,
      isCorrect: false, // Incomplete answers are NOT marked as fully correct
      feedback: isEnglish
        ? `Incomplete answer: Partial credit awarded (${partialScore}/${points}) for mentioning part of the concept (${uniqueMatchedTokens.slice(0, 3).join(', ')}). The remaining required details are missing.`
        : `إجابة غير مكتملة: تم احتساب درجة جزئية (${partialScore} من ${points}) لذكر جزء من المفهوم المطلوب (${uniqueMatchedTokens.slice(0, 3).join('، ')}). وباقي جوانب الإجابة ناقصة.`,
      steps: [
        {
          description: isEnglish ? 'Correct concepts mentioned' : `مفاهيم صحيحة تم ذكرها (${uniqueMatchedTokens.slice(0, 3).join('، ')})`,
          points: partialScore,
          earned: partialScore
        },
        {
          description: isEnglish ? 'Missing concepts / details' : 'الأجزاء الناقصة وغير المستوفاة من المطلوب',
          points: Number((points - partialScore).toFixed(2)),
          earned: 0
        }
      ]
    };
  }

  // Low coverage (< 50%): Answer is incomplete or off-target; do NOT match heuristically, leave for strict evaluation
  return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
}

/**
 * Detects if the provided texts are predominantly in English (LTR).
 * Returns true if English characters dominate or if pure Latin/English without Arabic.
 */
export function isEnglishContent(...texts: (string | undefined | null)[]): boolean {
  const combined = texts.filter(Boolean).join(' ');
  if (!combined.trim()) return false;
  const arabicMatches = (combined.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const englishMatches = (combined.match(/[a-zA-Z]/g) || []).length;
  if (englishMatches > 0 && arabicMatches === 0) return true;
  return englishMatches > arabicMatches;
}

/**
 * Robust Option Index Resolver
 * Converts any student answer (number, numeric string, letter A-E, Arabic letter أ-هـ, or option text)
 * into a standardized 0-based option index (0, 1, 2, 3...).
 */
export function resolveOptionIndex(ans: any, options?: string[]): number | null {
  if (ans === undefined || ans === null || ans === '') return null;

  // 1. Direct number
  if (typeof ans === 'number' && !isNaN(ans) && ans >= 0) {
    return Math.floor(ans);
  }

  const str = String(ans).trim();
  if (!str) return null;

  // 2. Pure digits (e.g. "0", "1", "2")
  if (/^\d+$/.test(str)) {
    const parsed = parseInt(str, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  // 3. English letter (e.g. "A", "b", "C.", "(D)", "[B]")
  const engMatch = str.match(/^[\[\(\s]*([a-eA-E])[\.\)\]\s]*$/);
  if (engMatch) {
    const letter = engMatch[1].toUpperCase();
    const code = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3, E=4
    if (code >= 0 && code <= 4) return code;
  }

  // 4. Arabic letter (e.g. "أ", "ب", "ج", "د", "هـ", "أ.", "(ب)")
  const arMatch = str.match(/^[\[\(\s]*([أإآابجدوهـه])[\.\)\]\s]*$/);
  if (arMatch) {
    const l = arMatch[1];
    if (l === 'أ' || l === 'إ' || l === 'آ' || l === 'ا') return 0;
    if (l === 'ب') return 1;
    if (l === 'ج') return 2;
    if (l === 'د') return 3;
    if (l === 'هـ' || l === 'ه' || l === 'و') return 4;
  }

  // 5. True/False representation
  const lower = str.toLowerCase();
  if (lower === 'true' || lower === 'صح' || lower === 'صواب' || lower === 't') return 0;
  if (lower === 'false' || lower === 'خطأ' || lower === 'خطا' || lower === 'f') return 1;

  // 6. Match against options text if options array provided
  if (Array.isArray(options) && options.length > 0) {
    const normAns = normalizeArabicText(str);

    // Pass 1: exact normalized match
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (typeof opt !== 'string') continue;
      const normOpt = normalizeArabicText(opt);
      if (normAns === normOpt) {
        return i;
      }
    }

    // Pass 2: strip option prefix if options have "A: ...", "أ: ...", "1- ..."
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (typeof opt !== 'string') continue;
      const cleanOpt = normalizeArabicText(opt.replace(/^[a-zA-Zأ-ي0-9][\.\:\)\-]\s*/, ''));
      const cleanAns = normalizeArabicText(str.replace(/^[a-zA-Zأ-ي0-9][\.\:\)\-]\s*/, ''));
      if (cleanAns && cleanOpt && (cleanAns === cleanOpt || cleanOpt.includes(cleanAns) || cleanAns.includes(cleanOpt))) {
        return i;
      }
    }
  }

  return null;
}

/**
 * Universal Question Answer Correctness Validator
 * Evaluates whether a student answer for MCQ or True/False is 100% correct.
 */
export function isQuestionAnswerCorrect(q: any, studentAns: any): boolean {
  if (studentAns === undefined || studentAns === null || studentAns === '') return false;
  if (!q) return false;

  const rawCorrect = q.correctOptionIndex !== undefined ? q.correctOptionIndex : (q.correctAnswer !== undefined ? q.correctAnswer : q.modelAnswer);
  const correctIndex = resolveOptionIndex(rawCorrect, q.options);
  const studentIndex = resolveOptionIndex(studentAns, q.options);

  // If both resolved to valid option indices, compare them
  if (correctIndex !== null && studentIndex !== null) {
    return correctIndex === studentIndex;
  }

  // True/False special comparison
  if (q.type === 'true-false') {
    const tfCorrect = resolveOptionIndex(rawCorrect);
    const tfStudent = resolveOptionIndex(studentAns);
    if (tfCorrect !== null && tfStudent !== null) {
      return tfCorrect === tfStudent;
    }
  }

  // Text-based fallback (for direct string match)
  if (q.options && Array.isArray(q.options) && correctIndex !== null && q.options[correctIndex] !== undefined) {
    const normCorrect = normalizeArabicText(q.options[correctIndex]);
    const normStudent = normalizeArabicText(String(studentAns));
    if (normCorrect && normStudent) {
      if (normCorrect === normStudent || normCorrect.replace(/\s+/g, '') === normStudent.replace(/\s+/g, '')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts feedback safely for a question across all storage key conventions (q.id, idx, string idx, 1-based, etc.)
 */
export function extractQuestionFeedback(
  feedbackObj: any,
  q: any,
  idx: number
): any {
  if (!feedbackObj || typeof feedbackObj !== 'object') return {};
  if (!q) return {};
  return (
    feedbackObj[q.id] 
    ?? (q.id !== undefined ? feedbackObj[String(q.id)] : undefined)
    ?? feedbackObj[String(idx)] 
    ?? feedbackObj[idx] 
    ?? feedbackObj[String(idx + 1)] 
    ?? feedbackObj[`q_${idx}`] 
    ?? feedbackObj[`q${idx + 1}`] 
    ?? feedbackObj[q.text] 
    ?? {}
  );
}

/**
 * Extracts a student's answer for a question across all storage sources & key conventions.
 */
export function extractQuestionStudentAnswer(
  studentResult: any,
  feedbackObj: any,
  q: any,
  idx: number
): any {
  if (!q) return undefined;

  // 1. From feedback object first
  if (feedbackObj && typeof feedbackObj === 'object') {
    const qf = extractQuestionFeedback(feedbackObj, q, idx);
    if (qf && typeof qf === 'object') {
      if (qf.studentAnswer !== undefined && qf.studentAnswer !== null && qf.studentAnswer !== '') {
        return qf.studentAnswer;
      }
      if (qf.answer !== undefined && qf.answer !== null && qf.answer !== '') {
        return qf.answer;
      }
      if (qf.student_answer !== undefined && qf.student_answer !== null && qf.student_answer !== '') {
        return qf.student_answer;
      }
    }
  }

  // 2. From raw answer fields on studentResult
  if (!studentResult) return undefined;

  const sources = [
    studentResult.student_answers,
    studentResult.answers,
    studentResult.studentAnswers,
    studentResult.responses
  ];

  for (const src of sources) {
    if (!src) continue;
    let parsed: any = src;
    if (typeof src === 'string') {
      try { 
        parsed = JSON.parse(src); 
      } catch { 
        parsed = {}; 
      }
    }
    if (parsed && typeof parsed === 'object') {
      const val = parsed[q.id] 
        ?? (q.id !== undefined ? parsed[String(q.id)] : undefined)
        ?? parsed[String(idx)] 
        ?? parsed[idx] 
        ?? parsed[String(idx + 1)] 
        ?? parsed[`q_${idx}`]
        ?? parsed[`q${idx + 1}`]
        ?? parsed[q.text];
      
      if (val !== undefined && val !== null && val !== '') {
        return val;
      }
    }
  }

  return undefined;
}

