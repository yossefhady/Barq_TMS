// Employee Profile Script

// Protect page - require Employee role
auth.requireRole([USER_ROLES.EMPLOYEE]);

let isEditing = false;
let originalData = {};

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document
    .getElementById("profileForm")
    .addEventListener("submit", handleProfileUpdate);
  document
    .getElementById("passwordForm")
    .addEventListener("submit", handlePasswordChange);
}

// Load profile data
async function loadProfile() {
  try {
    utils.showLoading();

    const currentUser = auth.getCurrentUser();

    // Fetch full user data from API
    const userData = await API.Users.getById(currentUser.UserId);

    // Populate form with user data
    document.getElementById("userName").value = userData.UserName || "";
    document.getElementById("email").value = userData.Email || "";
    document.getElementById("firstName").value = userData.FirstName || "";
    document.getElementById("lastName").value = userData.LastName || "";
    document.getElementById("phone").value = userData.Phone || "";

    // Store original data
    originalData = { ...userData };
  } catch (error) {
    console.error("Error loading profile:", error);
    utils.showError("Failed to load profile data");
  } finally {
    utils.hideLoading();
  }
}

// Enable edit mode
function enableEdit() {
  isEditing = true;
  document.getElementById("email").disabled = false;
  document.getElementById("firstName").disabled = false;
  document.getElementById("lastName").disabled = false;
  document.getElementById("phone").disabled = false;
  document.getElementById("formActions").style.display = "flex";
}

// Cancel edit mode
function cancelEdit() {
  isEditing = false;
  document.getElementById("email").disabled = true;
  document.getElementById("firstName").disabled = true;
  document.getElementById("lastName").disabled = true;
  document.getElementById("phone").disabled = true;
  document.getElementById("formActions").style.display = "none";

  // Restore original data
  loadProfile();
}

// Handle profile update
async function handleProfileUpdate(e) {
  e.preventDefault();

  if (!isEditing) return;

  try {
    utils.showLoading();

    const currentUser = auth.getCurrentUser();
    const updatedData = {
      ...currentUser,
      Email: document.getElementById("email").value,
      FirstName: document.getElementById("firstName").value,
      LastName: document.getElementById("lastName").value,
      Phone: document.getElementById("phone").value,
    };

    await API.Users.update(currentUser.UserId, updatedData);

    // Update stored user data
    auth.setAuthData(auth.getToken(), updatedData);

    utils.showSuccess("Profile updated successfully");
    cancelEdit();
  } catch (error) {
    console.error("Error updating profile:", error);
    utils.showError("Failed to update profile");
  } finally {
    utils.hideLoading();
  }
}

// Handle password change
async function handlePasswordChange(e) {
  e.preventDefault();

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    utils.showError("New passwords do not match");
    return;
  }

  // Validate password strength
  if (newPassword.length < 6) {
    utils.showError("Password must be at least 6 characters long");
    return;
  }

  try {
    utils.showLoading();

    const currentUser = auth.getCurrentUser();

    // Call API to change password
    await API.Auth.changePassword({
      userId: currentUser.UserID,
      currentPassword: currentPassword,
      newPassword: newPassword,
    });

    utils.showSuccess("Password changed successfully");

    // Clear form
    document.getElementById("passwordForm").reset();
  } catch (error) {
    console.error("Error changing password:", error);
    utils.showError(
      "Failed to change password. Please check your current password."
    );
  } finally {
    utils.hideLoading();
  }
}
