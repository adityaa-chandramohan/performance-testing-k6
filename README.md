# performance-testing-k6

A production-grade k6 load testing framework with a full observability stack:
**Prometheus** (metrics store) · **Grafana** (pre-provisioned dashboard) · **cAdvisor** (container system metrics) · **prom-client** (API-level metrics).

k6 pushes metrics to Prometheus in real time via remote-write while the test runs.
Grafana shows k6 load metrics *and* API container CPU / memory / network side by side.

---

## Architecture

```
┌─────────────┐   HTTP load    ┌──────────────────────────────────────────┐
│    k6       │ ─────────────► │  Express API  (:3000)                    │
│ (container) │                │  • /metrics  ← prom-client               │
│             │                │    per-route count, duration, error rate  │
└──────┬──────┘                └────────────────┬─────────────────────────┘
       │ remote-write                           │ scrape /metrics
       │ (live, during test)                    │
       ▼                                        ▼
┌──────────────────────────────────────────────────────┐
│             Prometheus  (:9090)                      │
│  • k6 metrics (pushed via remote-write)              │
│  • API metrics (scraped from /metrics)               │
│  • cAdvisor metrics (scraped) ◄── cAdvisor (:8080)  │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  Grafana (:3001) │
              │  Pre-provisioned │
              │  dashboard:      │
              │  k6 + API +      │
              │  System Metrics  │
              └──────────────────┘
```

### What each component measures

| Component | What it collects |
|---|---|
| **k6 remote-write** | VUs, request rate, p50/p95/p99 duration, error rate, check pass rate, custom `create_user_duration` |
| **prom-client (API `/metrics`)** | Per-route request count, per-route duration histogram, Node.js heap, event loop lag, open FDs |
| **cAdvisor** | API container CPU %, RSS memory, network RX/TX bytes |

---

## Quick Start

### Prerequisites

- Docker Desktop (Mac / Windows) or Docker Engine + Compose (Linux)
- `make` (comes with Xcode CLI tools on Mac; `apt install make` on Linux)

### 1. Start the observability stack

```bash
make up
```

This starts: **API** · **Prometheus** · **cAdvisor** · **Grafana**

| Service | URL |
|---|---|
| Grafana dashboard | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| API | http://localhost:3000 |
| API metrics endpoint | http://localhost:3000/metrics |
| cAdvisor | http://localhost:8080 |

### 2. Open Grafana

Navigate to **http://localhost:3001** — the dashboard `k6 Performance + API System Metrics`
is pre-loaded automatically. No login required.

### 3. Run the k6 load test

```bash
make run
```

k6 runs inside a container and pushes metrics to Prometheus every 5 seconds.
Switch to Grafana — VUs, request rate, and response time percentiles populate in real time
alongside the API container's CPU and memory usage.

The test also generates `k6/report.html` (standalone HTML summary) when it finishes.

### 4. Stop everything

```bash
make down        # stop containers, keep Prometheus + Grafana volumes
make clean       # stop containers AND remove all volumes (full reset)
```

---

## Running without Docker (local mode)

```bash
# Install dependencies
cd api && npm install && cd ..

# Install k6
brew install k6   # macOS

# Terminal 1 — start the API
node api/server.js

# Terminal 2 — run the test
k6 run k6/test.js

# Open the HTML report
open k6/report.html
```

---

## k6 Test Details (`k6/test.js`)

### Load stages

| Stage | Duration | Target VUs | Purpose |
|---|---|---|---|
| Warm-up | 30s | 10 | Gradual ramp-up |
| Sustained load | 60s | 30 | Steady state |
| Spike | 20s | 60 | Peak / burst |
| Recovery | 30s | 30 | Back to normal |
| Ramp-down | 30s | 0 | Cool-down |

Total run time: ~3 minutes

### Thresholds (SLOs)

| Metric | Threshold |
|---|---|
| `http_req_duration` | p(95) < 500ms |
| `error_rate` | rate < 5% |
| `slow_request_rate` | rate < 10% |

