import { HttpRouterService } from '@adonisjs/core/types'
const FilesController = () => import('#controllers/files_controller')

function fileRoutes(router: HttpRouterService) {
  router.get(':key/:file', [FilesController, 'hotlinkGet'])
}

export { fileRoutes }
