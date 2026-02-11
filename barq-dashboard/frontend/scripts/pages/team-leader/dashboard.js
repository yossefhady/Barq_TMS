// Team Leader Dashboard Script

// Protect page - require Manager role
auth.requireRole([USER_ROLES.TEAM_LEADER]);

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
    // Attempt to load sales targets regardless of explicit department check
    // If targets exist (non-zero goals), the widget will appear.
    await loadSalesTargets();
    
    // Load War Room Strategy
    await loadWeeklyStrategy();

    await loadDashboardData();
});

// --- War Room Strategy Logic ---
async function loadWeeklyStrategy() {
    const container = document.getElementById("warRoomContainer");
    const textEl = document.getElementById("warRoomText");
    const dateEl = document.getElementById("warRoomDate");

    const user = auth.getCurrentUser();
    if (!user) return;

    // Check if Sales Team Leader
    const isSales = user.Departments && user.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase() === "sales");
    
    // Only show container if Sales TL
    if (container) {
         if (isSales) {
            container.classList.remove("d-none");
            container.style.display = 'block';
         } else {
            container.classList.add("d-none");
            container.style.display = 'none';
            return; // Exit early for non-sales
         }
    }

    try {
        const strategy = await API.Sales.getWeeklyWarRoom(user.UserId || user.userId).catch(() => null);

        if (strategy && strategy.Content) {
            textEl.textContent = `"${strategy.Content}"`;
            dateEl.textContent = `Updated: ${utils.formatDate(strategy.LastUpdatedAt || strategy.lastUpdatedAt)}`;
            if (dateEl) dateEl.style.display = 'block';
        } else {
            textEl.textContent = "No strategy set for this week.";
            if (dateEl) dateEl.style.display = 'none';
        }
    } catch (e) {
        console.error("Error loading strategy", e);
        if(textEl) textEl.textContent = "Unable to load strategy.";
        if(dateEl) dateEl.style.display = 'none';
    }
}

function openStrategyModal() {
    const textEl = document.getElementById("warRoomText");
    const currentText = textEl.textContent.replace(/^"|"$/g, ''); // Remove quotes
    
    const input = document.getElementById("strategyInput");
    if(currentText !== "No strategy set for this week." && currentText !== "Loading strategy..." && currentText !== "Unable to load strategy.") {
        input.value = currentText;
    } else {
        input.value = "";
    }
    
    document.getElementById("strategyModal").classList.remove("d-none");
}

function closeStrategyModal() {
    document.getElementById("strategyModal").classList.add("d-none");
}

async function saveStrategy() {
    console.log("Saving strategy...");
    const input = document.getElementById("strategyInput");
    const content = input.value.trim();
    
    if (!content) {
        utils.showToast("Please enter a strategy message", "warning");
        return;
    }

    try {
        utils.showLoading();
        console.log("Sending strategy to API:", content);
        await API.Sales.setStrategy({ Content: content });
        utils.hideLoading();
        
        closeStrategyModal();
        await loadWeeklyStrategy(); // Reload UI
        utils.showToast("Strategy updated successfully", "success");
    } catch(e) {
        console.error("Failed to save strategy:", e);
        utils.hideLoading();
        utils.showError("Failed to update strategy: " + (e.message || "Unknown error"));
    }
}

// Ensure global access
window.openStrategyModal = openStrategyModal;
window.closeStrategyModal = closeStrategyModal;
window.saveStrategy = saveStrategy;

