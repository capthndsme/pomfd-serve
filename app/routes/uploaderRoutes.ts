import { HttpRouterService } from "@adonisjs/core/types";
const UploadsController = () => import('#controllers/uploads_controller')

function uploaderRoutes(
  router: HttpRouterService
) {
  router.group(() => {
    router.get('/available-servers', [UploadsController, 'getAvailableServers'])
  router.get('/where', [UploadsController, 'findAnonymousUrl'])
  }).prefix('/upload')

}

export {
  uploaderRoutes
}