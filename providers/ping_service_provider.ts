import type { ApplicationService } from '@adonisjs/core/types'
import PingService from '#services/PingService'

export default class PingServiceProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * The start method is called by the framework when the application is
   * ready to start the HTTP server.
   */
  async start() {
    PingService.boot()
  }
}