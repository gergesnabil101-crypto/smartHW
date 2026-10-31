/**
 * Master Test Suite Runner
 * Runs all validation, API security, Firebase Rules, Gemini rate limiting, and lifecycle tests.
 */

import { runApiAuthorizationAndValidationTests } from './api.auth.validation.test';
import { runGeminiRateLimitAndAuthTests } from './gemini.ratelimit.test';
import { runAppFlowsTests } from './app.flows.test';
import { execSync } from 'child_process';

async function main() {
  console.log('====================================================');
  console.log('🚀 RUNNING ALL APLET TEST SUITES & SECURITY CHECKS');
  console.log('====================================================');

  const startTime = Date.now();

  try {
    // 1. API Auth & Validation
    await runApiAuthorizationAndValidationTests();

    // 2. Gemini Auth, Rate Limiting & 429 Backoff
    await runGeminiRateLimitAndAuthTests();

    // 3. Application Lifecycle Flows
    await runAppFlowsTests();

    // 4. Firestore Security Rules
    console.log('\n--- 4. Running Firestore Security Rules Static & Assertion Tests ---');
    execSync('npm run test:rules', { stdio: 'inherit' });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('====================================================');
    console.log(`✅ ALL TEST SUITES PASSED SUCCESSFULLY IN ${duration}s!`);
    console.log('====================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST SUITE FAILURE:', error.message || error);
    process.exit(1);
  }
}

main();
