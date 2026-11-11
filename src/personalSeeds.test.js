import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MY_ANCESTRY, seedMyAncestry } from './personalSeeds.js'

const base = () => [
  { id: 1, label: 'Everything', parentId: null },
  { id: 2, label: 'Human Genetics', parentId: 1 },
]

test('seeds a private My Ancestry (23andMe) tree under Human Genetics, once', () => {
  const { nodes, changed } = seedMyAncestry(base())
  assert.equal(changed, true)
  const mine = nodes.find((n) => n.label === MY_ANCESTRY)
  assert.equal(mine.parentId, 2)
  const added = nodes.slice(2)
  assert.ok(added.length > 20)
  assert.ok(added.every((n) => n.isPersonal === true && n.isCustom === true))
  assert.ok(nodes.some((n) => n.label === 'Swiss, Southwestern German & Western Austrian 29.5%'))
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length)
  assert.equal(seedMyAncestry(nodes).changed, false)
  // deleting it afterwards keeps it gone
  const deleted = nodes.filter((n) => n.id < 3)
  assert.equal(seedMyAncestry(deleted).changed, false)
})

test('does nothing without a Human Genetics node', () => {
  assert.equal(seedMyAncestry([{ id: 1, label: 'Everything', parentId: null }]).changed, false)
})
