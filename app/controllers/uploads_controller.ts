import type { HttpContext } from '@adonisjs/core/http'
import { createFailure, createSuccess } from '../../shared/types/ApiBase.js'
import UploadService from '#services/UploadService'
import env from '#start/env'
import UUIDService from '#services/UUIDService'
import FileItem from '#models/file_item'
import { chunkedMetaValidator } from '#validators/chunked_meta_validator'
import { chunkedFinishValidator } from '#validators/chunked_finish_validator'
import { ChunkedMeta } from '../../shared/types/request/ChunkedMeta.js'

export default class UploadsController {
  async uploadFileAnonymous({ request, response }: HttpContext) {
    const file = request.files('file')

    let validate: ChunkedMeta | null = null
    // validate from qs
    try {
      validate = await request.validateUsing(chunkedMetaValidator)

      if (validate) {
        // also validate that we should have exactly
        // ONE file.
        if (file.length !== 1) {
          return response.badRequest(
            createFailure(
              'Chunked uploads must send one file at a time. You sent nothing or more than one file.',
              'einval'
            )
          )
        }
      }
    } catch (e) {
      console.log(`Request is not a chunked upload or a malformed one.`)
    }

    if (!file || file.length === 0) {
      return response.badRequest(createFailure('No file provided', 'no-file'))
    }

    const uploadedFile = await UploadService.uploadMultiFile(file, null, false, null, validate)
    // detect if we are CURL
    if (request.header('User-Agent')?.includes('curl') && typeof uploadedFile !== 'string') {
      return response.ok(
        `Success uploading.` +
          uploadedFile.map((file, idx) => this.generateCurlText(file, idx)).join('')
      )
    }
    if (uploadedFile === 'chunk-finish') return createSuccess(null, 'chunk-finish', 'chunk-finish')

    return response.ok(createSuccess(uploadedFile, 'Success uploading', 'success'))
  }
  generateCurlText(file: FileItem, idx: number) {
    return `
=================
File #${idx} (${file.originalFileName})
Direct Link: https://${file.serverShard?.domain}/${file.fileKey}
UI address: ${env.get('COORDINATOR_UI')}/s/${UUIDService.encode(file.id)}

`
  }

  async uploadFileUserBound({ request, response }: HttpContext) {
    // X-User-Id: main server user id
    // Authorization: Bearer for the token
    // This is protected by the middleware

    const file = request.files('file')
    const userId = request.header('X-User-Id')
    const { parentDirectoryId, isPrivate } = request.qs()
    let validate: ChunkedMeta | null = null
    // validate from qs
    try {
      validate = await request.validateUsing(chunkedMetaValidator)

      if (validate) {
        // also validate that we should have exactly
        // ONE file.
        if (file.length !== 1) {
          return response.badRequest(
            createFailure(
              'Chunked uploads must send one file at a time. You sent nothing or more than one file.',
              'einval'
            )
          )
        }
      }
    } catch (e) {
      console.log(`Request is not a chunked upload or a malformed one.`)
    }

    if (!file || file.length === 0) {
      return response.badRequest(createFailure('No file provided', 'no-file'))
    }

    console.log(`received file for user ${userId}: ${file.length} files`)

    const uploadedFiles = await UploadService.uploadMultiFile(
      file,
      userId,
      isPrivate,
      parentDirectoryId,
      validate
    )

    if (uploadedFiles === 'chunk-finish') return createSuccess(null, 'chunk-finish', 'chunk-finish')

    return response.ok(createSuccess(uploadedFiles, 'Success uploading', 'success'))
  }

  async finishChunkedUpload({ request, response }: HttpContext) {
    const userId = request.header('X-User-Id')
    const { parentDirectoryId, isPrivate } = request.qs()

    const { uploadId, totalChunks, fileName, fileSize, mimeType } =
      await request.validateUsing(chunkedFinishValidator)

    const file = await UploadService.finishChunkedUpload({
      uploadId,
      totalChunks,
      fileName,
      fileSize,
      mimeType,
      belongsToUser: userId ?? null,
      isPrivate,
      parentDirectoryId,
    })

    return response.ok(createSuccess(file, 'File assembled successfully', 'success'))
  }

  async finishChunkedUploadAnonymous({ request, response }: HttpContext) {
    const { uploadId, totalChunks, fileName, fileSize, mimeType } =
      await request.validateUsing(chunkedFinishValidator)

    const file = await UploadService.finishChunkedUpload({
      uploadId,
      totalChunks,
      fileName,
      fileSize,
      mimeType,
      belongsToUser: null,
      isPrivate: false,
      parentDirectoryId: null,
    })

    return response.ok(createSuccess(file, 'File assembled successfully', 'success'))
  }
}
