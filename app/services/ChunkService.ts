import env from "#start/env"
import { readdir } from "fs/promises"
import { join } from "path"
 

class ChunkService {
  async combineChunks(
    uploadId: string,
    fileName: string,
    totalChunks: number,
    mimeType: string,
    fileSize: number
  ) {
    // 1. Reconstruct the file from chunks
    // 2. Verify file integrity (e.g., hash)
    // 3. Store the file in its final destination
    // 4. Clean up chunks

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
    const chunkDir = join(env.get('SERVER_DIR'), '_chunks_', uploadId)
    let files
    try {
      files = await readdir(chunkDir)
    } catch (error) {
      // Directory doesn't exist or other error, so no chunks are present
      return false
    }

    // Filter out non-chunk files (e.g., .DS_Store) and check count
    const chunkFiles = files.filter((file) => file.endsWith('.chunk'))
    return chunkFiles.length === totalChunks
    
  }

  async getChunkInfoByUploadId(uploadId: string) {
    const chunkDir = join(env.get('SERVER_DIR'), '_chunks_', uploadId)
    let files
    try {
      files = await readdir(chunkDir)
    } catch (error) {
      return []
    }

    const chunkFiles = files.filter((file) => file.endsWith('.chunk'))
    return chunkFiles.map((file) => {
      const index = parseInt(file.replace('.chunk', ''))
      return {
        index,
        path: join(chunkDir, file),
      }
    })
  }

  
}


export default new ChunkService()
