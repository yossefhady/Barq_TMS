using BarqTMS.API.Data;
using Microsoft.EntityFrameworkCore;

namespace BarqTMS.Tests.Helpers;

internal static class TestDbContextFactory
{
    public static BarqTMSDbContext Create()
    {
        var options = new DbContextOptionsBuilder<BarqTMSDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .EnableSensitiveDataLogging()
            .Options;

        return new BarqTMSDbContext(options);
    }
}
