import { NamedError } from '#exceptions/NamedError'
import MainServerAuthService from '#services/MainServerAuthService'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class MainServerAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Middleware logic goes here (before the next call)
     */
    console.log(ctx)

    /**
     * Call next method in the pipeline and return its output
     */


    const userId = ctx.request.header('X-User-Id')
    const token = ctx.request.header('Authorization')

    if (!userId || !token) {
      throw new NamedError('Invalid API Key', 'server-key-not-found')
    }
    await MainServerAuthService.authenticateUserToken(
      userId,
      token.split(" ")[1]
    )

    const output = await next()
    return output
  }
}