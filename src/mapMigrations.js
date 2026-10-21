// Structural map migrations. Like LABEL_MIGRATIONS_BY_VERSION in App.jsx these
// run on every load, so each one must be idempotent: a map that is already
// migrated comes back unchanged.

// Each entry keeps exactly one built-in node with `label`, under the node at
// `homePath` (a chain of labels ending at the new parent). Every other
// built-in copy is merged into it: matching children merge recursively,
// anything the home copy lacks (custom nodes, deeper subtrees) is moved
// across, notes and summaries are carried over, and the copy itself is removed.
export const STRUCTURAL_MIGRATIONS_BY_VERSION = {
  3: [
    { label: 'Emotions', homePath: ['Psychology'] },
    { label: 'Emotional Regulation', homePath: ['Psychology', 'Emotions'] },
  ],
}

const buildChildrenByParent = (mapNodes) => {
  const childrenByParent = new Map()
  for (const node of mapNodes) {
    if (node.parentId === null || node.parentId === undefined) continue
    if (!childrenByParent.has(node.parentId)) childrenByParent.set(node.parentId, [])
    childrenByParent.get(node.parentId).push(node)
  }
  return childrenByParent
}

const countDescendants = (childrenByParent, nodeId) => {
  let count = 0
  const stack = [nodeId]
  while (stack.length > 0) {
    const children = childrenByParent.get(stack.pop()) || []
    count += children.length
    for (const child of children) stack.push(child.id)
  }
  return count
}

const isAncestorOrSelf = (byId, ancestorId, nodeId) => {
  const visited = new Set()
  let current = byId.get(nodeId)
  while (current && !visited.has(current.id)) {
    if (current.id === ancestorId) return true
    visited.add(current.id)
    current = byId.get(current.parentId)
  }
  return false
}

const findHome = (mapNodes, byId, homePath) => {
  const matches = mapNodes.filter((node) => {
    if (node.isCustom || node.isPersonal) return false
    let current = node
    for (let i = homePath.length - 1; i >= 0; i--) {
      if (!current || current.label !== homePath[i]) return false
      current = byId.get(current.parentId)
    }
    return true
  })
  matches.sort((a, b) => a.id - b.id)
  return matches[0] || null
}

const mergeNotes = (targetNotes, sourceNotes) => {
  if (!Array.isArray(sourceNotes) || sourceNotes.length === 0) return targetNotes
  const existing = Array.isArray(targetNotes) ? targetNotes : []
  const existingIds = new Set(existing.map((note) => note.id))
  const additions = sourceNotes.filter((note) => !existingIds.has(note.id))
  return additions.length > 0 ? [...existing, ...additions] : targetNotes
}

