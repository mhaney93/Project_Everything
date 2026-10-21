// Structural map migrations. Like LABEL_MIGRATIONS_BY_VERSION in App.jsx these
// run on every load, so each one must be idempotent: a map that is already
// migrated comes back unchanged.

// Each entry keeps exactly one built-in node with `label`, under the node at
// `homePath` (a chain of labels ending at the new parent). Every other
// built-in copy is merged into it: matching children merge recursively,
// anything the home copy lacks (custom nodes, deeper subtrees) is moved
// across, notes and summaries are carried over (a summary that differs from
// the home copy's becomes a note), and the copy itself is removed.
// When only the start of `homePath` is stored, the missing levels are created
// from the built-in taxonomy first, so a copy is never left behind for the
// stale-child prune to delete.
// With `dropBareCopies`, copies outside the home that hold nothing the owner
// wrote (no custom node, note or stored summary in their subtree) are deleted
// outright instead.
//
// Entries with a path (a chain of labels ending at the built-in node itself)
// change one place in the tree instead:
// - `rename` relabels the node to `label` (possibly its own label), dropping a stored summary only when
//   it is one of `dropSummaries`, so the built-in summary of the new label shows.
// - `add` creates a built-in child `add` under the node at `under`, when that
//   node's built-in children are already stored (expanding never adds more).
// - `move` reparents the node, with its subtree, under the node at `into`,
//   creating `into` when only its parent is stored.
// - `remove` merges the node into its namesake under `mergeInto` (notes,
//   children carry over, a differing summary becomes a note). Without one, a node holding anything
//   the owner wrote becomes custom and stays put; a bare one is deleted.
// A node that lands beside a namesake is merged into it the same way.
const PERSONALITY_ARCHETYPES = ['Personality Psychology', 'Archetypes']
const MARK_PEARSON = [...PERSONALITY_ARCHETYPES, 'Mark & Pearson\'s 12 Archetypes']
const MARK_PEARSON_FIGURES = [...MARK_PEARSON, 'Universal Archetypal Figures/Patterns']
const ARCHETYPE_COMBINATIONS = [...PERSONALITY_ARCHETYPES, 'My Archetype Combinations']
const JUNG_ARCHETYPAL_FIGURES = ['Collective Unconscious', 'Jungian Archetypes', 'Situational Archetypes/Motifs', 'Archetypal Figures']
const UNIVERSAL_FIGURES_SUMMARY = 'The recurring character types and narrative patterns that appear universally across myth, religion, and storytelling as expressions of the collective unconscious.'
const WISE_OLD_MAN_SUMMARY = 'An archetype representing wisdom, guidance, and spiritual insight, often appearing as a mentor or advisor figure.'
const TRICKSTER_SUMMARY = 'An archetype embodying chaos, disruption, and the challenging of norms, often bringing about change through unconventional or subversive means.'
const JUNGIAN_HERO_SUMMARY = 'An archetype representing the ego\'s journey of overcoming obstacles, achieving individuation, and integrating the Self.'
const JUNGIAN_ARCHETYPES_SUMMARY = 'Universal, inherited patterns of thought and imagery residing in the collective unconscious, influencing human behavior and cultural expressions as described by Carl Jung.'
const PANAS_RESULTS = ['Positive And Negative Affect Schedule (PANAS)', 'Results|PANAS']
const RWANDAN_GENOCIDE = 'Rwandan Genocide (1994)'
const MIGRATION_PERIOD = 'Migration Period (c. 375 - 568)'

