# K6 Performance Testing — Sample API + HTML Report

A self-contained local setup for performance testing with no Docker required:
- **Node.js/Express** sample API
- **K6** load test with staged load, thresholds, and custom metrics
- **HTML report** generated automatically after each test run

## Project Structure

```
performance-testing-k6/
├── api/
│   ├── server.js          # Express API
│   └── package.json
└── k6/
    └── test.js            # K6 load test (generates report.html)
```

## Quick Start

### Prerequisites

```bash
# Install Node.js dependencies
cd api && npm install && cd ..

# Install K6 (macOS)
brew install k6

# Install K6 (Linux / Windows)
# https://grafana.com/docs/k6/latest/set-up/install-k6/
```

### 1. Start the API

```bash
node api/server.js
```

API is now running at **http://localhost:3000**

### 2. Run the K6 test

```bash
k6 run k6/test.js
```

When the test finishes, **`k6/report.html`** is generated automatically.

### 3. Open the report

```bash
open k6/report.html      # macOS
xdg-open k6/report.html  # Linux
```

## API Endpoints

| Method | Path           | Description                |
|--------|----------------|----------------------------|
| GET    | /health        | Health check               |
| GET    | /api/users     | List users (`?role=admin`) |
| GET    | /api/users/:id | Get user by ID             |
| POST   | /api/users     | Create user                |
| PUT    | /api/users/:id | Update user                |
| DELETE | /api/users/:id | Delete user                |
| GET    | /api/slow      | Simulated slow endpoint    |

## K6 Test Stages

| Stage     | Duration | Target VUs | Purpose         |
|-----------|----------|------------|-----------------|
| Warm-up   | 30 s     | 10         | Gradual ramp-up |
| Load      | 60 s     | 30         | Sustained load  |
| Spike     | 20 s     | 60         | Spike test      |
| Recovery  | 30 s     | 30         | Recover         |
| Ramp-down | 30 s     | 0          | Cool-down       |

## Thresholds

| Metric              | Threshold    |
|---------------------|--------------|
| `http_req_duration` | p95 < 500 ms |
| `error_rate`        | < 5%         |
| `slow_request_rate` | < 10%        |
