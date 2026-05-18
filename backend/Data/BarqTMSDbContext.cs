using BarqTMS.API.Models;
using BarqTMS.API.Models.Enums;
using BarqTMS.API.Models.Sales;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.API.Data
{
    public class BarqTMSDbContext : DbContext
    {
        public BarqTMSDbContext(DbContextOptions<BarqTMSDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Company> Companies { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<ProjectTeamLeader> ProjectTeamLeaders { get; set; }
        public DbSet<ProjectDepartment> ProjectDepartments { get; set; }
        public DbSet<WorkTask> Tasks { get; set; }
        public DbSet<TaskAssignee> TaskAssignees { get; set; }
        public DbSet<TaskComment> TaskComments { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<Attachment> Attachments { get; set; }
        public DbSet<TimeLog> TimeLogs { get; set; }
        public DbSet<CalendarEvent> CalendarEvents { get; set; }
        public DbSet<EventAttendee> EventAttendees { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        // MED-04: UserChangeRequest model removed as dead code. Table remains in legacy DB
        // until a `DropUserChangeRequests` migration is applied.
        
        // Sales Module - Final Spec
        public DbSet<SalesTarget> SalesTargets { get; set; }
        public DbSet<WeeklyWarRoom> WeeklyWarRooms { get; set; }
        public DbSet<MarketSegment> MarketSegments { get; set; }

        // REMOVED Old Sales/Market Tables to avoid confusion
        // public DbSet<WeeklyStrategy> WeeklyStrategies { get; set; }
        // public DbSet<MarketZone> MarketZones { get; set; }
        // public DbSet<SalesMonthlyTarget> SalesMonthlyTargets { get; set; }
        // public DbSet<SalesWeeklyStrategy> SalesWeeklyStrategies { get; set; }
        // public DbSet<MarketTerritory> MarketTerritories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // --- Enums as Strings ---
            modelBuilder.Entity<User>().Property(u => u.Role).HasConversion<string>();
            modelBuilder.Entity<Project>().Property(p => p.Status).HasConversion<string>();
            modelBuilder.Entity<WorkTask>().Property(t => t.Status).HasConversion<string>();
            modelBuilder.Entity<WorkTask>().Property(t => t.Priority).HasConversion<string>();
            modelBuilder.Entity<Attachment>().Property(a => a.RelatedEntityType).HasConversion<string>();
            modelBuilder.Entity<Notification>().Property(n => n.Type).HasConversion<string>();
            modelBuilder.Entity<Notification>().Property(n => n.RelatedEntityType).HasConversion<string>();
            modelBuilder.Entity<CalendarEvent>().Property(e => e.EventType).HasConversion<string>();
            // HIGH-04: Department type stored as string for readability.
            modelBuilder.Entity<Department>().Property(d => d.Type).HasConversion<string>();

            // Unique Constraint for MarketSegment
             modelBuilder.Entity<MarketSegment>()
                .HasIndex(m => new { m.Place, m.Category })
                .IsUnique();

            // --- Composite Keys (Junction Tables) ---
            modelBuilder.Entity<ProjectTeamLeader>().HasKey(pt => new { pt.ProjectId, pt.UserId });
            modelBuilder.Entity<ProjectDepartment>().HasKey(pd => new { pd.ProjectId, pd.DeptId });
            modelBuilder.Entity<TaskAssignee>().HasKey(ta => new { ta.TaskId, ta.UserId });
            modelBuilder.Entity<EventAttendee>().HasKey(ea => new { ea.EventId, ea.UserId });

            // --- Relationships & Delete Behaviors ---

            // User -> Supervisor (Self-Referencing)
            modelBuilder.Entity<User>()
                .HasOne(u => u.Supervisor)
                .WithMany(u => u.Subordinates)
                .HasForeignKey(u => u.SupervisorId)
                .OnDelete(DeleteBehavior.Restrict);

            // Company -> Owner / AccountManager
            modelBuilder.Entity<Company>()
                .HasOne(c => c.Owner)
                .WithMany(u => u.OwnedCompanies)
                .HasForeignKey(c => c.OwnerUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Company>()
                .HasOne(c => c.AccountManager)
                .WithMany(u => u.ManagedCompanies)
                .HasForeignKey(c => c.AccountManagerId)
                .OnDelete(DeleteBehavior.Restrict);

            // Project -> Company
            modelBuilder.Entity<Project>()
                .HasOne(p => p.Company)
                .WithMany(c => c.Projects)
                .HasForeignKey(p => p.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);

            // Task -> Project / Department
            modelBuilder.Entity<WorkTask>()
                .HasOne(t => t.Project)
                .WithMany(p => p.Tasks)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<WorkTask>()
                .HasOne(t => t.Department)
                .WithMany(d => d.Tasks)
                .HasForeignKey(t => t.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);

            // Task -> Users (Creator, Delegator, OriginalAssigner)
            modelBuilder.Entity<WorkTask>()
                .HasOne(t => t.Delegator)
                .WithMany()
                .HasForeignKey(t => t.DelegatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<WorkTask>()
                .HasOne(t => t.OriginalAssigner)
                .WithMany()
                .HasForeignKey(t => t.OriginalAssignerId)
                .OnDelete(DeleteBehavior.Restrict);

            // Task -> Sales Market Segment
            modelBuilder.Entity<WorkTask>()
                .HasOne(t => t.MarketSegment)
                .WithMany()
                .HasForeignKey(t => t.SalesMarketSegmentId)
                .OnDelete(DeleteBehavior.SetNull);

            // Task Comments
            modelBuilder.Entity<TaskComment>()
                .HasOne(c => c.Task)
                .WithMany(t => t.Comments)
                .HasForeignKey(c => c.TaskId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TaskComment>()
                .HasOne(c => c.Author)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // TimeLogs
            modelBuilder.Entity<TimeLog>()
                .HasOne(tl => tl.Task)
                .WithMany(t => t.TimeLogs)
                .HasForeignKey(tl => tl.TaskId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TimeLog>()
                .HasOne(tl => tl.User)
                .WithMany()
                .HasForeignKey(tl => tl.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Notifications
            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Calendar Events
            modelBuilder.Entity<CalendarEvent>()
                .HasOne(e => e.Creator)
                .WithMany()
                .HasForeignKey(e => e.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // MED-04: UserChangeRequest relationships removed (model deleted as dead code).
        }
    }
}
