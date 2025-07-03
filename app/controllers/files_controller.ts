import type { HttpContext } from '@adonisjs/core/http'
import { createFailure } from '../../shared/types/ApiBase.js'
import env from '#start/env'

export default class FilesController {
  readonly #storageDir = env.get('SERVER_DIR')
  async hotlinkGet({ params, response }: HttpContext) {
    const {key, file } = params
    if (!key || !file) return response.badRequest(
      createFailure('Invalid parameters', 'einval')
    )
    if (key === "public" || key === "private") {
      // Trying to traverse the public/private buckets.
      console.warn(`WARNING: The client is trying to access the public/private buckets directly. This is not allowed.`) 
      return null;
    }
    // serve directly from filesystem
    const filePath = `${this.#storageDir}/public/${key}/${file}`
    return response.download(filePath)
  }


  
}