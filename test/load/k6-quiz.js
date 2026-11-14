// k6 load test for the mosahah-api backend (Cloud Run).
// Public endpoints only — teacher endpoints need Firebase tokens.
// Run:  k6 run test/load/k6-quiz.js
//       k6 run -e BASE_URL=http://localhost:3000 test/load/k6-quiz.js
import http from 'k6/http';
import { check, sleep } from 'k6';

// A missing quiz returns 404 by design — count it as an expected response,
// not a failure.
const QUIZ_PARAMS = { responseCallback: http.expectedStatuses(200, 401, 404) };

export const options = {
  stages: [
    { duration: '20s', target: 10 },   // ramp up
    { duration: '40s', target: 25 },   // sustained load
    { duration: '20s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],       // <1% errors
    http_req_duration: ['p(95)<2000'],    // p95 under 2s
  },
};

const BASE = __ENV.BASE_URL || 'https://mosahah-api-609470896445.europe-west1.run.app';

export default function () {
  // Student takes a quiz → fetches it (optional-auth path + Firestore read)
  const quiz = http.get(`${BASE}/api/quizzes/load-test-id`, QUIZ_PARAMS);
  check(quiz, { 'quiz fetch responds': (r) => [200, 401, 404].includes(r.status) });

  // Health check (light)
  const health = http.get(`${BASE}/api/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  // Privacy page (static)
  http.get(`${BASE}/privacy`);

  sleep(0.5);
}
