const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let client;
// Initialize OpenID Client
async function initializeClient() {
    const issuer = await Issuer.discover('https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_VG1OzzrL0');
    client = new issuer.Client({
        client_id: '6psh5d9pah9j64kr7v5cdqfa2j',
        client_secret: '<client secret>',
        redirect_uris: ['https://goshenkata-frontend.s3.eu-central-1.amazonaws.com/index.html'],
        response_types: ['code']
    });
};
initializeClient().catch(console.error);

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
