import multer from "multer";
import cloudinary from "../config/cloudinary";

// Multer config — store files in memory (buffer), then upload to Cloudinary
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "video/mp4",
      "audio/mpeg",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure URL, public ID, and detected resource type.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string = "synq-uploads"
): Promise<{ url: string; publicId: string; fileType: string }> {
  return new Promise((resolve, reject) => {
    const resourceType = "auto"; // let Cloudinary detect image/video/raw
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed"));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          fileType: result.resource_type,
        });
      }
    );
    stream.end(buffer);
  });
}
