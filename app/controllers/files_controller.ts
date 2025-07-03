import type { HttpContext } from '@adonisjs/core/http'
import { createFailure } from '../../shared/types/ApiBase.js'
import env from '#start/env'
import fileService from '#services/FileService'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

export default class FilesController {
  readonly #storageDir = env.get('SERVER_DIR')
  readonly #publicDir = join(this.#storageDir, 'public')
  readonly #privateDir = join(this.#storageDir, 'private')

  /**
   * Validates that a path component contains only safe characters.
   * Rejects path traversal characters and other potentially dangerous inputs.
   * This is a validation-only approach; we don't try to sanitize/mutate the input.
   */
  private isPathComponentSafe(component: string): boolean {
    if (!component || typeof component !== 'string') {
      return false
    }
    // Only allow alphanumeric characters, hyphens, and underscores.
    // This inherently prevents '.', '/', and '\'
    return /^[a-zA-Z0-9_-]+$/.test(component)
  }

  /**
   * Validates that the resolved path is within the allowed base directory.
   * This is the most critical security check to prevent directory traversal.
   */
  private isPathWithinDirectory(filePath: string, allowedDir: string): boolean {
    const resolvedPath = resolve(filePath)
    const resolvedAllowedDir = resolve(allowedDir)
    // Check if the resolved path starts with the allowed directory path.
    // Adding a path separator ensures a partial match like /base/dir-something won't pass for /base/dir.
    return resolvedPath.startsWith(resolvedAllowedDir + '/')
  }

  async hotlinkGet({ params, response }: HttpContext) {
    const { key, file } = params

    // 1. Validate input format
    if (!this.isPathComponentSafe(key) || !this.isPathComponentSafe(file)) {
      console.warn(
        `WARNING: Invalid characters in hotlink path components. Key: ${key}, File: ${file}`
      )
      return response.badRequest(createFailure('Invalid file path', 'einval'))
    }

    const requestedPath = join(this.#publicDir, key, file)

    // 2. Final check to ensure the path is within the intended directory
    if (!this.isPathWithinDirectory(requestedPath, this.#publicDir)) {
      console.warn(`WARNING: Path resolution led outside public directory. Path: ${requestedPath}`)
      return response.badRequest(createFailure('Invalid file path', 'einval'))
    }

    // AdonisJS's response.download will handle the file existence check and send a 404 if not found.
    try {
      response.download(requestedPath)
    } catch (e) {
      response.notFound(createFailure('File not found', 'not-found'))
    }
  }

  async getPresigned({ params, response, request }: HttpContext) {
    const { key, file } = params
    const { signature, expires } = request.qs()

    // 1. Validate input parameters exist and have safe characters.
    if (
      !signature ||
      !expires ||
      !this.isPathComponentSafe(key) ||
      !this.isPathComponentSafe(file)
    ) {
      return response.badRequest(createFailure('Invalid parameters', 'einval'))
    }

    const expiresNumber = Number(expires)
    if (isNaN(expiresNumber)) {
      return response.badRequest(createFailure('Invalid expiration timestamp', 'einval'))
    }

    const relativeFilePath = `${key}/${file}`

    // 2. Verify the presigned URL signature FIRST.
    const isValid = fileService.verifyPresignedUrl(signature, expiresNumber, relativeFilePath)

    if (!isValid) {
      return response.unauthorized(createFailure('Invalid or expired presigned URL', 'eunauth'))
    }

    // 3. Construct the full path and perform the final boundary check.
    const fullPath = join(this.#privateDir, relativeFilePath)

    if (!this.isPathWithinDirectory(fullPath, this.#privateDir)) {
      console.warn(
        `WARNING: Verified signature for a path that resolves outside the private directory. Path: ${fullPath}`
      )
      return response.badRequest(createFailure('Invalid file path', 'einval'))
    }

    // 4. Check for file existence before attempting to serve.
    if (!existsSync(fullPath)) {
      return response.notFound(createFailure('File not found', 'not-found'))
    }

    return response.download(fullPath)
  }
}
