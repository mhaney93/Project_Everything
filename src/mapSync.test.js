import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMapSync } from './mapSync.js'

// A fake /api/maps that versions the stored map like the server does.
const fakeServer = (stored = { nodes: [], version: 'v0' }) => {
  let counter = 0
  const posts = []
  const request = async (method, body) => {
    await new Promise((resolve) => setTimeout(resolve, 1))
    if (method === 'GET') return { status: 200, data: { ...stored } }
    posts.push(body)
    if (body.version !== stored.version) return { status: 409, data: { error: 'Map changed since it was loaded' } }
    counter += 1
    stored = { nodes: body.nodes, version: `v${counter}` }
    return { status: 200, data: { ...stored } }
  }
  return { request, posts, get stored() { return stored }, set stored(value) { stored = value } }
}

test('the first save after load sends the loaded version', async () => {
  const server = fakeServer()
  const sync = createMapSync(server.request)
  await sync.getMap()
  await sync.saveMap([{ id: 1 }])
  assert.equal(server.posts[0].version, 'v0')
  assert.deepEqual(server.stored.nodes, [{ id: 1 }])
})

test('the on-load migration save and the saves after it each use the latest version', async () => {
  const server = fakeServer()
  const sync = createMapSync(server.request)
  await sync.getMap()
  await sync.saveMap([{ id: 'migrated' }])
  await sync.saveMap([{ id: 'edited' }])
  assert.deepEqual(server.posts.map((post) => post.version), ['v0', 'v1'])
  assert.deepEqual(server.stored.nodes, [{ id: 'edited' }])
})

test('rapid saves from one tab run in order and do not conflict with each other', async () => {
  const server = fakeServer()
  const sync = createMapSync(server.request)
  let conflicts = 0
  sync.setConflictHandler(() => { conflicts += 1 })
  await sync.getMap()
  await Promise.all([1, 2, 3].map((id) => sync.saveMap([{ id }])))
  assert.equal(conflicts, 0)
  assert.deepEqual(server.posts.map((post) => post.version), ['v0', 'v1', 'v2'])
  assert.deepEqual(server.stored.nodes, [{ id: 3 }])
})

test('a save from a stale copy is refused, reported, and does not overwrite', async () => {
  const server = fakeServer()
  const sync = createMapSync(server.request)
  let conflicts = 0
  sync.setConflictHandler(() => { conflicts += 1 })
  await sync.getMap()
  server.stored = { nodes: [{ id: 'other tab' }], version: 'elsewhere' }
  await assert.rejects(sync.saveMap([{ id: 'stale' }]), (err) => err.conflict === true)
  assert.equal(conflicts, 1)
  assert.deepEqual(server.stored.nodes, [{ id: 'other tab' }])
})

test('saves queued before the reload are dropped, and saves after it go through', async () => {
  const server = fakeServer()
  const sync = createMapSync(server.request)
  let conflicts = 0
  sync.setConflictHandler(() => { conflicts += 1 })
  await sync.getMap()
  server.stored = { nodes: [{ id: 'other tab' }], version: 'elsewhere' }
  const first = sync.saveMap([{ id: 'stale 1' }])
  const second = sync.saveMap([{ id: 'stale 2' }])
  await assert.rejects(first, (err) => err.conflict === true)
  await assert.rejects(second, (err) => err.conflict === true)
  assert.equal(conflicts, 1)
  assert.equal(server.posts.length, 1)

  const reloaded = await sync.getMap()
  assert.deepEqual(reloaded.nodes, [{ id: 'other tab' }])
  await sync.saveMap([{ id: 'fresh' }])
  assert.equal(server.posts[1].version, 'elsewhere')
  assert.deepEqual(server.stored.nodes, [{ id: 'fresh' }])
})

test('other save errors are thrown without the conflict flag', async () => {
  const sync = createMapSync(async (method) => method === 'GET'
    ? { status: 200, data: { nodes: [], version: 'v0' } }
    : { status: 500, data: { error: 'boom' } })
  await sync.getMap()
  await assert.rejects(sync.saveMap([]), (err) => err.message === 'boom' && !err.conflict)
})
