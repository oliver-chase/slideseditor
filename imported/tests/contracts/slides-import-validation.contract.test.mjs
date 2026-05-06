import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_IMPORT_FILE_SIZE_BYTES,
  validateHtmlImportInput,
  validateImportFile,
  validatePastedHtml,
} from '../../src/components/slides/import-validation.ts'

function makeFile(name, contents, type = 'text/html') {
  return new File([contents], name, { type })
}

test('slides import validation contract: file intake accepts .html and .htm files', () => {
  assert.equal(validateImportFile(makeFile('deck.html', '<div class="slide-canvas"></div>')), null)
  assert.equal(validateImportFile(makeFile('deck.htm', '<div class="slide-canvas"></div>')), null)
})

test('slides import validation contract: file intake rejects unsupported file types and oversized payloads', () => {
  const invalidType = validateImportFile(makeFile('deck.txt', '<div class="slide-canvas"></div>', 'text/plain'))
  assert.equal(invalidType?.code, 'invalid_file_type')
  assert.match(invalidType?.message || '', /\.html and \.htm files are supported/i)

  const oversized = validateImportFile(makeFile('deck.html', 'x'.repeat(MAX_IMPORT_FILE_SIZE_BYTES + 1)))
  assert.equal(oversized?.code, 'file_too_large')
  const expectedLimitLabel = `${Math.floor(MAX_IMPORT_FILE_SIZE_BYTES / 1_000_000)} MB`
  assert.match(oversized?.message || '', new RegExp(expectedLimitLabel, 'i'))
})

test('slides import validation contract: html payload preflight rejects empty and plain text input', () => {
  const empty = validateHtmlImportInput('   \n\t  ')
  assert.equal(empty?.code, 'empty_input')
  assert.match(empty?.message || '', /empty/i)

  const plainText = validatePastedHtml('this is not html markup')
  assert.equal(plainText?.code, 'invalid_markup')
  assert.match(plainText?.message || '', /valid HTML markup/i)
})

test('slides import validation contract: html payload preflight accepts full documents and fragments', () => {
  assert.equal(validateHtmlImportInput('<!doctype html><html><body><div class="slide-canvas"></div></body></html>'), null)
  assert.equal(validateHtmlImportInput('<div class="slide-canvas"></div>'), null)
})
