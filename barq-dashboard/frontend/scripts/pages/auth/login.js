// Login Page Script

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
  // Redirect if already logged in
  if (auth && auth.isAuthenticated()) {
    window.location.href = auth.getDashboardUrl();
    return;
  }

  // Handle form submission
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Allow Enter key to submit
  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Trigger the submit event on the form
        const submitEvent = new Event("submit", {
          bubbles: true,
          cancelable: true,
        });
        loginForm.dispatchEvent(submitEvent);
      }
    });
  }
});

async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("errorMessage");

  // Hide previous errors
  errorMessage.classList.remove("show");
  errorMessage.style.display = "none"; // Force hide

  // Show loading
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

  try {
    const result = await auth.login(username, password);

    if (result.success) {
      // Show success and redirect
      if (window.utils && window.utils.showSuccess) {
        utils.showSuccess("Login successful! Redirecting...");
      }
      setTimeout(() => {
        window.location.href = result.redirectUrl;
      }, 500);
    } else {
      // Show error
      let displayError = "Incorrect username or password.";
      
      if (result.error) {
        // If it's a 401, keep the generic credential error
        if (result.error.includes("401") || result.error.toLowerCase().includes("invalid username")) {
           displayError = "Incorrect username or password.";
        } else {
           // For other errors, try to extract the message
           const parts = result.error.split(':');
           const serverMessage = parts.length > 1 ? parts.slice(1).join(':').trim() : result.error;
           
           // If we have a meaningful message, show it
           if (serverMessage && serverMessage !== "Error") {
               displayError = serverMessage;
           } else {
               displayError = "Unable to sign in. Please try again later.";
           }
        }
      }
      
      errorMessage.textContent = displayError;
      errorMessage.style.display = "block"; // Force show
      errorMessage.classList.add("show");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  } catch (error) {
    console.error("Login error:", error);
    errorMessage.textContent = "System error. Please try again later.";
    errorMessage.style.display = "block"; // Force show
    errorMessage.classList.add("show");
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}
