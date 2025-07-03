/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { uploadRoutes } from '../app/routes/uploadRoutes.js'
import { fileRoutes } from '../app/routes/fileRoutes.js'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// file serving routes

fileRoutes(router)
uploadRoutes(router)