namespace BarqTMS.API.Models.Enums
{
    public enum UserRole
    {
        Manager = 1,
        AssistantManager = 2,
        AccountManager = 3,
        TeamLeader = 4,
        Employee = 5,
        Client = 6
    }

    public enum ProjectStatus
    {
        Planned,
        Active,
        Completed,
        OnHold
    }

    public enum TaskStatus
    {
        Pending,
        InProgress,
        InReview,
        Completed,
        Closed // For "Closed/Not Interested" in Sales
    }

    public enum TaskPriority
    {
        Low,
        Medium,
        High,
        Critical
    }

    public enum RelatedEntityType
    {
        Task,
        Project,
        Company
    }

    public enum NotificationType
    {
        TaskAssigned,
        NewClient,
        DeadlineApproaching,
        TaskCompleted,
        TaskRejected,
        General
    }

    // MED-04: ChangeRequestType / ChangeRequestStatus removed with UserChangeRequest model.

    public enum EventType
    {
        Meeting = 1,
        Deadline = 2,
        Task = 3,
        Reminder = 4
    }

    // HIGH-04: Stable identity for departments. Department.Name remains editable as a label;
    // department-specific business rules key off this enum so renaming the label does not
    // silently disable validation.
    public enum DepartmentType
    {
        Other = 0,
        Management = 1,
        Accounts = 2,
        Sales = 3,
        Creative = 4,
        Marketing = 5,
        GraphicDesign = 6
    }
}
