import { middleware } from '#start/kernel'
import { HttpRouterService } from '@adonisjs/core/types'

const UploadsController = () => import('#controllers/uploads_controller')

function uploadRoutes(router: HttpRouterService) {
  // Anonymous upload
  router.post('/anon-upload', [UploadsController, 'uploadFileAnonymous'])
  router.post('/anon-upload/chunked/finish', [UploadsController, 'finishChunkedUploadAnonymous'])

  // protected upload 

 
    router.post('/upload', [UploadsController, 'uploadFileUserBound'])
    .middleware(middleware.mainServerAuth())

  router.post('/upload/chunked/finish', [UploadsController, 'finishChunkedUpload'])
    .middleware(middleware.mainServerAuth())

}

export { uploadRoutes }
