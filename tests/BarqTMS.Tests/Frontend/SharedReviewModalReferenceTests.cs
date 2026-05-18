using FluentAssertions;

namespace BarqTMS.Tests.Frontend;

// HIGH-01 / CRIT-02: every reviewer page must reference the shared review-modal.js
// and must NOT contain a live <div id="reviewModal"> (legacy markup must be templated out).
public sealed class SharedReviewModalReferenceTests
{
    private static readonly string FrontendRoot = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "barq-dashboard", "frontend"));

    public static IEnumerable<object[]> ReviewerPages() => new[]
    {
        new object[] { Path.Combine("pages", "manager", "tasks.html") },
        new object[] { Path.Combine("pages", "assistant-manager", "tasks.html") },
        new object[] { Path.Combine("pages", "team-leader", "team-tasks.html") },
        new object[] { Path.Combine("pages", "team-leader", "my-tasks.html") },
        new object[] { Path.Combine("pages", "account-manager", "tasks.html") },
        new object[] { Path.Combine("pages", "account-manager", "my-tasks.html") },
    };

    [Theory]
    [MemberData(nameof(ReviewerPages))]
    public void ReviewerPage_IncludesSharedReviewModalScript(string relativePath)
    {
        var fullPath = Path.Combine(FrontendRoot, relativePath);
        File.Exists(fullPath).Should().BeTrue($"page {relativePath} should exist");
        var html = File.ReadAllText(fullPath);

        html.Should().Contain("scripts/components/review-modal.js",
            $"page {relativePath} must include the shared review-modal.js");
    }

    [Theory]
    [MemberData(nameof(ReviewerPages))]
    public void ReviewerPage_HasNoLiveLegacyReviewModalDiv(string relativePath)
    {
        var fullPath = Path.Combine(FrontendRoot, relativePath);
        var html = File.ReadAllText(fullPath);

        // The shared component injects a <div id="reviewModal"> at runtime via JS.
        // Static HTML must not contain a live one — legacy markup is moved into a <template>.
        html.Should().NotContain("<div id=\"reviewModal\"",
            $"page {relativePath} still has a live legacy review modal — wrap it in <template> instead");
    }
}
