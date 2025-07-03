import FilesController from '#controllers/files_controller'
import { HttpRouterService } from '@adonisjs/core/types'

export function fileRoutes(router: HttpRouterService) {
  // Presigned routes (more specific)
router.get('/p/:key/:file', [FilesController, 'getPresigned'])
  
  // Hotlink routes (less specific, but exclude 'p' as key)
  router.get('/:key/:file', [FilesController, 'hotlinkGet']).where('key', /^(?!p$).*/)
}
