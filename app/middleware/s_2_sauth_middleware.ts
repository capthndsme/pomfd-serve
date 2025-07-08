import { NamedError } from '#exceptions/NamedError'
import MainServerAuthService from '#services/MainServerAuthService'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
/** Server-to-server auth */
export default class S2SauthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
  /**
     * Middleware logic goes here (before the next call)
     */
    console.log(ctx)

    /**
     * Call next method in the pipeline and return its output
     */


    const userId = ctx.request.header('x-server-id')
    const token = ctx.request.header('x-api-key')

    if (!userId || !token) {
      throw new NamedError('Invalid API Key', 'server-key-not-found')
    }
    await MainServerAuthService.authenticateOtherServers(
      userId,
      token.split(" ")[1]
    )

    const output = await next()
    return output
  }
}