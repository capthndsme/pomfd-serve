import env from '#start/env'
import { readdir, rm, mkdir } from 'fs/promises'
import { createWriteStream, createReadStream } from 'fs'
import { basename, join } from 'path'
import { NamedError } from '../exceptions/NamedError.js'

class ChunkService {
  readonly #storageDir = env.get('SERVER_DIR')

  async combineChunks(
    uploadId: string,
    fileName: string,
    totalChunks: number,
    fileSize: number,
    isPrivate: boolean,
    baseKey: string
  ) {
    const chunkDir = join(this.#storageDir, '_chunks_', uploadId)
    const clientFileName = basename(fileName ?? 'upload.bin')

    // Use the same directory structure as uploadFileBase
    const anonymousOrUserBucket = isPrivate ? 'private' : 'public'
    const finalDir = join(this.#storageDir, anonymousOrUserBucket, baseKey)
    await mkdir(finalDir, { recursive: true })

    const finalFilePath = join(finalDir, clientFileName)

    const chunkFiles = await this.getChunkInfoByUploadId(uploadId)
    if (chunkFiles.length !== totalChunks) {
      throw new NamedError(
        `Expected ${totalChunks} chunks, but found ${chunkFiles.length}`,
        'einval'
      )
    }
    chunkFiles.sort((a, b) => a.index - b.index)

    const writeStream = createWriteStream(finalFilePath)

    try {
      for (const chunkInfo of chunkFiles) {
        await new Promise<void>((resolve, reject) => {
          const readStream = createReadStream(chunkInfo.path)
          readStream.on('error', reject)
          readStream.on('end', resolve)
          readStream.pipe(writeStream, { end: false })
        })
      }

      writeStream.end()

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      })

      const stats = await import('fs/promises').then((fs) => fs.stat(finalFilePath))
      if (stats.size !== fileSize) {
        throw new Error(`File size mismatch: expected ${fileSize}, got ${stats.size}`)
      }

      // Clean up chunks after successful combination
      await rm(chunkDir, { recursive: true, force: true })

      return {
        filePath: finalFilePath,
        fileKey: `${baseKey}/${clientFileName}`,
      }
    } catch (error) {
      // Clean up on error
      writeStream.destroy()
      await rm(finalFilePath, { force: true }).catch(() => {}) // Ignore errors during cleanup
      throw error
    }
  }

  /**
   * Since with multithread enabled, the possibility of
   * the last chunk being the first one to finish is present,
   * we need to verify if all the chunks are present.
   * @param uploadId
   * @param totalChunks
   * @returns
   */
  async isActualEnd(uploadId: string, totalChunks: number): Promise<boolean> {
    const chunkDir = join(this.#storageDir, '_chunks_', uploadId)
    let files

    try {
      files = await readdir(chunkDir)
    } catch (error) {
      // Directory doesn't exist or other error, so no chunks are present
      return false
    }

    // Filter out non-chunk files (e.g., .DS_Store) and check count
    const chunkFiles = files.filter((file) => /^\d+\.chunk$/.test(file))

    if (chunkFiles.length !== totalChunks) {
      return false
    }

    // Verify all expected chunk indices are present
    const presentIndices = new Set(chunkFiles.map((file) => parseInt(file, 10)))
    if (presentIndices.size !== totalChunks) {
      return false
    }

    for (let i = 0; i < totalChunks; i++) {
      if (!presentIndices.has(i)) {
        return false
      }
    }

    return true
  }

  async getChunkInfoByUploadId(uploadId: string) {
    const chunkDir = join(this.#storageDir, '_chunks_', uploadId)
    let files

    try {
      files = await readdir(chunkDir)
    } catch (error) {
      return []
    }

    return files
      .filter((file) => /^\d+\.chunk$/.test(file))
      .map((file) => {
        const index = parseInt(file, 10)
        return {
          index,
          path: join(chunkDir, file),
        }
      })
  }
}

export default new ChunkService()