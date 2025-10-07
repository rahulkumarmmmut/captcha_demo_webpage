import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Port
const PORT = process.env.PORT || 3008;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudflare Turnstile (interactive test key)
// - This sitekey forces a visible, manual challenge.
// - For local testing with test sitekeys, use the test secret below.
//   (In production, replace both with your real keys.)
const TURNSTILE_SITEKEY = '0x4AAAAAAB5KBEu12bu0ZukL;
const TURNSTILE_SECRET  = '0x4AAAAAAB5KBHgHy-0w_dSi_5uPPNDu-9o'; 

app.set('trust proxy', true);

// --- helpers ---
function getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress
  );
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- routes ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Verify endpoint to handle form submission
app.post('/verify', async (req, res) => {
  const { username, password } = req.body;
  let token = req.body['cf-turnstile-response'];

  if (Array.isArray(token)) {
    console.log('[Server] Note: token received as an array, using first element.');
    token = token[0];
  }

  console.log('========== Turnstile Verification ==========');
  console.log('[Server] Username:', username || '(missing)');
  console.log('[Server] Password:', password ? '[REDACTED]' : '(missing)');
  console.log('[Server] Final Turnstile token (sent to siteverify):', token || '(missing)');
  console.log('============================================');

  if (!token) return res.status(400).send('CAPTCHA token missing');
  if (!username || !password) return res.status(400).send('Username or password missing');

  const ip = getClientIp(req);
  console.log('[Server] Client IP:', ip);

  try {
    // Verify with Cloudflare Turnstile
    const verifyResp = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip
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
      console.log('[Server] Verification failed with codes:', errors);
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

// basic error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).send('Internal server error');
});

// --- start server ---
// --- start server ---
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running locally on http://localhost:${PORT}`);
  });
}

export default app;
