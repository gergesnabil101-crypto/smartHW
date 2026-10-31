/**
 * Unit Tests for Gemini Authentication, Rate Limiting, 429 Exponential Backoff, and Token Quotas
 */

import assert from 'assert';
import crypto from 'crypto';

interface RateLimiterOptions {
  maxRequestsPerMinute: number;
  maxDailyTokens: number;
}

class MockGeminiService {
  private apiKey: string | undefined;
  private requestTimestamps: number[] = [];
  private dailyTokensUsed: number = 0;
  private lastResetDate: string;
  private readonly options: RateLimiterOptions;

  constructor(apiKey?: string, options: RateLimiterOptions = { maxRequestsPerMinute: 15, maxDailyTokens: 20000 }) {
    this.apiKey = apiKey;
    this.options = options;
    this.lastResetDate = new Date().toISOString().split('T')[0];
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  public checkAuthentication(): { authenticated: boolean; error?: string } {
    if (!this.apiKey || this.apiKey.trim() === '') {
      return { authenticated: false, error: 'GEMINI_API_KEY is not configured or is empty' };
    }
    return { authenticated: true };
  }

  public checkRateLimit(): { allowed: boolean; retryAfterMs?: number; error?: string } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Filter out requests older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);

    if (this.requestTimestamps.length >= this.options.maxRequestsPerMinute) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitTime = Math.max(100, 60000 - (now - oldestInWindow));
      return {
        allowed: false,
        retryAfterMs: waitTime,
        error: `Rate limit exceeded: max ${this.options.maxRequestsPerMinute} requests per minute`
      };
    }

    return { allowed: true };
  }

  public checkDailyQuota(requestedTokens: number = 500): { allowed: boolean; remaining: number; error?: string } {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastResetDate !== today) {
      this.dailyTokensUsed = 0;
      this.lastResetDate = today;
    }

    if (this.dailyTokensUsed + requestedTokens > this.options.maxDailyTokens) {
      return {
        allowed: false,
        remaining: Math.max(0, this.options.maxDailyTokens - this.dailyTokensUsed),
        error: 'Daily token quota exceeded (20,000 tokens/day)'
      };
    }

    return {
      allowed: true,
      remaining: this.options.maxDailyTokens - this.dailyTokensUsed
    };
  }

  public recordUsage(tokens: number) {
    this.requestTimestamps.push(Date.now());
    this.dailyTokensUsed += tokens;
  }

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 50
  ): Promise<{ result?: T; attempts: number; error?: any }> {
    let attempts = 0;
    let delay = initialDelayMs;

    while (attempts < maxRetries) {
      attempts++;
      try {
        const res = await operation();
        return { result: res, attempts };
      } catch (err: any) {
        if (err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429')) {
          if (attempts >= maxRetries) {
            return { attempts, error: err };
          }
          // Exponential backoff with jitter
          const backoff = delay * Math.pow(2, attempts - 1) + Math.random() * 20;
          await new Promise(r => setTimeout(r, backoff));
        } else {
          // Non-retryable error
          return { attempts, error: err };
        }
      }
    }

    return { attempts, error: new Error('Max retries exceeded') };
  }
}

// Signed Attempt Token Helper for Unit Tests
const TEST_SECRET = 'test_secret_key_123';
function testGenerateAttemptToken(quizId: string, studentKey: string, maxAttempts: number): string {
  const payload = {
    quizId,
    studentKey,
    maxAttempts,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex')
  };
  const str = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', TEST_SECRET).update(str).digest('hex');
  return Buffer.from(str).toString('base64url') + '.' + signature;
}

function testVerifyAttemptToken(token: string, expectedQuizId: string): { valid: boolean; payload?: any; error?: string } {
  if (!token) return { valid: false, error: 'Token missing' };
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, error: 'Invalid token structure' };
    const str = Buffer.from(parts[0], 'base64url').toString('utf-8');
    const signature = parts[1];
    const expectedSig = crypto.createHmac('sha256', TEST_SECRET).update(str).digest('hex');
    if (signature !== expectedSig) return { valid: false, error: 'Invalid signature' };
    const payload = JSON.parse(str);
    if (payload.quizId !== expectedQuizId) return { valid: false, error: 'Quiz mismatch' };
    if (Date.now() - payload.issuedAt > 6 * 60 * 60 * 1000) return { valid: false, error: 'Expired' };
    return { valid: true, payload };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

// Masking helpers
function maskStudentName(name?: string): string {
  if (!name || !name.trim()) return '***';
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed[0] + '*';
  return trimmed[0] + '***' + trimmed[trimmed.length - 1];
}

function maskPhoneNumber(phone?: string): string {
  if (!phone || !phone.trim()) return '***';
  const clean = phone.trim().replace(/[^0-9+]/g, '');
  if (clean.length <= 4) return '****';
  return clean.substring(0, 3) + '****' + clean.substring(clean.length - 2);
}

