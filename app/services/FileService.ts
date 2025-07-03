import env from '#start/env'
import crypto from 'node:crypto'

class FileService {
  readonly #secret = env.get('APP_KEY')
  // Use an environment variable for the base URL
  readonly #baseUrl = env.get('APP_URL', 'http://localhost:3333')

  /**
   * Generates a presigned URL for a given file path for private files.
   * @param filePath The path to the file relative to the 'private' directory (e.g., 'user-uploads/document.pdf').
   * @param expiresIn Seconds until the URL expires.
   * @returns The full, shareable presigned URL.
   */
  generatePresignedUrl(filePath: string, expiresIn: number): string {
    const expires = Date.now() + expiresIn * 1000 // expires timestamp in milliseconds
    const signature = this.#createSignature(filePath, expires)

    // Construct the URL safely. The base URL should not have a trailing slash.
    return `${this.#baseUrl}/p/${filePath}?signature=${signature}&expires=${expires}`
  }

  /**
   * Verifies a presigned URL.
   * @param signature The signature from the URL query string.
   * @param expires The expiration timestamp from the URL query string.
   * @param filePath The file path from the URL path.
   * @returns True if the signature is valid and the link has not expired, false otherwise.
   */
  verifyPresignedUrl(signature: string, expires: number, filePath: string): boolean {
    if (Date.now() > expires) {
      return false // URL has expired
    }

    // Recreate the signature with the same data and secret to verify.
    const expectedSignature = this.#createSignature(filePath, expires)

    // Use crypto.timingSafeEqual to prevent timing attacks.
    try {
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))
    } catch {
        // This can happen if the buffers are of different lengths, which means they're not equal.
        return false
    }
  }

  /**
   * Creates an HMAC signature for the file path and expiration.
   */
  #createSignature(filePath: string, expires: number): string {
    const data = `${filePath}|${expires}` // Use a separator that's not allowed in file paths
    return crypto.createHmac('sha256', this.#secret).update(data).digest('hex')
  }
}

export default new FileService()