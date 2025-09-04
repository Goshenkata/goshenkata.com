import express from 'express';
import session from 'express-session';
import { Issuer } from 'openid-client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import checkAuth from './middleware/checkAuth.js';
import authRoutes from './routes/auth.js';
import { callBackUri } from './routes/auth.js';
import attachAuthHeader from './middleware/attachAuthHeader.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

let client;
// Initialize OpenID Client
async function initializeClient() {
        const issuer = await Issuer.discover(process.env.COGNITO_ENDPOINT);
        client = new issuer.Client({
                client_id: process.env.COGNITO_CLIENT_ID,
                client_secret: process.env.COGNITO_CLIENT_SECRET,
                redirect_uris: [callBackUri],
                response_types: ['code']
        });
}
await initializeClient().catch(console.error);

app.use(session({
        secret: process.env.OIDC_SECRET,
        resave: false,
        saveUninitialized: false,
        // cookie: { secure: true, httpOnly: true }
}));

app.use(express.static(join(__dirname, 'static')));
app.use(express.json());
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(attachAuthHeader);

// Home route
app.get('/', checkAuth, (req, res) => {
        res.render('index', {
                isAuthenticated: req.isAuthenticated,
        });
});

app.get('/profile', checkAuth, (req, res) => {
        res.render('profile', {
                isAuthenticated: req.isAuthenticated,
                userInfo: req.session.userInfo || null,
                idToken: req.session.idToken || null,
                accessToken: req.session.accessToken || null
        });
});

// Diary page (authenticated only)
app.get('/diary', checkAuth, (req, res) => {
        if (!req.isAuthenticated) return res.redirect('/');
        res.render('diary', { isAuthenticated: true, backendApiUrl: process.env.BACKEND_API_URL || '' });
});

// Proxy API routes to backend adding Authorization header if available
app.get('/api/entries', async (req, res) => {
        if (!req.isAuthenticated) return res.status(401).json({ message: 'Unauthorized' });
        const { page = 0, size = 10 } = req.query;
        try {
                const url = `${process.env.BACKEND_API_URL}entries?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`;
                const r = await fetch(url, { headers: req.authHeaders });
                const data = await r.json().catch(() => ({}));
                res.status(r.status).json(data);
        } catch (e) {
                console.error(e);
                res.status(500).json({ message: 'Error fetching entries' });
        }
});

app.post('/api/entry', async (req, res) => {
        if (!req.isAuthenticated) return res.status(401).json({ message: 'Unauthorized' });
        try {
                const url = `${process.env.BACKEND_API_URL}entry`;
                const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...req.authHeaders }, body: JSON.stringify(req.body) });
                const data = await r.json().catch(() => ({}));
                res.status(r.status).json(data);
        } catch (e) {
                console.error(e);
                res.status(500).json({ message: 'Error creating entry' });
        }
});

// Auth routes
app.use('/', authRoutes(client));

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Node.js server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handler
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).send(err);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
