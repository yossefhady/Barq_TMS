// Employee Dashboard Script

// Protect page - require Employee role
auth.requireRole([USER_ROLES.EMPLOYEE]);

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
  await loadWeeklyStrategy();
});

// Load all dashboard data
async function loadDashboardData() {
  try {
    utils.showLoading();

    // Fetch employee's tasks and projects
    const [tasks, projects] = await Promise.all([
      API.Tasks.getAll().catch(() => []),
      API.Projects.getAll().catch(() => []),
    ]);

    // Filter tasks assigned to current user
    const currentUser = auth.getCurrentUser();
    const myTasks = tasks.filter(
      (task) => task.AssignedTo === currentUser.UserId
    );

    // Detect Sales Department (handle DepartmentDto.DeptName vs Department.Name inconsistencies)
    const isSales = currentUser.Departments && currentUser.Departments.some(d => {
        const name = d.DeptName || d.Name || '';
        return name.toLowerCase().includes('sales');
    });

    if (isSales) {
        loadSalesStats();
        // Hide Projects section for Sales
        const projectsCard = document.getElementById('recentProjectsBody')?.closest('.card');
        const projectsStat = document.getElementById('totalProjects')?.closest('.stat-card');
        const projectsNav = document.getElementById('nav-projects');
        
        if(projectsCard) projectsCard.style.display = 'none';
        if(projectsStat) projectsStat.style.display = 'none';
        if(projectsNav) projectsNav.style.display = 'none';
    }

    // Update stats
    updateStats(myTasks, projects);

    // Render recent data
    renderRecentTasks(myTasks.slice(0, 10), isSales);
    
    // Only render projects if not sales
    if (!isSales) {
        renderRecentProjects(projects.slice(0, 5));
    }
  } catch (error) {
    console.error("Error loading dashboard:", error);
    utils.showError("Failed to load dashboard data");
  } finally {
    utils.hideLoading();
  }
}

// Update statistics cards
function updateStats(tasks, projects) {
  // Pending (0)
  const pendingTasks = tasks.filter((t) => t.StatusId === 0).length;
  // In Progress (1)
  const inProgressTasks = tasks.filter((t) => t.StatusId === 1).length;
  // In Review (2)
  const reviewTasks = tasks.filter((t) => t.StatusId === 2).length;
  // Completed (3)
  const completedTasks = tasks.filter((t) => t.StatusId === 3).length;

  try {
    const totalEl = document.getElementById("totalTasks");
    const pendingEl = document.getElementById("pendingTasks");
    const completedEl = document.getElementById("completedTasks");
    const projectsEl = document.getElementById("totalProjects");

    if (totalEl) totalEl.textContent = tasks.length;
    // User requested "Pending" to reflect only pending tasks. 
    // Maybe we should add "In Progress" stat? 
    // For now, I will map the dashboard card "Pending Tasks" to Status 0.
    if (pendingEl) pendingEl.textContent = pendingTasks; 
    if (completedEl) completedEl.textContent = completedTasks;
    if (projectsEl) projectsEl.textContent = projects.length;
  } catch(e) { console.error(e); }
}

// Render recent tasks
function renderRecentTasks(tasks, isSales = false) {
  const tbody = document.getElementById("recentTasksBody");
  const thead = document.getElementById("tasksTableHead");

  if (isSales) {
      if(thead) {
          thead.innerHTML = `
            <tr>
                <th>Title</th>
                <th>Activity</th>
                <th>Client Info</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Actions</th>
            </tr>
          `;
      }
  }

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isSales ? 6 : 6}" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No tasks assigned</h3>
            <p>You don't have any tasks assigned yet</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  if (isSales) {
      tbody.innerHTML = tasks.map(task => {
          const activityType = task.SalesActivityType == 1 ? "Meeting" :
                               task.SalesActivityType == 2 ? "Cold Call" :
                               task.SalesActivityType == 3 ? "Data Collection" :
                               task.SalesActivityType == 4 ? "Closing" : "-";
                               
          return `
            <tr>
              <td><strong>${task.Title || "Untitled"}</strong></td>
              <td><span class="badge ${getActivityBadgeClass(task.SalesActivityType)}">${activityType}</span></td>
              <td>${task.SalesClientInfo || "-"}</td>
              <td>${utils.getStatusBadge(task.StatusId !== undefined ? task.StatusId : 1)}</td>
              <td>${utils.getPriorityBadge(task.PriorityId !== undefined ? task.PriorityId : 1)}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="updateTaskStatus(${task.TaskId})">
                  <i class="fa-solid fa-edit"></i>
                </button>
              </td>
            </tr>
          `;
      }).join("");
  } else {
      // Standard Table
      tbody.innerHTML = tasks
        .map(
          (task) => `
        <tr>
          <td><strong>${task.Title || "Untitled Task"}</strong></td>
          <td>${task.ProjectName || "N/A"}</td>
          <td>${utils.getStatusBadge(task.StatusId !== undefined ? task.StatusId : 1)}</td>
          <td>${utils.getPriorityBadge(task.PriorityId !== undefined ? task.PriorityId : 1)}</td>
          <td>${utils.formatDate(task.DueDate)}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="updateTaskStatus(${
              task.TaskId
            })">
              <i class="fa-solid fa-edit"></i>
            </button>
          </td>
        </tr>
      `
        )
        .join("");
  }
}