async function runGeminiRateLimitAndAuthTests() {
  console.log('\n--- 2. Running Gemini Auth, Rate Limiting & 429 Backoff Tests ---');
  let passed = 0;
  let failed = 0;

  async function it(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // 1. Authentication checks
  await it('Should fail authentication if GEMINI_API_KEY is missing', () => {
    const service = new MockGeminiService(undefined);
    const auth = service.checkAuthentication();
    assert.strictEqual(auth.authenticated, false);
    assert.ok(auth.error?.includes('GEMINI_API_KEY'));
  });

  await it('Should pass authentication when GEMINI_API_KEY is present', () => {
    const service = new MockGeminiService('AIzaSyDummyKeyForTestingPurposes12345');
    const auth = service.checkAuthentication();
    assert.strictEqual(auth.authenticated, true);
  });

  // 2. Rate Limiting per minute
  await it('Should enforce request rate limit (max 3 requests/min in test)', () => {
    const service = new MockGeminiService('valid-key', { maxRequestsPerMinute: 3, maxDailyTokens: 20000 });
    
    // 3 requests allowed
    assert.strictEqual(service.checkRateLimit().allowed, true);
    service.recordUsage(100);
    assert.strictEqual(service.checkRateLimit().allowed, true);
    service.recordUsage(100);
    assert.strictEqual(service.checkRateLimit().allowed, true);
    service.recordUsage(100);

    // 4th request blocked with retry-after
    const blocked = service.checkRateLimit();
    assert.strictEqual(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs && blocked.retryAfterMs > 0);
  });

  // 3. Daily Token Quota check
  await it('Should track daily token limit and block when 20,000 threshold reached', () => {
    const service = new MockGeminiService('valid-key', { maxRequestsPerMinute: 100, maxDailyTokens: 20000 });
    
    service.recordUsage(15000);
    const check1 = service.checkDailyQuota(4000);
    assert.strictEqual(check1.allowed, true);
    assert.strictEqual(check1.remaining, 5000);

    service.recordUsage(4500); // total 19,500
    const check2 = service.checkDailyQuota(1000); // 19,500 + 1000 > 20000 -> blocked
    assert.strictEqual(check2.allowed, false);
    assert.ok(check2.error?.includes('Daily token quota'));
  });

  // 4. 429 Exponential Backoff & Retry
  await it('Should successfully retry on 429 status code and recover with backoff', async () => {
    const service = new MockGeminiService('valid-key');
    let callCount = 0;

    const mockGeminiCall = async () => {
      callCount++;
      if (callCount < 3) {
        const error: any = new Error('429 Resource has been exhausted (rate limit)');
        error.status = 429;
        throw error;
      }
      return { text: '{"questions": []}', usageMetadata: { totalTokenCount: 250 } };
    };

    const outcome = await service.executeWithRetry(mockGeminiCall, 4, 30);
    assert.strictEqual(outcome.attempts, 3);
    assert.strictEqual(callCount, 3);
    assert.ok(outcome.result);
    assert.strictEqual(outcome.result.usageMetadata.totalTokenCount, 250);
  });

  await it('Should stop retrying and return error if max retries exceeded on continuous 429', async () => {
    const service = new MockGeminiService('valid-key');
    let callCount = 0;

    const failingCall = async () => {
      callCount++;
      const error: any = new Error('429 Rate limit exceeded permanently');
      error.status = 429;
      throw error;
    };

    const outcome = await service.executeWithRetry(failingCall, 3, 20);
    assert.strictEqual(outcome.attempts, 3);
    assert.strictEqual(callCount, 3);
    assert.ok(outcome.error);
  });

  // 5. Signed Attempt Token HMAC Tests
  await it('Should generate and verify valid signed attempt tokens with HMAC-SHA256', () => {
    const token = testGenerateAttemptToken('quiz-123', '01012345678_ahmed', 1);
    assert.ok(token.includes('.'));
    const verified = testVerifyAttemptToken(token, 'quiz-123');
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.payload.quizId, 'quiz-123');
    assert.strictEqual(verified.payload.studentKey, '01012345678_ahmed');
  });

  await it('Should reject tampered or mismatched signed attempt tokens', () => {
    const token = testGenerateAttemptToken('quiz-123', '01012345678_ahmed', 1);
    const mismatched = testVerifyAttemptToken(token, 'quiz-999');
    assert.strictEqual(mismatched.valid, false);

    const tampered = token.slice(0, -5) + 'abcde';
    const tamperedCheck = testVerifyAttemptToken(tampered, 'quiz-123');
    assert.strictEqual(tamperedCheck.valid, false);
  });

  // 6. Anti-PII Logging Masking Tests
  await it('Should properly mask student names and phone numbers to prevent PII leaks', () => {
    const maskedName = maskStudentName('محمد أحمد علي');
    assert.strictEqual(maskedName.startsWith('م'), true);
    assert.strictEqual(maskedName.endsWith('ي'), true);
    assert.ok(maskedName.includes('***'));

    const maskedPhone = maskPhoneNumber('01012345678');
    assert.strictEqual(maskedPhone.startsWith('010'), true);
    assert.strictEqual(maskedPhone.endsWith('78'), true);
    assert.ok(maskedPhone.includes('****'));
  });

  console.log(`Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('gemini.ratelimit.test')) {
  runGeminiRateLimitAndAuthTests();
}

export { runGeminiRateLimitAndAuthTests };

