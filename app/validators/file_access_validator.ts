// start/validator.ts
import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'

/**
 * Custom validation rule to ensure a path component is safe.
 * - Allows only alphanumeric characters, hyphens, and underscores.
 * - This inherently prevents path traversal characters like '.', '/', and '\'.
 */
async function safePathComponentRule(value: unknown, _: any, field: FieldContext) {
  if (typeof value !== 'string' || !value) {
    return
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    field.report('The {{ field }} field contains invalid characters.', 'safePathComponent', field)
  }
}

/**
 * Custom validation rule to ensure a filename is safe.
 * - Checks for traversal characters, control characters, and other risks.
 */
async function safeFilenameRule(value: unknown, _: any, field: FieldContext) {
  if (typeof value !== 'string' || !value) {
    return
  }

  // Disallow directory traversal attempts
  if (value.includes('/') || value.includes('\\')) {
    return field.report('Filename cannot contain slashes.', 'safeFilename', field)
  }

  // Disallow relative path components
  if (value === '.' || value === '..') {
    return field.report('Filename cannot be "." or "..".', 'safeFilename', field)
  }

  // Disallow null bytes and other control characters
  // eslint-disable-next-line no-control-regex
  if (value.includes('\0') || /[\x00-\x1f\x7f]/.test(value)) {
    return field.report('Filename contains invalid control characters.', 'safeFilename', field)
  }

  // Prevent filenames that are just dots or start with a dot (hidden files)
  if (value.startsWith('.')) {
    return field.report('Filename cannot start with a dot.', 'safeFilename', field)
  }
  
  // Prevent extremely long filenames
  if (value.length > 255) {
    return field.report('Filename is too long (max 255 characters).', 'safeFilename', field)
  }
}

// Create and export the rules
export const safePathComponent = vine.createRule(safePathComponentRule)
export const safeFilename = vine.createRule(safeFilenameRule)

/**
 * Validator for the hotlinkGet action.
 * It validates the URL parameters.
 */
export const hotlinkValidator = vine.compile(
  vine.object({
    key: vine.string().use(safePathComponent()),
    file: vine.string().use(safeFilename()),
  })
)

/**
 * Validator for the getPresigned action.
 * It validates URL parameters and query strings.
 */
export const presignedValidator = vine.compile(
  vine.object({
    // Params from the URL
    params: vine.object({
      key: vine.string().use(safePathComponent()),
      file: vine.string().use(safeFilename()),
    }),
    // Query string values
    signature: vine.string(),
    expires: vine.string().regex(/^\d+$/), // Must be a string of numbers
  })
)
