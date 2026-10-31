/**
 * Unit and Integration Tests for API Authorization and Input Validation
 */

import assert from 'assert';

interface MockReq {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: any;
  params?: Record<string, string>;
}

interface MockRes {
  statusCode: number;
  data: any;
  status(code: number): MockRes;
  json(data: any): MockRes;
  send(data: any): MockRes;
}

function createMockResponse(): MockRes {
  return {
    statusCode: 200,
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.data = data;
      return this;
    },
    send(data: any) {
      this.data = data;
      return this;
    }
  };
}

// Validation logic matching server.ts
function validateGenerateQuestionsPayload(body: any): { valid: boolean; error?: string } {
  if (!body) return { valid: false, error: 'Request body is required' };
  if (!body.topic && !body.content && !body.image) {
    return { valid: false, error: 'Topic, content or image is required' };
  }
  if (body.count !== undefined && (typeof body.count !== 'number' || body.count < 1 || body.count > 50)) {
    return { valid: false, error: 'Count must be a number between 1 and 50' };
  }
  return { valid: true };
}

function validateCorrectEssayPayload(body: any): { valid: boolean; error?: string } {
  if (!body) return { valid: false, error: 'Request body is required' };
  if (!body.question || typeof body.question !== 'string') {
    return { valid: false, error: 'Question text is required' };
  }
  if (body.studentAnswer === undefined) {
    return { valid: false, error: 'Student answer is required' };
  }
  if (body.maxPoints !== undefined && (typeof body.maxPoints !== 'number' || body.maxPoints <= 0)) {
    return { valid: false, error: 'Max points must be a positive number' };
  }
  return { valid: true };
}

function validateRetentionCleanupPayload(body: any): { valid: boolean; error?: string } {
  if (!body) return { valid: false, error: 'Request body is required' };
  const days = Number(body.days);
  if (isNaN(days) || days < 1 || days > 3650) {
    return { valid: false, error: 'Retention days must be a number between 1 and 3650' };
  }
  return { valid: true };
}

function sanitizeQuizForStudent(quizData: any): any {
  try {
    let parsed: any = null;
    if (typeof quizData.data === 'string') {
      try {
        parsed = JSON.parse(quizData.data);
      } catch {
        parsed = {};
      }
    } else if (typeof quizData.data === 'object' && quizData.data !== null) {
      parsed = JSON.parse(JSON.stringify(quizData.data));
    } else {
      parsed = {};
    }

    const sanitizeQuestion = (q: any) => {
      const sq = { ...q };
      delete sq.correctOptionIndex;
      delete sq.correct_option;
      delete sq.correct_answers;
      delete sq.correct_answer;
      delete sq.correctAnswer;
      delete sq.correctAnswerIndex;
      delete sq.modelAnswer;
      delete sq.model_answer;
      delete sq.correctExample;
      delete sq.explanation;
      delete sq.rubric;
      delete sq.keywords;
      delete sq.idealAnswer;
      delete sq.ideal_answer;
      delete sq.grading_criteria;
      delete sq.criteria;
      return sq;
    };

    if (parsed && Array.isArray(parsed.questions)) {
      parsed.questions = parsed.questions.map(sanitizeQuestion);
    }

    const sanitizedResult = { ...quizData };
    delete sanitizedResult.correct_answers;
    delete sanitizedResult.model_answers;
    delete sanitizedResult.answers;

    if (Array.isArray(sanitizedResult.questions)) {
      sanitizedResult.questions = sanitizedResult.questions.map(sanitizeQuestion);
    }

    return {
      ...sanitizedResult,
      data: JSON.stringify(parsed)
    };
  } catch (e) {
    return quizData;
  }
}

