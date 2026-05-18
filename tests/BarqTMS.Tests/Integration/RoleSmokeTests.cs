using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BarqTMS.API.DTOs;
using FluentAssertions;

namespace BarqTMS.Tests.Integration;

// Automated equivalent of the AUDIT.md "end-to-end manual run per role" gate.
// Boots the API in-process with an InMemory DB, seeds a user per role, and exercises
// the key cross-role endpoints. Each role gets at least one assertion proving the
// audit-driven authz/scoping behavior holds end-to-end.
public sealed class RoleSmokeTests : IAsyncLifetime
{
    private readonly RoleSmokeFactory _factory = new();
    private HttpClient _http = null!;

    public Task InitializeAsync()
    {
        _http = _factory.CreateClient();
        _factory.SeedWorld();
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    private HttpClient AuthedAs(string username)
    {
        var token = _factory.TokenFor(username);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Theory]
    [InlineData("mgr")]
    [InlineData("asst")]
    [InlineData("acct")]
    [InlineData("tlsales")]
    [InlineData("tlmkt")]
    [InlineData("esales")]
    [InlineData("ecre")]
    [InlineData("client1")]
    public async Task EveryRole_CanReachOwnDashboardStats(string username)
    {
        var http = AuthedAs(username);

        var resp = await http.GetAsync("/api/Dashboard/stats");

        resp.StatusCode.Should().Be(HttpStatusCode.OK, $"role {username} should be able to load its own dashboard");
        var body = await resp.Content.ReadFromJsonAsync<DashboardStatsDto>();
        body.Should().NotBeNull();
    }

    [Fact]
    public async Task Manager_SeesGlobalCounts_OtherRolesDoNot()
    {
        var managerStats = await AuthedAs("mgr").GetFromJsonAsync<DashboardStatsDto>("/api/Dashboard/stats");
        var employeeStats = await AuthedAs("esales").GetFromJsonAsync<DashboardStatsDto>("/api/Dashboard/stats");
        var clientStats = await AuthedAs("client1").GetFromJsonAsync<DashboardStatsDto>("/api/Dashboard/stats");

        // Manager sees real user/company counts. Employee + Client see 0 for those (no leak).
        managerStats!.TotalUsers.Should().BeGreaterThan(0);
        managerStats.TotalClients.Should().BeGreaterThan(0);

        employeeStats!.TotalUsers.Should().Be(0);
        employeeStats.TotalClients.Should().Be(0);

        clientStats!.TotalUsers.Should().Be(0);
        clientStats.TotalClients.Should().Be(0);
    }

    [Fact]
    public async Task Employee_CannotCreateUser_Manager_Can()
    {
        var emp = AuthedAs("esales");
        var mgr = AuthedAs("mgr");

        var payload = new
        {
            Name = "New User",
            Username = $"new_{Guid.NewGuid():N}".Substring(0, 12),
            Email = "new@x.com",
            Password = "password123",
            Role = 5, // Employee
            DepartmentIds = new int[] { 1 },
        };

        var empResp = await emp.PostAsJsonAsync("/api/Users", payload);
        empResp.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var mgrResp = await mgr.PostAsJsonAsync("/api/Users", payload);
        mgrResp.IsSuccessStatusCode.Should().BeTrue();
    }

    [Fact]
    public async Task TeamPerformance_ReturnsRowsForBothSalesAndMarketing()
    {
        var http = AuthedAs("mgr");
        var now = DateTime.UtcNow;

        var sales = await http.GetAsync($"/api/Sales/team-performance/Sales/summary?month={now.Month}&year={now.Year}");
        sales.StatusCode.Should().Be(HttpStatusCode.OK);

        var marketing = await http.GetAsync($"/api/Sales/team-performance/Marketing/summary?month={now.Month}&year={now.Year}");
        marketing.StatusCode.Should().Be(HttpStatusCode.OK);

        // Both should return arrays — Marketing returns the marketing TL row with zeroed actuals.
        var marketingJson = await marketing.Content.ReadAsStringAsync();
        marketingJson.Should().Contain("TL Marketing", "Marketing TL should be visible in their own performance summary (HIGH-05)");
    }
}
