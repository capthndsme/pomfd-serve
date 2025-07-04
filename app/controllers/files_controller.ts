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

  /**
   * Validates that a filename component contains only safe characters.
   * Allows common filename characters while preventing directory traversal.
   * Updated to handle real-world filenames with spaces, parentheses, etc.
   */
  private isFilenameSafe(component: string): boolean {
    if (!component || typeof component !== 'string') {
      return false
    }
    
    // Decode URL-encoded characters first
    let decodedComponent: string
    try {
      decodedComponent = decodeURIComponent(component)
    } catch (e) {
      // If decoding fails, use original component
      decodedComponent = component
    }
    
    // Disallow directory traversal attempts
    if (decodedComponent.includes('/') || decodedComponent.includes('\\')) {
      return false
    }
    
    // Disallow relative path components
    if (decodedComponent === '.' || decodedComponent === '..') {
      return false
    }
    
    // Disallow null bytes and other control characters
    // Sonarlint, i wish there is a @sl-ignore like typescript here... its a valid use case? 
    if (decodedComponent.includes('\0') || /[\x00-\x1f\x7f]/.test(decodedComponent)) {
      return false
    }
    
    // Allow common filename characters:
    // - Letters, numbers, spaces
    // - Common punctuation: . - _ ( ) [ ] { } 
    // - Other safe chars: ~ ! @ # $ % ^ & + = , ;
    // But still prevent problematic chars like: / \ : * ? " < > |
    const allowedChars = /^[a-zA-Z0-9\s._\-()[\]{}~!@#$%^&+=,;]+$/
    
    if (!allowedChars.test(decodedComponent)) {
      return false
    }
    
    // Prevent filenames starting with a dot (hidden files)
    if (decodedComponent.startsWith('.')) {
      return false
    }
    
    // Prevent extremely long filenames (filesystem limits)
    if (decodedComponent.length > 255) {
      return false
    }
    
    return true
  }

  async hotlinkGet({ params, response }: HttpContext) {
    const { key, file } = params

    // 1. Validate input format using the correct validators
    if (!this.isPathComponentSafe(key) || !this.isFilenameSafe(file)) {
      console.warn(
        `WARNING: Invalid characters in hotlink path components. Key: ${key}, File: ${file}`
      )
      return response.badRequest(createFailure('Invalid file path', 'einval'))
    }

    // Decode the filename for filesystem operations
    let decodedFile: string
    try {
      decodedFile = decodeURIComponent(file)
    } catch (e) {
      decodedFile = file
    }

    const requestedPath = join(this.#publicDir, key, decodedFile)

    // 2. Final check to ensure the path is within the intended directory
    if (!this.isPathWithinDirectory(requestedPath, this.#publicDir)) {
      console.warn(`WARNING: Path resolution led outside public directory. Path: ${requestedPath}`)
      return response.badRequest(createFailure('Invalid file path', 'einval'))
    }

    // 3. Check if file exists before attempting to serve
    if (!existsSync(requestedPath)) {
      return response.notFound(createFailure('File not found', 'not-found'))
    }

    return response.download(requestedPath)
  }

  async getPresigned({ params, response, request }: HttpContext) {
    const { key, file } = params
    const { signature, expires } = request.qs()

    // 1. Validate input parameters exist and have safe characters.
    if (
      !signature ||
      !expires ||
      !this.isPathComponentSafe(key) ||
      !this.isFilenameSafe(file)
    ) {
      return response.badRequest(createFailure('Invalid parameters', 'einval'))
    }
    
    const expiresNumber = Number(expires)
    if (isNaN(expiresNumber)) {
      return response.badRequest(createFailure('Invalid expiration timestamp', 'einval'))
    }

    // Decode the filename for filesystem operations
    let decodedFile: string
    try {
      decodedFile = decodeURIComponent(file)
    } catch (e) {
      decodedFile = file
    }

    const relativeFilePath = `${key}/${decodedFile}`

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