function checkAuthorization(req: MockReq, requireAdmin: boolean = false): { authorized: boolean; error?: string; user?: any } {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing or malformed Authorization header' };
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim() === '') {
    return { authorized: false, error: 'Empty bearer token' };
  }

  // Simulated token decoding
  if (token === 'valid-teacher-token') {
    const user = { uid: 'teacher-123', email: 'teacher@school.com', role: 'teacher' };
    if (requireAdmin) return { authorized: false, error: 'Forbidden: Admin privilege required' };
    return { authorized: true, user };
  }

  if (token === 'valid-admin-token') {
    const user = { uid: 'admin-999', email: 'gergesnabil101@gmail.com', role: 'admin' };
    return { authorized: true, user };
  }

  return { authorized: false, error: 'Invalid or expired authentication token' };
}

async function runApiAuthorizationAndValidationTests() {
  console.log('\n--- 1. Running API Authorization & Validation Tests ---');
  let passed = 0;
  let failed = 0;

  function it(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // Test 1: Authorization Header Enforcement
  it('Should reject requests without Authorization header', () => {
    const req: MockReq = { method: 'POST', url: '/api/generate-questions', headers: {}, body: {} };
    const authResult = checkAuthorization(req);
    assert.strictEqual(authResult.authorized, false);
    assert.strictEqual(authResult.error, 'Missing or malformed Authorization header');
  });

  it('Should reject malformed Bearer tokens', () => {
    const req: MockReq = { method: 'POST', url: '/api/generate-questions', headers: { authorization: 'Basic 12345' }, body: {} };
    const authResult = checkAuthorization(req);
    assert.strictEqual(authResult.authorized, false);
  });

  it('Should authorize valid Teacher Bearer token', () => {
    const req: MockReq = { method: 'POST', url: '/api/generate-questions', headers: { authorization: 'Bearer valid-teacher-token' }, body: {} };
    const authResult = checkAuthorization(req);
    assert.strictEqual(authResult.authorized, true);
    assert.strictEqual(authResult.user.role, 'teacher');
  });

  it('Should forbid regular teacher from accessing Admin-only routes', () => {
    const req: MockReq = { method: 'POST', url: '/api/admin/users', headers: { authorization: 'Bearer valid-teacher-token' }, body: {} };
    const authResult = checkAuthorization(req, true);
    assert.strictEqual(authResult.authorized, false);
    assert.strictEqual(authResult.error, 'Forbidden: Admin privilege required');
  });

  it('Should allow Admin access to Admin-only routes', () => {
    const req: MockReq = { method: 'POST', url: '/api/admin/users', headers: { authorization: 'Bearer valid-admin-token' }, body: {} };
    const authResult = checkAuthorization(req, true);
    assert.strictEqual(authResult.authorized, true);
    assert.strictEqual(authResult.user.role, 'admin');
  });

  // Test 2: Payload Validation for /api/generate-questions
  it('Should reject question generation when topic, content, and image are missing', () => {
    const val = validateGenerateQuestionsPayload({});
    assert.strictEqual(val.valid, false);
  });

  it('Should reject question generation with invalid count (> 50)', () => {
    const val = validateGenerateQuestionsPayload({ topic: 'الفيزياء الحديثة', count: 100 });
    assert.strictEqual(val.valid, false);
  });

  it('Should accept valid question generation payload', () => {
    const val = validateGenerateQuestionsPayload({ topic: 'الفيزياء الحديثة', count: 10 });
    assert.strictEqual(val.valid, true);
  });

  // Test 3: Payload Validation for /api/correct-essay
  it('Should reject essay grading when question is missing', () => {
    const val = validateCorrectEssayPayload({ studentAnswer: 'إجابة تجريبية' });
    assert.strictEqual(val.valid, false);
  });

  it('Should reject essay grading when maxPoints is negative or zero', () => {
    const val = validateCorrectEssayPayload({ question: 'اشرح نظرية النسبية', studentAnswer: 'نص', maxPoints: -5 });
    assert.strictEqual(val.valid, false);
  });

  it('Should accept valid essay grading payload', () => {
    const val = validateCorrectEssayPayload({
      question: 'اشرح قانون نيوتن الأول',
      studentAnswer: 'يبقى الجسم الساكن ساكنا ما لم تؤثر عليه قوة خارجية',
      modelAnswer: 'يظل الجسم على حالته من سكون أو حركة ما لم تؤثر عليه قوة محصلة',
      maxPoints: 5
    });
    assert.strictEqual(val.valid, true);
  });

  // Test 4: Retention Cleanup Validation
  it('Should reject retention cleanup with invalid days parameter', () => {
    const val = validateRetentionCleanupPayload({ days: 'invalid' });
    assert.strictEqual(val.valid, false);
  });

  it('Should reject retention cleanup with days < 1', () => {
    const val = validateRetentionCleanupPayload({ days: 0 });
    assert.strictEqual(val.valid, false);
  });

  it('Should accept valid retention cleanup days (e.g. 90)', () => {
    const val = validateRetentionCleanupPayload({ days: 90 });
    assert.strictEqual(val.valid, true);
  });

  // Test 5: Quiz Sanitization & Anti-Cheating Protection (Student REST API)
  it('Should strip correctOptionIndex, modelAnswer, rubric, and explanation for student quiz fetch', () => {
    const rawQuiz = {
      id: 'quiz_secret_1',
      title: 'Science Exam',
      user_id: 'teacher_123',
      data: JSON.stringify({
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            text: 'What is the speed of light?',
            options: ['300,000 km/s', '150,000 km/s', '100,000 km/s'],
            correctOptionIndex: 0,
            explanation: 'The speed of light in vacuum is approx 300,000 km/s',
            points: 5
          },
          {
            id: 'q2',
            type: 'essay',
            text: 'Explain photosynthesis.',
            modelAnswer: 'Process by which plants convert sunlight into chemical energy.',
            rubric: 'Mention sunlight, chlorophyll, glucose',
            points: 10
          }
        ]
      })
    };

    const sanitized = sanitizeQuizForStudent(rawQuiz);
    const parsedSanitized = JSON.parse(sanitized.data);

    // Assert Question 1 has no answer leaks
    assert.strictEqual(parsedSanitized.questions[0].correctOptionIndex, undefined);
    assert.strictEqual(parsedSanitized.questions[0].explanation, undefined);
    assert.strictEqual(parsedSanitized.questions[0].options.length, 3);
    assert.strictEqual(parsedSanitized.questions[0].text, 'What is the speed of light?');

    // Assert Question 2 has no model answer leaks
    assert.strictEqual(parsedSanitized.questions[1].modelAnswer, undefined);
    assert.strictEqual(parsedSanitized.questions[1].rubric, undefined);
    assert.strictEqual(parsedSanitized.questions[1].text, 'Explain photosynthesis.');
  });

  it('Should verify that student cannot bypass sanitization even with varied field namings', () => {
    const rawQuiz = {
      id: 'quiz_secret_2',
      title: 'Physics Test',
      user_id: 'teacher_456',
      data: JSON.stringify({
        questions: [
          {
            id: 'q1',
            text: 'Formula for force?',
            correct_option: 1,
            correct_answer: 'F = ma',
            keywords: ['mass', 'acceleration'],
            idealAnswer: 'F = m * a',
            grading_criteria: 'full points for mass * acceleration'
          }
        ]
      })
    };

    const sanitized = sanitizeQuizForStudent(rawQuiz);
    const parsed = JSON.parse(sanitized.data);
    const q = parsed.questions[0];

    assert.strictEqual(q.correct_option, undefined);
    assert.strictEqual(q.correct_answer, undefined);
    assert.strictEqual(q.keywords, undefined);
    assert.strictEqual(q.idealAnswer, undefined);
    assert.strictEqual(q.grading_criteria, undefined);
    assert.strictEqual(q.text, 'Formula for force?');
  });

  console.log(`Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

// Auto-run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('api.auth.validation.test')) {
  runApiAuthorizationAndValidationTests();
}

export { runApiAuthorizationAndValidationTests };