function getActivityBadgeClass(type) {
    if(type == 1) return 'badge-info'; // Meeting
    if(type == 2) return 'badge-warning'; // Call
    if(type == 4) return 'badge-success'; // Closing
    return 'badge-secondary';
}


// Render recent projects
function renderRecentProjects(projects) {
  const tbody = document.getElementById("recentProjectsBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No projects found</h3>
            <p>You're not assigned to any projects yet</p>
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
      <td>${utils.formatDate(project.StartDate)}</td>
      <td>${utils.formatDate(project.EndDate)}</td>
      <td>${utils.getStatusBadge(project.StatusId || 1)}</td>
    </tr>
  `
    )
    .join("");
}

// Update task status
async function updateTaskStatus(taskId) {
  window.location.href = `my-tasks.html?taskId=${taskId}`;
}

async function loadSalesStats() {
    const container = document.getElementById('salesPerformanceSection');
    try {
        const now = new Date();
        const stats = await API.Sales.getEmployeeStats(now.getMonth() + 1, now.getFullYear());
        
        if (stats) {
            if(container) container.classList.remove('d-none');
            
            document.getElementById('myClients').textContent = stats.ActualClients || 0;
            // if(stats.TargetClients) document.getElementById('teamClients').textContent = stats.TargetClients;
            
            document.getElementById('myMeetings').textContent = stats.ActualMeetings || 0;
            // if(stats.TargetMeetings) document.getElementById('teamMeetings').textContent = stats.TargetMeetings;

            document.getElementById('myData').textContent = stats.ActualData || 0;
            // if(stats.TargetData) document.getElementById('teamData').textContent = stats.TargetData;
        }
    } catch (err) {
        console.warn("Could not load sales stats", err);
        if(container) container.classList.add('d-none');
    }
}

async function loadWeeklyStrategy() {
    const container = document.getElementById("warRoomContainer");
    const textEl = document.getElementById("warRoomText");
    const dateEl = document.getElementById("warRoomDate");

    const user = auth.getCurrentUser();
    if (!user) return;

    // Detect Sales Department (handle DepartmentDto.DeptName vs Department.Name inconsistencies)
    const isSales = user.Departments && user.Departments.some(d => {
        const name = d.DeptName || d.Name || '';
        return name.toLowerCase().includes('sales');
    });
    
    // Only show container if Sales
    if (container) {
         if (isSales) {
            container.classList.remove("d-none");
         } else {
            return; // Exit early for non-sales
         }
    }

    try {
        // Backend handles logic: if employee ID is passed, it looks up their supervisor's strategy
        const strategy = await API.Sales.getWeeklyWarRoom(user.UserId).catch(() => null);

        if (strategy && strategy.Content) {
            textEl.textContent = `"${strategy.Content}"`;
            dateEl.textContent = `Updated: ${utils.formatDate(strategy.LastUpdatedAt)}`;
            if (dateEl) dateEl.style.display = 'block';
        } else {
            textEl.textContent = "No strategy set for this week by your Team Leader.";
            textEl.style.fontStyle = 'normal';
            if (dateEl) dateEl.style.display = 'none';
        }
    } catch (err) {
        console.error("Error loading war room", err);
        if (textEl) textEl.textContent = "Unable to load strategy.";
    }
}

