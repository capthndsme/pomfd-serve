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
    const start = performance.now()
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
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', (err) => {
          // Ensure cleanup happens before rejecting
          writeStream.destroy()
          rm(finalFilePath, { force: true }).catch(() => {}) // Ignore cleanup errors
          reject(err)
        })

        const pipeNextChunk = (index: number) => {
          if (index >= chunkFiles.length) {
            writeStream.end()
            return
          }

          const chunkPath = chunkFiles[index].path
          const readStream = createReadStream(chunkPath)

          readStream.on('error', (err) => {
            readStream.destroy()
            writeStream.emit('error', err) // Propagate error to the write stream
          })

          readStream.on('end', () => {
            pipeNextChunk(index + 1)
          })

          readStream.pipe(writeStream, { end: false })
        }

        pipeNextChunk(0)
      })

      const stats = await import('fs/promises').then((fs) => fs.stat(finalFilePath))
      if (stats.size !== fileSize) {
        throw new Error(`File size mismatch: expected ${fileSize}, got ${stats.size}`)
      }

      // Clean up chunks after successful combination
      await rm(chunkDir, { recursive: true, force: true })
      console.log(`Chunk recombine took ${(performance.now() - start).toFixed(2)}ms`)
      return {
        filePath: finalFilePath,
        fileKey: `${baseKey}/${clientFileName}`,
      }
    } catch (error) {
      // The promise-based piping now handles its own cleanup on error.
      // We just need to re-throw the error.
      // The initial writeStream.destroy() and rm() in the old catch block are now inside the promise reject handler.
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

    // Verify all expected chunk indices are present.
    // This relies on the caller (e.g., UploadService) to validate that chunkIndex
    // is within the range [0, totalChunks - 1].
    const presentIndices = new Set(chunkFiles.map((file) => parseInt(file, 10)))
    return presentIndices.size === totalChunks
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