const express = require('express');

const app = express();
app.use(express.json());

// ─── In-memory data store ───────────────────────────────────────────────────

let users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith',    email: 'bob@example.com',   role: 'user'  },
  { id: 3, name: 'Carol White',  email: 'carol@example.com', role: 'user'  },
];
let nextId = 4;

// ─── Routes ────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// List all users
app.get('/api/users', (req, res) => {
  const { role } = req.query;
  const result = role ? users.filter(u => u.role === role) : users;
  res.json({ count: result.length, users: result });
});

// Get single user
app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Create user
app.post('/api/users', (req, res) => {
  const { name, email, role = 'user' } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  const user = { id: nextId++, name, email, role };
  users.push(user);
  res.status(201).json(user);
});

// Update user
app.put('/api/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  users[index] = { ...users[index], ...req.body, id: users[index].id };
  res.json(users[index]);
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  users.splice(index, 1);
  res.status(204).send();
});

// Simulate a slow endpoint (useful to see latency spread in the K6 report)
app.get('/api/slow', (req, res) => {
  const delay = Math.floor(Math.random() * 300) + 100; // 100–400 ms
  setTimeout(() => res.json({ delay_ms: delay }), delay);
});

// ─── Start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