const consolidateBuiltInNode = (mapNodes, { label, homePath }, builtInSummary, topicSubdivisions) => {
  let byId = new Map(mapNodes.map((node) => [node.id, node]))
  const home = findHome(mapNodes, byId, homePath)
  if (!home) return { nodes: mapNodes, changed: false }

  let childrenByParent = buildChildrenByParent(mapNodes)
  const copies = mapNodes.filter((node) => node.label === label && !node.isCustom && !node.isPersonal)
  const homeChildren = childrenByParent.get(home.id) || []

  if (copies.length === 0) {
    // Nothing stored yet. A home whose built-in children are already stored
    // never regenerates new ones on expand, so add the node here.
    const homeHasPredefined = homeChildren.some((child) => !child.isCustom)
    const excluded = (home.excludedChildLabels || []).includes(label)
    if (!homeHasPredefined || excluded) return { nodes: mapNodes, changed: false }
    const maxId = mapNodes.reduce((max, node) => (Number.isFinite(node.id) ? Math.max(max, node.id) : max), 0)
    const created = { id: maxId + 1, label, parentId: home.id, hidden: homeChildren[0]?.hidden ?? true }
    return { nodes: [...mapNodes, created], changed: true }
  }

  const byRichness = (a, b) =>
    countDescendants(childrenByParent, b.id) - countDescendants(childrenByParent, a.id) || a.id - b.id
  const copiesAtHome = copies.filter((node) => node.parentId === home.id).sort(byRichness)
  const canonical = copiesAtHome[0] || [...copies].sort(byRichness)[0]
  if (isAncestorOrSelf(byId, canonical.id, home.id)) return { nodes: mapNodes, changed: false }

  let changed = false
  const updates = new Map()
  const removed = new Set()
  const current = (id) => updates.get(id) || byId.get(id)
  const update = (id, fields) => {
    updates.set(id, { ...current(id), ...fields })
    changed = true
  }

  const created = []
  if (canonical.parentId !== home.id) {
    const moved = { ...canonical, parentId: home.id, hidden: homeChildren[0]?.hidden ?? canonical.hidden }
    delete moved.order
    updates.set(canonical.id, moved)
    changed = true

    // addChildren only generates built-in children for a node that has none,
    // so a home that was never expanded gets its full built-in set here.
    if (!homeChildren.some((child) => !child.isCustom)) {
      const skip = new Set([label, ...(home.excludedChildLabels || []), ...homeChildren.map((child) => child.label)])
      const maxId = mapNodes.reduce((max, node) => (Number.isFinite(node.id) ? Math.max(max, node.id) : max), 0)
      for (const childLabel of topicSubdivisions[home.label] || []) {
        if (skip.has(childLabel)) continue
        skip.add(childLabel)
        created.push({ id: maxId + created.length + 1, label: childLabel, parentId: home.id, hidden: moved.hidden })
      }
    }
  }

  const refresh = () => {
    const live = mapNodes.filter((node) => !removed.has(node.id)).map((node) => current(node.id))
    byId = new Map(live.map((node) => [node.id, node]))
    childrenByParent = buildChildrenByParent(live)
  }

  const mergeInto = (sourceId, targetId) => {
    refresh()
    const source = byId.get(sourceId)
    const target = byId.get(targetId)
    const notes = mergeNotes(target.notes, source.notes)
    if (notes !== target.notes) update(targetId, { notes })
    // A summary written on the copy wins over the built-in text; otherwise keep
    // whatever the copy displayed when the kept node displays nothing.
    const displayed = (node) => node.summary || (!node.isCustom ? builtInSummary(node.label) : '')
    if (!target.summary && source.summary) update(targetId, { summary: source.summary })
    else if (!displayed(target) && displayed(source)) update(targetId, { summary: displayed(source) })

    for (const child of childrenByParent.get(sourceId) || []) {
      refresh()
      const match = (childrenByParent.get(targetId) || []).find((n) => n.label === child.label)
      if (match) mergeInto(child.id, match.id)
      else update(child.id, { parentId: targetId })
    }
    removed.add(sourceId)
    changed = true
  }

  refresh()
  for (const copy of copies) {
    if (copy.id === canonical.id || removed.has(copy.id) || !byId.has(copy.id)) continue
    // Merging an ancestor of the canonical node into it would create a cycle.
    if (isAncestorOrSelf(byId, copy.id, canonical.id)) continue
    mergeInto(copy.id, canonical.id)
  }

  if (!changed) return { nodes: mapNodes, changed: false }
  const nodes = mapNodes.filter((node) => !removed.has(node.id)).map((node) => current(node.id))
  return { nodes: [...nodes, ...created], changed: true }
}

// builtInSummary(label) returns the built-in summary text for a label, so a
// merged copy's displayed summary can be kept on a custom node.
// topicSubdivisions maps a label to its built-in child labels.
export const applyStructuralMigrations = (mapNodes, builtInSummary = () => '', topicSubdivisions = {}) => {
  if (!Array.isArray(mapNodes)) return { nodes: [], changed: false }

  const orderedVersions = Object.keys(STRUCTURAL_MIGRATIONS_BY_VERSION)
    .map((version) => Number(version))
    .sort((a, b) => a - b)

  let nodes = mapNodes
  let changed = false
  for (const version of orderedVersions) {
    for (const migration of STRUCTURAL_MIGRATIONS_BY_VERSION[version]) {
      const result = consolidateBuiltInNode(nodes, migration, builtInSummary, topicSubdivisions)
      nodes = result.nodes
      changed = changed || result.changed
    }
  }
  return { nodes, changed }
}

// Remove stale predefined children: for any node with known subdivisions,
// drop predefined children whose labels are not in the expected set, along
// with all their descendants. addChildren recreates correct children on
// first expand.
export const removeStalePredefinedChildren = (mapNodes, topicSubdivisions) => {
  const childrenByParent = buildChildrenByParent(mapNodes)

  const idsToRemove = new Set()
  for (const node of mapNodes) {
    const expected = topicSubdivisions[node.label]
    if (!expected || expected.length === 0) continue
    const children = childrenByParent.get(node.id) || []
    for (const child of children) {
      if (!child.isCustom && !expected.includes(child.label)) {
        const stack = [child.id]
        while (stack.length > 0) {
          const id = stack.pop()
          idsToRemove.add(id)
          const grandchildren = childrenByParent.get(id) || []
          for (const gc of grandchildren) stack.push(gc.id)
        }
      }
    }
  }

  if (idsToRemove.size === 0) return { nodes: mapNodes, changed: false }
  return { nodes: mapNodes.filter((n) => !idsToRemove.has(n.id)), changed: true }
}
