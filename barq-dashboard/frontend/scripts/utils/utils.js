// Utility Functions

// Date Formatting
function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Status & Priority Labels
function getStatusBadge(status) {
  const statusMap = {
    0: { label: "Pending", class: "badge-pending" },
    1: { label: "In Progress", class: "badge-info" },
    2: { label: "In Review", class: "badge-warning" },
    3: { label: "Completed", class: "badge-success" },
    4: { label: "Cancelled", class: "badge-danger" },
  };
  const statusInfo = statusMap[status] || {
    label: "Unknown",
    class: "badge-secondary",
  };
  return `<span class="badge ${statusInfo.class}">${statusInfo.label}</span>`;
}

function getPriorityBadge(priority) {
  const priorityMap = {
    0: { label: "Low", class: "badge-success" },
    1: { label: "Medium", class: "badge-info" },
    2: { label: "High", class: "badge-warning" },
    3: { label: "Critical", class: "badge-danger" },
  };
  const priorityInfo = priorityMap[priority] || {
    label: "Unknown",
    class: "badge-secondary",
  };
  return `<span class="badge ${priorityInfo.class}">${priorityInfo.label}</span>`;
}

// Loading States
function showLoading() {
  document.body.classList.add("loading");

  // Create loading overlay if it doesn't exist
  if (!document.getElementById("loadingOverlay")) {
    const overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    overlay.className = "loading-overlay";
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  document.getElementById("loadingOverlay").classList.remove("d-none");
}

function hideLoading() {
  document.body.classList.remove("loading");
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.add("d-none");
  }
}

// Notifications
function showSuccess(message) {
  showNotification(message, "success");
}

function showError(message) {
  showNotification(message, "error");
}

function showWarning(message) {
  showNotification(message, "warning");
}

function showInfo(message) {
  showNotification(message, "info");
}

function showNotification(message, type = "info") {
  // Simple alert for now - can be enhanced with custom toast notifications
  console.log(`[${type.toUpperCase()}]`, message);

  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: var(--dark-color);
    border: 1px solid ${getNotificationColor(type)};
    border-radius: var(--radius-lg);
    color: var(--text-main);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function getNotificationColor(type) {
  const colors = {
    success: "var(--success)",
    error: "var(--error)",
    warning: "var(--warning)",
    info: "var(--info)",
  };
  return colors[type] || colors.info;
}

// Add animations to head
if (!document.getElementById("utilityAnimations")) {
  const style = document.createElement("style");
  style.id = "utilityAnimations";
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Confirmation Dialog
function confirmAction(message) {
  return confirm(message);
}

// Mobile Menu Toggle
function initMobileMenu() {
  const menuToggle = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("show");
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
          sidebar.classList.remove("show");
        }
      }
    });
  }
}

// Initialize mobile menu on page load
document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
});

// Form Validation
function validateForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return false;

  const inputs = form.querySelectorAll("[required]");
  let isValid = true;

  inputs.forEach((input) => {
    if (!input.value.trim()) {
      input.style.borderColor = "var(--error)";
      isValid = false;
    } else {
      input.style.borderColor = "";
    }
  });

  return isValid;
}

// Debounce Function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Currency Formatting
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Truncate Text
function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Page Transitions
document.addEventListener('DOMContentLoaded', () => {
  // Handle internal links for smooth transitions
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    
    // Check if it's a valid link
    if (!link || !link.href) return;
    
    // Skip if:
    // 1. It's an external link
    // 2. It opens in a new tab
    // 3. It's an anchor link to the same page
    // 4. It has a 'no-transition' class
    if (
      link.hostname !== window.location.hostname ||
      link.target === '_blank' ||
      link.href.includes('#') ||
      link.classList.contains('no-transition')
    ) {
      return;
    }

    // Prevent default navigation
    e.preventDefault();
    const href = link.href;

    // Add fade-out class
    document.body.classList.add('fade-out');

    // Wait for animation then navigate
    setTimeout(() => {
      window.location.href = href;
    }, 300); // Match the CSS transition time
  });
  
  // Ensure body is visible on load (removes fade-out if it stuck from back button)
  // The CSS default is opacity: 1, but if we navigated back, the browser might restore the state
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      document.body.classList.remove('fade-out');
    }
  });
});

function getInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// SECURITY: HTML escaping to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const text = String(str);
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// SECURITY: URL sanitization to prevent javascript: URI injection
function sanitizeUrl(url) {
  if (!url) return "#";
  // Strip control characters and whitespace that could break protocol detection
  const cleaned = String(url).replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (/^(javascript|data|vbscript|blob):/i.test(cleaned)) {
    return "#";
  }
  return cleaned;
}

// Export functions to window
window.utils = {
  getInitials,
  formatDate,
  formatDateTime,
  getStatusBadge,
  getPriorityBadge,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  confirmAction,
  validateForm,
  debounce,
  formatCurrency,
  truncateText,
  showToast,
  escapeHtml,
  sanitizeUrl,
};

function showToast(message, type = 'info') {
  showNotification(message, type);
}