### Scenarios

1. `GET /health` — health check
2. `GET /api/users` — list users
3. `GET /api/users/:id` — get single user (random ID 1–3)
4. `POST /api/users` — create user with random payload
5. `GET /api/slow` — simulated 100–400ms latency (every 5th iteration)

### Prometheus remote-write output

When running via Docker Compose, k6 is launched with:

```
--out=experimental-prometheus-rw
```

| Variable | Value |
|---|---|
| `K6_PROMETHEUS_RW_SERVER_URL` | `http://prometheus:9090/api/v1/write` |
| `K6_PROMETHEUS_RW_TREND_STATS` | `p(50),p(95),p(99),max` |

Key metrics pushed:

| Metric | Type | Description |
|---|---|---|
| `k6_vus` | Gauge | Active virtual users |
| `k6_http_reqs_total` | Counter | Total HTTP requests |
| `k6_http_req_duration_p50/p95/p99` | Gauge | Response time percentiles |
| `k6_http_req_failed` | Gauge | Fraction of failed requests |
| `k6_error_rate` | Gauge | Custom error rate metric |
| `k6_create_user_duration_*` | Gauge | Custom create-user latency |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus scrape endpoint (prom-client) |
| `GET` | `/api/users` | List users (`?role=admin\|user`) |
| `GET` | `/api/users/:id` | Get user by ID |
| `POST` | `/api/users` | Create user `{name, email, role?}` |
| `PUT` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |
| `GET` | `/api/slow` | Random 100–400ms delay (latency simulation) |

### Metrics at `/metrics`

| Metric | Type | Labels |
|---|---|---|
| `api_http_requests_total` | Counter | `method`, `route`, `status_code` |
| `api_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` |
| `nodejs_heap_size_used_bytes` | Gauge | — |
| `nodejs_eventloop_lag_seconds` | Gauge | — |
| `process_open_fds` | Gauge | — |

---

## Grafana Dashboard

The dashboard `k6 Performance + API System Metrics` is pre-provisioned from
`grafana/dashboards/k6-performance.json`. No manual setup required.

### Dashboard panels

**k6 Load Test**
- Virtual Users (stat + time series)
- HTTP Request Rate (req/s)
- HTTP Request Duration — p50 / p95 / p99 / max
- API Request Duration by Route (server-side histogram from prom-client)
- API Request Rate by Route & Status Code
- Error Rate (with 5% SLO threshold overlay)
- Check Pass Rate

**API Container System Metrics (cAdvisor)**
- Container CPU usage %
- Container RSS + total memory usage
- Container Network RX / TX bytes/s
- Node.js heap used + event loop lag + open FDs

---

## File Structure

```
performance-testing-k6/
├── api/
│   ├── Dockerfile
│   ├── package.json          # includes prom-client
│   └── server.js             # Express API + /metrics endpoint
├── grafana/
│   ├── dashboards/
│   │   └── k6-performance.json   # pre-provisioned dashboard
│   └── provisioning/
│       ├── dashboards/dashboards.yml
│       └── datasources/prometheus.yml
├── k6/
│   └── test.js               # k6 load test with remote-write tags
├── prometheus/
│   └── prometheus.yml        # scrape config + remote-write receiver
├── docker-compose.yml        # api · prometheus · cadvisor · grafana · k6
├── Makefile                  # convenience targets
└── README.md
```

---

## Notes

- **cAdvisor on macOS**: Docker Desktop runs inside a Linux VM. cAdvisor mounts
  `/sys` and `/var/lib/docker` from that VM — container-level metrics for `perf_api`
  work correctly; host-level metrics reflect the VM, not the Mac itself.
- **Volume persistence**: Prometheus and Grafana data persists across `make down`.
  Run `make clean` for a full reset.
- **k6 exits after the test**: The k6 container runs once and exits. The rest of the stack
  stays up so you can browse Grafana after the test completes.
