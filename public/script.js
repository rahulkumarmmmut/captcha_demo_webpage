document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById('login-form');

  form.addEventListener('submit', function (e) {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const captchaToken = document.getElementById('cf-token').value;

    if (!username || !password) {
      e.preventDefault();
      alert('Please fill in both username and password fields');
      return false;
    }

    if (!captchaToken) {
      e.preventDefault();
      alert('Please complete the captcha verification');
      return false;
    }

    console.log('[Client] Submitting with token (truncated):', captchaToken.slice(0, 20) + '...');
  });
});