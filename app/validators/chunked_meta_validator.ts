// validators/chunked_meta.ts
import vine from '@vinejs/vine'

const chunkedMetaSchema = vine.object({
  uploadId: vine.string().minLength(1),
  chunkIndex: vine.number().min(0),
  totalChunks: vine.number().min(1),
  fileName: vine.string().minLength(1),
  fileSize: vine.number().min(1),
  mimeType: vine.string().minLength(1),
  chunkHash: vine.string().regex(/^[a-fA-F0-9]{64}$/),
  fileHash: vine.string().regex(/^[a-fA-F0-9]{64}$/),
  chunkSize: vine.number().min(1),
})

export const chunkedMetaValidator = vine.compile(chunkedMetaSchema)
