// API Configuration
const API_CONFIG = {
  // Use localhost for local dev, or the production backend for all other hosts
  BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? "http://localhost:5144/api"
    : "https://barqtms-api.runasp.net/api",
  TOKEN_KEY: "auth_token",
  USER_KEY: "user_data",
};

// API Client Class
class APIClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
  }

  getToken() {
    return localStorage.getItem(API_CONFIG.TOKEN_KEY);
  }

  getHeaders(includeAuth = true) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: this.getHeaders(options.includeAuth !== false),
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if (response.status === 401 && !options.skipRedirectOn401) {
          this.clearAuth();
          window.location.href = "../auth/login.html";
        }
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        return data;
      }
      return await response.text();
    } catch (error) {
      console.error("[API] Request failed:", error);
      throw error;
    }
  }

  // Convenience methods
  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: "GET", ...options });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      ...options,
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
      ...options,
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: "DELETE", ...options });
  }

  clearAuth() {
    localStorage.removeItem(API_CONFIG.TOKEN_KEY);
    localStorage.removeItem(API_CONFIG.USER_KEY);
  }
}

// Service Layer Pattern
const API = {
  // Auth Service
  Auth: {
    async login(userName, password) {
      const client = new APIClient();
      return client.post(
        "/Auth/login",
        {
          userName: userName,
          password: password,
        },
        { skipRedirectOn401: true }
      );
    },
    async register(userData) {
      const client = new APIClient();
      return client.post("/Auth/register", userData);
    },
    async logout() {
      // No backend logout endpoint — just clear local auth data
      const client = new APIClient();
      client.clearAuth();
      return Promise.resolve();
    },
    async changePassword(data) {
      const client = new APIClient();
      return client.post("/Auth/change-password", data);
    },
  },

  // Dashboard Service
  Dashboard: {
    async getStats() {
      const client = new APIClient();
      return client.get("/Dashboard/stats");
    },
    async getActivities() {
      const client = new APIClient();
      return client.get("/Dashboard/activities");
    },
    async getRecentProjects() {
      const client = new APIClient();
      return client.get("/Dashboard/recent-projects");
    },
    async getTasksByStatus() {
      const client = new APIClient();
      return client.get("/Dashboard/tasks-by-status");
    },
    async getUserStats(userId) {
      const client = new APIClient();
      return client.get(`/Dashboard/user-stats/${userId}`);
    },
    async getTeamStats() {
      const client = new APIClient();
      return client.get("/Dashboard/team-stats");
    },
  },

  // Tasks Service
  Tasks: {
    async getAll() {
      const client = new APIClient();
      return client.get("/Tasks");
    },
    async getById(id) {
      const client = new APIClient();
      return client.get(`/Tasks/${id}`);
    },
    async create(taskData) {
      const client = new APIClient();
      return client.post("/Tasks", taskData);
    },
    async update(id, taskData) {
      const client = new APIClient();
      return client.put(`/Tasks/${id}`, taskData);
    },
    async updateStatus(id, statusData) {
      const client = new APIClient();
      // statusData can include statusId, notes, finalKpiValue
      return client.put(`/Tasks/${id}/status`, statusData);
    },
    async delete(id) {
      const client = new APIClient();
      return client.delete(`/Tasks/${id}`);
    },
    async getComments(taskId) {
      const client = new APIClient();
      return client.get(`/Tasks/${taskId}/comments`);
    },
    async addComment(taskId, comment) {
      const client = new APIClient();
      return client.post(`/Tasks/${taskId}/comments`, { comment: comment });
    },
    async getAttachments(taskId) {
      const client = new APIClient();
      return client.get(`/Tasks/${taskId}/attachments`);
    },
    async getHistory(taskId) {
      const client = new APIClient();
      return client.get(`/Tasks/${taskId}/history`);
    },
    async requestComplete(id, data = {}) {
      const client = new APIClient();
      // data: { note, finalKpiValue } (using object to be flexible)
      return client.put(`/Tasks/${id}/request-complete`, data);
    },
    async reviewCompletion(id, reviewData) {
      const client = new APIClient();
      return client.put(`/Tasks/${id}/review-completion`, reviewData);
    },
    async getLatestDeclineComment(id) {
      const client = new APIClient();
      return client.get(`/Tasks/${id}/latest-decline-comment`);
    },
    async passTask(id, passData) {
      const client = new APIClient();
      return client.put(`/Tasks/${id}/pass`, passData);
    },
    // Get tasks by project (helper method)
    async getByProject(projectId) {
      const client = new APIClient();
      return client.get(`/Projects/${projectId}/tasks`);
    },

    // ========================================================================
    // ACCOUNT MANAGER REVIEW WORKFLOW - PLACEHOLDER ENDPOINTS
    // ========================================================================
    // These endpoints need to be implemented on the backend
    // Current implementation uses workarounds with existing endpoints

    /**
     * PLACEHOLDER: Approve task and send to client
     *
     * BACKEND REQUIREMENT:
     * Endpoint: PUT /api/Tasks/{id}/approve-for-client
     * Body: { notes: string, accountManagerId: int }
     * Updates: StatusId, AccountManagerApproved, SentToClient, AccountManagerNotes
     *
     * CURRENT WORKAROUND: Use Tasks.update() with status change
     */
    async approveForClient(id, notes) {
      // TODO: Implement PUT /api/Tasks/{id}/approve-for-client on backend
      throw new Error(
        "Backend endpoint not implemented. Use Tasks.update() workaround."
      );
    },

    /**
     * PLACEHOLDER: Send task back to team leader for rework
     *
     * BACKEND REQUIREMENT:
     * Endpoint: PUT /api/Tasks/{id}/send-back-rework
     * Body: { feedback: string, accountManagerId: int }
     * Updates: StatusId to IN_PROGRESS, clears approval flags
     *
     * CURRENT WORKAROUND: Use Tasks.update() with status change
     */
    async sendBackForRework(id, feedback) {
      // TODO: Implement PUT /api/Tasks/{id}/send-back-rework on backend
      throw new Error(
        "Backend endpoint not implemented. Use Tasks.update() workaround."
      );
    },

    /**
     * PLACEHOLDER: Client approves task
     *
     * BACKEND REQUIREMENT:
     * Endpoint: PUT /api/Tasks/{id}/client-approve
     * Body: { notes: string, clientUserId: int }
     * Updates: StatusId to CLIENT_APPROVED, ClientApproved = true, ClientReviewDate
     *
     * CURRENT WORKAROUND: Use Tasks.update() with status change
     */
    async clientApprove(id, notes, clientUserId) {
      // TODO: Implement PUT /api/Tasks/{id}/client-approve on backend
      throw new Error(
        "Backend endpoint not implemented. Use Tasks.update() workaround."
      );
    },

    /**
     * PLACEHOLDER: Client rejects task with feedback
     *
     * BACKEND REQUIREMENT:
     * Endpoint: PUT /api/Tasks/{id}/client-reject
     * Body: { feedback: string, clientUserId: int }
     * Updates: StatusId to CLIENT_REJECTED, ClientApproved = false, ClientFeedback
     *
     * CURRENT WORKAROUND: Use Tasks.update() with status change
     */
    async clientReject(id, feedback, clientUserId) {
      // TODO: Implement PUT /api/Tasks/{id}/client-reject on backend
      throw new Error(
        "Backend endpoint not implemented. Use Tasks.update() workaround."
      );
    },

    /**
     * PLACEHOLDER: Team leader submits task for account manager review
     *
     * BACKEND REQUIREMENT:
     * Endpoint: PUT /api/Tasks/{id}/submit-for-review
     * Body: { notes: string, teamLeaderId: int }
     * Updates: StatusId to PENDING_AM_REVIEW, SubmittedForReview = true
     *
     * CURRENT WORKAROUND: Use Tasks.update() with status change
     */
    async submitForReview(id, notes) {
      // TODO: Implement PUT /api/Tasks/{id}/submit-for-review on backend
      throw new Error(
        "Backend endpoint not implemented. Use Tasks.update() workaround."
      );
    },
  },

  // Projects Service
  Projects: {
    async getAll() {
      const client = new APIClient();
      return client.get("/Projects");
    },
    async getById(id) {
      const client = new APIClient();
      return client.get(`/Projects/${id}`);
    },
    async create(projectData) {
      const client = new APIClient();
      return client.post("/Projects", projectData);
    },
    async update(id, projectData) {
      const client = new APIClient();
      return client.put(`/Projects/${id}`, projectData);
    },
    async delete(id) {
      const client = new APIClient();
      return client.delete(`/Projects/${id}`);
    },
    async getTasks(projectId) {
      const client = new APIClient();
      return client.get(`/Projects/${projectId}/tasks`);
    },
    async getAuditLogs(projectId) {
      const client = new APIClient();
      return client.get(`/Projects/${projectId}/auditlogs`);
    },
  },

  // Users Service (replaces Employees)
  Users: {
    async getAll() {
      const client = new APIClient();
      return client.get("/Users");
    },
    async getByRole(roleId) {
      const client = new APIClient();
      return client.get(`/Users/by-role/${roleId}`);
    },
    async getById(id) {
      const client = new APIClient();
      return client.get(`/Users/${id}`);
    },
    async create(userData) {
      const client = new APIClient();
      return client.post("/Users", userData);
    },
    async update(id, userData) {
      const client = new APIClient();
      return client.put(`/Users/${id}`, userData);
    },
    async delete(id) {
      const client = new APIClient();
      return client.delete(`/Users/${id}`);
    },
    async getDepartments(userId) {
      const client = new APIClient();
      return client.get(`/Users/${userId}/departments`);
    },
    async getTasks(userId) {
      const client = new APIClient();
      return client.get(`/Users/${userId}/tasks`);
    },
  },

  // Departments Service
  Departments: {
    async getAll() {
      const client = new APIClient();
      return client.get("/Departments");
    },
    async getById(id) {
      const client = new APIClient();
      return client.get(`/Departments/${id}`);
    },
    async create(deptData) {
      const client = new APIClient();
      return client.post("/Departments", deptData);
    },
    async update(id, deptData) {
      const client = new APIClient();
      return client.put(`/Departments/${id}`, deptData);
    },
    async delete(id) {
      const client = new APIClient();
      return client.delete(`/Departments/${id}`);
    },
    async getTasks(deptId) {
      const client = new APIClient();
      return client.get(`/Departments/${deptId}/tasks`);
    },
    async getProjects(deptId) {
      const client = new APIClient();
      return client.get(`/Departments/${deptId}/projects`);
    },
    async getUsers(deptId) {
      const client = new APIClient();
      return client.get(`/Departments/${deptId}/users`);
    },
  },

  // Clients Service
  Clients: {
    async getAll() {
      const client = new APIClient();
      return client.get("/Clients");
    },
    async getById(id) {
      const client = new APIClient();
      return client.get(`/Clients/${id}`);
    },
    async create(clientData) {
      const client = new APIClient();
      return client.post("/Clients", clientData);
    },
    async update(id, clientData) {
      const client = new APIClient();
      return client.put(`/Clients/${id}`, clientData);
    },
    async delete(id) {
      const client = new APIClient();
      return client.delete(`/Clients/${id}`);
    },
    async getProjects(clientId) {
      const client = new APIClient();
      return client.get(`/Clients/${clientId}/projects`);
    },

    /**
     * PLACEHOLDER: Get users associated with a client
     *
     * BACKEND REQUIREMENT:
     * Endpoint: GET /api/Clients/{id}/users
     * Returns: [{ userId, userName, email, role }]
     *
     * PURPOSE: To notify client users when tasks are ready for review
     *
     * CURRENT WORKAROUND: None - feature unavailable
     */
    async getUsers(clientId) {
      // TODO: Implement GET /api/Clients/{id}/users on backend
      throw new Error("Backend endpoint not implemented");
    },
  },

  // Roles Service
  Roles: {
    async getAll() {
      const client = new APIClient();
      return client.get("/Roles");
    },
    async getById(id) {
      const client = new APIClient();
      return client.get(`/Roles/${id}`);
    },
    async create(roleData) {
      const client = new APIClient();
      return client.post("/Roles", roleData);
    },
    async update(id, roleData) {
      const client = new APIClient();
      return client.put(`/Roles/${id}`, roleData);
    },
    async delete(id) {
      const client = new APIClient();
      return client.delete(`/Roles/${id}`);
    },
  },

  // Notifications Service
  Notifications: {
    async getByUser(userId) {
      const client = new APIClient();
      return client.get(`/Notifications/user/${userId}`);
    },
    async getUnread(userId) {
      const client = new APIClient();
      return client.get(`/Notifications/user/${userId}/unread`);
    },
    async getUnreadCount(userId) {
      const client = new APIClient();
      return client.get(`/Notifications/user/${userId}/count/unread`);
    },
    async getDetails(notifId) {
      const client = new APIClient();
      return client.get(`/Notifications/${notifId}/details`);
    },
    async markAsRead(notifId) {
      const client = new APIClient();
      return client.put(`/Notifications/${notifId}/read`, {});
    },
    async markAllAsRead(userId) {
      const client = new APIClient();
      return client.put(`/Notifications/user/${userId}/read-all`, {});
    },
    async delete(notifId) {
      const client = new APIClient();
      return client.delete(`/Notifications/${notifId}`);
    },
    async create(notifData) {
      const client = new APIClient();
      return client.post("/Notifications", notifData);
    },
  },

  // Calendar Service
  Calendar: {
    async getEvents(filter) {
      const client = new APIClient();
      // Use POST /Calendar/view endpoint
      return client.post("/Calendar/view", filter);
    },
    async getEventById(id) {
      const client = new APIClient();
      return client.get(`/Calendar/events/${id}`);
    },
    async createEvent(eventData) {
      const client = new APIClient();
      return client.post("/Calendar/events", eventData);
    },
    async updateEvent(id, eventData) {
      const client = new APIClient();
      return client.put(`/Calendar/events/${id}`, eventData);
    },
    async deleteEvent(id) {
      const client = new APIClient();
      return client.delete(`/Calendar/events/${id}`);
    },
    async getUpcomingEvents(days = 7) {
      const client = new APIClient();
      return client.get(`/Calendar/events/upcoming?days=${days}`);
    },
    async getStats() {
      const client = new APIClient();
      return client.get("/Calendar/stats");
    },
    async getTodayEvents() {
      const client = new APIClient();
      return client.get("/Calendar/events/today");
    },
    async getThisWeekEvents() {
      const client = new APIClient();
      return client.get("/Calendar/events/this-week");
    },
    async getThisMonthEvents() {
      const client = new APIClient();
      return client.get("/Calendar/events/this-month");
    },
  },

  // Statistics Service
  Statistics: {
    async getDashboard() {
      const client = new APIClient();
      return client.get("/Statistics/dashboard");
    },
    async getTasksByStatus() {
      const client = new APIClient();
      return client.get("/Statistics/tasks-by-status");
    },
    async getTasksByPriority() {
      const client = new APIClient();
      return client.get("/Statistics/tasks-by-priority");
    },
    async getProjectProgress() {
      const client = new APIClient();
      return client.get("/Statistics/project-progress");
    },
  },

  // Search Service
  Search: {
    async global(query, page = 1, pageSize = 10) {
      const client = new APIClient();
      return client.get(
        `/Search?query=${encodeURIComponent(
          query
        )}&page=${page}&pageSize=${pageSize}`
      );
    },
    async tasks(query, statusId, priorityId, projectId, assignedTo, page = 1) {
      const client = new APIClient();
      let url = `/Search/tasks?query=${encodeURIComponent(query)}&page=${page}`;
      if (statusId) url += `&statusId=${statusId}`;
      if (priorityId) url += `&priorityId=${priorityId}`;
      if (projectId) url += `&projectId=${projectId}`;
      if (assignedTo) url += `&assignedTo=${assignedTo}`;
      return client.get(url);
    },
    async projects(query, clientId = null) {
      const client = new APIClient();
      let url = `/Search/projects?query=${encodeURIComponent(query)}`;
      if (clientId) url += `&clientId=${clientId}`;
      return client.get(url);
    },
    async users(query, role = null, departmentId = null) {
      const client = new APIClient();
      let url = `/Search/users?query=${encodeURIComponent(query)}`;
      if (role) url += `&role=${role}`;
      if (departmentId) url += `&departmentId=${departmentId}`;
      return client.get(url);
    },
  },

  // Files Service
  Files: {
    async upload(taskId, formData) {
      const client = new APIClient();
      // Note: For file upload, we need to handle FormData differently
      const url = `${client.baseURL}/Files/upload/${taskId}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${client.getToken()}`,
        },
        body: formData, // FormData handles its own content-type
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      return response.json();
    },
    async download(fileId) {
      const client = new APIClient();
      return client.get(`/Files/download/${fileId}`);
    },
    async delete(fileId) {
      const client = new APIClient();
      return client.delete(`/Files/${fileId}`);
    },
  },

  // AuditLogs Service
  AuditLogs: {
    async getAll(page = 1, pageSize = 50) {
      const client = new APIClient();
      return client.get(`/AuditLogs?page=${page}&pageSize=${pageSize}`);
    },
    async getByProject(projectId) {
      const client = new APIClient();
      return client.get(`/AuditLogs/project/${projectId}`);
    },
    async getByTask(taskId) {
      const client = new APIClient();
      return client.get(`/AuditLogs/task/${taskId}`);
    },
    async getByUser(userId, page = 1, pageSize = 50) {
      const client = new APIClient();
      return client.get(
        `/AuditLogs/user/${userId}?page=${page}&pageSize=${pageSize}`
      );
    },
    async getRecent(count = 10) {
      const client = new APIClient();
      return client.get(`/AuditLogs/recent?count=${count}`);
    },
  },

  // Reporting Service
  Reporting: {
     async getEmployeeReport(userId, startDate, endDate) {
         const client = new APIClient();
         let url = `/Reporting/employee/${userId}`;
         const params = [];
         if(startDate) params.push(`startDate=${startDate}`);
         if(endDate) params.push(`endDate=${endDate}`);
         if(params.length > 0) url += `?${params.join('&')}`;
         return client.get(url);
     },
     async getClientReport(clientId, startDate, endDate) {
         const client = new APIClient();
         let url = `/Reporting/client/${clientId}`;
         const params = [];
         if(startDate) params.push(`startDate=${startDate}`);
         if(endDate) params.push(`endDate=${endDate}`);
         if(params.length > 0) url += `?${params.join('&')}`;
         return client.get(url);
     }
  },

  // Sales Service
  Sales: {
      async getStrategy() {
          const client = new APIClient();
          return client.get(`/Sales/strategy`);
      },
      async updateStrategy(dto) {
          const client = new APIClient();
          return client.post(`/Sales/strategy`, dto);
      },
      async getMarket() {
          const client = new APIClient();
          return client.get(`/Sales/market`);
      },
      async updateMarketStatus(dto) {
          const client = new APIClient();
          return client.post(`/Sales/market/update-status`, dto);
      },
      async getTarget(teamLeaderId, month, year) {
          const client = new APIClient();
          const query = new URLSearchParams({ teamLeaderId, month, year }).toString();
          return client.get(`/Sales/targets?${query}`);
      },
      async getSummary(month, year) {
          const client = new APIClient();
          const query = new URLSearchParams({ month, year }).toString();
          return client.get(`/Sales/targets/summary?${query}`);
      },
      async assignTarget(dto) {
          const client = new APIClient();
          return client.post(`/Sales/assign-target`, dto);
      },
      async createTeamLeader(dto) {
          const client = new APIClient();
          return client.post(`/Sales/team-leader`, dto);
      },
      async getDashboardStats(teamLeaderId, month, year) {
          const client = new APIClient();
          const query = new URLSearchParams({ teamLeaderId, month, year }).toString();
          return client.get(`/Sales/dashboard-stats?${query}`);
      },
      async getEmployeeStats(month, year) {
          const client = new APIClient();
          const query = new URLSearchParams({ month, year }).toString();
          return client.get(`/Sales/employee-stats?${query}`);
      },
      async getWeeklyWarRoom(userId) {
          const client = new APIClient();
          return client.get(`/Sales/weekly-war-room?userId=${userId}`);
      },
       async setStrategy(dto) {
           const client = new APIClient();
           return client.post(`/Sales/weekly-war-room`, dto);
       },
       async reviewTask(dto) {
           const client = new APIClient();
           return client.post(`/Sales/review-task`, dto);
       },
       async getMarketSegments(status = '') {
           const client = new APIClient();
           let url = '/Sales/market-segments';
          if(status) url += `?status=${status}`;
          return client.get(url);
      },
      async addMarketSegment(dto) {
          const client = new APIClient();
          return client.post(`/Sales/market-segments`, dto);
      },
      async updateMarketSegmentStatus(id, status) {
          const client = new APIClient();
          return client.put(`/Sales/market-segments/${id}/status`, { Status: status });
      },
      async deleteMarketSegment(id) {
          const client = new APIClient();
          return client.delete(`/Sales/market-segments/${id}`);
      }
  },

  // Keep legacy aliases for backward compatibility
  Employees: {
    getAll: () => API.Users.getAll(),
    getById: (id) => API.Users.getById(id),
    create: (data) => API.Users.create(data),
    update: (id, data) => API.Users.update(id, data),
    delete: (id) => API.Users.delete(id),
  },

  // Keep legacy Analytics alias
  Analytics: {
    getDashboardStats: () => API.Statistics.getDashboard(),
    getTaskStats: () => API.Statistics.getTasksByStatus(),
    getProjectStats: () => API.Statistics.getProjectProgress(),
  },
};

// Export for use in other files
window.API = API;
