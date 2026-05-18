using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using BarqTMS.API.Models.Enums;

namespace BarqTMS.API.Models
{
    public class Attachment
    {
        [Key]
        public int AttachmentId { get; set; }

        [Required]
        [StringLength(255)]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public string FilePath { get; set; } = string.Empty;

        [StringLength(50)]
        public string? FileType { get; set; }

        public long FileSize { get; set; }

        public int UploadedBy { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public RelatedEntityType RelatedEntityType { get; set; }

        public int RelatedEntityId { get; set; }

        // Navigation Properties
        [ForeignKey("UploadedBy")]
        public virtual User Uploader { get; set; } = null!;
        
        // Note: Polymorphic relationships are tricky in EF Core. 
        // We usually don't have a direct navigation property for the "RelatedEntity" 
        // unless we use TPH or TPT inheritance, or just manual queries.
        // For now, we keep the ID and Type.
    }
}
