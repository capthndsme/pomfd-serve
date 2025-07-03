
import type { NextFn } from '@adonisjs/core/types/http'
 

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
 
  async handle(
    next: NextFn,
 
  ) {
 
    return next()
  }
}