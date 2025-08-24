const express = require('express');
const session = require('express-session');
const openidClient = require('openid-client');
const { join } = require('path');
const { Issuer, generators } = openidClient;


const app = express();
const PORT = process.env.PORT || 3000;

let client;
// Initialize OpenID Client
async function initializeClient() {
    const issuer = await Issuer.discover(process.env.COGNITO_ENDPOINT);
    client = new issuer.Client({
        client_id: process.env.COGNITO_CLIENT_ID,
        client_secret: process.env.COGNITO_CLIENT_SECRET,
        redirect_uris: [`https://${process.env.DOMAIN}/callback`],
        response_types: ['code']
    });
};
initializeClient().catch(console.error);

app.use(session({
    secret: process.env.OIDC_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, httpOnly: true }
}));

const checkAuth = (req, res, next) => {
    if (!req.session.userInfo) {
        req.isAuthenticated = false;
    } else {
        req.isAuthenticated = true;
    }
    next();
};

app.set('view engine', 'ejs');

// Serve static files from the static directory
app.use(express.static(join(__dirname, 'static')));

// Middleware to parse JSON bodies
app.use(express.json());

// Route for the homepage
app.get('/', checkAuth, (req, res) => {
    res.render('index', {
        isAuthenticated: req.isAuthenticated,
        userInfo: req.session.userInfo || null
    });
});

app.get('/callback', async (req, res) => {
    try {
        const params = client.callbackParams(req);
        const tokenSet = await client.callback(
            `https://${process.env.DOMAIN}/callback`,
            params,
            {
                nonce: req.session.nonce,
                state: req.session.state
            }
        );

        const userInfo = await client.userinfo(tokenSet.access_token);
        req.session.userInfo = userInfo;

        res.redirect('/');
    } catch (err) {
        console.error('Callback error:', err);
        res.redirect('/');
    }
});

app.get('/login', (req, res) => {
    const nonce = generators.nonce();
    const state = generators.state();

    req.session.nonce = nonce;
    req.session.state = state;

    const authUrl = client.authorizationUrl({
        scope: 'email openid phone',
        state: state,
        nonce: nonce,
    });

    res.redirect(authUrl);
});

app.get('/logout', (req, res) => {
    const logoutUrl = `${process.env.COGNITO_ENDPOINT}/logout?client_id=${process.env.COGNITO_CLIENT_ID}&logout_uri=https://${process.env.DOMAIN}/`;
    req.session.destroy(() => {
      res.redirect(logoutUrl);
    });
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
