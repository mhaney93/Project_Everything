import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { applyStructuralMigrations, removeStalePredefinedChildren } from './mapMigrations.js'

// TOPIC_SUBDIVISIONS lives inside the App component, so read it from the source.
const loadTopicSubdivisions = () => {
  const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
  const start = source.indexOf('{', source.indexOf('const TOPIC_SUBDIVISIONS = {'))
  const end = source.indexOf('\n  }\n', start)
  return vm.runInNewContext(`(${source.slice(start, end + 4)})`)
}

const TOPIC_SUBDIVISIONS = loadTopicSubdivisions()

const normalize = (mapNodes) => {
  const structural = applyStructuralMigrations(mapNodes, () => '', TOPIC_SUBDIVISIONS)
  const pruned = removeStalePredefinedChildren(structural.nodes, TOPIC_SUBDIVISIONS)
  return { nodes: pruned.nodes, changed: structural.changed || pruned.changed }
}

// Builds a stored map from nested [label, children, extraFields] tuples.
const buildMap = (tree) => {
  const nodes = []
  let nextId = 1
  const add = ([label, children = [], extra = {}], parentId) => {
    const id = nextId++
    nodes.push({ id, label, parentId, hidden: false, ...extra })
    for (const child of children) add(child, id)
    return id
  }
  add(tree, null)
  return nodes
}

// Expands a built-in label the way the app does, all the way down. The
// taxonomy has cycles (Appreciation > ... > Respecting > Appreciation) that the
// app only ever expands lazily, so stop at a label already on the path.
const builtIn = (label, extra = {}, path = []) => [
  label,
  (TOPIC_SUBDIVISIONS[label] || []).filter((child) => !path.includes(child)).map((child) => builtIn(child, {}, [...path, label])),
  extra,
]

const pathOf = (mapNodes, node) => {
  const byId = new Map(mapNodes.map((n) => [n.id, n]))
  const labels = []
  for (let current = node; current; current = byId.get(current.parentId)) labels.unshift(current.label)
  return labels.join(' > ')
}

const orphansOf = (mapNodes) => {
  const ids = new Set(mapNodes.map((n) => n.id))
  return mapNodes.filter((n) => n.parentId !== null && !ids.has(n.parentId))
}

const descendantsOf = (mapNodes, id) => {
  const result = []
  const stack = [id]
  while (stack.length > 0) {
    const parentId = stack.pop()
    for (const child of mapNodes.filter((n) => n.parentId === parentId)) {
      result.push(child)
      stack.push(child.id)
    }
  }
  return result
}

// The four stored copies found in the live map (2026-10-20 review). The root
// and the custom wrapper stand in for the levels between Everything and each
// parent, so the stale-child prune only judges real taxonomy edges.
const liveShapedMap = () => buildMap(
  ['Root', [
    ['Neuroscience levels', [
      ['Functional Roles|PFC-Limbic', [
        ['Emotional Regulation', [
          ['Emotional Awareness and Identification'],
          ['Mindfulness', [builtIn('Equanimity Cultivation')]],
          ['Cognitive Behavioral Therapy (CBT)'],
          ['Strong Healthy Relationships', [], { notes: [{ id: 'note-a', text: 'from neuroscience copy', level: 0 }] }],
        ]],
        ['Decision-Making'],
      ]],
      ['Cognition', [['Intelligence'], ['Emotional Regulation']]],
    ], { isCustom: true }],
    ['Psychology', [
      ['Cognitive Psychology', [
        ['Cognition', [
          ['Intelligence'],
          ['Emotional Regulation', [
            ['Emotional Awareness and Identification'],
            ['Mindfulness', [['Equanimity Cultivation', [['Detachment from Outcomes']]]]],
            ['Strong Healthy Relationships'],
            ['My Own Practice', [], { isCustom: true }],
          ]],
        ]],
      ]],
      ['Emotions', [['Components of Emotions'], ['Types of Emotions'], ['Pleasant'], ['Neutral'], ['Unpleasant']]],
      ['Positive Psychology', [
        ['Emotional Well-Being', [
          ['Negativity Bias'],
          builtIn('Emotional Regulation', { notes: [{ id: 'note-b', text: 'positive psychology copy', level: 0 }] }),
        ]],
      ]],
    ]],
  ]],
)

