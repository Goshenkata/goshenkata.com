import { Router } from 'express';
import { generators } from 'openid-client';

export const callBackUri = process.env.NODE_ENV === 'production'
        ? `https://${process.env.DOMAIN}/callback`
        : 'http://localhost:3000/callback';

export const logoutUri = process.env.NODE_ENV === 'production'
      ? `https://${process.env.DOMAIN}/`
      : 'http://localhost:3000/';

export default function (client) {
  const router = Router();

  router.get('/login', (req, res) => {
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

  router.get('/callback', async (req, res) => {
    try {
      const params = client.callbackParams(req);
      const tokenSet = await client.callback(
        callBackUri,
        params,
        {
          nonce: req.session.nonce,
          state: req.session.state
        },
      );
      const userInfo = await client.userinfo(tokenSet.access_token);
  req.session.userInfo = userInfo;
  req.session.idToken = tokenSet.id_token;
  req.session.accessToken = tokenSet.access_token;
  res.redirect('/');
    } catch (err) {
      console.error('Callback error:', err);
      res.redirect('/');
    }
  });

  router.get('/logout', (req, res) => {
    // Determine logout URI based on environment
    const logoutUrl = `https://eu-central-1vg1ozzrl0.auth.eu-central-1.amazoncognito.com/logout?client_id=${process.env.COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(logoutUri)}`;
    req.session.destroy(() => {
      res.redirect(logoutUrl);
    });
  });

  return router;
}
