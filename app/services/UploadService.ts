import type FileItem from '#models/file_item'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import MainServerAxiosService from './MainServerAxiosService.js'
import FileTypeExtractionService from './FileTypeExtractionService.js'
import { NamedError } from '#exceptions/NamedError'
import env from '#start/env'

import { nanoid } from 'nanoid'
import { basename, join } from 'path'
import { mkdir, rm } from 'fs/promises'
import { ApiBase } from '../../shared/types/ApiBase.js'
import { ChunkedMeta } from '../../shared/types/request/ChunkedMeta.js'
import ChunkService from './ChunkService.js'
class UploadService {
  readonly #storageDir = env.get('SERVER_DIR')
  async uploadFinish(file: FileItem) {
    const res = await MainServerAxiosService.post(`/coordinator/v1/ack`, file)
    if (res.status === 200) {
      return true
    }
    return false
  }

  async uploadFileBase(
    file: MultipartFile,
    belongsToUser: string | null = null,
    isPrivate: boolean = false,
    parentDirectoryId: string | null = null
  ) {
    const clientFileName = basename(file.clientName ?? 'upload.bin')
    const anonymousOrUserBucket = isPrivate ? "private" : "public"
    // random 36 char hex + time representation
    const baseKey = nanoid(18)
    const targetDir = join(this.#storageDir, anonymousOrUserBucket, baseKey)

    await mkdir(targetDir, { recursive: true })

    await file.move(targetDir, {
      name: clientFileName,
      overwrite: true,
    })
    console.log(`made file in ${targetDir}/${clientFileName}`)

    // 2. create File object
    const object: Partial<FileItem> = {
      originalFileName: file.clientName,
      name: file.clientName, // I dont think clients have custom names.
      ownerId: belongsToUser ?? undefined,
      isPrivate: isPrivate ?? false,
      isFolder: false, // Cannot upload literal folders
      parentFolder: parentDirectoryId,
      mimeType: file.headers['content-type'],
      fileSize: file.size,
      fileKey: `${baseKey}/${clientFileName}`,
      fileType: FileTypeExtractionService.detectFileType({
        mimeType: file.headers['content-type'],
        fileName: file.clientName,
      }),
    }

    // 3. push to the server
    try {
      return await MainServerAxiosService.post<ApiBase<FileItem>>('/coordinator/v1/ack', object)
    } catch (e) {
      // delete the file
      await rm(
        `${targetDir}/${clientFileName}`
      )
      console.error("Coordinator Down! Deleted file (retry mechanism soon!)")
      throw new NamedError('Coordinator Down!', 'error')
    }
  }


  async chunkedUploadBase(
    // We cant rely on the MultipartFile info now, so we shall send 
    // it on the Frontend
    chunk: MultipartFile,
    meta: ChunkedMeta,
    belongsToUser: string | null = null,
    isPrivate: boolean = false,
    parentDirectoryId: string | null = null
  ) {
    const { uploadId, chunkIndex, totalChunks, fileName, fileSize, mimeType } = meta;

    // uploadId should only ever be alphanumeric
    if (!/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
      throw new NamedError('Invalid uploadId', 'einval');
    }

    if (chunkIndex < 0 || chunkIndex >= totalChunks) {
      throw new NamedError('Invalid chunk index', 'einval');
    }
    if (fileSize <= 0) {
      throw new NamedError('Invalid file size', 'einval');
    }


    /** validations for chunk */
    if (!chunk) {
      throw new NamedError('No chunk provided', 'no-file');
    }
    if (chunk.size !== meta.chunkSize) {
      throw new NamedError('Chunk size mismatch', 'einval');
    }
    // async hashing (todo)

    const clientFileName = basename(fileName ?? 'upload.bin')
    const bucketBase = "_chunks_"

    const targetDir = join(this.#storageDir, bucketBase, uploadId)

    await mkdir(targetDir, { recursive: true })

    // write clientfilename 
    await chunk.move(targetDir, {
      name: `${chunkIndex}.chunk`,
      overwrite: true,
    })
    console.log(`wrote chunk ${chunkIndex} for uploadId ${uploadId} in ${targetDir}`)

    // check if we are finished

   
    const isActualFinish = await ChunkService.isActualEnd(uploadId, totalChunks)
    if (isActualFinish) {
      
    } else {
      return "ok"
    }
  }

 
  async uploadFile(
    file: MultipartFile,
    belongsToUser: string | null = null,
    isPrivate: boolean = false,
    parentDirectoryId: string | null = null
  ) {
    const res = await this.uploadFileBase(file, belongsToUser, isPrivate, parentDirectoryId)
    if (res.status === 200 && 'data' in res.data) {
      return res.data.data
    } else {
      throw new NamedError('Coordinator Down!', 'error')
    }
  }

  async uploadMultiFile(
    files: MultipartFile[],
    belongsToUser: string | null = null,
    isPrivate: boolean = false,
    parentDirectoryId: string | null = null
  ) {
    const uploadedFiles: FileItem[] = []
    for (const file of files) {
      const uploadedFile = await this.uploadFile(file, belongsToUser, isPrivate, parentDirectoryId)
      uploadedFiles.push(uploadedFile)
    }
    return uploadedFiles

  }
}

export default new UploadService()
