import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3008;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Use env vars on Vercel:
 *  - TURNSTILE_SITEKEY
 *  - TURNSTILE_SECRET
 * (Set them in Project Settings → Environment Variables)
 * Fallbacks below are for local dev only.
 */
const TURNSTILE_SITEKEY = process.env.TURNSTILE_SITEKEY || '0x4AAAAAAB5KBEu12bu0ZukL';
const TURNSTILE_SECRET  = process.env.TURNSTILE_SECRET  || '0x4AAAAAAB5KBHgHy-0w_dSi_5uPPNDu-9o';

app.set('trust proxy', true);

function getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress
  );
}
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/verify', async (req, res) => {
  const { username, password } = req.body;
  let token = req.body['cf-turnstile-response'];
  if (Array.isArray(token)) token = token[0];

  if (!token) return res.status(400).send('CAPTCHA token missing');
  if (!username || !password) return res.status(400).send('Username or password missing');

  console.log('========== Turnstile Verification ==========');
  console.log('[Server] Host header:', req.headers.host);
  console.log('[Server] Turnstile token sent to siteverify:', token);
  console.log('============================================');

  try {
    const verifyResp = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: getClientIp(req)
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('[Server] Verification result:', verifyResp.data);

    if (verifyResp.data.success) {
      return res.send(`
        <!doctype html><meta charset="utf-8">
        <h1>Login Successful</h1>
        <p>Hello ${escapeHtml(username)}, your captcha was successfully verified!</p>
        <p><a href="/">Back to login</a></p>
      `);
    } else {
      const errors = verifyResp.data['error-codes'] || [];
      return res.status(400).send(`
        <!doctype html><meta charset="utf-8">
        <h1>CAPTCHA validation failed</h1>
        <p>Error codes: ${escapeHtml(errors.join(', ') || 'none')}</p>
        <p><a href="/">Back</a></p>
      `);
    }
  } catch (err) {
    console.error('[Server] Error verifying captcha:', err.message);
    if (err.response) console.error('[Server] Response data:', err.response.data);
    return res.status(500).send('Server error during verification');
  }
});

// Vercel: export the app. Locally: also listen.
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running locally on http://localhost:${PORT}`);
    console.log(`Using Turnstile site key: ${TURNSTILE_SITEKEY}`);
  });
}
export default app;
