import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// ─── Custom metrics ─────────────────────────────────────────────────────────

const errorRate   = new Rate('error_rate');
const slowReqRate = new Rate('slow_request_rate');
const createTrend = new Trend('create_user_duration', true);

// ─── Test configuration ──────────────────────────────────────────────────────

export const options = {
  // Staged load: ramp up → sustain → spike → ramp down
  stages: [
    { duration: '30s', target: 10  }, // warm-up
    { duration: '1m',  target: 30  }, // sustained load
    { duration: '20s', target: 60  }, // spike
    { duration: '30s', target: 30  }, // back to normal
    { duration: '30s', target: 0   }, // ramp down
  ],

  thresholds: {
    // 95% of requests must complete in under 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate must stay below 5%
    error_rate:        ['rate<0.05'],
    // Slow endpoint p99 under 600ms
    slow_request_rate: ['rate<0.10'],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function randomName() {
  const names = ['Taylor', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Drew'];
  return `${names[Math.floor(Math.random() * names.length)]} ${Date.now()}`;
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

export default function () {
  const userId = Math.floor(Math.random() * 3) + 1;

  // 1. Health check
  {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health: status 200': r => r.status === 200 });
    errorRate.add(res.status !== 200);
  }

  sleep(0.2);

  // 2. List all users
  {
    const res = http.get(`${BASE_URL}/api/users`);
    const ok  = check(res, {
      'list users: status 200':        r => r.status === 200,
      'list users: has users array':   r => JSON.parse(r.body).users !== undefined,
    });
    errorRate.add(!ok);
  }

  sleep(0.2);

  // 3. Get single user
  {
    const res = http.get(`${BASE_URL}/api/users/${userId}`);
    check(res, {
      'get user: status 200 or 404': r => r.status === 200 || r.status === 404,
    });
    errorRate.add(res.status >= 500);
  }

  sleep(0.2);

  // 4. Create a user
  {
    const payload = JSON.stringify({
      name:  randomName(),
      email: `perf_${Date.now()}@test.com`,
      role:  'user',
    });
    const start = Date.now();
    const res   = http.post(`${BASE_URL}/api/users`, payload, { headers: JSON_HEADERS });
    createTrend.add(Date.now() - start);
    check(res, { 'create user: status 201': r => r.status === 201 });
    errorRate.add(res.status !== 201);
  }

  sleep(0.2);

  // 5. Slow endpoint (every 5th VU iteration to add latency variety)
  if (__ITER % 5 === 0) {
    const res = http.get(`${BASE_URL}/api/slow`);
    check(res, { 'slow: status 200': r => r.status === 200 });
    slowReqRate.add(res.timings.duration > 400);
    errorRate.add(res.status !== 200);
  }

  sleep(0.5);
}

// ─── HTML report ─────────────────────────────────────────────────────────────

export function handleSummary(data) {
  return {
    'k6/report.html': htmlReport(data),
  };
}