async function loadSalesTargets() {
    try {
        const user = auth.getCurrentUser();
        const userId = user?.UserId || user?.userId;
        
        if (!userId) {
            console.warn("User ID not found context");
            return;
        }

        const now = new Date();
        const apiResponse = await API.Sales.getDashboardStats(userId, now.getMonth() + 1, now.getFullYear());
        console.log("Sales Targets API Response:", apiResponse);

        // Normalize response
        const tClients = apiResponse?.TargetClients ?? apiResponse?.targetClients ?? 0;
        const tMeetings = apiResponse?.TargetMeetings ?? apiResponse?.targetMeetings ?? 0;
        const tData = apiResponse?.TargetData ?? apiResponse?.targetData ?? 0;

        const aClients = apiResponse?.ActualClients ?? apiResponse?.actualClients ?? 0;
        const aMeetings = apiResponse?.ActualMeetings ?? apiResponse?.actualMeetings ?? 0;
        const aData = apiResponse?.ActualData ?? apiResponse?.actualData ?? 0;
        
        // Only show if at least one target is set (> 0)
        const hasTargets = (tClients > 0 || tMeetings > 0 || tData > 0);

        if (hasTargets) {
            // Update Cards - visibility is handled inside updateInfoCard
            updateInfoCard("cardTargetClients", aClients, tClients);
            updateInfoCard("cardTargetMeetings", aMeetings, tMeetings);
            updateInfoCard("cardTargetData", aData, tData);

            // SPECIAL LOGIC: Hide Projects UI for Sales TLs who have targets
            hideProjectsUI();

            // Load Targeted Segments Overview
            loadTargetedSegmentsPreview();
        } 
        // Force hide all if user has NO targets at all (though individual calls to updateInfoCard with 0 will also hide them)
        else {
             updateInfoCard("cardTargetClients", 0, 0);
             updateInfoCard("cardTargetMeetings", 0, 0);
             updateInfoCard("cardTargetData", 0, 0);
        }

    } catch (e) {
        console.error("Failed to load sales targets", e);
    }
}

async function loadTargetedSegmentsPreview() {
    const container = document.getElementById("targetedSegmentsContainer");
    const tbody = document.getElementById("targetedSegmentsBody");
    
    if(!container || !tbody) return;

    try {
        // Show Container
        container.classList.remove("d-none");
        tbody.innerHTML = '<tr><td colspan="3"><div class="spinner"></div></td></tr>';

        // Fetch using existing API.Sales.getMarketSegments
        const segments = await API.Sales.getMarketSegments('Targeted'); // Ensure simple string filter in backend
        // Backend expects 'status' query param. JS API helper handles query param construction if designed right.
        
        if (!segments || segments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted">
                        No segments currently targeted. Go to Market Map to add targets.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = segments.map(seg => `
            <tr>
                <td><strong>${seg.Place || seg.place || 'Unknown'}</strong></td>
                <td>${seg.Category || seg.category || 'General'}</td>
                <td><span class="badge badge-info">Targeted</span></td>
            </tr>
        `).join("");

    } catch (e) {
        console.error("Error loading segments preview", e);
        tbody.innerHTML = `<tr><td colspan="3" class="text-danger">Failed to load segments</td></tr>`;
    }
}

function updateInfoCard(elementId, actual, target) {
    const el = document.getElementById(elementId);
    if (!el) return;

    // Find the parent card
    const card = el.closest('.stat-card');

    if (!target || target === 0) {
        // HIDE if N/A
        if (card) card.style.display = 'none';
        el.textContent = '0'; // default
    } else {
        // SHOW if active
        if (card) card.style.display = 'flex';
        
        // Only show the target number as requested
        el.textContent = `${target}`;
        
        // Optional: Add color if achieved
        if (actual >= target) {
            el.classList.add('text-success');
        } else {
            el.classList.remove('text-success');
        }
    }
}

function hideProjectsUI() {
    // 1. Hide "Active Projects" Stat Card
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        if (card.textContent.includes('Active Projects')) {
            card.style.display = 'none';
        }
    });

    // 2. Hide "Active Projects" Table Section
    const headers = document.querySelectorAll('h3');
    headers.forEach(h3 => {
        if (h3.textContent.trim() === 'Active Projects') {
            const card = h3.closest('.card');
            if (card) {
                card.style.display = 'none';
            }
        }
    });
}

