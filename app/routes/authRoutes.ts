import { middleware } from "#start/kernel";
import { HttpRouterService } from "@adonisjs/core/types";

/** Imports */
const AuthController = () => import('#controllers/auth_controller')

function authRoutes(router: HttpRouterService) {
  router.group(() => {
    router.post('/login', [AuthController, 'login'])
    router.post('/register', [AuthController, 'createAccount'])

    router.group(() => {
      router.post('/logout', [AuthController, 'logout'])
      router.get('/verify-token', [AuthController, 'verifyToken'])
    }).use(middleware.auth())
  }).prefix('auth')
  
}

export {
  authRoutes
}