export const STRUCTURAL_MIGRATIONS_BY_VERSION = {
  3: [
    { label: 'Emotions', homePath: ['Psychology'] },
    { label: 'Emotional Regulation', homePath: ['Psychology', 'Emotions'] },
  ],
  4: [
    { label: 'Front-End Frameworks', homePath: ['Applied Sciences', 'Engineering', 'Software Engineering', 'Software Development/Programming', 'Packages', 'Frameworks'] },
    { label: 'Python', homePath: ['Programming Languages', 'Imperative Languages', 'Object-Oriented'] },
    { label: 'Node.js', homePath: ['Software Development/Programming', 'Runtime Environments'], dropBareCopies: true },
    { label: 'Asynchronous Operations', homePath: ['JavaScript', 'Control Flow'] },
  ],
  5: [
    {
      rename: [...PERSONALITY_ARCHETYPES, 'Jungian Archetypes'],
      label: MARK_PEARSON.at(-1),
      dropSummaries: [JUNGIAN_ARCHETYPES_SUMMARY, `${JUNGIAN_ARCHETYPES_SUMMARY}  See: Jung's Analytical Psychology under Depth Psychology.`],
    },
    { add: ARCHETYPE_COMBINATIONS.at(-1), under: PERSONALITY_ARCHETYPES },
    { move: [...MARK_PEARSON, 'Combinations|Jungian'], into: ARCHETYPE_COMBINATIONS },
    { move: [...MARK_PEARSON, 'Combinations of Combinations'], into: ARCHETYPE_COMBINATIONS },
    { move: [...MARK_PEARSON_FIGURES, 'The Healer'], into: ARCHETYPE_COMBINATIONS },
    { remove: [...MARK_PEARSON, 'The Archetypes of Orientation'] },
    { rename: [...MARK_PEARSON_FIGURES, 'The Trickster'], label: 'The Jester', dropSummaries: [TRICKSTER_SUMMARY] },
    { rename: [...MARK_PEARSON_FIGURES, 'The Wise Old Man/Sage'], label: 'The Sage', dropSummaries: [WISE_OLD_MAN_SUMMARY] },
    { rename: MARK_PEARSON_FIGURES, label: MARK_PEARSON_FIGURES.at(-1), dropSummaries: [UNIVERSAL_FIGURES_SUMMARY] },
    { rename: [...MARK_PEARSON_FIGURES, 'The Hero'], label: 'The Hero|Mark & Pearson', dropSummaries: [JUNGIAN_HERO_SUMMARY] },
    { remove: [...MARK_PEARSON_FIGURES, 'The Child'], mergeInto: JUNG_ARCHETYPAL_FIGURES },
    { remove: [...MARK_PEARSON_FIGURES, 'The Great Mother'], mergeInto: JUNG_ARCHETYPAL_FIGURES },
    { add: 'The Caregiver', under: MARK_PEARSON_FIGURES },
    { add: 'The Magician', under: MARK_PEARSON_FIGURES },
    { add: 'The Ruler', under: MARK_PEARSON_FIGURES },
    { rename: [...PANAS_RESULTS, 'Cheerleader Archetype'], label: 'Self-fulfilling (Cheerleader)' },
    { rename: [...PANAS_RESULTS, 'Mad Scientist Archetype'], label: 'High affective (Mad Scientist)' },
    { rename: [...PANAS_RESULTS, 'Judge/Surgeon Archetype'], label: 'Low affective (Judge/Surgeon)' },
    { rename: [...PANAS_RESULTS, 'Poet Archetype'], label: 'Self-destructive (Poet)' },
  ],
  6: [
    // 1994 is after the Cold War; the copy under the post-Cold War Rwanda node stays.
    { remove: ['Rwanda During the Cold War Era', RWANDAN_GENOCIDE], mergeInto: ['Rwanda During the Post-Cold War Era'] },
    // One Migration Period, under the medieval Late Antiquity; the ancient copy merges into it.
    { rename: ['Late Antiquity (250 - 500 AD)', 'Migration Period (300 - 500 AD)'], label: MIGRATION_PERIOD },
    { label: MIGRATION_PERIOD, homePath: ['History', 'Medieval Period (476 - 1453)', 'Early Middle Ages (476 - 1000)', 'Late Antiquity (500 - 750)'] },
  ],
}

