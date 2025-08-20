const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  const ip = req.get('X-Real-IP') || req.get('X-Forwarded-For') || req.ip || req.connection.remoteAddress;
  console.log(`${req.method} ${req.url} from ${ip}`);
  next();
});

// Serve static files from the static directory
app.use(express.static(path.join(__dirname, 'static')));

// Middleware to parse JSON bodies
app.use(express.json());

// Route for the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Node.js server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send(err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
