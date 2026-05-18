namespace BarqTMS.API.Models.Enums
{
    public enum SalesActivityType
    {
        None = 0,
        Meeting = 1,
        ColdCall = 2,
        DataCollection = 3,
        Closing = 4
    }

    public enum SalesOutcome
    {
        Pending = 0,
        Success = 1,
        Failed = 2,
        NeedsFollowUp = 3
    }
}
