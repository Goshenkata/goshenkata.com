
import express from 'express';
import session from 'express-session';
import { Issuer } from 'openid-client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import checkAuth from './middleware/checkAuth.js';
import authRoutes from './routes/auth.js';
import { callBackUri } from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
app.set('view engine', 'ejs');

// Home route
app.get('/', checkAuth, (req, res) => {
        res.render('index', {
                isAuthenticated: req.isAuthenticated,
                userInfo: req.session.userInfo || null,
                idToken: req.session.idToken || null,
                accessToken: req.session.accessToken || null
        });
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
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send(err);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