test('the taxonomy lists Emotional Regulation only under Emotions', () => {
  const parents = Object.entries(TOPIC_SUBDIVISIONS)
    .filter(([, children]) => children.includes('Emotional Regulation'))
    .map(([parent]) => parent)
  assert.deepEqual(parents, ['Emotions'])
  assert.ok(TOPIC_SUBDIVISIONS.Psychology.includes('Emotions'))
})

test('the built-in Emotional Regulation subtree keeps the richest copy', () => {
  const nodes = buildMap(builtIn('Emotional Regulation'))
  assert.equal(nodes.length - 1, 16)
  const labels = nodes.map((n) => n.label)
  for (const label of ['Cognitive Behavioral Therapy (CBT)', 'Dialectical Behavior Therapy (DBT)', 'Mindfulness', 'Equanimity Cultivation', 'Cold Plunge', 'Strong Healthy Relationships']) {
    assert.ok(labels.includes(label), label)
  }
  assert.equal(new Set(labels).size, labels.length)
})

test('migration leaves one Emotional Regulation under Psychology > Emotions with no orphans', () => {
  const before = liveShapedMap()
  const positiveCopy = before.find((n) => n.label === 'Emotional Regulation' && n.notes)
  const { nodes, changed } = normalize(before)

  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  const copies = nodes.filter((n) => n.label === 'Emotional Regulation')
  assert.equal(copies.length, 1)
  const [home] = copies
  assert.equal(pathOf(nodes, home), 'Root > Psychology > Emotions > Emotional Regulation')
  assert.equal(home.id, positiveCopy.id)
  assert.deepEqual(home.notes.map((n) => n.id), ['note-b'])

  const subtree = descendantsOf(nodes, home.id)
  const builtInSubtree = subtree.filter((n) => !n.isCustom)
  assert.equal(builtInSubtree.length, 16)
  assert.equal(new Set(subtree.map((n) => pathOf(nodes, n))).size, subtree.length)

  const custom = subtree.find((n) => n.label === 'My Own Practice')
  assert.equal(custom?.parentId, home.id)
  const relationships = subtree.find((n) => n.label === 'Strong Healthy Relationships')
  assert.deepEqual(relationships.notes.map((n) => n.id), ['note-a'])

  // The other three parents keep their remaining children and nothing else.
  for (const parent of nodes.filter((n) => ['Functional Roles|PFC-Limbic', 'Cognition', 'Emotional Well-Being'].includes(n.label))) {
    const childLabels = nodes.filter((n) => n.parentId === parent.id).map((n) => n.label)
    assert.ok(!childLabels.includes('Emotional Regulation'), pathOf(nodes, parent))
  }
  assert.equal(nodes.filter((n) => n.label === 'Equanimity Cultivation').length, 1)
  assert.equal(nodes.filter((n) => n.label === 'Cognitive Behavioral Therapy (CBT)').length, 1)
})

test('migration is idempotent', () => {
  const once = normalize(liveShapedMap()).nodes
  const twice = normalize(once)
  assert.equal(twice.changed, false)
  assert.deepEqual(twice.nodes, once)
})

test('a stored Emotions without Emotional Regulation gains one', () => {
  const before = buildMap(['Root', [['Psychology', [['Emotions', [['Components of Emotions'], ['Pleasant']]]]]]])
  const { nodes, changed } = normalize(before)
  assert.equal(changed, true)
  const added = nodes.find((n) => n.label === 'Emotional Regulation')
  assert.equal(pathOf(nodes, added), 'Root > Psychology > Emotions > Emotional Regulation')
  assert.ok(added.id > Math.max(...before.map((n) => n.id)))
})

