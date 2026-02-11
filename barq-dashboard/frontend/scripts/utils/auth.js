// Authentication Storage Keys
const AUTH_STORAGE_KEYS = {
  TOKEN: "auth_token",
  USER: "user_data",
};

// User Roles
const USER_ROLES = {
  MANAGER: 1,
  ASSISTANT_MANAGER: 2,
  ACCOUNT_MANAGER: 3,
  TEAM_LEADER: 4,
  EMPLOYEE: 5,
  CLIENT: 6,
};

// Role Dashboards
const ROLE_DASHBOARDS = {
  1: "../manager/dashboard.html",
  2: "../assistant-manager/dashboard.html",
  3: "../account-manager/dashboard.html",
  4: "../team-leader/dashboard.html",
  5: "../employee/dashboard.html",
  6: "../client/dashboard.html",
};

// Authentication Manager Class
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.loadUserFromStorage();
  }

  async login(username, password) {
    console.log("[Auth] Attempting login for user:", username);
    try {
      const response = await API.Auth.login(username, password);
      console.log("[Auth] Login response received:", response);

      // API returns PascalCase: { User: UserDto, Token: string, RefreshToken: string, ExpiresIn: int }
      if (response && response.Token && response.User) {
        console.log("[Auth] Login successful, setting auth data");
        this.setAuthData(response.Token, response.User);
        const redirectUrl = this.getDashboardUrl(response.User.Role);
        console.log("[Auth] Redirecting to:", redirectUrl);
        return {
          success: true,
          user: response.user,
          redirectUrl: redirectUrl,
        };
      }
      console.error("[Auth] Invalid response format:", response);
      throw new Error("Invalid response format from server");
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      return { success: false, error: error.message };
    }
  }

  logout() {
    API.Auth.logout().catch(() => {});
    this.clearAuthData();
    window.location.href = "../auth/login.html";
  }

  setAuthData(token, user) {
    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
    this.currentUser = user;
  }

  clearAuthData() {
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    this.currentUser = null;
  }

  loadUserFromStorage() {
    const userData = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
    if (userData) {
      try {
        this.currentUser = JSON.parse(userData);
      } catch (error) {
        this.clearAuthData();
      }
    }
  }

  isAuthenticated() {
    return !!localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
  }

  getCurrentUser() {
    console.log(this.currentUser);
    return this.currentUser;
  }

  getUserRole() {
    // API returns PascalCase 'Role' property
    return (
      this.currentUser?.Role ||
      this.currentUser?.role ||
      this.currentUser?.RoleId
    );
  }

  getDashboardUrl(role = null) {
    const userRole = role || this.getUserRole();
    return ROLE_DASHBOARDS[userRole] || "../auth/login.html";
  }

  hasRole(role) {
    return this.getUserRole() === role;
  }

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = "../auth/login.html";
      return false;
    }
    return true;
  }

  requireRole(allowedRoles) {
    if (!this.requireAuth()) return false;
    const userRole = this.getUserRole();
    if (!allowedRoles.includes(userRole)) {
      alert("Access denied");
      window.location.href = this.getDashboardUrl();
      return false;
    }
    return true;
  }
}

// Initialize auth globally
const auth = new AuthManager();
window.auth = auth;
window.USER_ROLES = USER_ROLES;

// Auto-initialize UI on page load
document.addEventListener("DOMContentLoaded", () => {
  initAuthUI();
});

function initAuthUI() {
  const user = auth.getCurrentUser();
  if (!user) return;

  // API returns PascalCase properties: Name, Username, Email, Role
  const userName = user.Name || user.name || "User";

  // Update user info in sidebar
  const sidebarName = document.querySelector(".sidebar-user-name");
  const sidebarRole = document.querySelector(".sidebar-user-role");
  if (sidebarName) sidebarName.textContent = userName;
  if (sidebarRole) sidebarRole.textContent = getRoleName(auth.getUserRole());

  // Update header user info
  const headerUserName = document.querySelector(".user-name");
  const userAvatar = document.querySelector(".user-avatar");
  if (headerUserName) headerUserName.textContent = userName;
  if (userAvatar) {
    const initials = userName.substring(0, 1).toUpperCase();
    userAvatar.textContent = initials;
  }

  // Update sidebar avatar
  const sidebarAvatar = document.querySelector(".sidebar-user-avatar");
  if (sidebarAvatar) {
    const initials = userName.substring(0, 1).toUpperCase();
    sidebarAvatar.textContent = initials;
  }

  // Hide Market Map for Non-Sales Team Leaders & Projects for Sales Employees
  const isSales = user.Departments && user.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase().includes("sales"));
  
  const marketMapLink = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.includes('Market Map'));
  if(marketMapLink) {
      marketMapLink.style.display = isSales ? 'flex' : 'none';
  }
  
  // Hide Projects for Sales Employees
  if (auth.getUserRole() === USER_ROLES.EMPLOYEE && isSales) {
      const projectsLink = document.getElementById('nav-projects');
      if (projectsLink) projectsLink.style.display = 'none';
  }
}

function getRoleName(roleId) {
  const roleNames = {
    1: "Manager",
    2: "Assistant Manager",
    3: "Account Manager",
    4: "Team Leader",
    5: "Employee",
    6: "Client",
  };
  return roleNames[roleId] || "User";
}