// Each entry rewrites a stored summary on a node with `label` only while it
// still reads exactly `from`, so a summary the owner edited is left alone.
// Change the built-in summary in App.jsx to `to` in the same change.
export const SUMMARY_MIGRATIONS_BY_VERSION = {
  4: [
    {
      label: 'Memory Tricks',
      from: 'Mnemonics for the V of each key: Car→Gas, Data→Analysis, Eyes→Blink, Fire→Coal, Garden→Dirt, Artist→Easel, Bitch→Fuck.',
      to: 'Mnemonics for the V of each key: Car→Gas, Data→Analysis, Eyes→Blink, Fire→Coal, Garden→Dirt, Artist→Easel, Bitch→Fuck (sharp!).',
    },
  ],
  5: [
    {
      label: 'Pharmacology|DMT',
      from: 'The mechanisms by which DMT produces its effects, hypothesized to involve ordering of neuronal microtubules.',
      to: 'Acts mainly as a serotonin 5-HT2A receptor agonist (also sigma-1 and trace-amine receptors). Speculative hypotheses also propose effects on neuronal microtubule order.',
    },
    {
      label: 'Pharmacology|5-MeO-DMT',
      from: 'The hypothesized mechanism of 5-MeO-DMT involving a scrambling of liquid crystal order in neuronal microtubules.',
      to: 'Acts mainly on serotonin 5-HT1A receptors, with 5-HT2A activity. A speculative hypothesis proposes it scrambles microtubule liquid-crystal order.',
    },
    {
      label: 'Results|PANAS',
      from: 'The four PANAS profile archetypes defined by combinations of high/low positive and negative affect scores.',
      to: 'Archer & Garcia\'s four affective profiles, built from PANAS\'s two scores: high or low positive affect (PA) combined with high or low negative affect (NA).',
    },
    {
      label: 'Combinations|Jungian',
      from: 'Jungian archetypes that emerge from the interaction or blending of two or more core archetypal patterns.',
      to: 'My own combinations of two or more archetypes, blended into one pattern.',
    },
    {
      label: 'Combinations of Combinations',
      from: 'Higher-order Jungian archetypes that emerge from combining already-blended archetypal patterns.',
      to: 'My own higher-order combinations, built by combining archetypes that are already blends.',
    },
  ],
  6: [
    {
      label: 'Operation Northwoods (1962)',
      from: 'A March 1962 proposed CIA plan to stage false-flag attacks and blame them on Cuba to justify a U.S. military invasion, rejected by President Kennedy.',
      to: 'A March 1962 Joint Chiefs of Staff proposal, part of the Operation Mongoose anti-Castro planning, to stage false-flag attacks and blame them on Cuba to justify a U.S. invasion; rejected by the Kennedy administration.',
    },
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

const isBuiltIn = (node) => !node.isCustom && !node.isPersonal

// Every node accepted by `accepts` whose label chain ends with `path`, oldest first.
const nodesAtPath = (mapNodes, byId, path, accepts = isBuiltIn) => {
  const matches = mapNodes.filter((node) => {
    if (!accepts(node)) return false
    let current = node
    for (let i = path.length - 1; i >= 0; i--) {
      if (!current || current.label !== path[i]) return false
      current = byId.get(current.parentId)
    }
    return true
  })
  return matches.sort((a, b) => a.id - b.id)
}

const findHome = (mapNodes, byId, homePath) => nodesAtPath(mapNodes, byId, homePath)[0] || null

const subtreeIds = (childrenByParent, nodeId) => {
  const ids = [nodeId]
  for (let i = 0; i < ids.length; i++) {
    for (const child of childrenByParent.get(ids[i]) || []) ids.push(child.id)
  }
  return ids
}

const holdsOwnerContent = (node) =>
  Boolean(node.isCustom || node.isPersonal || node.summary || (Array.isArray(node.notes) && node.notes.length > 0))

const dropBareCopies = (mapNodes, { label, homePath }) => {
  const byId = new Map(mapNodes.map((node) => [node.id, node]))
  const home = findHome(mapNodes, byId, homePath)
  const childrenByParent = buildChildrenByParent(mapNodes)
  const removed = new Set()
  for (const node of mapNodes) {
    if (node.label !== label || node.isCustom || node.isPersonal || removed.has(node.id)) continue
    if (home && node.parentId === home.id) continue
    const ids = subtreeIds(childrenByParent, node.id)
    if (ids.some((id) => holdsOwnerContent(byId.get(id)))) continue
    for (const id of ids) removed.add(id)
  }
  if (removed.size === 0) return { nodes: mapNodes, changed: false }
  return { nodes: mapNodes.filter((node) => !removed.has(node.id)), changed: true }
}

const maxIdOf = (mapNodes) =>
  mapNodes.reduce((max, node) => (Number.isFinite(node.id) ? Math.max(max, node.id) : max), 0)

// Finds the deepest stored node along `homePath` and creates the levels below
// it the way expanding each one would: a parent without built-in children gets
// its full built-in set, otherwise just the missing level.
const ensureHome = (mapNodes, homePath, topicSubdivisions) => {
  const byId = new Map(mapNodes.map((node) => [node.id, node]))
  let depth = homePath.length
  let anchor = findHome(mapNodes, byId, homePath)
  while (!anchor && depth > 1) anchor = findHome(mapNodes, byId, homePath.slice(0, --depth))
  if (!anchor) return null

  let nodes = mapNodes
  let maxId = maxIdOf(mapNodes)
  for (const label of homePath.slice(depth)) {
    const excluded = anchor.excludedChildLabels || []
    const expected = (topicSubdivisions[anchor.label] || []).filter((childLabel) => !excluded.includes(childLabel))
    if (!expected.includes(label)) return null
    const children = nodes.filter((node) => node.parentId === anchor.id)
    const taken = new Set(children.map((child) => child.label).filter((childLabel) => childLabel !== label))
    const labels = children.some((child) => !child.isCustom) ? [label] : [...new Set(expected)].filter((l) => !taken.has(l))
    const hidden = children[0]?.hidden ?? true
    const created = labels.map((childLabel) => ({ id: ++maxId, label: childLabel, parentId: anchor.id, hidden }))
    nodes = [...nodes, ...created]
    anchor = created.find((node) => node.label === label)
  }
  return { nodes, home: anchor }
}

const mergeNotes = (targetNotes, sourceNotes) => {
  if (!Array.isArray(sourceNotes) || sourceNotes.length === 0) return targetNotes
  const existing = Array.isArray(targetNotes) ? targetNotes : []
  const existingIds = new Set(existing.map((note) => note.id))
  const additions = sourceNotes.filter((note) => !existingIds.has(note.id))
  return additions.length > 0 ? [...existing, ...additions] : targetNotes
}

const consolidateBuiltInNode = (mapNodes, { label, homePath }, builtInSummary, topicSubdivisions) => {
  const storedNodes = mapNodes
  let byId = new Map(mapNodes.map((node) => [node.id, node]))
  let home = findHome(mapNodes, byId, homePath)
  const copies = mapNodes.filter((node) => node.label === label && !node.isCustom && !node.isPersonal)
  if (!home && copies.length > 0) {
    const ensured = ensureHome(mapNodes, homePath, topicSubdivisions)
    if (ensured) {
      mapNodes = ensured.nodes
      home = ensured.home
      byId = new Map(mapNodes.map((node) => [node.id, node]))
    }
  }
  if (!home) return { nodes: storedNodes, changed: false }

  const childrenByParent = buildChildrenByParent(mapNodes)
  const homeChildren = childrenByParent.get(home.id) || []

  if (copies.length === 0) {
    // Nothing stored yet. A home whose built-in children are already stored
    // never regenerates new ones on expand, so add the node here.
    const homeHasPredefined = homeChildren.some((child) => !child.isCustom)
    const excluded = (home.excludedChildLabels || []).includes(label)
    if (!homeHasPredefined || excluded) return { nodes: mapNodes, changed: false }
    const maxId = maxIdOf(mapNodes)
    const created = { id: maxId + 1, label, parentId: home.id, hidden: homeChildren[0]?.hidden ?? true }
    return { nodes: [...mapNodes, created], changed: true }
  }

  const byRichness = (a, b) =>
    countDescendants(childrenByParent, b.id) - countDescendants(childrenByParent, a.id) || a.id - b.id
  const copiesAtHome = copies.filter((node) => node.parentId === home.id).sort(byRichness)
  const canonical = copiesAtHome[0] || [...copies].sort(byRichness)[0]
  if (isAncestorOrSelf(byId, canonical.id, home.id)) return { nodes: storedNodes, changed: false }

  let nodes = mapNodes
  const created = []
  if (canonical.parentId !== home.id) {
    const moved = { ...canonical, parentId: home.id, hidden: homeChildren[0]?.hidden ?? (home.hidden || canonical.hidden) }
    delete moved.order
    nodes = nodes.map((node) => (node.id === canonical.id ? moved : node))

    // addChildren only generates built-in children for a node that has none,
    // so a home that was never expanded gets its full built-in set here.
    if (!homeChildren.some((child) => !child.isCustom)) {
      const skip = new Set([label, ...(home.excludedChildLabels || []), ...homeChildren.map((child) => child.label)])
      const maxId = maxIdOf(mapNodes)
      for (const childLabel of topicSubdivisions[home.label] || []) {
        if (skip.has(childLabel)) continue
        skip.add(childLabel)
        created.push({ id: maxId + created.length + 1, label: childLabel, parentId: home.id, hidden: moved.hidden })
      }
    }
  }

  for (const copy of copies) {
    if (copy.id === canonical.id || !nodes.some((node) => node.id === copy.id)) continue
    // Merging an ancestor of the canonical node into it would create a cycle.
    if (isAncestorOrSelf(new Map(nodes.map((node) => [node.id, node])), copy.id, canonical.id)) continue
    nodes = mergeNode(nodes, copy.id, canonical.id, builtInSummary)
  }

  if (nodes === mapNodes) return { nodes: storedNodes, changed: false }
  return { nodes: [...nodes, ...created], changed: true }
}

const withoutOrder = (node) => {
  const copy = { ...node }
  delete copy.order
  return copy
}

const labelPathOf = (mapNodes, nodeId) => {
  const byId = new Map(mapNodes.map((node) => [node.id, node]))
  const labels = []
  const visited = new Set()
  for (let node = byId.get(nodeId); node && !visited.has(node.id); node = byId.get(node.parentId)) {
    visited.add(node.id)
    labels.unshift(node.label)
  }
  return labels
}

// Merges the node `sourceId` into `targetId`: notes carry over, children merge
// with namesakes or move across, and the source node is removed. The target
// keeps its summary; a different one shown on the source becomes a note naming
// `sourcePath`, the source's label path before the migration moved it.
const mergeNode = (mapNodes, sourceId, targetId, builtInSummary, sourcePath = labelPathOf(mapNodes, sourceId)) => {
  let nodes = mapNodes
  const merge = (fromId, toId, fromPath) => {
    const source = nodes.find((node) => node.id === fromId)
    const target = nodes.find((node) => node.id === toId)
    const fields = {}
    let notes = mergeNotes(target.notes, source.notes)
    const displayed = (node) => node.summary || (!node.isCustom ? builtInSummary(node.label) : '')
    const shown = displayed(source)
    if (!target.summary && source.summary) fields.summary = source.summary
    else if (!displayed(target) && shown) fields.summary = shown
    else if (shown && shown !== displayed(target)) {
      notes = mergeNotes(notes, [{ id: `merged-summary-${fromId}`, text: `Merged from ${fromPath.join(' > ')}: ${shown}`, level: 0 }])
    }
    if (notes !== target.notes) fields.notes = notes
    if (Object.keys(fields).length > 0) nodes = nodes.map((node) => (node.id === toId ? { ...node, ...fields } : node))

    for (const child of nodes.filter((node) => node.parentId === fromId)) {
      const match = nodes.find((node) => node.parentId === toId && node.label === child.label)
      if (match) merge(child.id, match.id, [...fromPath, child.label])
      else nodes = nodes.map((node) => (node.id === child.id ? withoutOrder({ ...node, parentId: toId }) : node))
    }
    nodes = nodes.filter((node) => node.id !== fromId)
  }
  merge(sourceId, targetId, sourcePath)
  return nodes
}

// Puts `node` (already updated in `mapNodes`) under `parentId`, merging it into
// a namesake already there. `sourcePath` is its label path before the update.
const settleUnder = (mapNodes, nodeId, parentId, builtInSummary, sourcePath) => {
  const namesake = mapNodes.find((node) => {
    if (node.parentId !== parentId || node.id === nodeId) return false
    return node.label === mapNodes.find((n) => n.id === nodeId).label
  })
  return namesake ? mergeNode(mapNodes, nodeId, namesake.id, builtInSummary, sourcePath) : mapNodes
}

const renameBuiltInNode = (mapNodes, { rename, label, dropSummaries = [] }, builtInSummary) => {
  let nodes = mapNodes
  const byId = new Map(mapNodes.map((node) => [node.id, node]))
  for (const match of nodesAtPath(mapNodes, byId, rename)) {
    if (match.label === label && !dropSummaries.includes(match.summary)) continue
    const sourcePath = labelPathOf(nodes, match.id)
    nodes = nodes.map((node) => {
      if (node.id !== match.id) return node
      const renamed = { ...node, label }
      if (dropSummaries.includes(node.summary)) delete renamed.summary
      return renamed
    })
    nodes = settleUnder(nodes, match.id, match.parentId, builtInSummary, sourcePath)
  }
  return { nodes, changed: nodes !== mapNodes }
}

const addBuiltInNode = (mapNodes, { add, under }) => {
  const byId = new Map(mapNodes.map((node) => [node.id, node]))
  const childrenByParent = buildChildrenByParent(mapNodes)
  let maxId = maxIdOf(mapNodes)
  const created = []
  for (const parent of nodesAtPath(mapNodes, byId, under)) {
    const children = childrenByParent.get(parent.id) || []
    if (!children.some((child) => !child.isCustom)) continue
    if (children.some((child) => child.label === add)) continue
    if ((parent.excludedChildLabels || []).includes(add)) continue
    created.push({ id: ++maxId, label: add, parentId: parent.id, hidden: children[0].hidden ?? true })
  }
  if (created.length === 0) return { nodes: mapNodes, changed: false }
  return { nodes: [...mapNodes, ...created], changed: true }
}

const moveBuiltInNode = (mapNodes, { move, into }, builtInSummary) => {
  let nodes = mapNodes
  for (const source of nodesAtPath(mapNodes, new Map(mapNodes.map((node) => [node.id, node])), move)) {
    let byId = new Map(nodes.map((node) => [node.id, node]))
    let target = findHome(nodes, byId, into)
    if (!target) {
      const parent = findHome(nodes, byId, into.slice(0, -1))
      if (!parent) continue
      target = { id: maxIdOf(nodes) + 1, label: into.at(-1), parentId: parent.id, hidden: source.hidden }
      nodes = [...nodes, target]
      byId = new Map(nodes.map((node) => [node.id, node]))
    }
    if (isAncestorOrSelf(byId, source.id, target.id)) continue
    const targetChildren = nodes.filter((node) => node.parentId === target.id && node.id !== source.id)
    const hidden = targetChildren[0]?.hidden ?? (target.hidden || source.hidden)
    const sourcePath = labelPathOf(nodes, source.id)
    nodes = nodes.map((node) => (node.id === source.id ? withoutOrder({ ...node, parentId: target.id, hidden }) : node))
    nodes = settleUnder(nodes, source.id, target.id, builtInSummary, sourcePath)
  }
  return { nodes, changed: nodes !== mapNodes }
}

const removeBuiltInNode = (mapNodes, { remove, mergeInto }, builtInSummary) => {
  let nodes = mapNodes
  for (const source of nodesAtPath(mapNodes, new Map(mapNodes.map((node) => [node.id, node])), remove)) {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const notPersonal = (node) => !node.isPersonal
    const target = mergeInto && nodesAtPath(nodes, byId, [...mergeInto, source.label], notPersonal).find((node) => node.id !== source.id)
    if (target) {
      nodes = mergeNode(nodes, source.id, target.id, builtInSummary)
      continue
    }
    const ids = subtreeIds(buildChildrenByParent(nodes), source.id)
    if (ids.some((id) => holdsOwnerContent(byId.get(id)))) {
      const summary = source.summary || builtInSummary(source.label) || undefined
      nodes = nodes.map((node) => (node.id === source.id ? { ...node, isCustom: true, summary } : node))
    } else {
      const removed = new Set(ids)
      nodes = nodes.filter((node) => !removed.has(node.id))
    }
  }
  return { nodes, changed: nodes !== mapNodes }
}

const runStructuralMigration = (mapNodes, migration, builtInSummary, topicSubdivisions) => {
  if (migration.rename) return renameBuiltInNode(mapNodes, migration, builtInSummary)
  if (migration.add) return addBuiltInNode(mapNodes, migration)
  if (migration.move) return moveBuiltInNode(mapNodes, migration, builtInSummary)
  if (migration.remove) return removeBuiltInNode(mapNodes, migration, builtInSummary)
  return consolidateBuiltInNode(mapNodes, migration, builtInSummary, topicSubdivisions)
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
      if (migration.dropBareCopies) {
        const dropped = dropBareCopies(nodes, migration)
        nodes = dropped.nodes
        changed = changed || dropped.changed
      }
      const result = runStructuralMigration(nodes, migration, builtInSummary, topicSubdivisions)
      nodes = result.nodes
      changed = changed || result.changed
    }
  }
  return { nodes, changed }
}