// Load all dashboard data
async function loadDashboardData() {
  try {
    utils.showLoading();

    // Fetch all data in parallel
    const [tasks, projects, allUsers] = await Promise.all([
      API.Tasks.getAll().catch(() => []),
      API.Projects.getAll().catch(() => []),
      API.Users.getAll().catch(() => []), // This will return only supervised employees for team leader
    ]);

    // Filter users to only show employees (exclude the team leader themselves if returned)
    const employees = allUsers.filter(u => (u.Role || u.RoleId) === 5);

    // Sort tasks by ID descending (Newest first)
    tasks.sort((a, b) => (b.TaskId || b.taskId || 0) - (a.TaskId || a.taskId || 0));

    // Update stats
    updateStats({ tasks, projects, employees });

    // Render recent data
    renderRecentTasks(tasks.slice(0, 10));
    renderRecentProjects(projects.slice(0, 5));
  } catch (error) {
    console.error("Error loading dashboard:", error);
    utils.showError("Failed to load dashboard data");
  } finally {
    utils.hideLoading();
  }
}

// Update statistics cards
function updateStats(data) {
  const user = auth.getCurrentUser();
  const isCreative = user && user.Departments && user.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase().includes("creative"));
  const isSales = user && user.Departments && user.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase() === "sales");

  let displayTasks = data.tasks;
  if(isCreative || isSales) {
      // For Creative AND Sales Team Leader, filter out Completed (Status 3) from Total Tasks count
      displayTasks = data.tasks.filter(t => (t.StatusId !== undefined ? t.StatusId : t.statusId) !== 3);
  }

  document.getElementById("totalTasks").textContent = displayTasks.length;
  document.getElementById("totalProjects").textContent = data.projects.length;
  document.getElementById("totalEmployees").textContent = data.employees.length;
}

// Render recent tasks
function renderRecentTasks(tasks) {
  const tbody = document.getElementById("recentTasksBody");
  const thead = document.getElementById("recentTasksTableHead");

  const user = auth.getCurrentUser();
  const isSales = user && user.Departments && user.Departments.some(d => (d.DeptName || d.Name || '').toLowerCase() === "sales");

  // Activity Map (Text only)
  const activityMap = {
    1: '<span class="badge badge-info">Meeting</span>',
    2: '<span class="badge badge-secondary">Cold Call</span>',
    3: '<span class="badge badge-warning">Data</span>',
    4: '<span class="badge badge-success">Closing</span>'
  };

  // Update Header based on Dept
  if (thead) {
      if (isSales) {
          thead.innerHTML = `
            <tr>
                <th>Task</th>
                <th>Activity</th>
                <th>Client Info</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
            </tr>
          `;
      } else {
           thead.innerHTML = `
            <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
            </tr>
          `;
      }
  }

  if (tasks.length === 0) {
    const colSpan = isSales ? 7 : 6;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks found</h3>
            <p>Create your first task to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tasks
    .map(
      (task) => {
        let middleCols = '';
        if (isSales) {
             const act = (task.SalesActivityType && activityMap[task.SalesActivityType]) 
                    ? activityMap[task.SalesActivityType] 
                    : '<span style="color:var(--text-secondary)">-</span>';
             const client = task.SalesClientInfo || '<span style="color:var(--text-secondary)">-</span>';
             middleCols = `
                <td>${act}</td>
                <td>${client}</td>
             `;
        } else {
             middleCols = `<td>${task.ProjectName || "N/A"}</td>`;
        }

        return `
            <tr>
            <td><strong>${task.Title || "Untitled Task"}</strong></td>
            ${middleCols}
            <td>${task.AssignedToName || "Unassigned"}</td>
            <td>${utils.getStatusBadge(task.StatusId)}</td>
            <td>${utils.getPriorityBadge(task.PriorityId)}</td>
            <td>${utils.formatDate(task.DueDate)}</td>
            </tr>
        `;
      }
    )
    .join("");
}

// Render recent projects
function renderRecentProjects(projects) {
  const tbody = document.getElementById("recentProjectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No projects found</h3>
            <p>Create your first project to get started</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = projects
    .map(
      (project) => `
    <tr>
      <td><strong>${project.ProjectName || "Untitled Project"}</strong></td>
      <td>${project.ClientName || "N/A"}</td>
      <td><span class="badge badge-info">${
        project.TaskCount || 0
      } tasks</span></td>
      <td>${utils.formatDate(project.StartDate)} - ${utils.formatDate(
        project.EndDate
      )}</td>
    </tr>
  `
    )
    .join("");
}
