import { HttpRouterService } from "@adonisjs/core/types";

const ServerCommunicationsController = () => import('#controllers/server_communications_controller')

function serverCommunicationRoutes(
  router: HttpRouterService
) {
  
}


export {
  serverCommunicationRoutes
}