export const applySummaryMigrations = (mapNodes) => {
  if (!Array.isArray(mapNodes)) return { nodes: [], changed: false }

  const migrations = Object.keys(SUMMARY_MIGRATIONS_BY_VERSION)
    .map((version) => Number(version))
    .sort((a, b) => a - b)
    .flatMap((version) => SUMMARY_MIGRATIONS_BY_VERSION[version])

  let changed = false
  const nodes = mapNodes.map((node) => {
    let summary = node.summary
    for (const { label, from, to } of migrations) {
      if (node.label === label && summary === from) summary = to
    }
    if (summary === node.summary) return node
    changed = true
    return { ...node, summary }
  })
  return { nodes: changed ? nodes : mapNodes, changed }
}

// Remove stale predefined children: for any node with known subdivisions,
// drop predefined children whose labels are not in the expected set, along
// with all their descendants. addChildren recreates correct children on
// first expand. A copy of a structurally migrated label is never dropped: if
// its home could not be stored (the owner deleted a level of it), it stays put.
export const removeStalePredefinedChildren = (mapNodes, topicSubdivisions) => {
  const childrenByParent = buildChildrenByParent(mapNodes)
  const migratedLabels = new Set(Object.values(STRUCTURAL_MIGRATIONS_BY_VERSION).flat().map(({ label }) => label))

  const idsToRemove = new Set()
  for (const node of mapNodes) {
    const expected = topicSubdivisions[node.label]
    if (!expected || expected.length === 0) continue
    const children = childrenByParent.get(node.id) || []
    for (const child of children) {
      if (!child.isCustom && !expected.includes(child.label) && !migratedLabels.has(child.label)) {
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
