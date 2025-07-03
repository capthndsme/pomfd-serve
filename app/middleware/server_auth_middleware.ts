import { NamedError } from '#exceptions/NamedError'
import ServerAuthService from '#services/ServerAuthService'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class ServerAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Middleware logic goes here (before the next call)
     */
    console.log(ctx)

    /**
     * Call next method in the pipeline and return its output
     */

    const serverId = ctx.request.header('x-server-id')
    const apiKey = ctx.request.header('x-api-key')

    if (!serverId || !apiKey) {
      throw new NamedError('Invalid API Key', 'server-key-not-found')
    }
    await ServerAuthService.authenticate(parseInt(serverId), apiKey)
    const output = await next()
    return output


  }
}