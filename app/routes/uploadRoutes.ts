import { HttpRouterService } from '@adonisjs/core/types'

const UploadsController = () => import('#controllers/uploads_controller')

function uploadRoutes(router: HttpRouterService) {
  // Anonymous upload
  router.post('/anon-upload', [UploadsController, 'uploadFileAnonymous'])


}

export { uploadRoutes }
