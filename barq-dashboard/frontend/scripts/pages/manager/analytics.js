// Manager Analytics Page Script
auth.requireRole([USER_ROLES.MANAGER]);

document.addEventListener("DOMContentLoaded", async () => {
  await loadAnalytics();
  await loadReportEntities();
});

async function loadAnalytics() {
  try {
    utils.showLoading();

    const now = new Date();
    const [tasks, projects, users, targets] = await Promise.all([
      API.Tasks.getAll().catch(() => []),
      API.Projects.getAll().catch(() => []),
      API.Users.getAll().catch(() => []),
      API.Sales.getSummary(now.getMonth() + 1, now.getFullYear()).catch(() => []) 
    ]);

    calculateTaskStats(tasks);
    renderBudgetOverview(projects, tasks);
    renderTargetsOverview(targets);
    renderTeamPerformance(tasks, users);
  } catch (error) {
    console.error("Error loading analytics:", error);
    utils.showError("Failed to load analytics data");
  } finally {
    utils.hideLoading();
  }
}

function calculateTaskStats(tasks) {
  const now = new Date();
  
  // Status IDs: 0: Pending, 1: In Progress, 2: In Review, 3: Completed, 4: Cancelled
  const completed = tasks.filter((t) => t.StatusId === 3).length;
  
  // Exclude Cancelled tasks
  const activeTasks = tasks.filter(t => t.StatusId !== 4 && t.StatusId !== 3); // Not cancelled, Not completed

  // Overdue logic
  const overdueTasks = activeTasks.filter(t => {
      if(!t.DueDate) return false;
      const dueDate = new Date(t.DueDate);
      dueDate.setHours(23, 59, 59, 999);
      return dueDate < now;
  });
  const overdueCount = overdueTasks.length;

  // Pending & In Progress (Non-Overdue)
  const pendingCount = activeTasks.filter(t => t.StatusId === 0 && (!t.DueDate || new Date(t.DueDate) >= now)).length;
  
  const inProgressCount = activeTasks.filter(t => (t.StatusId === 1 || t.StatusId === 2) && (!t.DueDate || new Date(t.DueDate) >= now)).length;

  // Update Stats Cards (Show real totals, including overdue in buckets if preferred, but usually cards show status counts)
  // For cards, we usually keep them as status based + overdue count
  document.getElementById("completedTasks").textContent = completed;
  document.getElementById("pendingTasks").textContent = tasks.filter(t => t.StatusId === 0).length;
  document.getElementById("inProgressTasks").textContent = tasks.filter(t => t.StatusId === 1 || t.StatusId === 2).length;
  document.getElementById("overdueTasks").textContent = overdueCount;

  // Render chart with Mutually Exclusive Categories (Pending | In Progress | Completed | Overdue)
  renderTaskDistributionChart(
    pendingCount,
    inProgressCount,
    completed,
    overdueCount
  );
}


