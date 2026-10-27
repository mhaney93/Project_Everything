// Keeps the map version (the server's updated_at text) from the last load or
// save and sends it with every save, so the server can refuse a save from a tab
// whose copy of the map is out of date (409) instead of overwriting newer changes.
//
// Saves run one at a time, so consecutive saves from this tab each send the
// version returned by the save before them rather than racing each other.
// After a conflict, saves queued before the map is reloaded are dropped: they
// hold the stale copy and would otherwise overwrite the reloaded map.

export class MapConflictError extends Error {
  constructor(message = 'Map changed since it was loaded') {
    super(message)
    this.conflict = true
  }
}

// request(method, body) resolves to { status, data }.
export const createMapSync = (request) => {
  let version = null
  let generation = 0
  let queue = Promise.resolve()
  let onConflict = null

  const getMap = async () => {
    const { status, data } = await request('GET')
    if (status < 200 || status >= 300) throw new Error(data.error)
    version = data.version ?? null
    generation += 1
    return data
  }

  const sendSave = async (nodes, savedGeneration) => {
    if (savedGeneration !== generation) throw new MapConflictError()
    const { status, data } = await request('POST', { nodes, version })
    if (status === 409) {
      generation += 1
      if (onConflict) onConflict()
      throw new MapConflictError(data.error)
    }
    if (status < 200 || status >= 300) throw new Error(data.error)
    version = data.version ?? null
    return data
  }

  const saveMap = (nodes) => {
    const savedGeneration = generation
    const result = queue.then(() => sendSave(nodes, savedGeneration))
    queue = result.catch(() => {})
    return result
  }

  const setConflictHandler = (handler) => { onConflict = handler }

  return { getMap, saveMap, setConflictHandler }
}