test('moving the kept copy into an unexpanded Emotions adds its other built-in children', () => {
  const before = buildMap(['Root', [
    ['Psychology', [
      ['Emotions', [], { excludedChildLabels: ['Neutral'] }],
      ['Positive Psychology', [['Emotional Well-Being', [builtIn('Emotional Regulation')]]]],
    ]],
  ]])
  const { nodes, changed } = normalize(before)
  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  const emotions = nodes.find((n) => n.label === 'Emotions')
  const childLabels = nodes.filter((n) => n.parentId === emotions.id).map((n) => n.label).sort()
  const expected = [...TOPIC_SUBDIVISIONS.Emotions].filter((l) => l !== 'Neutral').sort()
  assert.deepEqual(childLabels, expected)
  assert.equal(nodes.filter((n) => n.label === 'Emotional Regulation').length, 1)
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length)

  const again = normalize(nodes)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

test('an unexpanded Emotions and Personal copies are left alone', () => {
  const before = buildMap(['Root', [
    ['Psychology', [['Emotions']]],
    ['Personal', [['Emotional Regulation', [], { isPersonal: true }]], { isPersonal: true }],
  ]])
  const { nodes, changed } = applyStructuralMigrations(before)
  assert.equal(changed, false)
  assert.deepEqual(nodes, before)
})

test('the taxonomy lists Emotions only under Psychology', () => {
  const parents = Object.entries(TOPIC_SUBDIVISIONS)
    .filter(([, children]) => children.includes('Emotions'))
    .map(([parent]) => parent)
  assert.deepEqual(parents, ['Psychology'])
  assert.ok(TOPIC_SUBDIVISIONS['Affective Psychology'].length > 0)
})

// The live map's two Emotions: Psychology > Emotions (with a custom Neutral)
// and the Cognitive Psychology > Affective Psychology copy.
const emotionsMap = () => buildMap(
  ['Root', [
    ['Psychology', [
      ['Cognitive Psychology', [
        ['Affective Psychology', [
          ['Emotions', [
            ...builtIn('Emotions')[1],
            ['Awe', [], { isCustom: true, notes: [{ id: 'note-awe', text: 'only in affective copy', level: 0 }] }],
          ], { notes: [{ id: 'note-emotions', text: 'affective copy note', level: 0 }] }],
          ['Moods'],
          ['Positive And Negative Affect Schedule (PANAS)'],
        ]],
      ]],
      ['Emotions', [
        ['Components of Emotions'],
        ['Types of Emotions'],
        ['Pleasant'],
        ['Neutral', [['Ambivalent'], ['Melancholy']], { isCustom: true }],
        ['Unpleasant'],
      ]],
    ]],
  ]],
)

const fakeSummary = (label) => (label === 'Neutral' ? 'Built-in Neutral summary.' : '')

test('migration keeps Psychology > Emotions as the only Emotions and merges the Affective copy', () => {
  const before = emotionsMap()
  const kept = before.find((n) => n.label === 'Emotions' && before.find((p) => p.id === n.parentId).label === 'Psychology')
  const structural = applyStructuralMigrations(before, fakeSummary)
  const { nodes } = removeStalePredefinedChildren(structural.nodes, TOPIC_SUBDIVISIONS)

  assert.equal(structural.changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  const emotions = nodes.filter((n) => n.label === 'Emotions')
  assert.equal(emotions.length, 1)
  assert.equal(emotions[0].id, kept.id)
  assert.equal(pathOf(nodes, emotions[0]), 'Root > Psychology > Emotions')
  assert.deepEqual(emotions[0].notes.map((n) => n.id), ['note-emotions'])

  const byPath = new Map(nodes.map((n) => [pathOf(nodes, n), n]))
  assert.equal(byPath.size, nodes.length)
  assert.deepEqual(byPath.get('Root > Psychology > Emotions > Awe')?.notes.map((n) => n.id), ['note-awe'])
  const neutral = byPath.get('Root > Psychology > Emotions > Neutral')
  assert.equal(neutral.isCustom, true)
  assert.equal(neutral.summary, 'Built-in Neutral summary.')
  for (const label of TOPIC_SUBDIVISIONS.Neutral) {
    assert.ok(byPath.has(`Root > Psychology > Emotions > Neutral > ${label}`), label)
  }
  assert.ok(byPath.has('Root > Psychology > Emotions > Emotional Regulation > Mindfulness > Equanimity Cultivation'))

  const affective = byPath.get('Root > Psychology > Cognitive Psychology > Affective Psychology')
  assert.deepEqual(
    nodes.filter((n) => n.parentId === affective.id).map((n) => n.label).sort(),
    ['Moods', 'Positive And Negative Affect Schedule (PANAS)'],
  )

  const again = applyStructuralMigrations(nodes, fakeSummary)
  assert.equal(again.changed, false)
})
