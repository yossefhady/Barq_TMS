// REST-based Notification Service (polling) - replaces SignalR implementation
class NotificationService {
  constructor({ pollInterval = 30000 } = {}) {
    this.pollInterval = pollInterval;
    this.pollTimer = null;
    this.lastSeenIds = new Set();
    this.callbacks = {
      onReceive: [],
      onError: [],
      onUpdate: [],
    };
    this.isRunning = false;
  }

  // Initialize polling and perform initial load
  async initialize() {
    try {
      const currentUser = auth.getCurrentUser();
      if (!currentUser) {
        console.warn("[Notifications] No authenticated user, skipping init");
        return;
      }

      // Load initial unread list and set seen IDs
      const unread = await this.fetchUnreadList(currentUser.UserId);
      (unread || []).forEach((n) =>
        this.lastSeenIds.add(n.notifId || n.notifId || n.notifId)
      );

      // Update badge immediately
      await this.updateNotificationBadge();

      // Start polling
      this.startPolling();
      this.isRunning = true;
      console.log("[Notifications] Initialized (polling)");
    } catch (err) {
      console.error("[Notifications] Initialization error:", err);
      this.triggerCallbacks("onError", err);
    }
  }

  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.poll(), this.pollInterval);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
  }

  async poll() {
    try {
      const currentUser = auth.getCurrentUser();
      if (!currentUser) return;

      const unread = await this.fetchUnreadList(currentUser.UserId);
      if (!Array.isArray(unread)) return;

      // Detect new notifications by comparing notif ids
      const newOnes = (unread || []).filter((n) => {
        const id = n.notifId ?? n.notifId ?? n.notifId;
        return id != null && !this.lastSeenIds.has(id);
      });

      if (newOnes.length > 0) {
        newOnes.forEach((n) => {
          this.showToastFromDto(n);
          this.triggerCallbacks("onReceive", n);
          const id = n.notifId ?? n.notifId ?? n.notifId;
          if (id != null) this.lastSeenIds.add(id);
        });
        await this.updateNotificationBadge();
      }
    } catch (err) {
      console.error("[Notifications] Poll error:", err);
      this.triggerCallbacks("onError", err);
    }
  }

  async fetchUnreadList(userId) {
    try {
      const res = await API.Notifications.getUnread(userId);
      // API may return an object with data or an array directly
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.items)) return res.items;
      return res || [];
    } catch (err) {
      console.error("[Notifications] fetchUnreadList failed:", err);
      return [];
    }
  }

  // Update notification badge count using API
  async updateNotificationBadge() {
    try {
      const currentUser = auth.getCurrentUser();
      if (!currentUser) return;
      const res = await API.Notifications.getUnreadCount(currentUser.UserId);
      const count =
        res?.count ?? res?.Count ?? (typeof res === "number" ? res : 0);

      const badges = document.querySelectorAll(
        ".notification-btn .badge, .header-btn.notification-btn .badge"
      );
      badges.forEach((badge) => {
        badge.textContent = count;
        badge.style.display = count > 0 ? "flex" : "none";
      });

      this.triggerCallbacks("onUpdate", { count });
    } catch (err) {
      console.error("[Notifications] updateNotificationBadge failed:", err);
      this.triggerCallbacks("onError", err);
    }
  }

  // Public helper: mark notification as read
  async markAsRead(notifId) {
    try {
      await API.Notifications.markAsRead(notifId);
      await this.updateNotificationBadge();
    } catch (err) {
      console.error("[Notifications] markAsRead failed:", err);
      this.triggerCallbacks("onError", err);
    }
  }

  async markAllAsRead() {
    try {
      const currentUser = auth.getCurrentUser();
      if (!currentUser) return;
      await API.Notifications.markAllAsRead(currentUser.UserId);
      await this.updateNotificationBadge();
      utils.showSuccess("All notifications marked as read");
    } catch (err) {
      console.error("[Notifications] markAllAsRead failed:", err);
      utils.showError("Failed to mark notifications as read");
      this.triggerCallbacks("onError", err);
    }
  }

  async delete(notifId) {
    try {
      await API.Notifications.delete(notifId);
      await this.updateNotificationBadge();
    } catch (err) {
      console.error("[Notifications] delete failed:", err);
      this.triggerCallbacks("onError", err);
    }
  }

  async create(notificationData) {
    try {
      return await API.Notifications.create(notificationData);
    } catch (err) {
      console.error("[Notifications] create failed:", err);
      this.triggerCallbacks("onError", err);
      throw err;
    }
  }

  // Show UI toast for NotificationDto (v1 schema uses fields like notifId, message, createdAt)
  showToastFromDto(dto) {
    try {
      const toast = document.createElement("div");
      toast.className = "notification-toast";

      const title =
        dto.taskTitle || dto.projectName || dto.message || "Notification";
      const message = dto.message ?? dto.Message ?? "";
      const time = dto.createdAt ?? dto.CreatedAt ?? new Date();

      const icon = this.getNotificationIcon(dto.type || dto.Type || "info");

      toast.innerHTML = `
        <div class="notification-toast-content">
          <div class="notification-toast-icon">${icon}</div>
          <div class="notification-toast-body">
            <div class="notification-toast-title">${this.escapeHtml(
              title
            )}</div>
            <div class="notification-toast-message">${this.escapeHtml(
              message
            )}</div>
            <div class="notification-toast-time">${this.getRelativeTime(
              time
            )}</div>
          </div>
          <button class="notification-toast-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;

      toast
        .querySelector(".notification-toast-close")
        .addEventListener("click", (e) => {
          e.stopPropagation();
          toast.remove();
        });

      toast.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = dto.notifId ?? dto.notifId;
        if (id) this.markAsRead(id);
        if (dto.taskId) {
          window.location.href = `./tasks/view.html?id=${dto.taskId}`;
        } else if (dto.projectId) {
          window.location.href = `./projects/view.html?id=${dto.projectId}`;
        }
      });

      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = "slideOut 0.3s ease";
        setTimeout(() => toast.remove(), 300);
      }, 5000);

      // play sound
      this.playNotificationSound();
    } catch (err) {
      console.error("[Notifications] showToastFromDto error:", err);
    }
  }

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

  playNotificationSound() {
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltrzxnMnBSl+zPLaizsIGGS57OihUBALTKXh8bllHAU2jtTzzn0vBSd6yu/glEcMEVOn4/G2aR0GOZPc8st3KwUme8rx3I0+CRVht+vpoVkTCkql4/K6aB0FOo/V88V4LgUgdcjw2YpAChNdsOnrtV4YBzyU2/HEdigFKnvK8dyOPwkVYrfs6aBaDgtJo+PxuGgdBjqQ1fPEeC0FI3XJ8NiJPwoUXK/q7LVeGAc8lNvxxHYoBSt7y/HcjT8JFmG37OmgWg0LRqLi8bhqHgU7kdXzxHgtBSN0yPDZiz8KFF2v6+y1XhgHO5Tb8sR2KAUsesrx3I0+CRZiuO3poFkNDEWh4vG3ax4FO5DV8sV5LgUkdcnv2Is/CxRcr+vstl0YCDuV2/HFdisFKnrK8d2MPwkWYrju6aFaDgtFouLxt2seBS+T1fPEeS4FJHfK79iLQAoUXK/q7LZdGAg6lNvxxXYrBCp7yvHdjD4KFmG47umgWg4LQ6Lh8LhqHgU6kdT0xXktBCR4ye/YikALFVyu6uy2XRgIPJPb8cV3KwQqe8rx3Iw+ChVhue3poVoOCkSi4fG3ah4FOZPVfPFeC0FI3bJ8NmJPgoUXrfr7bVeGAc7ltvyxHYpBCt8yfDZi0ALFFys6uy1XhgHPJXa8sR2KQQresjw2YtACxRcr+rstV4YBzyV2vLDdikELH7G8dmKQAsRW7Do7LReGQY6k9vxw3opBCx9x/DZiz8KFFuv6+y0XhkGOpTa8sR2KQQsecjw2Ys/ChRbr+vstF4YCDqT2/HEdikELHnJ8NmLPwoTWrDp67ReGAY7k9rxw3YpBCx6yPDZiz4LEFq0LAALG0ujA="
      );
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (err) {
      // ignore
    }
  }

  // Event handlers registration
  on(event, cb) {
    if (this.callbacks[event]) this.callbacks[event].push(cb);
  }

  off(event, cb) {
    if (this.callbacks[event])
      this.callbacks[event] = this.callbacks[event].filter((c) => c !== cb);
  }

  triggerCallbacks(event, data) {
    (this.callbacks[event] || []).forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[Notifications] callback error (${event}):`, err);
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

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

// Replace the previous global with the polling implementation
const notificationService = new NotificationService({ pollInterval: 30000 });

// Auto-init when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (auth.isAuthenticated()) notificationService.initialize();
  });
} else {
  if (auth.isAuthenticated()) notificationService.initialize();
}
