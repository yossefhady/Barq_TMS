using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BarqTMS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDepartmentTypeAndDropChangeRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // MED-04: drop the unused UserChangeRequests table.
            migrationBuilder.DropTable(
                name: "UserChangeRequests");

            // HIGH-04: add stable Department.Type with sensible default for unknown rows.
            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Departments",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "Other");

            // Backfill existing departments based on their seeded names so business rules
            // (Sales mandatory note, Marketing TL summary, etc.) light up immediately.
            migrationBuilder.Sql("UPDATE Departments SET Type = 'Sales'         WHERE Name = 'Sales';");
            migrationBuilder.Sql("UPDATE Departments SET Type = 'Marketing'     WHERE Name = 'Marketing';");
            migrationBuilder.Sql("UPDATE Departments SET Type = 'Creative'      WHERE Name = 'Creative';");
            migrationBuilder.Sql("UPDATE Departments SET Type = 'Management'    WHERE Name = 'Management';");
            migrationBuilder.Sql("UPDATE Departments SET Type = 'Accounts'      WHERE Name = 'Accounts';");
            migrationBuilder.Sql("UPDATE Departments SET Type = 'GraphicDesign' WHERE Name = 'Graphic Design';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Type",
                table: "Departments");

            migrationBuilder.CreateTable(
                name: "UserChangeRequests",
                columns: table => new
                {
                    RequestId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReviewedBy = table.Column<int>(type: "int", nullable: true),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    NewData = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewPasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RequestType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserChangeRequests", x => x.RequestId);
                    table.ForeignKey(
                        name: "FK_UserChangeRequests_Users_ReviewedBy",
                        column: x => x.ReviewedBy,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserChangeRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserChangeRequests_ReviewedBy",
                table: "UserChangeRequests",
                column: "ReviewedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserChangeRequests_UserId",
                table: "UserChangeRequests",
                column: "UserId");
        }
    }
}
