import { FileType } from "../../shared/types/FileType.js";

/**
 * A service to extract a simplified FileType using a multi-step process,
 * prioritizing the MIME type and falling back to the filename extension.
 * 
 * Created by Gemini 2.5 Pro
 */
class FileTypeExtractionService {
  // Sets for MIME subtype lookups (from the previous version)
  private readonly documentMimeSubtypes = new Set([
    "pdf", "msword", "vnd.openxmlformats-officedocument.wordprocessingml.document",
    "vnd.ms-excel", "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "vnd.ms-powerpoint", "vnd.openxmlformats-officedocument.presentationml.presentation",
    "rtf", "vnd.oasis.opendocument.text", "vnd.oasis.opendocument.spreadsheet",
    "vnd.oasis.opendocument.presentation",
  ]);

  private readonly plaintextMimeSubtypes = new Set([
    "json", "xml", "javascript", "ecmascript", "css", "csv", "html", "sql",
    "x-sh", "x-csh", "x-python", "x-java-source", "markdown",
  ]);

  /**
   * Public-facing method to detect file type.
   * It prioritizes the MIME type and uses the filename as a fallback.
   *
   * @param options An object containing the mimeType and/or fileName.
   * @returns The detected FileType.
   */
  public detectFileType(options: {
    mimeType?: string | null;
    fileName?: string | null;
  }): FileType {
    const { mimeType, fileName } = options;

    // Step 1: Try to detect the type from the MIME type first.
    if (mimeType) {
      const typeFromMime = this.detectByMime(mimeType);
      // If we get a specific type (anything other than BINARY), we trust it.
      if (typeFromMime !== "BINARY") {
        return typeFromMime;
      }
    }

    // Step 2: If MIME type is missing, generic, or unhandled, fall back to the filename.
    if (fileName) {
      const typeFromFileName = this.detectByFileName(fileName);
      if (typeFromFileName !== "BINARY") {
        return typeFromFileName;
      }
    }
    
    // Step 3: If all else fails, return BINARY.
    return "BINARY";
  }

  /**
   * Detects FileType based on the filename extension.
   * @param fileName The full name of the file (e.g., "report.pdf").
   * @returns The corresponding FileType, or "BINARY" if unknown.
   */
  private detectByFileName(fileName: string): FileType {
    // Get the part after the last dot, and convert to lower case.
    const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();

    if (!extension || extension === fileName) {
      // No extension found
      return "BINARY";
    }
    
    // Using simple `includes` checks for brevity, but a Set could also be used here.
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif'].includes(extension)) {
      return "IMAGE";
    }
    if (['mp4', 'mov', 'avi', 'wmv', 'mkv', 'webm', 'flv'].includes(extension)) {
      return "VIDEO";
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(extension)) {
      return "AUDIO";
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'].includes(extension)) {
      return "DOCUMENT";
    }
    if (['txt', 'md', 'json', 'xml', 'csv', 'html', 'css', 'js', 'ts', 'sh', 'py', 'java', 'sql'].includes(extension)) {
      return "PLAINTEXT";
    }

    return "BINARY";
  }

  /**
   * (Previously detectFileTypeByMime)
   * Detects a simplified file type from a given MIME type string.
   * @param mimeType The MIME type string.
   * @returns The corresponding FileType.
   */
  private detectByMime(mimeType: string): FileType {
    const [type, subtype] = mimeType.toLowerCase().split("/");
    
    switch (type) {
      case "image": return "IMAGE";
      case "video": return "VIDEO";
      case "audio": return "AUDIO";
      case "text": return "PLAINTEXT"; // Covers text/plain, text/markdown, etc.
      case "application":
        if (subtype) {
          if (this.documentMimeSubtypes.has(subtype)) return "DOCUMENT";
          if (this.plaintextMimeSubtypes.has(subtype)) return "PLAINTEXT";
        }
        return "BINARY";
      default:
        return "BINARY";
    }
  }
}

export default new FileTypeExtractionService();