import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { createFailure } from '../../shared/types/ApiBase.js';
import { NamedError } from './NamedError.js';
 
export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: any, ctx: HttpContext) {
    super.handle(error, ctx);

    const { response } = ctx;

    response.status(error?.status ?? 500);
    console.log(error)
    if (error instanceof NamedError) {
      return response.status(500).send(
        createFailure(
          error.message,
          error.name
        )
      )
    } else {
      return response.status(500).send(createFailure(
        error?.message ?? "Unknown Failure",
        'error'
      ))
    }
     


  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