function renderBudgetOverview(projects, tasks) {
  const tbody = document.getElementById("budgetTableBody");

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No project data available</h3>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Calculate completion for each project based on tasks
  const projectsWithCompletion = projects.map((project) => {
    const projectTasks = tasks.filter((t) => t.ProjectId === project.ProjectId);
    const completedTasks = projectTasks.filter((t) => t.StatusId === 3).length; // Corrected ID
    const totalTasks = projectTasks.length;
    const completion =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...project,
      totalTasks,
      completedTasks,
      completion,
    };
  });


  tbody.innerHTML = projectsWithCompletion
    .map((project) => {
      return `
      <tr>
        <td><strong>${project.ProjectName || "Untitled"}</strong></td>
        <td>${project.ClientName || "No Client"}</td>
        <td><span class="badge badge-info">${
          project.totalTasks
        } tasks</span> <span class="badge badge-success">${
        project.completedTasks
      } done</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="flex: 1; height: 8px; background: rgba(126, 45, 150, 0.2); border-radius: 4px; overflow: hidden;">
              <div style="width: ${
                project.completion
              }%; height: 100%; background: linear-gradient(90deg, var(--primary-color), var(--primary-light));"></div>
            </div>
            <span style="font-size: var(--text-sm); color: var(--text-secondary);">${
              project.completion
            }%</span>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderTargetsOverview(targets) {
  const tbody = document.getElementById("targetsTableBody");
  if (!tbody) return;

  if (!targets || targets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-bullseye"></i>
            <h3>No targets set for this month</h3>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = targets
    .map((target) => {
      let totalPercent = 0;
      let count = 0;
      
      const tClients = target.TargetClients || target.targetClients || 0;
      const aClients = target.ActualClients || target.actualClients || 0;
      if (tClients > 0) {
          totalPercent += Math.min((aClients / tClients) * 100, 100);
          count++;
      }
      
      const tMeetings = target.TargetMeetings || target.targetMeetings || 0;
      const aMeetings = target.ActualMeetings || target.actualMeetings || 0;
      if (tMeetings > 0) {
          totalPercent += Math.min((aMeetings / tMeetings) * 100, 100);
          count++;
      }

      const overallProgress = count > 0 ? Math.round(totalPercent / count) : 0;
      const name = target.TeamLeaderName || target.teamLeaderName || 'Unknown';

      return `
      <tr>
        <td><strong>${name}</strong></td>
        <td>
           <span class="badge ${aClients >= tClients && tClients > 0 ? 'badge-success' : 'badge-info'}">
             ${aClients} / ${tClients || '-'}
           </span>
        </td>
        <td>
           <span class="badge ${aMeetings >= tMeetings && tMeetings > 0 ? 'badge-success' : 'badge-info'}">
             ${aMeetings} / ${tMeetings || '-'}
           </span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="flex: 1; height: 8px; background: rgba(126, 45, 150, 0.2); border-radius: 4px; overflow: hidden;">
              <div style="width: ${overallProgress}%; height: 100%; background: linear-gradient(90deg, var(--primary-color), var(--primary-light));"></div>
            </div>
            <span style="font-size: var(--text-sm); color: var(--text-secondary);">${overallProgress}%</span>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderTeamPerformance(tasks, allUsers) {
  const tbody = document.getElementById("performanceTableBody");

  // Filter users: Exclude Admins(0), Managers(1), Clients(6). Keep AsstMgr(2), AcctMgr(3), TeamLeader(4), Employee(5)
  const users = allUsers.filter(u => [2, 3, 4, 5].includes(u.Role));

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px;">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <h3>No employee data available</h3>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users
    .map((user) => {
      const userId = user.UserId;
      let relevantTasks = [];

      if (user.Role === 4) { // Team Leader
        // Find team members (Employees who have this user as TeamLeaderId)
        const teamMemberIds = allUsers
            .filter(u => u.TeamLeaderId === userId)
            .map(u => u.UserId);

        relevantTasks = tasks.filter(t => {
            // 1. Tasks assigned to the TL directly
            const isAssignedToMe = t.AssignedTo === userId;
            // 2. Tasks assigned to team members that are In Review (StatusId 2)
            const isTeamReview = t.StatusId === 2 && teamMemberIds.includes(t.AssignedTo);
            
            return (isAssignedToMe || isTeamReview) && t.StatusId !== 4; // Exclude cancelled
        });
      } else {
        // Employee / Others: Just assigned tasks
        relevantTasks = tasks.filter((t) => t.AssignedTo === userId && t.StatusId !== 4);
      }
      
      const completed = relevantTasks.filter((t) => t.StatusId === 3).length;
      const pending = relevantTasks.filter((t) => t.StatusId === 0).length;
      const inProgress = relevantTasks.filter((t) => t.StatusId === 1 || t.StatusId === 2).length;
      
      const completionRate =
        relevantTasks.length > 0
          ? Math.round((completed / relevantTasks.length) * 100)
          : 0;

      return `
      <tr>
        <td><strong>${user.Name || user.Username || "Unknown"}</strong></td>
        <td>${relevantTasks.length}</td>
        <td><span class="badge badge-success">${completed}</span></td>
        <td><span class="badge badge-info">${inProgress}</span></td>
        <td><span class="badge badge-warning">${pending}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="flex: 1; height: 8px; background: rgba(16, 185, 129, 0.2); border-radius: 4px; overflow: hidden;">
              <div style="width: ${completionRate}%; height: 100%; background: var(--success);"></div>
            </div>
            <span style="font-size: var(--text-sm); font-weight: 600;">${completionRate}%</span>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

// Chart rendering function
let taskChart = null;

function renderTaskDistributionChart(pending, inProgress, completed, overdue) {
  const canvas = document.getElementById("taskDistributionChart");

  // Destroy existing chart if it exists
  if (taskChart) {
    taskChart.destroy();
  }

  const ctx = canvas.getContext("2d");

  taskChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Pending", "In Progress", "Completed", "Overdue"],
      datasets: [
        {
          data: [pending, inProgress, completed, overdue],
          backgroundColor: [
            "rgba(245, 158, 11, 0.8)", // Warning/Pending - Orange
            "rgba(59, 130, 246, 0.8)", // Info/In Progress - Blue
            "rgba(16, 185, 129, 0.8)", // Success/Completed - Green
            "rgba(239, 68, 68, 0.8)",  // Danger/Overdue - Red
          ],
          borderColor: [
            "rgb(245, 158, 11)",
            "rgb(59, 130, 246)",
            "rgb(16, 185, 129)",
            "rgb(239, 68, 68)",
          ],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#f2f0d9",
            font: {
              size: 14,
            },
            padding: 15,
          },
        },
        tooltip: {
          backgroundColor: "rgba(30, 30, 46, 0.9)",
          titleColor: "#f2f0d9",
          bodyColor: "#f2f0d9",
          borderColor: "rgba(126, 45, 150, 0.5)",
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

// Report Generation Logic
let allUsers = [];
let allClients = [];

async function loadReportEntities() {
  try {
    const [users, clients] = await Promise.all([
      API.Users.getAll().catch(() => []),
      API.Clients.getAll().catch(() => [])
    ]);
    
    allUsers = users;
    allClients = clients;
    
    toggleReportEntitySelect(); // Initialize dropdown
  } catch (error) {
    console.error("Error loading report entities:", error);
  }
}

window.toggleReportEntitySelect = function() {
  const type = document.getElementById("reportType").value;
  const select = document.getElementById("reportEntity");
  select.innerHTML = '<option value="">Select...</option>';
  
  if (type === "employee") {
    allUsers.forEach(user => {
      const option = document.createElement("option");
      option.value = user.UserId;
      option.textContent = user.Name || user.Username;
      select.appendChild(option);
    });
  } else {
    allClients.forEach(client => {
      const option = document.createElement("option");
      option.value = client.ClientId;
      option.textContent = client.Name;
      select.appendChild(option);
    });
  }
};

window.generateReport = async function() {
  const type = document.getElementById("reportType").value;
  const entityId = document.getElementById("reportEntity").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  
  if (!entityId) {
    utils.showError("Please select an entity");
    return;
  }
  
  utils.showLoading();
  const resultsDiv = document.getElementById("reportResults");
  const contentDiv = document.getElementById("reportContent");
  const titleEl = document.getElementById("reportTitle");
  
  try {
    let data;
    if (type === "employee") {
      data = await API.Reporting.getEmployeeReport(entityId, startDate, endDate);
      titleEl.textContent = `Performance Report: ${data.UserName}`;
      renderEmployeeReport(data, contentDiv);
    } else {
      data = await API.Reporting.getClientReport(entityId, startDate, endDate);
      titleEl.textContent = `Client Report: ${data.ClientName}`;
      renderClientReport(data, contentDiv);
    }
    resultsDiv.style.display = "block";
  } catch (error) {
    console.error("Error generating report:", error);
    utils.showError("Failed to generate report");
    resultsDiv.style.display = "none";
  } finally {
    utils.hideLoading();
  }
};

function renderEmployeeReport(data, container) {
  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">Completion Rate</span>
          <span class="stat-value">${data.CompletionRate.toFixed(1)}%</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">Total Tasks</span>
          <span class="stat-value">${data.TotalTasksAssigned}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">Completed</span>
          <span class="stat-value">${data.CompletedTasks}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">Overdue</span>
          <span class="stat-value" style="color: var(--danger);">${data.OverdueTasks}</span>
        </div>
      </div>
    </div>
    <div style="margin-top: 20px;">
      <p><strong>Total Hours Logged:</strong> ${data.TotalHoursLogged.toFixed(2)} hrs</p>
      <p><strong>Projects Worked On:</strong> ${data.ProjectsWorkedOn}</p>
      <p><strong>Avg Completion Time:</strong> ${data.AverageTaskCompletionDays.toFixed(1)} days</p>
    </div>
  `;
}

function renderClientReport(data, container) {
  container.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">Active Projects</span>
          <span class="stat-value">${data.ActiveProjects} / ${data.TotalProjects}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">Total Tasks</span>
          <span class="stat-value">${data.TotalTasks}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">Completion</span>
          <span class="stat-value">${data.CompletionPercentage.toFixed(1)}%</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-label">Overdue</span>
          <span class="stat-value" style="color: var(--danger);">${data.OverdueTasks}</span>
        </div>
      </div>
    </div>
    <div style="margin-top: 20px;">
      <p><strong>Company:</strong> ${data.CompanyName}</p>
      <p><strong>Estimated Hours:</strong> ${data.TotalEstimatedHours}</p>
      <p><strong>Actual Hours:</strong> ${data.TotalActualHours}</p>
    </div>
  `;
}
