// app/controllers/files_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

import env from '#start/env'
import fileService from '#services/FileService'
import { join, resolve } from 'node:path'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { hotlinkValidator, presignedValidator } from '#validators/file_access_validator'

import { createFailure } from '../../shared/types/ApiBase.js'
 
import MimeService from '#services/MimeService'
 
export default class FilesController {
  readonly #storageDir = env.get('SERVER_DIR')
  readonly #publicDir = join(this.#storageDir, 'public')
  readonly #privateDir = join(this.#storageDir, 'private')


 

  /**
   * Validates that the resolved path is within the allowed base directory.
   */
  #isPathWithinDirectory(filePath: string, allowedDir: string): boolean {
    const resolvedPath = resolve(filePath)
    const resolvedAllowedDir = resolve(allowedDir)
    return resolvedPath.startsWith(resolvedAllowedDir + '/')
  }

  /**
   * Handles HTTP Range requests to stream a file, enabling video/audio seeking.
   */
  async #streamFile(ctx: HttpContext, filePath: string, fileName: string) {
    const { request, response } = ctx

    try {
      const stats = await stat(filePath)
      const fileSize = stats.size
      const range = request.header('range')

      const mimeType = MimeService.get(filePath)

      response.header('Content-Type', mimeType)
      response.header('Accept-Ranges', 'bytes')
      // Use 'inline' to suggest playback in the browser
      response.header('Content-Disposition', `inline; filename="${fileName}"`)

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunksize = end - start + 1

        if (start >= fileSize || end >= fileSize) {
          response.status(416).header('Content-Range', `bytes */${fileSize}`)
          return response.send('Range Not Satisfiable')
        }

        const stream = createReadStream(filePath, { start, end })
        response.status(206) // Partial Content
        response.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        response.header('Content-Length', chunksize)
        return response.stream(stream)
      } else {
        const stream = createReadStream(filePath)
        response.status(200) // OK
        response.header('Content-Length', fileSize)
        return response.stream(stream)
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return response.notFound(createFailure('File not found', 'not-found'))
      }
      return response.internalServerError(createFailure('Cannot process file', 'error'))
    }
  }

  async hotlinkGet(ctx: HttpContext) {
    const { response, params } = ctx

    // 1. Decode filename *before* validation
    const decodedFile = decodeURIComponent(params.file)

    // 2. Validate using the VineJS validator
    const payload = await hotlinkValidator.validate({ ...params, file: decodedFile })

    const requestedPath = join(this.#publicDir, payload.key, payload.file)

    // 3. Final security boundary check
    if (!this.#isPathWithinDirectory(requestedPath, this.#publicDir)) {
      console.warn(`WARNING: Path resolution led outside public directory. Path: ${requestedPath}`)
      return response.badRequest(createFailure('Invalid file path', 'einval'))
    }

    // 4. Stream the file
    return this.#streamFile(ctx, requestedPath, payload.file)
  }

  async getPresigned(ctx: HttpContext) {
    const { request, response, params } = ctx

    // 1. Decode filename *before* validation
    const decodedFile = decodeURIComponent(params.file)

    // 2. Validate params and query string together
    const payload = await presignedValidator.validate({
      params: { ...params, file: decodedFile },
      ...request.qs(),
    })

    const { key, file } = payload.params
    const { signature, expires } = payload
    const relativeFilePath = `${key}/${file}`

    // 3. Verify the presigned URL signature FIRST
    const isValid = fileService.verifyPresignedUrl(signature, Number(expires), relativeFilePath)
    if (!isValid) {
      return response.unauthorized(createFailure('Invalid or expired presigned URL', 'eunauth'))
    }

    // 4. Construct full path and perform final boundary check
    const fullPath = join(this.#privateDir, relativeFilePath)
    if (!this.#isPathWithinDirectory(fullPath, this.#privateDir)) {
      console.warn(`WARNING: Verified signature for path outside private dir. Path: ${fullPath}`)
      return response.badRequest(createFailure('Invalid file path', 'einval'))
    }

    // 5. Stream the file
    return this.#streamFile(ctx, fullPath, file)
  }
}
