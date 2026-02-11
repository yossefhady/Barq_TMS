// Notification Panel Component
class NotificationPanel {
  constructor() {
    this.isOpen = false;
    this.notifications = [];
    this.panel = null;
    this.initialized = false;
  }

  // Initialize the panel
  async initialize() {
    if (this.initialized) return;

    this.createPanel();
    this.setupEventListeners();
    await this.loadNotifications();
    this.initialized = true;

    // Listen to notification service events
    notificationService.on("onReceive", (notification) => {
      this.handleNewNotification(notification);
    });

    console.log("[NotificationPanel] Initialized");
  }

  // Create panel HTML
  createPanel() {
    const panel = document.createElement("div");
    panel.className = "notification-panel";
    panel.id = "notificationPanel";
    panel.innerHTML = `
      <div class="notification-panel-header">
        <h3 class="notification-panel-title">Notifications</h3>
        <div class="notification-panel-actions">
          <button class="notification-panel-btn" id="markAllReadBtn">
            Mark all read
          </button>
        </div>
      </div>
      <div class="notification-panel-list" id="notificationList">
        <div class="notification-panel-empty">
          <i class="fa-solid fa-bell-slash"></i>
          <p>No notifications</p>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    // Close panel when clicking outside
    document.addEventListener("click", (e) => {
      if (
        this.isOpen &&
        !panel.contains(e.target) &&
        !e.target.closest(".notification-btn")
      ) {
        this.close();
      }
    });
  }

  // Setup event listeners
  setupEventListeners() {
    const markAllReadBtn = document.getElementById("markAllReadBtn");
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener("click", async () => {
        await this.markAllAsRead();
      });
    }

    // Setup notification button click handler
    const notificationBtns = document.querySelectorAll(
      ".notification-btn, .header-btn.notification-btn"
    );
    notificationBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggle();
      });
    });
  }

  // Toggle panel
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  // Open panel
  async open() {
    if (!this.initialized) {
      await this.initialize();
    }

    this.panel.classList.add("active");
    this.isOpen = true;
    await this.loadNotifications();
  }

  // Close panel
  close() {
    this.panel.classList.remove("active");
    this.isOpen = false;
  }

  // Load notifications from API
  async loadNotifications() {
    try {
      const currentUser = auth.getCurrentUser();
      if (!currentUser) return;

      const notifications = await API.Notifications.getByUser(
        currentUser.UserId
      );
      this.notifications = Array.isArray(notifications) ? notifications : [];
      this.render();
    } catch (error) {
      console.error("[NotificationPanel] Failed to load notifications:", error);
    }
  }

  // Handle new notification from SignalR
  handleNewNotification(notification) {
    // Notifications may come in different shapes (notifId vs NotificationId)
    const incomingId = this.getId(notification);

    if (notification.type === "read") {
      // Mark notification as read
      const index = this.notifications.findIndex(
        (n) => this.getId(n) == incomingId
      );
      if (index !== -1) this.notifications[index].IsRead = true;
    } else if (notification.type === "deleted") {
      // Remove notification
      this.notifications = this.notifications.filter(
        (n) => this.getId(n) != incomingId
      );
    } else {
      // Add new notification at the beginning
      this.notifications.unshift(notification);
    }

    this.render();
  }

  // Render notifications
  render() {
    const listContainer = document.getElementById("notificationList");
    if (!listContainer) return;

    if (this.notifications.length === 0) {
      listContainer.innerHTML = `
        <div class="notification-panel-empty">
          <i class="fa-solid fa-bell-slash"></i>
          <p>No notifications</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = this.notifications
      .map((notification) => this.renderNotificationItem(notification))
      .join("");

    // Add event listeners to notification items
    listContainer
      .querySelectorAll(".notification-item")
      .forEach((item, index) => {
        const notification = this.notifications[index];
        const id = this.getId(notification);

        item.addEventListener("click", async (e) => {
          if (e.target.closest(".notification-item-action-btn")) return;

          const taskId = notification?.TaskId ?? notification?.taskId ?? null;
          const hasDetails = taskId != null;

          // If notification has details, open the modal instead of just marking as read
          if (hasDetails) {
            const isRead = this.getIsRead(notification);
            if (!isRead) {
              await this.markAsRead(id);
            }
            await this.showNotificationDetails(notification);
          } else {
            // For regular notifications, mark as read and navigate if there's a link
            const isRead = this.getIsRead(notification);
            if (!isRead) {
              await this.markAsRead(id);
            }

            if (notification.Link) {
              window.location.href = notification.Link;
            }
          }
        });

        const deleteBtn = item.querySelector(".notification-delete-btn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.deleteNotification(id);
          });
        }

        const readBtn = item.querySelector(".notification-read-btn");
        if (readBtn) {
          readBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const isRead = this.getIsRead(notification);
            if (!isRead) {
              await this.markAsRead(id);
            }
          });
        }

        const detailsBtn = item.querySelector(".notification-details-btn");
        if (detailsBtn) {
          detailsBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const isRead = this.getIsRead(notification);
            if (!isRead) {
              await this.markAsRead(id);
            }
            await this.showNotificationDetails(notification);
          });
        }
      });
  }

  // Render single notification item
  renderNotificationItem(notification) {
    const isRead = this.getIsRead(notification);
    const icon = this.getNotificationIcon(this.getType(notification) || "info");
    const time = this.getRelativeTime(this.getCreatedAt(notification));
    const taskId = notification?.TaskId ?? notification?.taskId ?? null;
    const hasDetails = taskId != null;

    return `
      <div class="notification-item ${isRead ? "read" : "unread"}">
        <div class="notification-item-icon">${icon}</div>
        <div class="notification-item-content">
          <div class="notification-item-title">${this.escapeHtml(
            this.getTitle(notification) || "Notification"
          )}</div>
          <div class="notification-item-message">${this.escapeHtml(
            this.getMessage(notification) || ""
          )}</div>
          <div class="notification-item-time">${time}</div>
        </div>
        <div class="notification-item-actions">
          ${
            hasDetails
              ? `
            <button class="notification-item-action-btn notification-details-btn" title="View Details">
              <i class="fa-solid fa-eye"></i>
            </button>
          `
              : ""
          }
          ${
            !isRead
              ? `
            <button class="notification-item-action-btn notification-read-btn" title="Mark as read">
              <i class="fa-solid fa-check"></i>
            </button>
          `
              : ""
          }
          <button class="notification-item-action-btn notification-delete-btn" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Get notification icon
  getNotificationIcon(type) {
    const icons = {
      info: '<i class="fa-solid fa-circle-info"></i>',
      success: '<i class="fa-solid fa-circle-check"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
      error: '<i class="fa-solid fa-circle-exclamation"></i>',
      task: '<i class="fa-solid fa-list-check"></i>',
      project: '<i class="fa-solid fa-folder-open"></i>',
      message: '<i class="fa-solid fa-message"></i>',
      reminder: '<i class="fa-solid fa-bell"></i>',
    };
    return icons[type] || icons.info;
  }

  // Convenience accessors to handle different DTO casings
  getId(notification) {
    // API returns NotifId (PascalCase with capital N and I)
    const id =
      notification?.NotifId ??
      notification?.notifId ??
      notification?.NotificationId ??
      notification?.id ??
      notification?.Id ??
      null;
    console.log("[NotificationPanel] getId:", { notification, resolvedId: id });
    return id;
  }

  getIsRead(notification) {
    return (
      notification?.IsRead ??
      notification?.isRead ??
      notification?.read ??
      false
    );
  }

  getTitle(notification) {
    return (
      notification?.TaskTitle ??
      notification?.taskTitle ??
      notification?.Title ??
      notification?.title ??
      notification?.messageTitle ??
      null
    );
  }

  getMessage(notification) {
    return notification?.Message ?? notification?.message ?? null;
  }

  getType(notification) {
    return notification?.type ?? notification?.Type ?? null;
  }

  getCreatedAt(notification) {
    return notification?.CreatedAt ?? notification?.createdAt ?? new Date();
  }

  getTaskStatusUpdate(notification) {
    return (
      notification?.TaskStatusUpdate ??
      notification?.taskStatusUpdate ??
      notification?.StatusName ??
      notification?.statusName ??
      null
    );
  }

  getEmployeeNotes(notification) {
    return (
      notification?.EmployeeNotes ??
      notification?.employeeNotes ??
      notification?.Notes ??
      notification?.notes ??
      notification?.TaskNotes ??
      notification?.taskNotes ??
      null
    );
  }

  // Show notification details modal
  async showNotificationDetails(notification) {
    const notifId = this.getId(notification);

    try {
      // Fetch full details from API
      const details = await API.Notifications.getDetails(notifId);

      const taskTitle =
        details.TaskTitle ||
        details.taskTitle ||
        this.getTitle(notification) ||
        "Task Update";
      const message =
        details.Message ||
        details.message ||
        this.getMessage(notification) ||
        "";
      const createdAt =
        details.CreatedAt ||
        details.createdAt ||
        this.getCreatedAt(notification);

      // Create modal if it doesn't exist
      let modal = document.getElementById("notificationDetailsModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "notificationDetailsModal";
        modal.className = "modal-backdrop d-none";
        modal.innerHTML = `
          <div class="modal-dialog" style="max-width: 600px">
            <div class="modal-content">
              <div class="modal-header">
                <h3>Task Status Update</h3>
                <button class="btn-icon" onclick="document.getElementById('notificationDetailsModal').classList.add('d-none')">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label><strong>Task:</strong></label>
                  <p id="notifDetailTaskTitle">-</p>
                </div>
                <div class="form-group">
                  <label><strong>Message:</strong></label>
                  <p id="notifDetailMessage">-</p>
                </div>
                <div class="form-group">
                  <label><strong>Received:</strong></label>
                  <p id="notifDetailTime">-</p>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('notificationDetailsModal').classList.add('d-none')">
                  Close
                </button>
                <button class="btn btn-primary" id="notifDetailGoToTask" style="display: none">
                  <i class="fa-solid fa-arrow-right"></i> Go to Tasks
                </button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      // Populate modal with notification data
      document.getElementById("notifDetailTaskTitle").textContent = taskTitle;
      document.getElementById("notifDetailMessage").textContent = message;
      document.getElementById("notifDetailTime").textContent = new Date(
        createdAt
      ).toLocaleString();

      // Setup "Go to Tasks" button
      const goToTaskBtn = document.getElementById("notifDetailGoToTask");
      const taskId = details.TaskId || details.taskId;
      if (taskId) {
        goToTaskBtn.style.display = "inline-block";
        goToTaskBtn.onclick = () => {
          // Determine the correct tasks page based on user role
          const currentUser = auth.getCurrentUser();
          const role = currentUser?.Role || currentUser?.role;
          let tasksPage = "tasks.html"; // Default fallback

          if (role === 1) {
            // Manager
            tasksPage = "tasks.html";
          } else if (role === 2) {
            // Assistant Manager
            tasksPage = "tasks.html";
          } else if (role === 3) {
            // Account Manager
            tasksPage = "tasks.html";
          } else if (role === 4) {
            // Team Leader
            tasksPage = "team-tasks.html";
          } else if (role === 5) {
            // Employee
            tasksPage = "my-tasks.html";
          } else if (role === 6) {
            // Client
            tasksPage = "tasks.html";
          }

          document
            .getElementById("notificationDetailsModal")
            .classList.add("d-none");
          // Navigate to the tasks page in the current role's folder
          if (tasksPage) {
            window.location.href = tasksPage;
          }
        };
      } else {
        goToTaskBtn.style.display = "none";
      }

      // Show modal
      modal.classList.remove("d-none");
    } catch (error) {
      console.error(
        "[NotificationPanel] Failed to load notification details:",
        error
      );
      utils.showError("Failed to load notification details");
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      console.log(
        "[NotificationPanel] markAsRead called with:",
        notificationId
      );
      if (notificationId == null) {
        console.error(
          "[NotificationPanel] notificationId is null/undefined, cannot mark as read"
        );
        utils.showError("Invalid notification ID");
        return;
      }
      await API.Notifications.markAsRead(notificationId);

      const index = this.notifications.findIndex(
        (n) => this.getId(n) == notificationId
      );
      if (index !== -1) this.notifications[index].IsRead = true;

      this.render();
      notificationService.updateNotificationBadge();
    } catch (error) {
      console.error("[NotificationPanel] Failed to mark as read:", error);
      utils.showError("Failed to mark notification as read");
    }
  }

  // Mark all as read
  async markAllAsRead() {
    try {
      await notificationService.markAllAsRead();

      this.notifications.forEach((n) => (n.IsRead = true));
      this.render();
    } catch (error) {
      console.error("[NotificationPanel] Failed to mark all as read:", error);
    }
  }

  // Delete notification
  async deleteNotification(notificationId) {
    try {
      await API.Notifications.delete(notificationId);

      this.notifications = this.notifications.filter(
        (n) => this.getId(n) != notificationId
      );
      this.render();
      notificationService.updateNotificationBadge();
      utils.showSuccess("Notification deleted");
    } catch (error) {
      console.error(
        "[NotificationPanel] Failed to delete notification:",
        error
      );
      utils.showError("Failed to delete notification");
    }
  }

  // Utility: Escape HTML
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Utility: Get relative time
  getRelativeTime(date) {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return then.toLocaleDateString();
  }
}

// Create global notification panel instance
const notificationPanel = new NotificationPanel();

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (auth.isAuthenticated()) {
      notificationPanel.initialize();
    }
  });
} else {
  if (auth.isAuthenticated()) {
    notificationPanel.initialize();
  }
}
