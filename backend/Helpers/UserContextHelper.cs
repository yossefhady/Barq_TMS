using System.Security.Claims;

namespace BarqTMS.API.Helpers
{
    public static class UserContextHelper
    {
        /// <summary>
        /// Extract current user ID from JWT token
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <returns>User ID or null if not found</returns>
        public static int? GetCurrentUserId(ClaimsPrincipal user)
        {
            var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return null;
            }
            
            return userId;
        }

        /// <summary>
        /// Get current user ID or throw exception if not found
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <returns>User ID</returns>
        /// <exception cref="UnauthorizedAccessException">If user not found</exception>
        public static int GetCurrentUserIdOrThrow(ClaimsPrincipal user)
        {
            var userId = GetCurrentUserId(user);
            
            if (!userId.HasValue)
            {
                throw new UnauthorizedAccessException("Unable to determine current user from token");
            }
            
            return userId.Value;
        }

        /// <summary>
        /// Extract current user name from JWT token
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <returns>User name or null if not found</returns>
        public static string? GetCurrentUserName(ClaimsPrincipal user)
        {
            return user.FindFirst(ClaimTypes.Name)?.Value;
        }

        /// <summary>
        /// Extract current user email from JWT token
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <returns>User email or null if not found</returns>
        public static string? GetCurrentUserEmail(ClaimsPrincipal user)
        {
            return user.FindFirst(ClaimTypes.Email)?.Value;
        }

        /// <summary>
        /// Extract current user roles from JWT token
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <returns>List of user roles</returns>
        public static List<string> GetCurrentUserRoles(ClaimsPrincipal user)
        {
            return user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        }

        /// <summary>
        /// Check if current user has a specific role
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <param name="role">Role to check for</param>
        /// <returns>true if user has the specified role</returns>
        public static bool HasRole(ClaimsPrincipal user, string role)
        {
            return user.IsInRole(role);
        }

        /// <summary>
        /// Check if current user has any of the specified roles
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <param name="roles">List of roles to check for</param>
        /// <returns>true if user has any of the specified roles</returns>
        public static bool HasAnyRole(ClaimsPrincipal user, params string[] roles)
        {
            return roles.Any(role => user.IsInRole(role));
        }

        /// <summary>
        /// Check if current user has all specified roles
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <param name="roles">List of roles to check for</param>
        /// <returns>true if user has all specified roles</returns>
        public static bool HasAllRoles(ClaimsPrincipal user, params string[] roles)
        {
            return roles.All(role => user.IsInRole(role));
        }

        /// <summary>
        /// Extract basic user information from JWT token
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <returns>Basic user information</returns>
        public static CurrentUserInfo? GetCurrentUserInfo(ClaimsPrincipal user)
        {
            var userId = GetCurrentUserId(user);
            if (!userId.HasValue)
            {
                return null;
            }

            return new CurrentUserInfo
            {
                UserId = userId.Value,
                Name = GetCurrentUserName(user),
                Email = GetCurrentUserEmail(user),
                Roles = GetCurrentUserRoles(user)
            };
        }

        /// <summary>
        /// Validate authentication and get user ID
        /// </summary>
        /// <param name="user">ClaimsPrincipal from current context</param>
        /// <param name="requiredRole">Required role (optional)</param>
        /// <returns>User ID if authenticated and has required role</returns>
        /// <exception cref="UnauthorizedAccessException">If not authenticated or doesn't have required role</exception>
        public static int ValidateAndGetUserId(ClaimsPrincipal user, string? requiredRole = null)
        {
            if (!user.Identity?.IsAuthenticated ?? true)
            {
                throw new UnauthorizedAccessException("User is not authenticated");
            }

            var userId = GetCurrentUserIdOrThrow(user);

            if (!string.IsNullOrEmpty(requiredRole) && !HasRole(user, requiredRole))
            {
                throw new UnauthorizedAccessException($"User does not have required role: {requiredRole}");
            }

            return userId;
        }
    }

    /// <summary>
    /// Current user information extracted from JWT token
    /// </summary>
    public class CurrentUserInfo
    {
        public int UserId { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
        public List<string> Roles { get; set; } = new List<string>();
    }
}