// File: public/js/auth.js

document.addEventListener("DOMContentLoaded", () => {
  // Modal elements
  const signupModal = document.getElementById("signupModal");
  const showSignup = document.getElementById("showSignup");
  const closeSignup = document.getElementById("closeSignup");

  // Open signup modal
  showSignup.addEventListener("click", (e) => {
    e.preventDefault();
    signupModal.style.display = "flex";
  });

  // Close signup modal via × button
  closeSignup.addEventListener("click", () => {
    signupModal.style.display = "none";
  });

  // Close signup modal by clicking outside content
  window.addEventListener("click", (e) => {
    if (e.target === signupModal) {
      signupModal.style.display = "none";
    }
  });

  // Shared form submit handler
  async function handleFormSubmit(e, endpoint, errorId) {
    e.preventDefault();
    const errEl = document.getElementById(errorId);
    const form = e.target;

    // build data load
    const data = {
      username: form.username.value.trim(),
      password: form.password.value,
    };

    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unknown error");

      // Store token & username, then redirect
      localStorage.setItem("qb_token", json.token);
      localStorage.setItem("qb_user", json.username);
      window.location.href = "/multiplayer.html";
    } catch (err) {
      errEl.textContent = err.message;
    }
  }

  // Wire up login form
  const loginForm = document.getElementById("loginForm");
  loginForm.addEventListener("submit", (e) =>
    handleFormSubmit(e, "login", "loginError"),
  );

  // Wire up signup form
  const signupForm = document.getElementById("signupForm");
  signupForm.addEventListener("submit", (e) =>
    handleFormSubmit(e, "register", "signupError"),
  );
});
