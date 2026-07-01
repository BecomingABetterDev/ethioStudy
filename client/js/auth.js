/**
 * auth.js — Authentication helpers for EthioStudy
 *
 * Provides token storage, session management, and page guards.
 * All functions exposed as window.AuthUtils for use by any page.
 * login.html uses this via <script src> (no ES modules).
 */

const AuthUtils = {
  /* ─── Token / session storage ──────────────────────────────────────────── */
  getToken() {
    return localStorage.getItem('es_token');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('es_user'));
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  saveSession(token, user) {
    localStorage.setItem('es_token', token);
    localStorage.setItem('es_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('es_token');
    localStorage.removeItem('es_user');
  },

  /* ─── Page guards ─────────────────────────────────────────────────────── */
  /**
   * Redirect already-authenticated users away from auth pages.
   * Call at the top of login.html and register.html.
   */
  guardAuthPage() {
    if (this.isLoggedIn()) {
      window.location.replace('/dashboard.html');
    }
  },

  /**
   * Redirect unauthenticated users to login.
   * Call at the top of dashboard.html.
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.replace('/login.html');
    }
  },
};

/* ─── Landing page nav behaviour ─────────────────────────────────────────── */
function initLandingNav() {
  const header    = document.getElementById('navHeader');
  const hamburger = document.getElementById('navHamburger');
  const mobileNav = document.getElementById('mobileNav');

  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    mobileNav.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Redirect logged-in users' CTA buttons to dashboard
  if (AuthUtils.isLoggedIn()) {
    document.querySelectorAll('a[href="/register.html"]').forEach((btn) => {
      if (btn.textContent.includes('Free') || btn.textContent.includes('Started')) {
        btn.href        = '/dashboard.html';
        btn.textContent = 'Go to Dashboard';
      }
    });
  }
}

/* ─── Login page ──────────────────────────────────────────────────────────── */
function initLoginPage() {
  AuthUtils.guardAuthPage();

  const form      = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginBtn');
  const togglePwd = document.getElementById('togglePassword');
  const pwdInput  = document.getElementById('password');
  const alertEl   = document.getElementById('loginAlert');

  // Password visibility toggle
  if (togglePwd && pwdInput) {
    togglePwd.addEventListener('click', () => {
      const isText      = pwdInput.type === 'text';
      pwdInput.type     = isText ? 'password' : 'text';
    });
  }

  function showAlert(msg) {
    if (!alertEl) return;
    alertEl.textContent = msg;
    alertEl.classList.add('visible');
  }

  function hideAlert() {
    if (alertEl) alertEl.classList.remove('visible');
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled    = loading;
    submitBtn.textContent = loading ? 'Signing in…' : 'Sign In';
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const emailInput = document.getElementById('email');
  
  // 1. Gather all form inputs and button structures to block interaction
  const formElements = [emailInput, pwdInput];
  
  // 2. Lock UI down immediately
  formElements.forEach(el => {
    if (el) el.setAttribute('disabled', 'true');
  });

    const email    = document.getElementById('email').value.trim();
    const password = pwdInput ? pwdInput.value : '';

    if (!email || !password) {
      showAlert('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await window.Auth.login({ email, password });

      if (!data || data.success === false || !data.token) {
        throw new Error(data?.message || 'Invalid email or password.');
      }

      AuthUtils.saveSession(data.token, data.user);
      window.location.href = '/dashboard.html';
    } catch (err) {
      formElements.forEach(el => {
        if (el) el.removeAttribute('disabled');
      });
      showAlert(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  });
}

/* ─── Register page ───────────────────────────────────────────────────────── */
function initRegisterPage() {
  AuthUtils.guardAuthPage();
  // register.html has its own inline JS for the form + password strength meter
  // This function exists as a hook in case extra setup is needed.
}

/* ─── Expose globals ──────────────────────────────────────────────────────── */
window.AuthUtils        = AuthUtils;
window.initLandingNav   = initLandingNav;
window.initLoginPage    = initLoginPage;
window.initRegisterPage = initRegisterPage;
