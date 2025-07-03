import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ServerShard extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare domain: string

  @column()
  /**
   * Is the server paired, as in paired?
   */
  declare paired: boolean

  @column({
    serializeAs: null
  })
  declare apiKey: string

  @column()
  declare isUp: boolean

  @column()
  declare spaceTotal: number

  @column()
  declare spaceFree: number

  @column.dateTime()
  declare lastHeartbeat: DateTime


}