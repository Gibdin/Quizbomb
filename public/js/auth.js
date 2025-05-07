// File: public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Modal elements
    const signupModal = document.getElementById('signupModal');
    const showSignup  = document.getElementById('showSignup');
    const closeSignup = document.getElementById('closeSignup');
  
    // Open signup modal
    showSignup.addEventListener('click', e => {
      e.preventDefault();
      signupModal.style.display = 'flex';
    });
  
    // Close signup modal via × button
    closeSignup.addEventListener('click', () => {
      signupModal.style.display = 'none';
    });
  
    // Close signup modal by clicking outside content
    window.addEventListener('click', e => {
      if (e.target === signupModal) {
        signupModal.style.display = 'none';
      }
    });
  
    // Shared form submit handler
    async function handleFormSubmit(e, endpoint, errorId) {
      e.preventDefault();
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());
      const errEl = document.getElementById(errorId);
      errEl.textContent = '';
  
      try {
        const res = await fetch(`/api/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Unknown error');
  
        // Store token & redirect
        localStorage.setItem('token', json.token);
        window.location.href = 'index.html';
  
      } catch (err) {
        errEl.textContent = err.message;
      }
    }
  
    // Wire up login form
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', e =>
      handleFormSubmit(e, 'login', 'loginError')
    );
  
    // Wire up signup form
    const signupForm = document.getElementById('signupForm');
    signupForm.addEventListener('submit', e =>
      handleFormSubmit(e, 'register', 'signupError')
    );
  });
  