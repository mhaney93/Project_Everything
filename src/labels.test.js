import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripLabelSuffix } from './labels.js'

test('stripLabelSuffix hides the |context suffix', () => {
  assert.equal(stripLabelSuffix('Flavor|food'), 'Flavor')
  assert.equal(stripLabelSuffix('Key Brain Regions|PFC'), 'Key Brain Regions')
})

test('stripLabelSuffix keeps verse and plain labels intact', () => {
  assert.equal(stripLabelSuffix('Gen 1:3'), 'Gen 1:3')
  assert.equal(stripLabelSuffix('Pharmacology'), 'Pharmacology')
})
