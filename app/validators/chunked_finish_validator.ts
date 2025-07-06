import vine from '@vinejs/vine'

export const chunkedFinishValidator = vine.compile(
  vine.object({
    uploadId: vine.string(),
    totalChunks: vine.number().min(1),
    fileName: vine.string(),
    fileSize: vine.number().min(1),
    mimeType: vine.string(),
  })
)
