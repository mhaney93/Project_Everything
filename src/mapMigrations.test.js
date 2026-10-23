import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { applyLabelMigrations, applyNodeEdits, applyStructuralMigrations, applySummaryMigrations, dropStaleChildren, LATEST_LABEL_MIGRATION_VERSION, NODE_EDITS_BY_VERSION, STRUCTURAL_MIGRATIONS_BY_VERSION, SUMMARY_MIGRATIONS_BY_VERSION, removeStalePredefinedChildren } from './mapMigrations.js'

// TOPIC_SUBDIVISIONS and generateSummary's summaries live inside the App
// component, so evaluate the object literals from the source.
const loadAppObject = (declaration, indent) => {
  const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
  const start = source.indexOf('{', source.indexOf(declaration))
  const close = `\n${indent}}\n`
  const end = source.indexOf(close, start)
  return vm.runInNewContext(`(${source.slice(start, end + close.length)})`)
}

const TOPIC_SUBDIVISIONS = loadAppObject('const TOPIC_SUBDIVISIONS = {', '  ')
const BUILT_IN_SUMMARIES = loadAppObject('const summaries = {', '    ')

const appSummary = (label) => BUILT_IN_SUMMARIES[label] || ''

const normalize = (mapNodes, builtInSummary = () => '') => {
  const structural = applyStructuralMigrations(mapNodes, builtInSummary, TOPIC_SUBDIVISIONS)
  const pruned = removeStalePredefinedChildren(structural.nodes, TOPIC_SUBDIVISIONS, builtInSummary)
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

const childLabelsOf = (mapNodes, node) => mapNodes.filter((n) => n.parentId === node.id).map((n) => n.label).sort()

test('the taxonomy lists the moved engineering branches only in their new homes', () => {
  const parentsOf = (label) => Object.entries(TOPIC_SUBDIVISIONS)
    .filter(([, children]) => children.includes(label))
    .map(([parent]) => parent)
  assert.deepEqual(parentsOf('Front-End Frameworks'), ['Frameworks'])
  assert.deepEqual(parentsOf('Python'), ['Object-Oriented'])
  assert.deepEqual(parentsOf('Node.js'), ['Runtime Environments'])
  assert.deepEqual(parentsOf('Asynchronous Operations'), ['Control Flow'])
  assert.equal(TOPIC_SUBDIVISIONS.PowerShell.length, 0)
  assert.ok(TOPIC_SUBDIVISIONS.JavaScript.includes('Control Flow'))
})

// The live map's misplaced engineering branches (2026-10-21 review): the
// front-end frameworks under Blockchain > DApps, Python and Node.js under
// PowerShell, and JavaScript's Asynchronous Operations under Solidity's custom
// Control Flow. Their homes are stored but empty. The custom wrappers stand in
// for the levels in between.
const inEngineering = (children) => ['Root', [['Applied Sciences', [['Engineering', children]]]]]

const engineeringMap = () => buildMap(
  inEngineering([
    ['Blockchain levels', [
      ['DApps (Decentralized Applications)', [
        ['Contract Interaction'],
        ['Deployment and Maintenance'],
        ['Front-End Frameworks', [
          ['Angular'],
          ['Bootstrap'],
          ['React', [
            ['Components|React'],
            ['Folder Structure|React'],
            ['React-related Packages'],
            ['react|pkg'],
            ['Syntax|React', [builtIn('.jsx'), ['.TSX|React']]],
            ['My React Hooks', [], { isCustom: true, summary: 'custom react summary' }],
          ], { notes: [{ id: 'note-react', text: 'react note', level: 0 }] }],
          ['Svelte'],
          ['Tailwind CSS'],
          ['Vue.js'],
        ], { notes: [{ id: 'note-fef', text: 'front-end note', level: 0 }] }],
        ['UI/UX Considerations'],
        ['Wallet Integration'],
        ['Web3 Libraries', [['ethers.js', [], { summary: 'stored ethers summary' }], ['web3.js']]],
      ]],
      ['Solidity levels', [
        ['Control Flow', [
          builtIn('Conditional Statements'),
          ['Loops', [
            ['For Loops', [['for (x i = 0; i < 10; i++) {\ny\n}', [['x', [], { isCustom: true, summary: 'loop variable' }]], { isCustom: true }]]],
            ['While Loops'],
            ['Do...While Loops'],
          ]],
          ['Error Handling', [['require', [], { isCustom: true }]], { isCustom: true, summary: 'solidity errors' }],
          ['Asynchronous Operations', [
            ['AJAX (Asynchronous JavaScript And XML)', [], { notes: [{ id: 'note-ajax', text: 'ajax note', level: 0 }] }],
            builtIn('Event Loop'),
            ['Promises', [], { isCustom: true }],
          ], { summary: 'stored async summary' }],
        ], { isCustom: true, summary: 'the set of statements inside a function body' }],
      ], { isCustom: true }],
    ], { isCustom: true }],
    ['Software Engineering', [
      ['Operating System (OS)', [
        ['Shells levels', [
          ['PowerShell', [
            ['Node.js'],
            ['Python', [
              ...TOPIC_SUBDIVISIONS.Python.filter((l) => l !== 'Loops (Python)|py').map((l) => [l]),
              builtIn('Loops (Python)|py'),
              ['Virtual Environments|py-notes', [], { isCustom: true, notes: [{ id: 'note-venv', text: 'venv note', level: 0 }] }],
            ], { summary: 'stored python summary', notes: [{ id: 'note-python', text: 'python note', level: 0 }] }],
          ]],
        ], { isCustom: true }],
      ]],
      ['Software Development/Programming', [
        ['Programming Languages', [
          ['Imperative Languages', [
            ['Object-Oriented', [
              ['Emojicode'],
              ['JavaScript', [['JS Keywords'], ['Control Flow'], ['Scope']]],
              ['Python'],
            ]],
          ]],
        ]],
        ['Packages', [['CLI Tools'], ['Frameworks'], ['HTTP'], ['Libraries'], ['Middleware'], ['View Engines']]],
        ['Runtime Environments'],
      ]],
    ]],
  ]),
)

const SOFTWARE_DEVELOPMENT = 'Root > Applied Sciences > Engineering > Software Engineering > Software Development/Programming'
const JAVASCRIPT = `${SOFTWARE_DEVELOPMENT} > Programming Languages > Imperative Languages > Object-Oriented > JavaScript`

test('migration moves Front-End Frameworks from DApps to Packages > Frameworks', () => {
  const before = engineeringMap()
  const original = before.find((n) => n.label === 'Front-End Frameworks')
  const { nodes, changed } = normalize(before)
  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length)

  const copies = nodes.filter((n) => n.label === 'Front-End Frameworks')
  assert.equal(copies.length, 1)
  const [fef] = copies
  assert.equal(fef.id, original.id)
  assert.equal(pathOf(nodes, fef), `${SOFTWARE_DEVELOPMENT} > Packages > Frameworks > Front-End Frameworks`)
  assert.deepEqual(fef.notes.map((n) => n.id), ['note-fef'])
  assert.deepEqual(childLabelsOf(nodes, fef), [...TOPIC_SUBDIVISIONS['Front-End Frameworks']].sort())

  // Only the moved node's place changes: every stored field of it and of each
  // descendant (labels, summaries, notes, custom flags) is kept as it was.
  const placement = (node) => Object.fromEntries(Object.entries(node).filter(([key]) => !['parentId', 'hidden', 'order'].includes(key)))
  assert.deepEqual(placement(fef), placement(original))
  assert.deepEqual(descendantsOf(nodes, fef.id), descendantsOf(before, original.id))

  // The whole React subtree, its note and its custom child came along.
  const originalReact = before.find((n) => n.label === 'React')
  const react = nodes.find((n) => n.label === 'React')
  assert.equal(react.parentId, fef.id)
  assert.deepEqual(react.notes.map((n) => n.id), ['note-react'])
  assert.equal(descendantsOf(nodes, react.id).length, descendantsOf(before, originalReact.id).length)
  assert.equal(nodes.find((n) => n.label === 'My React Hooks').summary, 'custom react summary')

  // Frameworks was never expanded, so it gains its other built-in children.
  const frameworks = nodes.find((n) => n.label === 'Frameworks')
  assert.deepEqual(childLabelsOf(nodes, frameworks), [...TOPIC_SUBDIVISIONS.Frameworks].sort())

  const dapps = nodes.find((n) => n.label === 'DApps (Decentralized Applications)')
  assert.deepEqual(childLabelsOf(nodes, dapps), [...TOPIC_SUBDIVISIONS['DApps (Decentralized Applications)']].sort())
  assert.equal(nodes.find((n) => n.label === 'ethers.js').summary, 'stored ethers summary')
})

test('Front-End Frameworks moves into Packages > Frameworks even when Packages was never expanded', () => {
  const before = buildMap(inEngineering([
    ['Blockchain levels', [
      ['DApps (Decentralized Applications)', [
        ['Contract Interaction'],
        ['Front-End Frameworks', [
          ['React', [['My React Hooks', [], { isCustom: true, summary: 'custom react summary' }]], { notes: [{ id: 'note-react', text: 'react note', level: 0 }] }],
          ['Vue.js'],
        ], { summary: 'stored fef summary', notes: [{ id: 'note-fef', text: 'front-end note', level: 0 }] }],
      ]],
    ], { isCustom: true }],
    ['Software Engineering', [
      ['Software Development/Programming', [['Packages'], ['Runtime Environments']]],
    ]],
  ]))
  const original = before.find((n) => n.label === 'Front-End Frameworks')
  const { nodes, changed } = normalize(before)
  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length)
  assert.ok(nodes.filter((n) => !before.some((b) => b.id === n.id)).every((n) => n.id > Math.max(...before.map((b) => b.id))))

  const [fef] = nodes.filter((n) => n.label === 'Front-End Frameworks')
  assert.equal(fef.id, original.id)
  assert.equal(pathOf(nodes, fef), `${SOFTWARE_DEVELOPMENT} > Packages > Frameworks > Front-End Frameworks`)
  assert.equal(fef.summary, 'stored fef summary')
  assert.deepEqual(fef.notes.map((n) => n.id), ['note-fef'])
  assert.deepEqual(descendantsOf(nodes, fef.id).map((n) => n.id).sort(), descendantsOf(before, original.id).map((n) => n.id).sort())
  assert.deepEqual(nodes.find((n) => n.label === 'React').notes.map((n) => n.id), ['note-react'])
  assert.equal(nodes.find((n) => n.label === 'My React Hooks').summary, 'custom react summary')

  const packages = nodes.find((n) => n.label === 'Packages')
  assert.deepEqual(childLabelsOf(nodes, packages), [...TOPIC_SUBDIVISIONS.Packages].sort())
  assert.ok(nodes.filter((n) => n.parentId === packages.id).every((n) => n.hidden === true))
  const frameworks = nodes.find((n) => n.label === 'Frameworks')
  assert.deepEqual(childLabelsOf(nodes, frameworks), [...TOPIC_SUBDIVISIONS.Frameworks].sort())
  assert.ok(nodes.filter((n) => n.parentId === frameworks.id).every((n) => n.hidden === true))

  const again = normalize(nodes)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

// Production map 1 (2026-10-21): DApps > Front-End Frameworks is stored under
// Computer Systems Engineering, but no Frameworks node exists, because Software
// Engineering was never expanded (or never stored at all).
test('Front-End Frameworks moves when no level below Engineering is stored on the Software Engineering side', () => {
  const dapps = ['DApps (Decentralized Applications)', [
    ['Contract Interaction'],
    ['Front-End Frameworks', [
      ['React', [['My React Hooks', [], { isCustom: true, summary: 'custom react summary' }]], { notes: [{ id: 'note-react', text: 'react note', level: 0 }] }],
      ['Vue.js'],
    ], { notes: [{ id: 'note-fef', text: 'front-end note', level: 0 }] }],
  ]]
  const computerSystems = ['Computer Systems Engineering', [['Blockchain levels', [dapps], { isCustom: true }]]]
  const shapes = {
    'Software Engineering unexpanded': [computerSystems, ['Software Engineering']],
    'Software Engineering not stored': [computerSystems, ['Civil Engineering']],
  }

  for (const [shape, engineering] of Object.entries(shapes)) {
    const before = buildMap(inEngineering(engineering))
    const original = before.find((n) => n.label === 'Front-End Frameworks')
    const { nodes, changed } = normalize(before)
    assert.equal(changed, true, shape)
    assert.deepEqual(orphansOf(nodes), [], shape)
    assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length, shape)

    const copies = nodes.filter((n) => n.label === 'Front-End Frameworks')
    assert.equal(copies.length, 1, shape)
    assert.equal(copies[0].id, original.id, shape)
    assert.equal(pathOf(nodes, copies[0]), `${SOFTWARE_DEVELOPMENT} > Packages > Frameworks > Front-End Frameworks`, shape)
    assert.deepEqual(copies[0].notes.map((n) => n.id), ['note-fef'], shape)
    assert.deepEqual(descendantsOf(nodes, original.id), descendantsOf(before, original.id), shape)

    // Each created level holds what expanding it would: its full built-in set.
    for (const label of ['Software Development/Programming', 'Packages', 'Frameworks']) {
      assert.deepEqual(childLabelsOf(nodes, nodes.find((n) => n.label === label)), [...TOPIC_SUBDIVISIONS[label]].sort(), `${shape}: ${label}`)
    }
    const softwareEngineering = nodes.find((n) => n.label === 'Software Engineering')
    const createdUnderSE = childLabelsOf(nodes, softwareEngineering)
    assert.ok(createdUnderSE.includes('Software Development/Programming'), shape)

    const again = normalize(nodes)
    assert.equal(again.changed, false, shape)
    assert.deepEqual(again.nodes, nodes, shape)
  }
})

// The stored chain from production map 1 down to DApps > Front-End Frameworks
// (pre-merge backup, 2026-10-21), with every stored child of each chain node.
// Software Engineering is stored but was never expanded.
test('production map 1 moves Front-End Frameworks under a newly created Packages > Frameworks', () => {
  const { nodes: before } = JSON.parse(readFileSync(new URL('./fixtures/map1-front-end-frameworks.json', import.meta.url), 'utf8'))
  const original = before.find((n) => n.label === 'Front-End Frameworks')
  const { nodes, changed } = normalize(before)
  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length)
  const maxBefore = Math.max(...before.map((n) => n.id))
  const created = nodes.filter((n) => !before.some((b) => b.id === n.id))
  assert.ok(created.every((n) => n.id > maxBefore && n.hidden === true && !n.isCustom))
  // Apart from the move, the map changes only by the stale-child prune it
  // already gets on main (Blockchain no longer lists Ethereum Virtual Machine).
  const prunedOnMain = removeStalePredefinedChildren(before, TOPIC_SUBDIVISIONS).nodes
  assert.deepEqual(
    nodes.filter((n) => !created.includes(n) && n.id !== original.id),
    prunedOnMain.filter((n) => n.id !== original.id),
  )

  const [fef] = nodes.filter((n) => n.label === 'Front-End Frameworks')
  assert.equal(fef.id, original.id)
  assert.equal(pathOf(nodes, fef), 'Everything > Sciences > Applied Sciences > Engineering > Software Engineering > Software Development/Programming > Packages > Frameworks > Front-End Frameworks')
  assert.deepEqual(descendantsOf(nodes, fef.id), descendantsOf(before, original.id))
  assert.equal(descendantsOf(nodes, fef.id).length, 20)

  for (const label of ['Software Engineering', 'Software Development/Programming', 'Packages', 'Frameworks']) {
    assert.deepEqual(childLabelsOf(nodes, nodes.find((n) => n.label === label)), [...TOPIC_SUBDIVISIONS[label]].sort(), label)
  }
  const dapps = nodes.find((n) => n.label === 'DApps (Decentralized Applications)')
  assert.deepEqual(childLabelsOf(nodes, dapps), [...TOPIC_SUBDIVISIONS['DApps (Decentralized Applications)']].sort())

  const again = normalize(nodes)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

test('Front-End Frameworks stays under DApps when the owner deleted a level of its home', () => {
  const dapps = ['DApps (Decentralized Applications)', [
    ['Contract Interaction'],
    ['Front-End Frameworks', [
      ['React', [['My React Hooks', [], { isCustom: true, summary: 'custom react summary' }]], { notes: [{ id: 'note-react', text: 'react note', level: 0 }] }],
    ], { summary: 'stored fef summary', notes: [{ id: 'note-fef', text: 'front-end note', level: 0 }] }],
  ]]
  const engineeringWithout = (excluded) => {
    const softwareEngineering = excluded === 'Software Engineering'
      ? []
      : [['Software Engineering', [['Software Development/Programming', [['Runtime Environments']], { excludedChildLabels: [excluded] }]]]]
    return buildMap(['Root', [['Applied Sciences', [
      ['Engineering', [['Computer Systems Engineering', [['Blockchain levels', [dapps], { isCustom: true }]]], ...softwareEngineering], { excludedChildLabels: excluded === 'Software Engineering' ? [excluded] : [] }],
    ]]]])
  }

  for (const excluded of ['Packages', 'Software Engineering']) {
    const before = engineeringWithout(excluded)
    const original = before.find((n) => n.label === 'Front-End Frameworks')
    const { nodes } = normalize(before)
    assert.deepEqual(orphansOf(nodes), [])
    const fef = nodes.find((n) => n.id === original.id)
    assert.equal(pathOf(nodes, fef), pathOf(before, original))
    assert.equal(fef.summary, 'stored fef summary')
    assert.deepEqual(fef.notes.map((n) => n.id), ['note-fef'])
    assert.deepEqual(descendantsOf(nodes, fef.id), descendantsOf(before, original.id))
    assert.equal(nodes.some((n) => n.label === excluded), false)

    const again = normalize(nodes)
    assert.equal(again.changed, false)
  }
})

test('migration merges PowerShell > Python into Object-Oriented > Python and deletes PowerShell > Node.js', () => {
  const before = engineeringMap()
  const home = before.find((n) => n.label === 'Python' && before.find((p) => p.id === n.parentId).label === 'Object-Oriented')
  const misplaced = before.find((n) => n.label === 'Python' && n.id !== home.id)
  const { nodes } = normalize(before)
  assert.deepEqual(orphansOf(nodes), [])

  const copies = nodes.filter((n) => n.label === 'Python')
  assert.equal(copies.length, 1)
  const [python] = copies
  assert.equal(python.id, home.id)
  assert.equal(pathOf(nodes, python), `${SOFTWARE_DEVELOPMENT} > Programming Languages > Imperative Languages > Object-Oriented > Python`)
  assert.equal(python.summary, 'stored python summary')
  assert.deepEqual(python.notes.map((n) => n.id), ['note-python'])
  assert.deepEqual(childLabelsOf(nodes, python), [...TOPIC_SUBDIVISIONS.Python, 'Virtual Environments|py-notes'].sort())
  assert.equal(descendantsOf(nodes, python.id).length, descendantsOf(before, misplaced.id).length)
  assert.deepEqual(nodes.find((n) => n.label === 'Virtual Environments|py-notes').notes.map((n) => n.id), ['note-venv'])

  const powerShell = nodes.find((n) => n.label === 'PowerShell')
  assert.deepEqual(childLabelsOf(nodes, powerShell), [])
  assert.equal(nodes.filter((n) => n.label === 'Node.js').length, 0)
  const runtimes = nodes.find((n) => n.label === 'Runtime Environments')
  assert.deepEqual(childLabelsOf(nodes, runtimes), [])
})

test('a PowerShell > Node.js holding owner content moves to Runtime Environments instead', () => {
  const before = buildMap(['Root', [
    ['Shells levels', [
      ['PowerShell', [
        ['Node.js', [['Flow|Node.js'], ['My Node Script', [], { isCustom: true }]], { notes: [{ id: 'note-node', text: 'node note', level: 0 }] }],
      ]],
    ], { isCustom: true }],
    ['Software Development/Programming', [['Runtime Environments', [['Web Browsers']]]]],
  ]])
  const { nodes, changed } = normalize(before)
  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  const copies = nodes.filter((n) => n.label === 'Node.js')
  assert.equal(copies.length, 1)
  assert.equal(pathOf(nodes, copies[0]), 'Root > Software Development/Programming > Runtime Environments > Node.js')
  assert.deepEqual(copies[0].notes.map((n) => n.id), ['note-node'])
  assert.ok(childLabelsOf(nodes, copies[0]).includes('My Node Script'))
  assert.deepEqual(childLabelsOf(nodes, nodes.find((n) => n.label === 'PowerShell')), [])
})

test('migration moves Asynchronous Operations from Solidity to JavaScript > Control Flow', () => {
  const before = engineeringMap()
  const original = before.find((n) => n.label === 'Asynchronous Operations')
  const { nodes } = normalize(before)
  assert.deepEqual(orphansOf(nodes), [])

  const copies = nodes.filter((n) => n.label === 'Asynchronous Operations')
  assert.equal(copies.length, 1)
  const [async] = copies
  assert.equal(async.id, original.id)
  assert.equal(pathOf(nodes, async), `${JAVASCRIPT} > Control Flow > Asynchronous Operations`)
  assert.equal(async.summary, 'stored async summary')
  assert.deepEqual(childLabelsOf(nodes, async), ['AJAX (Asynchronous JavaScript And XML)', 'Event Loop', 'Promises'])
  assert.deepEqual(nodes.find((n) => n.label === 'AJAX (Asynchronous JavaScript And XML)').notes.map((n) => n.id), ['note-ajax'])
  const eventLoop = nodes.find((n) => n.label === 'Event Loop')
  assert.deepEqual(childLabelsOf(nodes, eventLoop), [...TOPIC_SUBDIVISIONS['Event Loop']].sort())

  // JavaScript's Control Flow was never expanded, so it gains its other built-in children.
  const jsControlFlow = nodes.find((n) => n.id === async.parentId)
  assert.deepEqual(childLabelsOf(nodes, jsControlFlow), [...TOPIC_SUBDIVISIONS['Control Flow']].sort())

  // Solidity's Control Flow keeps its conditionals, loops and custom content.
  const solidityControlFlow = nodes.find((n) => n.label === 'Control Flow' && n.isCustom)
  assert.equal(solidityControlFlow.summary, 'the set of statements inside a function body')
  assert.deepEqual(childLabelsOf(nodes, solidityControlFlow), ['Conditional Statements', 'Error Handling', 'Loops'])
  const forLoop = nodes.find((n) => n.label === 'for (x i = 0; i < 10; i++) {\ny\n}')
  assert.equal(pathOf(nodes, forLoop), 'Root > Applied Sciences > Engineering > Blockchain levels > Solidity levels > Control Flow > Loops > For Loops > for (x i = 0; i < 10; i++) {\ny\n}')
  assert.equal(descendantsOf(nodes, solidityControlFlow.id).filter((n) => n.label === 'Conditional Statements').length, 1)
})

test('the engineering moves are idempotent', () => {
  const once = normalize(engineeringMap()).nodes
  const twice = normalize(once)
  assert.equal(twice.changed, false)
  assert.deepEqual(twice.nodes, once)
})

test('the built-in Memory Tricks summary matches the stored-summary fix', () => {
  const [{ label, from, to }] = SUMMARY_MIGRATIONS_BY_VERSION[4]
  assert.equal(label, 'Memory Tricks')
  assert.equal(BUILT_IN_SUMMARIES['Memory Tricks'], to)
  assert.equal(to, from.replace(/\.$/, ' (sharp!).'))
})

test('summary migration fixes only the stored Memory Tricks summary that still has the old text', () => {
  const oldText = 'Mnemonics for the V of each key: Car→Gas, Data→Analysis, Eyes→Blink, Fire→Coal, Garden→Dirt, Artist→Easel, Bitch→Fuck.'
  const notes = [{ id: 'note-music', text: 'music note', level: 0 }]
  const before = buildMap(['Root', [
    ['Tension', [
      ['Memory Tricks', [], { summary: oldText, notes }],
      ['Dominant Chords by Key', [], { summary: oldText }],
    ]],
    ['Other Tension', [['Memory Tricks', [], { summary: 'my own mnemonic' }], ['Memory Tricks']], { isCustom: true }],
  ]])
  const { nodes, changed } = applySummaryMigrations(before)
  assert.equal(changed, true)
  const [fixed, edited, unset] = nodes.filter((n) => n.label === 'Memory Tricks')
  assert.equal(fixed.summary, 'Mnemonics for the V of each key: Car→Gas, Data→Analysis, Eyes→Blink, Fire→Coal, Garden→Dirt, Artist→Easel, Bitch→Fuck (sharp!).')
  assert.equal(fixed.notes, notes)
  assert.equal(edited.summary, 'my own mnemonic')
  assert.equal('summary' in unset, false)
  assert.equal(nodes.find((n) => n.label === 'Dominant Chords by Key').summary, oldText)
  assert.deepEqual(nodes.filter((n) => n.label !== 'Memory Tricks'), before.filter((n) => n.label !== 'Memory Tricks'))

  const again = applySummaryMigrations(nodes)
  assert.equal(again.changed, false)
  assert.equal(again.nodes, nodes)
})

test('summary migration rewrites stored copies of the reworded built-in summaries only while they hold the old text', () => {
  const changes = SUMMARY_MIGRATIONS_BY_VERSION[5]
  assert.deepEqual(changes.map((c) => c.label).sort(), ['Combinations of Combinations', 'Combinations|Jungian', 'Pharmacology|5-MeO-DMT', 'Pharmacology|DMT', 'Results|PANAS'])
  const before = buildMap(['Root', changes.flatMap(({ label, from }) => [
    [label, [], { summary: from }],
    [label, [], { summary: `${from} My edit.`, isCustom: true }],
  ])])
  const { nodes, changed } = applySummaryMigrations(before)
  assert.equal(changed, true)
  for (const { label, from, to } of changes) {
    const [exact, edited] = nodes.filter((n) => n.label === label)
    assert.equal(to, BUILT_IN_SUMMARIES[label])
    assert.equal(exact.summary, to)
    assert.equal(edited.summary, `${from} My edit.`)
  }

  const again = applySummaryMigrations(nodes)
  assert.equal(again.changed, false)
  assert.equal(again.nodes, nodes)
})

test('the Jester drops stored Trickster built-in text but keeps an edited summary', () => {
  const trickster = 'An archetype embodying chaos, disruption, and the challenging of norms, often bringing about change through unconventional or subversive means.'
  const figures = (summary) => buildMap(['Root', [['Personality Psychology', [['Archetypes', [['Jungian Archetypes', [
    ['Universal Archetypal Figures/Patterns', [['The Trickster', [], { summary }]]],
  ]]]]]]]])
  const exact = normalize(figures(trickster), appSummary).nodes.find((n) => n.label === 'The Jester')
  assert.equal('summary' in exact, false)
  const edited = normalize(figures(`${trickster} Mine.`), appSummary).nodes.find((n) => n.label === 'The Jester')
  assert.equal(edited.summary, `${trickster} Mine.`)
})

const MARK_PEARSON = 'Mark & Pearson\'s 12 Archetypes'
const MARK_PEARSON_FIGURES = ['The Innocent', 'The Everyman', 'The Orphan', 'The Hero|Mark & Pearson', 'The Caregiver', 'The Explorer', 'The Rebel/Outlaw', 'The Lover', 'The Creator', 'The Jester', 'The Sage', 'The Magician', 'The Ruler']

test('the DMT and 5-MeO-DMT pharmacology summaries lead with the receptor mechanism', () => {
  assert.equal(BUILT_IN_SUMMARIES['Pharmacology|DMT'], 'Acts mainly as a serotonin 5-HT2A receptor agonist (also sigma-1 and trace-amine receptors). Speculative hypotheses also propose effects on neuronal microtubule order.')
  assert.equal(BUILT_IN_SUMMARIES['Pharmacology|5-MeO-DMT'], 'Acts mainly on serotonin 5-HT1A receptors, with 5-HT2A activity. A speculative hypothesis proposes it scrambles microtubule liquid-crystal order.')
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Pharmacology|DMT']], ['Microtubule Ordering Hypothesis'])
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Pharmacology|5-MeO-DMT']], ['Microtubule Scrambling Hypothesis'])
})

test('the taxonomy splits Personality Archetypes into Mark & Pearson and my combinations', () => {
  assert.deepEqual([...TOPIC_SUBDIVISIONS.Archetypes], [MARK_PEARSON, 'My Archetype Combinations'])
  assert.deepEqual([...TOPIC_SUBDIVISIONS[MARK_PEARSON]], ['Universal Archetypal Figures/Patterns'])
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Universal Archetypal Figures/Patterns']].sort(), [...MARK_PEARSON_FIGURES].sort())
  assert.deepEqual([...TOPIC_SUBDIVISIONS['My Archetype Combinations']], ['The Healer', 'Combinations|Jungian', 'Combinations of Combinations'])
  assert.equal(TOPIC_SUBDIVISIONS['Jungian Archetypes'], undefined)
  assert.equal(BUILT_IN_SUMMARIES[MARK_PEARSON], 'Twelve story and brand archetypes from Margaret Mark and Carol S. Pearson (The Hero and the Outlaw, 2001).')
  assert.equal(BUILT_IN_SUMMARIES['My Archetype Combinations'], 'My own combinations of archetypes.')
  for (const label of [...MARK_PEARSON_FIGURES, ...TOPIC_SUBDIVISIONS['My Archetype Combinations']]) {
    assert.ok(BUILT_IN_SUMMARIES[label], label)
  }
})

const JUNGIAN_SUMMARY_WITH_POINTER = 'Universal, inherited patterns of thought and imagery residing in the collective unconscious, influencing human behavior and cultural expressions as described by Carl Jung.  See: Jung\'s Analytical Psychology under Depth Psychology.'

// The live map's two archetype trees (2026-10-21 review): the built-in
// Personality Psychology copy, stored down to its combinations, and the
// owner's Jung tree under Depth Psychology.
const archetypesMap = ({ figureExtras = {}, withJungTree = true } = {}) => buildMap(
  ['Root', [
    ['Psychology', [
      ['Personality Psychology', [
        ['Personality Theory'],
        ['Archetypes', [
          ['Jungian Archetypes', [
            ['Universal Archetypal Figures/Patterns', [
              ['The Child', [], figureExtras['The Child']],
              ['The Creator', [['The Artist', [['The Poet']]]]],
              ['The Everyman'],
              ['The Explorer'],
              ['The Great Mother', [], figureExtras['The Great Mother']],
              ['The Healer', [], { notes: [{ id: 'note-healer', text: 'my healer', level: 0 }] }],
              ['The Hero'],
              ['The Innocent'],
              ['The Lover'],
              ['The Orphan'],
              ['The Rebel/Outlaw'],
              ['The Trickster', [], { summary: 'My own trickster words.' }],
              ['The Wise Old Man/Sage'],
            ]],
            ['Combinations|Jungian', [
              ['The Great Mother and The Innocent and The Self', [['The Caregiver']]],
              ['The Wise Old Man and The Hero'],
            ]],
            ['Combinations of Combinations', [
              ['The Creator and The Magician', [['The Mad Scientist']]],
              ['The Healer and The Magician'],
              ['The Innocent and The Caregiver and The Lover'],
              ['The Ruler and The Wise Old Man'],
            ]],
          ], { summary: JUNGIAN_SUMMARY_WITH_POINTER, excludedChildLabels: ['The Archetypes of Orientation'] }],
        ]],
      ]],
      ...(withJungTree ? [['Collective Unconscious', [
        ['Jungian Archetypes', [
          ['Situational Archetypes/Motifs', [
            ['Archetypal Figures', [
              ['The Child', [], { isCustom: true, summary: 'Jung tree child.' }],
              ['The Great Mother', [], { isCustom: true, summary: 'Jung tree mother.' }],
              ['The Trickster', [], { isCustom: true, summary: 'Jung tree trickster.' }],
            ], { isCustom: true }],
          ], { isCustom: true }],
        ], { isCustom: true, summary: 'Jung tree archetypes.' }],
      ], { isCustom: true }]] : []),
    ], { excludedChildLabels: ['Emotions'] }],
  ]],
)


test('archetype migration keeps Mark & Pearson figures and moves my combinations to their own node', () => {
  const before = archetypesMap()
  const byLabelPath = (mapNodes) => new Map(mapNodes.map((n) => [pathOf(mapNodes, n), n]))
  const old = byLabelPath(before)
  const P = 'Root > Psychology > Personality Psychology > Archetypes'
  const { nodes, changed } = normalize(before, appSummary)
  const now = byLabelPath(nodes)

  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(now.size, nodes.length)
  assert.deepEqual(childLabelsOf(nodes, now.get(P)), [MARK_PEARSON, 'My Archetype Combinations'])

  const markPearson = now.get(`${P} > ${MARK_PEARSON}`)
  assert.equal(markPearson.id, old.get(`${P} > Jungian Archetypes`).id)
  assert.equal(markPearson.summary, undefined)
  assert.deepEqual(markPearson.excludedChildLabels, ['The Archetypes of Orientation'])
  assert.deepEqual(childLabelsOf(nodes, markPearson), ['Universal Archetypal Figures/Patterns'])

  const figures = now.get(`${P} > ${MARK_PEARSON} > Universal Archetypal Figures/Patterns`)
  assert.deepEqual(childLabelsOf(nodes, figures), [...MARK_PEARSON_FIGURES].sort())
  const oldFigures = `${P} > Jungian Archetypes > Universal Archetypal Figures/Patterns`
  const jester = now.get(`${figures && pathOf(nodes, figures)} > The Jester`)
  assert.equal(jester.id, old.get(`${oldFigures} > The Trickster`).id)
  assert.equal(jester.summary, 'My own trickster words.')
  assert.equal(now.get(`${pathOf(nodes, figures)} > The Sage`).id, old.get(`${oldFigures} > The Wise Old Man/Sage`).id)
  assert.equal(now.get(`${pathOf(nodes, figures)} > The Creator > The Artist > The Poet`).id, old.get(`${oldFigures} > The Creator > The Artist > The Poet`).id)

  const combinations = now.get(`${P} > My Archetype Combinations`)
  assert.deepEqual(childLabelsOf(nodes, combinations), ['Combinations of Combinations', 'Combinations|Jungian', 'The Healer'])
  // Every node of my combinations keeps its id, label, notes and subtree.
  for (const [path, node] of old) {
    const moved = path
      .replace(`${P} > Jungian Archetypes > Universal Archetypal Figures/Patterns > The Healer`, `${P} > My Archetype Combinations > The Healer`)
      .replace(`${P} > Jungian Archetypes > Combinations`, `${P} > My Archetype Combinations > Combinations`)
    if (moved === path) continue
    const after = now.get(moved)
    assert.equal(after?.id, node.id, moved)
    assert.deepEqual(after.notes, node.notes)
  }

  // The Jungian-only figures stay in the Jung tree alone. Each keeps its own
  // summary and gains the built-in text the removed copy showed as a note.
  const jungFigures = 'Root > Psychology > Collective Unconscious > Jungian Archetypes > Situational Archetypes/Motifs > Archetypal Figures'
  for (const label of ['The Child', 'The Great Mother']) {
    const source = old.get(`${oldFigures} > ${label}`)
    assert.deepEqual(now.get(`${jungFigures} > ${label}`), {
      ...old.get(`${jungFigures} > ${label}`),
      notes: [{
        id: `merged-summary-${source.id}`,
        text: `Merged from ${P} > ${MARK_PEARSON} > Universal Archetypal Figures/Patterns > ${label}: ${BUILT_IN_SUMMARIES[label]}`,
        level: 0,
      }],
    })
  }
  assert.deepEqual(now.get(`${jungFigures} > The Trickster`), old.get(`${jungFigures} > The Trickster`))
  assert.equal(nodes.filter((n) => n.label === 'The Child' || n.label === 'The Great Mother').length, 2)

  // Only the two bare Jungian copies are gone; the three new figures and the
  // combinations node are the only additions.
  const ids = new Set(nodes.map((n) => n.id))
  const gone = before.filter((n) => !ids.has(n.id)).map((n) => pathOf(before, n)).sort()
  assert.deepEqual(gone, [`${oldFigures} > The Child`, `${oldFigures} > The Great Mother`])
  const beforeIds = new Set(before.map((n) => n.id))
  const added = nodes.filter((n) => !beforeIds.has(n.id)).map((n) => pathOf(nodes, n)).sort()
  assert.deepEqual(added, [
    `${P} > ${MARK_PEARSON} > Universal Archetypal Figures/Patterns > The Caregiver`,
    `${P} > ${MARK_PEARSON} > Universal Archetypal Figures/Patterns > The Magician`,
    `${P} > ${MARK_PEARSON} > Universal Archetypal Figures/Patterns > The Ruler`,
    `${P} > My Archetype Combinations`,
  ])

  const again = normalize(nodes, appSummary)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

test('a removed Jungian figure carries what the owner wrote into its Jung tree namesake', () => {
  const before = archetypesMap({
    figureExtras: {
      'The Child': { notes: [{ id: 'note-child', text: 'my child note', level: 0 }] },
    },
  })
  const custom = { id: Math.max(...before.map((n) => n.id)) + 1, label: 'Inner Child', parentId: before.find((n) => n.label === 'The Child' && !n.isCustom).id, hidden: false, isCustom: true }
  const { nodes } = normalize([...before, custom], appSummary)

  assert.deepEqual(orphansOf(nodes), [])
  const children = nodes.filter((n) => n.label === 'The Child')
  assert.equal(children.length, 1)
  const [jungChild] = children
  assert.equal(jungChild.isCustom, true)
  assert.equal(jungChild.summary, 'Jung tree child.')
  const source = before.find((n) => n.label === 'The Child' && !n.isCustom)
  assert.deepEqual(jungChild.notes.map((n) => n.id), ['note-child', `merged-summary-${source.id}`])
  assert.equal(nodes.find((n) => n.id === custom.id).parentId, jungChild.id)
})

test('a removed Jungian figure with its own summary leaves it as a note on the Jung tree namesake', () => {
  const before = archetypesMap({ figureExtras: { 'The Child': { summary: 'My Mark & Pearson child words.' } } })
  const source = before.find((n) => n.label === 'The Child' && !n.isCustom)
  const { nodes } = normalize(before, appSummary)

  const children = nodes.filter((n) => n.label === 'The Child')
  assert.equal(children.length, 1)
  assert.equal(children[0].summary, 'Jung tree child.')
  assert.deepEqual(children[0].notes, [{
    id: `merged-summary-${source.id}`,
    text: `Merged from Root > Psychology > Personality Psychology > Archetypes > ${MARK_PEARSON} > Universal Archetypal Figures/Patterns > The Child: My Mark & Pearson child words.`,
    level: 0,
  }])

  const again = normalize(nodes, appSummary)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

const OLD_HERO_SUMMARY = 'An archetype representing the ego\'s journey of overcoming obstacles, achieving individuation, and integrating the Self.'
const OLD_SAGE_SUMMARY = 'An archetype representing wisdom, guidance, and spiritual insight, often appearing as a mentor or advisor figure.'
const OLD_FIGURES_SUMMARY = 'The recurring character types and narrative patterns that appear universally across myth, religion, and storytelling as expressions of the collective unconscious.'

test('Mark & Pearson figures drop stored Jungian built-in text but keep the Jung tree and owner words', () => {
  const before = buildMap(['Root', [['Psychology', [
    ['Personality Psychology', [['Archetypes', [['Jungian Archetypes', [
      ['Universal Archetypal Figures/Patterns', [
        ['The Hero', [['My Quest', [], { isCustom: true }]], { summary: OLD_HERO_SUMMARY, notes: [{ id: 'note-hero', text: 'my hero', level: 0 }] }],
        ['The Wise Old Man/Sage', [], { summary: OLD_SAGE_SUMMARY }],
        ['The Lover', [], { summary: 'My lover words.' }],
      ], { summary: OLD_FIGURES_SUMMARY }],
    ]]]]]],
    ['Collective Unconscious', [['The Hero', [], { isCustom: true, summary: OLD_HERO_SUMMARY }]], { isCustom: true }],
  ]]]])
  const old = new Map(before.map((n) => [n.id, n]))
  const { nodes, changed } = normalize(before, appSummary)
  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])

  const hero = nodes.find((n) => n.label === 'The Hero|Mark & Pearson')
  const oldHero = before.find((n) => n.label === 'The Hero' && !n.isCustom)
  assert.equal(hero.id, oldHero.id)
  assert.equal(hero.summary, undefined)
  assert.deepEqual(hero.notes, oldHero.notes)
  assert.deepEqual(childLabelsOf(nodes, hero), ['My Quest'])
  assert.ok(BUILT_IN_SUMMARIES['The Hero|Mark & Pearson'])
  assert.equal(BUILT_IN_SUMMARIES['The Hero'], OLD_HERO_SUMMARY)

  const jungHero = before.find((n) => n.label === 'The Hero' && n.isCustom)
  assert.deepEqual(nodes.find((n) => n.id === jungHero.id), jungHero)

  const sage = nodes.find((n) => n.label === 'The Sage')
  assert.equal(sage.summary, undefined)
  assert.equal(nodes.find((n) => n.label === 'Universal Archetypal Figures/Patterns').summary, undefined)
  const lover = nodes.find((n) => n.label === 'The Lover')
  assert.deepEqual(lover, old.get(lover.id))

  const again = normalize(nodes, appSummary)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

test('without a Jung tree a figure holding owner content stays as a custom node', () => {
  const before = archetypesMap({
    withJungTree: false,
    figureExtras: { 'The Child': { notes: [{ id: 'note-child', text: 'keep me', level: 0 }] } },
  })
  const summaries = { 'The Child': 'Built-in child summary.' }
  const structural = applyStructuralMigrations(before, (label) => summaries[label] || '', TOPIC_SUBDIVISIONS)
  const { nodes } = removeStalePredefinedChildren(structural.nodes, TOPIC_SUBDIVISIONS)

  const child = nodes.find((n) => n.label === 'The Child')
  assert.equal(child.isCustom, true)
  assert.equal(child.summary, 'Built-in child summary.')
  assert.deepEqual(child.notes.map((n) => n.id), ['note-child'])
  assert.match(pathOf(nodes, child), /Universal Archetypal Figures\/Patterns > The Child$/)
  assert.equal(nodes.some((n) => n.label === 'The Great Mother'), false)
})

test('an unexpanded Jungian Archetypes is renamed and gains a combinations sibling', () => {
  const before = buildMap(['Root', [['Personality Psychology', [
    ['Archetypes', [['Jungian Archetypes', [], { summary: 'My own words.' }]]],
  ]]]])
  const { nodes, changed } = normalize(before, appSummary)
  assert.equal(changed, true)
  const archetypes = nodes.find((n) => n.label === 'Archetypes')
  assert.deepEqual(childLabelsOf(nodes, archetypes), [MARK_PEARSON, 'My Archetype Combinations'])
  assert.equal(nodes.find((n) => n.label === MARK_PEARSON).summary, 'My own words.')
  assert.equal(nodes.length, before.length + 1)
  assert.equal(normalize(nodes, appSummary).changed, false)
})

test('archetype migration leaves Personal and custom copies alone', () => {
  const before = buildMap(['Root', [
    ['Personality Psychology', [['Archetypes']]],
    ['Personal', [
      ['Jungian Archetypes', [['The Trickster', [], { isPersonal: true }]], { isPersonal: true }],
    ], { isPersonal: true }],
    ['Notes', [['Archetypes', [['Jungian Archetypes', [], { isCustom: true }]], { isCustom: true }]], { isCustom: true }],
  ]])
  const { nodes, changed } = applyStructuralMigrations(before, () => '', TOPIC_SUBDIVISIONS)
  assert.equal(changed, false)
  assert.deepEqual(nodes, before)
})

const panasMap = () => buildMap(['Root', [['Positive And Negative Affect Schedule (PANAS)', [
  ['Positive Affect'],
  ['Negative Affect'],
  ['Results|PANAS', [
    ['Cheerleader Archetype', [['Good Emotional Regulation Skills']], { notes: [{ id: 'note-cheer', text: 'me?', level: 0 }] }],
    ['Judge/Surgeon Archetype'],
    ['Mad Scientist Archetype', [['High Potential for Emotional Intelligence'], ['Sensitive to Nuance'], ['Wide Emotional Range']]],
    ['Poet Archetype', [], { summary: 'My poet summary.' }],
  ]],
]]]])

test('PANAS profiles take the Archer & Garcia names and keep their nicknames, notes and children', () => {
  const renames = {
    'Cheerleader Archetype': 'Self-fulfilling (Cheerleader)',
    'Mad Scientist Archetype': 'High affective (Mad Scientist)',
    'Judge/Surgeon Archetype': 'Low affective (Judge/Surgeon)',
    'Poet Archetype': 'Self-destructive (Poet)',
  }
  const before = panasMap()
  const { nodes, changed } = normalize(before)
  assert.equal(changed, true)
  assert.equal(nodes.length, before.length)
  for (const node of before) {
    const after = nodes.find((n) => n.id === node.id)
    assert.deepEqual(after, { ...node, label: renames[node.label] || node.label })
  }
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Results|PANAS']].sort(), Object.values(renames).sort())
  assert.equal(BUILT_IN_SUMMARIES['Results|PANAS'], 'Archer & Garcia\'s four affective profiles, built from PANAS\'s two scores: high or low positive affect (PA) combined with high or low negative affect (NA).')
  for (const [label, combo] of [['Self-fulfilling (Cheerleader)', 'High PA + Low NA'], ['High affective (Mad Scientist)', 'High PA + High NA'], ['Low affective (Judge/Surgeon)', 'Low PA + Low NA'], ['Self-destructive (Poet)', 'Low PA + High NA']]) {
    assert.ok(BUILT_IN_SUMMARIES[label].startsWith(`${combo} profile:`), label)
  }
  assert.equal(normalize(nodes).changed, false)
})

test('consolidating a copy with a different summary keeps it as a note on the kept copy', () => {
  const before = buildMap(['Root', [['Psychology', [
    ['Emotions', [], { summary: 'Kept summary.', notes: [{ id: 'note-kept', text: 'kept', level: 0 }] }],
    ['Cognitive Psychology', [['Emotions', [], { summary: 'Copy summary.' }]]],
  ]]]])
  const copy = before.find((n) => n.label === 'Emotions' && n.summary === 'Copy summary.')
  const { nodes, changed } = applyStructuralMigrations(before, () => '', TOPIC_SUBDIVISIONS)

  assert.equal(changed, true)
  const emotions = nodes.filter((n) => n.label === 'Emotions')
  assert.equal(emotions.length, 1)
  assert.equal(emotions[0].summary, 'Kept summary.')
  assert.deepEqual(emotions[0].notes, [
    { id: 'note-kept', text: 'kept', level: 0 },
    { id: `merged-summary-${copy.id}`, text: 'Merged from Root > Psychology > Cognitive Psychology > Emotions: Copy summary.', level: 0 },
  ])

  const again = applyStructuralMigrations(nodes, () => '', TOPIC_SUBDIVISIONS)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

test('consolidating a copy with the same summary adds no note', () => {
  const before = buildMap(['Root', [['Psychology', [
    ['Emotions', [], { summary: 'Same.' }],
    ['Cognitive Psychology', [['Emotions', [], { summary: 'Same.' }]]],
  ]]]])
  const { nodes } = applyStructuralMigrations(before, () => '', TOPIC_SUBDIVISIONS)
  const emotions = nodes.filter((n) => n.label === 'Emotions')
  assert.equal(emotions.length, 1)
  assert.equal(emotions[0].summary, 'Same.')
  assert.equal(emotions[0].notes, undefined)
})

const rwandaMap = (coldWarCopyExtra = {}) => buildMap(['Contemporary Period (1945 - present)', [
  ['Cold War Era (1947 - 1991)', [
    ['Rwanda During the Cold War Era', [['Rwandan Genocide (1994)', [], coldWarCopyExtra]], { isCustom: true, summary: 'Cold War Rwanda.' }],
  ], { isCustom: true }],
  ['Post-Cold War Era (1991 - 2022)', [
    ['Rwanda During the Post-Cold War Era', [['Rwandan Genocide (1994)', [], { notes: [{ id: 'note-kept', text: 'kept', level: 0 }] }]], { isCustom: true, summary: 'Post-Cold War Rwanda.' }],
  ], { isCustom: true }],
]])

test('the Rwandan Genocide copy under the Cold War era is removed and the post-Cold War copy kept', () => {
  const before = rwandaMap()
  const [coldWarCopy, keptCopy] = before.filter((n) => n.label === 'Rwandan Genocide (1994)')
  const { nodes, changed } = normalize(before, appSummary)

  assert.equal(changed, true)
  assert.deepEqual(nodes, before.filter((n) => n.id !== coldWarCopy.id))
  assert.equal(pathOf(nodes, nodes.find((n) => n.id === keptCopy.id)), 'Contemporary Period (1945 - present) > Post-Cold War Era (1991 - 2022) > Rwanda During the Post-Cold War Era > Rwandan Genocide (1994)')
  assert.ok(nodes.some((n) => n.label === 'Rwanda During the Cold War Era'))
  assert.equal(normalize(nodes, appSummary).changed, false)
})

test('notes on the Cold War era Rwandan Genocide copy move to the post-Cold War copy', () => {
  const before = rwandaMap({ notes: [{ id: 'note-moved', text: 'moved', level: 0 }], summary: 'My own summary.' })
  const coldWarCopy = before.find((n) => n.label === 'Rwandan Genocide (1994)')
  const { nodes } = normalize(before, appSummary)

  const copies = nodes.filter((n) => n.label === 'Rwandan Genocide (1994)')
  assert.equal(copies.length, 1)
  assert.equal(copies[0].summary, 'My own summary.')
  assert.deepEqual(copies[0].notes, [
    { id: 'note-kept', text: 'kept', level: 0 },
    { id: 'note-moved', text: 'moved', level: 0 },
  ])
  assert.ok(!nodes.some((n) => n.id === coldWarCopy.id))
})

test('the built-in Rwanda (1962 - present) keeps its Rwandan Genocide child', () => {
  const before = buildMap(builtIn('Rwanda (1962 - present)'))
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Rwanda (1962 - present)']], ['Rwandan Genocide (1994)'])
  assert.equal(normalize(before, appSummary).changed, false)
})

const relabel = (mapNodes) => applyLabelMigrations(mapNodes, TOPIC_SUBDIVISIONS)

test('history labels take corrected dates and keep their summaries, notes and children', () => {
  const notes = [{ id: 'note-trump', text: 'mine', level: 0 }]
  const lateAntiquitySummary = 'Significantly shaped post-Roman Europe through the consolidation and development of Germanic kingdoms during the late antique period.'
  const carolingianSummary = 'Reflects the consolidation of previously established Germanic kingdoms and the foundational developments leading to the Carolingian Empire.'
  const before = buildMap(['Root', [
    ['Early Middle Ages (476 - 1000)', [
      ['Late Antiquity (500 - 750)', [['Migration Period (500 - 750)', [], { summary: lateAntiquitySummary }]]],
      ['Migration Period (750 - 800)', [['My Carolingian note', [], { isCustom: true }]], { summary: carolingianSummary }],
      ['Carolingian Era (800 - 887)'],
      ['Post-Carolingian Era (887 - 1000)'],
    ]],
    ['America During the Post-Cold War Era', [
      ['First Trump Presidency (2016 - 2020)', [['Tax Cuts', [], { isCustom: true }]], { isCustom: true, summary: 'My summary.', notes }],
    ], { isCustom: true }],
  ]])
  const renames = {
    'First Trump Presidency (2016 - 2020)': 'First Trump Presidency (2017 - 2021)',
    'Migration Period (500 - 750)': 'Migration Period (c. 375 - 568)',
    'Migration Period (750 - 800)': 'Rise of the Carolingians (750 - 800)',
  }
  const { nodes } = normalize(relabel(before).nodes, appSummary)

  assert.equal(nodes.length, before.length)
  for (const node of before.slice(1)) assert.deepEqual(nodes.find((n) => n.id === node.id), { ...node, label: renames[node.label] || node.label })
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Early Middle Ages (476 - 1000)']], ['Late Antiquity (500 - 750)', 'Rise of the Carolingians (750 - 800)', 'Carolingian Era (800 - 887)', 'Post-Carolingian Era (887 - 1000)'])
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Late Antiquity (500 - 750)']], ['Migration Period (c. 375 - 568)'])
  assert.equal(BUILT_IN_SUMMARIES['Migration Period (c. 375 - 568)'], lateAntiquitySummary)
  assert.equal(BUILT_IN_SUMMARIES['Rise of the Carolingians (750 - 800)'], carolingianSummary)
  for (const label of ['Migration Period (500 - 750)', 'Migration Period (750 - 800)']) {
    assert.equal(label in TOPIC_SUBDIVISIONS, false)
    assert.equal(label in BUILT_IN_SUMMARIES, false)
  }
  assert.equal(relabel(nodes).changed, false)
})

test('Operation Northwoods credits the Joint Chiefs and rewrites only an unedited stored summary', () => {
  const [{ label, from, to }] = SUMMARY_MIGRATIONS_BY_VERSION[6]
  assert.equal(label, 'Operation Northwoods (1962)')
  assert.equal(BUILT_IN_SUMMARIES[label], to)
  assert.equal(to, 'A March 1962 Joint Chiefs of Staff proposal, part of the Operation Mongoose anti-Castro planning, to stage false-flag attacks and blame them on Cuba to justify a U.S. invasion; rejected by the Kennedy administration.')
  const notes = [{ id: 'note-northwoods', text: 'mine', level: 0 }]
  const before = buildMap(['Root', [[label, [], { summary: from, notes }], [label, [], { summary: `${from} Mine.` }], [label]]])
  const { nodes, changed } = applySummaryMigrations(before)
  assert.equal(changed, true)
  const [exact, edited, unset] = nodes.filter((n) => n.label === label)
  assert.equal(exact.summary, to)
  assert.equal(exact.notes, notes)
  assert.equal(edited.summary, `${from} Mine.`)
  assert.equal('summary' in unset, false)
  assert.equal(applySummaryMigrations(nodes).changed, false)
})

const MIGRATION_PERIOD = 'Migration Period (c. 375 - 568)'
const MEDIEVAL_MIGRATION_PERIOD = `History > Medieval Period (476 - 1453) > Early Middle Ages (476 - 1000) > Late Antiquity (500 - 750) > ${MIGRATION_PERIOD}`
const ANCIENT_MIGRATION_PERIOD = 'History > Ancient History (3,200 BC - 476 AD) > Late Antiquity (250 - 500 AD) > Migration Period (300 - 500 AD)'
const ANCIENT_MIGRATION_PERIOD_SUMMARY = 'Characterized by significant movements of various peoples, primarily Germanic tribes, leading to widespread upheaval, the decline of the Western Roman Empire, and the emergence of new political entities across Europe.'

const historyWithAncientMigrationPeriod = (ancientCopy, medieval = [builtIn('Medieval Period (476 - 1453)')]) => buildMap(['History', [
  ['Ancient History (3,200 BC - 476 AD)', [
    ['Late Antiquity (250 - 500 AD)', [ancientCopy]],
  ]],
  ...medieval,
]])

const mergedSummaryNote = (mapNodes, text) => ({
  id: `merged-summary-${mapNodes.find((n) => n.label === 'Migration Period (300 - 500 AD)').id}`,
  text: `Merged from ${ANCIENT_MIGRATION_PERIOD}: ${text}`,
  level: 0,
})

test('the ancient Migration Period merges into the medieval one, keeping its summary, notes and children', () => {
  const ancientSummary = 'Movements of Germanic peoples.'
  const before = historyWithAncientMigrationPeriod(['Migration Period (300 - 500 AD)', [['Goths', [], { isCustom: true }]], {
    summary: ancientSummary,
    notes: [{ id: 'note-ancient', text: 'mine', level: 0 }],
  }]).map((n) => (n.label === MIGRATION_PERIOD ? { ...n, summary: 'My medieval summary.' } : n))
  const { nodes, changed } = normalize(before, appSummary)

  assert.equal(changed, true)
  assert.ok(!nodes.some((n) => n.label === 'Migration Period (300 - 500 AD)'))
  const kept = nodes.filter((n) => n.label === MIGRATION_PERIOD)
  assert.equal(kept.length, 1)
  assert.equal(pathOf(nodes, kept[0]), MEDIEVAL_MIGRATION_PERIOD)
  assert.equal(kept[0].summary, 'My medieval summary.')
  assert.deepEqual(kept[0].notes, [
    { id: 'note-ancient', text: 'mine', level: 0 },
    mergedSummaryNote(before, ancientSummary),
  ])
  assert.equal(pathOf(nodes, nodes.find((n) => n.label === 'Goths')), `${MEDIEVAL_MIGRATION_PERIOD} > Goths`)
  for (const label of ['Late Antiquity (250 - 500 AD)', 'Late Antiquity (500 - 750)']) assert.equal(nodes.filter((n) => n.label === label).length, 1)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(normalize(nodes, appSummary).changed, false)
})

test('a bare ancient Migration Period leaves its retired built-in summary as a note on the medieval one', () => {
  const before = historyWithAncientMigrationPeriod(['Migration Period (300 - 500 AD)'])
  const kept = before.find((n) => n.label === MIGRATION_PERIOD)
  const { nodes, changed } = normalize(before, appSummary)

  assert.equal(changed, true)
  assert.deepEqual(nodes, before
    .filter((n) => n.label !== 'Migration Period (300 - 500 AD)')
    .map((n) => (n.id === kept.id ? { ...n, notes: [mergedSummaryNote(before, ANCIENT_MIGRATION_PERIOD_SUMMARY)] } : n)))
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Late Antiquity (250 - 500 AD)']], [])
  assert.equal('Migration Period (300 - 500 AD)' in TOPIC_SUBDIVISIONS, false)
  assert.equal('Migration Period (300 - 500 AD)' in BUILT_IN_SUMMARIES, false)
  assert.equal(normalize(nodes, appSummary).changed, false)
})

test('the ancient Migration Period merges into a medieval branch that is not stored yet', () => {
  for (const extra of [{}, { notes: [{ id: 'note-ancient', text: 'mine', level: 0 }] }]) {
    const before = historyWithAncientMigrationPeriod(['Migration Period (300 - 500 AD)', [], extra], [])
    const { nodes, changed } = normalize(before, appSummary)

    assert.equal(changed, true)
    assert.ok(!nodes.some((n) => n.label === 'Migration Period (300 - 500 AD)'))
    const kept = nodes.filter((n) => n.label === MIGRATION_PERIOD)
    assert.equal(kept.length, 1)
    assert.equal(pathOf(nodes, kept[0]), MEDIEVAL_MIGRATION_PERIOD)
    assert.deepEqual(kept[0].notes, [...(extra.notes || []), mergedSummaryNote(before, ANCIENT_MIGRATION_PERIOD_SUMMARY)])
    assert.ok(nodes.some((n) => n.label === 'Late Antiquity (250 - 500 AD)'))
    assert.deepEqual(orphansOf(nodes), [])
    assert.equal(normalize(nodes, appSummary).changed, false)
  }
})

// Production map 7 (admin map backup, 2026-10-21): 32 nodes whose parents
// 515, 516, 1271-1275 and 1510 are no longer stored, plus the chains to their
// homes. Notes and the Personal branch are left out of the fixture.
const map7Orphans = () => JSON.parse(readFileSync(new URL('./fixtures/map7-orphans.json', import.meta.url), 'utf8')).nodes

const reachableFrom = (mapNodes) => {
  const ids = new Set()
  const stack = mapNodes.filter((n) => n.parentId === null).map((n) => n.id)
  while (stack.length > 0) {
    const id = stack.pop()
    ids.add(id)
    for (const child of mapNodes.filter((n) => n.parentId === id)) stack.push(child.id)
  }
  return mapNodes.filter((n) => ids.has(n.id))
}

test('production map 7 puts every orphan back in the tree without losing a summary', () => {
  const before = map7Orphans()
  const byId = new Map(before.map((n) => [n.id, n]))
  assert.equal(orphansOf(before).length, 28)
  assert.equal(before.length - reachableFrom(before).length, 32)

  const { nodes, changed } = normalize(before, appSummary)
  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(reachableFrom(nodes).length, nodes.length)
  const node = (id) => nodes.find((n) => n.id === id)
  const childrenOf = (id) => nodes.filter((n) => n.parentId === id).map((n) => n.id).sort((a, b) => a - b)

  // Visible copies without a summary take the hidden copy's; hidden copies go.
  for (const [hidden, visible] of [[517, 1811], [518, 1812], [519, 1813], [520, 1814], [521, 1815], [522, 1816], [1290, 1871], [1291, 1872], [1292, 1873], [1293, 1874]]) {
    assert.equal(byId.get(visible).summary, undefined)
    assert.equal(node(visible).summary, byId.get(hidden).summary, byId.get(hidden).label)
    assert.equal(node(visible).notes, undefined)
  }
  for (const id of [517, 518, 519, 520, 521, 522, 1276, 1284, 1277, 1278, 1279, 1280, 1281, 1282, 1283, 1288, 1289, 1290, 1291, 1292, 1293]) {
    assert.equal(node(id), undefined, byId.get(id).label)
  }

  // Unique content moves under its built-in parent, keeping its summary.
  assert.deepEqual(childrenOf(1787), [1268, 1269])
  assert.deepEqual(childrenOf(1812), [1285, 1286, 1287])
  // The hidden Mossad theory is not restored.
  assert.deepEqual(childrenOf(1816), [])
  assert.equal(nodes.some((n) => n.label === 'Mossad Killed Kennedy'), false)
  const aliyahs = nodes.filter((n) => n.label === 'Aliyahs (1882 - 1948)')
  assert.equal(aliyahs.length, 1)
  assert.equal(aliyahs[0].parentId, 1508)
  assert.equal(aliyahs[0].isCustom, undefined)
  // The slot between Balfour Declaration (0) and End of Ottoman Palestine (2).
  assert.equal(aliyahs[0].order, 1)
  assert.deepEqual(childrenOf(aliyahs[0].id), [1522, 1523, 1524, 1525, 1526, 1527])
  for (const id of [1268, 1269, 1285, 1286, 1287, 1522, 1523, 1524, 1525, 1526, 1527]) {
    assert.equal(node(id).summary, byId.get(id).summary)
    assert.equal(node(id).hidden, true)
    assert.equal(node(id).order, undefined)
  }

  // Inauguration and Dulles were refiled under 1961 with the same summaries.
  for (const [hidden, visible] of [[1288, 1808], [1289, 1809]]) {
    assert.equal(node(visible).summary, byId.get(hidden).summary)
  }

  // No hidden summary is lost, and nothing else changes.
  const shown = new Set(reachableFrom(nodes).map((n) => n.summary))
  for (const id of before.filter((n) => !reachableFrom(before).includes(n) && n.id !== 1284).map((n) => n.id)) {
    assert.ok(shown.has(byId.get(id).summary), byId.get(id).label)
  }
  const touched = new Set([1268, 1269, 1285, 1286, 1287, 1522, 1523, 1524, 1525, 1526, 1527, 1811, 1812, 1813, 1814, 1815, 1816, 1871, 1872, 1873, 1874])
  for (const n of reachableFrom(before)) {
    if (!touched.has(n.id)) assert.deepEqual(node(n.id), n, n.label)
  }

  const again = normalize(nodes, appSummary)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

const jfkMap = (namesakeExtra, orphans) => [
  ...buildMap(['Everything', [
    ['Assassination of President John F. Kennedy (1963)', [['Lee Harvey Oswald (1939 - 1963)', [], namesakeExtra]]],
  ]]),
  ...orphans,
]

test('an orphan never overwrites what the owner wrote on its namesake', () => {
  const before = jfkMap(
    { summary: 'My own words.', notes: [{ id: 'note-visible', text: 'mine', level: 0 }] },
    [
      { id: 100, label: 'Lee Harvey Oswald (1939 - 1963)', parentId: 99, hidden: true, summary: 'Old hidden words.', notes: [{ id: 'note-hidden', text: 'hidden', level: 0 }] },
      { id: 101, label: 'Oswald under Custody (1963)', parentId: 100, hidden: true, summary: 'Custody.' },
    ],
  )
  const { nodes } = normalize(before, appSummary)
  const oswald = nodes.find((n) => n.label === 'Lee Harvey Oswald (1939 - 1963)')
  assert.equal(nodes.filter((n) => n.label === oswald.label).length, 1)
  assert.equal(oswald.summary, 'My own words.')
  assert.deepEqual(oswald.notes.map((n) => n.id), ['note-visible', 'note-hidden', 'merged-summary-100'])
  assert.match(oswald.notes[2].text, /Old hidden words\.$/)
  assert.equal(nodes.find((n) => n.id === 101).parentId, oswald.id)
  assert.deepEqual(orphansOf(nodes), [])
})

test('an orphan with no home stays as stored unless it is bare; a Personal one stays', () => {
  const before = [
    ...buildMap(['Everything', [['Sciences']]]),
    { id: 50, label: 'Somewhere Unknown', parentId: 40, hidden: true, notes: [{ id: 'note-x', text: 'keep', level: 0 }] },
    { id: 51, label: 'Under It', parentId: 50, hidden: true },
    { id: 52, label: 'Nothing Here', parentId: 41, hidden: true },
    { id: 53, label: 'Custom Thing', parentId: 42, hidden: true, isCustom: true },
    { id: 54, label: 'Private', parentId: 43, hidden: true, isPersonal: true, summary: 'private' },
  ]
  const log = []
  const { nodes } = applyStructuralMigrations(before, appSummary, TOPIC_SUBDIVISIONS, log)
  assert.equal(nodes.length, before.length - 1)
  assert.equal(nodes.some((n) => n.id === 52), false)
  for (const id of [1, 2, 50, 51, 53, 54]) assert.deepEqual(nodes.find((n) => n.id === id), before.find((n) => n.id === id))
  assert.equal(log.length, 4)
  assert.ok(log.every((line) => !line.includes('Private')))

  const again = applyStructuralMigrations(nodes, appSummary, TOPIC_SUBDIVISIONS)
  assert.equal(again.changed, false)
  assert.deepEqual(again.nodes, nodes)
})

test('dropping a stale built-in child takes its whole subtree, never leaving orphans', () => {
  const before = buildMap(['Everything', [
    ['Sciences', [
      ['Retired Topic', [['Retired Child', [['Retired Grandchild', [], { summary: 'Stored built-in text.' }]]]], { summary: 'Old.' }],
      ['Owner Topic', [['Built-in Child', [['My Idea', [], { isCustom: true }]]]]],
      ['Noted Topic', [['Noted Child', [], { notes: [{ id: 'note-n', text: 'mine', level: 0 }] }]]],
      ['Natural Sciences'],
    ]],
  ]])
  const sciences = before.find((n) => n.label === 'Sciences')
  const stale = before.filter((n) => n.parentId === sciences.id && n.label !== 'Natural Sciences').map((n) => n.id)
  const builtInTexts = { 'Owner Topic': 'Built-in owner text.', 'Retired Topic': 'Old.', 'Retired Grandchild': 'Stored built-in text.' }
  const { nodes, changed } = dropStaleChildren(before, stale, (label) => builtInTexts[label] || '')

  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  assert.ok(!nodes.some((n) => n.label.startsWith('Retired')))
  const owner = nodes.find((n) => n.label === 'Owner Topic')
  assert.equal(owner.isCustom, true)
  assert.equal(owner.summary, 'Built-in owner text.')
  assert.ok(nodes.some((n) => n.label === 'My Idea' && n.parentId === nodes.find((m) => m.label === 'Built-in Child').id))
  const noted = nodes.find((n) => n.label === 'Noted Topic')
  assert.equal(noted.isCustom, true)
  assert.equal('summary' in noted, false)
  assert.equal(dropStaleChildren(nodes, [], () => '').changed, false)
})

test('the stale-child prune keeps a retired branch the owner wrote under, as a custom node', () => {
  const before = buildMap(['Everything', [
    ['Sciences', [
      ['Natural Sciences'],
      ['Physics', [['Mechanics', [], { notes: [{ id: 'note-m', text: 'mine', level: 0 }] }]], { summary: 'Stored built-in text.' }],
      ['Chemistry', [['Organic Chemistry', [], { summary: 'Stored built-in text.' }]]],
    ]],
  ]])
  assert.ok(!TOPIC_SUBDIVISIONS.Sciences.includes('Physics'))
  const builtInText = () => 'Stored built-in text.'
  const { nodes } = removeStalePredefinedChildren(before, TOPIC_SUBDIVISIONS, builtInText)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(nodes.find((n) => n.label === 'Physics').isCustom, true)
  assert.equal(nodes.find((n) => n.label === 'Mechanics').notes[0].id, 'note-m')
  assert.ok(!nodes.some((n) => n.label === 'Chemistry' || n.label === 'Organic Chemistry'))
  assert.equal(removeStalePredefinedChildren(nodes, TOPIC_SUBDIVISIONS, builtInText).changed, false)
})

test('the stale-child prune keeps a retired branch whose summary the owner edited, as a custom node', () => {
  const before = buildMap(['Everything', [
    ['Sciences', [
      ['Natural Sciences'],
      ['Chemistry', [['Organic Chemistry', [], { summary: 'My edited words.' }]], { summary: 'Stored built-in text.' }],
    ]],
  ]])
  assert.ok(!TOPIC_SUBDIVISIONS.Sciences.includes('Chemistry'))
  const builtInText = () => 'Stored built-in text.'
  const { nodes, changed } = removeStalePredefinedChildren(before, TOPIC_SUBDIVISIONS, builtInText)
  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  const chemistry = nodes.find((n) => n.label === 'Chemistry')
  assert.equal(chemistry.isCustom, true)
  assert.equal(chemistry.summary, 'Stored built-in text.')
  const organic = nodes.find((n) => n.label === 'Organic Chemistry')
  assert.equal(organic.parentId, chemistry.id)
  assert.equal(organic.summary, 'My edited words.')
  assert.equal(removeStalePredefinedChildren(nodes, TOPIC_SUBDIVISIONS, builtInText).changed, false)
})

test('Alternate Theories lists no built-in children, so expanding it adds no Mossad Killed Kennedy', () => {
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Alternate Theories']], [])
})

const ARCHIVED_MOSSAD = () => map7Orphans().find((n) => n.id === 1284)

test('a hidden Mossad Killed Kennedy holding only the archived or built-in text is deleted', () => {
  for (const summary of [ARCHIVED_MOSSAD().summary, appSummary('Mossad Killed Kennedy'), undefined]) {
    const before = [
      ...buildMap(['Everything', [['Alternate Theories']]]),
      { id: 90, label: 'Mossad Killed Kennedy', parentId: 89, hidden: true, summary },
    ]
    const { nodes } = applyStructuralMigrations(before, appSummary, TOPIC_SUBDIVISIONS)
    assert.equal(nodes.some((n) => n.label === 'Mossad Killed Kennedy'), false)
    assert.deepEqual(orphansOf(nodes), [])
  }
})

test('a hidden Mossad Killed Kennedy holding owner content is left untouched', () => {
  const variants = [
    [{ id: 90, label: 'Mossad Killed Kennedy', parentId: 89, hidden: true, summary: 'My own edited words.' }],
    [{ id: 90, label: 'Mossad Killed Kennedy', parentId: 89, hidden: true, notes: [{ id: 'note-m', text: 'mine', level: 0 }] }],
    [
      { id: 90, label: 'Mossad Killed Kennedy', parentId: 89, hidden: true },
      { id: 91, label: 'My Lead', parentId: 90, hidden: true, isCustom: true },
    ],
    [
      { id: 90, label: 'Mossad Killed Kennedy', parentId: 89, hidden: true },
      { id: 91, label: 'Private', parentId: 90, hidden: true, isPersonal: true },
    ],
  ]
  for (const hidden of variants) {
    const before = [...buildMap(['Everything', [['Alternate Theories']]]), ...hidden]
    const { nodes } = applyStructuralMigrations(before, appSummary, TOPIC_SUBDIVISIONS)
    for (const n of hidden) assert.deepEqual(nodes.find((m) => m.id === n.id), n)
  }
})

test('a reachable Mossad Killed Kennedy survives the full normalize', () => {
  for (const extra of [{}, { summary: ARCHIVED_MOSSAD().summary }, { summary: 'Mine.' }]) {
    const before = buildMap(['Root', [
      ['Assassination of President John F. Kennedy (1963)', [['Alternate Theories', [['Mossad Killed Kennedy', [], extra]]]]],
    ]])
    const { nodes, changed } = normalize(before, appSummary)
    assert.equal(changed, false)
    assert.deepEqual(nodes, before)
  }
})

const FINE_ARTS_SUMMARY = 'The visual and performing arts created primarily for aesthetic and expressive purposes, including film, painting, and sculpture.'

// Arts as stored in the live map (2026-10-21): Arts and Visual Arts expanded,
// Film under the Fine Arts wrapper and Video Games under Interactive Art, all
// collapsed. `fineArtsExtra` and `film` let a test vary those two nodes.
const artsMap = ({ fineArtsExtra = {}, film = builtIn('Film', { hidden: true }), videoGames = true } = {}) => {
  const hidden = (label, children = [], extra = {}) => [label, children, { hidden: true, ...extra }]
  return buildMap(['Root', [
    ['Humanities', [
      ['Arts', [
        ['Literature'],
        ['Visual Arts', [
          ...['Painting', 'Sculpture', 'Architecture', 'Photography', 'Installation Art'].map((label) => hidden(label)),
          hidden('Fine Arts', film ? [film] : [], fineArtsExtra),
          hidden('Digital Art', [
            ...['Digital Painting', 'Digital Sculpture', 'Virtual Reality Art', 'Generative Art'].map((label) => hidden(label)),
            hidden('Interactive Art', videoGames ? [builtIn('Video Games', { hidden: true })] : []),
          ]),
          ...['Graphic Design', 'Printmaking', 'Design Principles'].map((label) => hidden(label)),
        ]],
        ['Performing Arts'],
        ['Music'],
        ['Design'],
      ]],
    ]],
  ], { isCustom: true }])
}

const withHidden = (tuple) => [tuple[0], tuple[1].map(withHidden), { hidden: true, ...tuple[2] }]

test('the taxonomy files Film and Video Games under Arts > Media Arts', () => {
  assert.ok(TOPIC_SUBDIVISIONS.Arts.includes('Media Arts'))
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Media Arts']], ['Film', 'Video Games'])
  assert.ok(!TOPIC_SUBDIVISIONS['Visual Arts'].includes('Fine Arts'))
  assert.equal(TOPIC_SUBDIVISIONS['Fine Arts'], undefined)
  assert.ok(!(TOPIC_SUBDIVISIONS['Interactive Art'] || []).includes('Video Games'))
  assert.ok(TOPIC_SUBDIVISIONS['Digital Art'].includes('Interactive Art'))
  assert.ok(appSummary('Media Arts'))
  assert.equal(appSummary('Fine Arts'), '')
})

test('Film and Video Games move under a new Media Arts with their whole subtrees, and Fine Arts goes', () => {
  const film = withHidden(builtIn('Film'))
  const movies = film[1].find(([label]) => label === 'Movies')
  movies[1].push(['My Watchlist', [], { isCustom: true, hidden: true, order: 0 }])
  movies[2].notes = [{ id: 'note-movies', text: 'mine', level: 0 }]
  film[2].summary = 'My own film summary.'
  const before = artsMap({ film })
  const byLabel = (mapNodes, label) => mapNodes.filter((n) => n.label === label)
  const [filmBefore] = byLabel(before, 'Film')
  const [gamesBefore] = byLabel(before, 'Video Games')
  const filmSubtree = descendantsOf(before, filmBefore.id)
  const gamesSubtree = descendantsOf(before, gamesBefore.id)
  assert.ok(filmSubtree.length > 50)
  assert.ok(gamesSubtree.length > 0)

  const { nodes, changed } = normalize(before, appSummary)

  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(nodes.length, before.length)
  const [mediaArts] = byLabel(nodes, 'Media Arts')
  assert.equal(pathOf(nodes, mediaArts), 'Root > Humanities > Arts > Media Arts')
  assert.equal(mediaArts.hidden, false)
  assert.ok(!mediaArts.isCustom)
  assert.deepEqual(byLabel(nodes, 'Fine Arts'), [])

  for (const [moved, subtree] of [[filmBefore, filmSubtree], [gamesBefore, gamesSubtree]]) {
    const after = nodes.find((n) => n.id === moved.id)
    assert.equal(pathOf(nodes, after), `Root > Humanities > Arts > Media Arts > ${moved.label}`)
    assert.equal(after.hidden, true)
    assert.equal(after.summary, moved.summary)
    assert.deepEqual(descendantsOf(nodes, moved.id), subtree)
  }

  const interactiveArt = byLabel(nodes, 'Interactive Art')
  assert.equal(interactiveArt.length, 1)
  assert.equal(pathOf(nodes, interactiveArt[0]), 'Root > Humanities > Arts > Visual Arts > Digital Art > Interactive Art')
  assert.deepEqual(descendantsOf(nodes, interactiveArt[0].id), [])
  assert.equal(normalize(nodes, appSummary).changed, false)
})

test('a Fine Arts the owner wrote on stays under Visual Arts as a custom node', () => {
  const extras = [
    { notes: [{ id: 'note-fine', text: 'mine', level: 0 }] },
    { summary: 'My own fine arts summary.' },
  ]
  for (const fineArtsExtra of extras) {
    const before = artsMap({ fineArtsExtra })
    const fineArts = before.find((n) => n.label === 'Fine Arts')
    const { nodes } = normalize(before, appSummary)

    const kept = nodes.find((n) => n.id === fineArts.id)
    assert.equal(pathOf(nodes, kept), 'Root > Humanities > Arts > Visual Arts > Fine Arts')
    assert.equal(kept.isCustom, true)
    assert.equal(kept.summary, fineArtsExtra.summary || FINE_ARTS_SUMMARY)
    assert.deepEqual(kept.notes, fineArtsExtra.notes)
    assert.deepEqual(descendantsOf(nodes, fineArts.id), [])
    assert.equal(pathOf(nodes, nodes.find((n) => n.label === 'Film')), 'Root > Humanities > Arts > Media Arts > Film')
    assert.equal(normalize(nodes, appSummary).changed, false)
  }
})

test('a Fine Arts holding only a stored copy of its retired summary is removed', () => {
  const { nodes } = normalize(artsMap({ fineArtsExtra: { summary: FINE_ARTS_SUMMARY } }), appSummary)
  assert.deepEqual(nodes.filter((n) => n.label === 'Fine Arts'), [])
})

test('a Fine Arts the owner added a custom child to stays with it', () => {
  const before = artsMap({ film: null, fineArtsExtra: {} })
  const fineArts = before.find((n) => n.label === 'Fine Arts')
  before.push({ id: 9999, label: 'My Sketches', parentId: fineArts.id, hidden: true, isCustom: true })
  const { nodes } = normalize(before, appSummary)
  assert.equal(nodes.find((n) => n.id === fineArts.id).isCustom, true)
  assert.equal(nodes.find((n) => n.id === 9999).parentId, fineArts.id)
})

test('Media Arts gets the built-in children that were not stored yet', () => {
  const { nodes } = normalize(artsMap({ videoGames: false }), appSummary)
  const mediaArts = nodes.find((n) => n.label === 'Media Arts')
  const children = nodes.filter((n) => n.parentId === mediaArts.id)
  assert.deepEqual(children.map((n) => n.label).sort(), ['Film', 'Video Games'])
  assert.ok(children.every((n) => n.hidden))
  assert.equal(normalize(nodes, appSummary).changed, false)

  // An unexpanded Fine Arts leaves Media Arts unexpanded, to generate both on expand.
  const unexpanded = normalize(artsMap({ film: null, videoGames: false }), appSummary).nodes
  const bare = unexpanded.find((n) => n.label === 'Media Arts')
  assert.deepEqual(unexpanded.filter((n) => n.parentId === bare.id), [])
  assert.deepEqual(unexpanded.filter((n) => n.label === 'Fine Arts'), [])
})

test('the Media Arts move leaves maps without those nodes, and Personal or custom copies, alone', () => {
  const unexpanded = buildMap(['Root', [['Humanities', [['Arts']]]], { isCustom: true }])
  assert.equal(normalize(unexpanded, appSummary).changed, false)

  const before = buildMap(['Root', [
    ['Arts', [
      ['Literature', [['Film', [['Notes on Film', [], { isCustom: true }]], { isCustom: true }]]],
      ['Visual Arts'], ['Performing Arts'], ['Music'], ['Design'],
    ]],
    ['Personal', [['Fine Arts', [['Film']], { isPersonal: true }]], { isPersonal: true }],
  ], { isCustom: true }])
  const { nodes } = normalize(before, appSummary)
  for (const node of before.filter((n) => n.label === 'Film' || n.label === 'Fine Arts')) {
    assert.deepEqual(nodes.find((n) => n.id === node.id), node)
  }
  const mediaArts = nodes.filter((n) => n.label === 'Media Arts')
  assert.equal(mediaArts.length, 1)
  assert.deepEqual(nodes.filter((n) => n.parentId === mediaArts[0].id), [])
})

test('built-in Solidity, JavaScript, shell and Ethereum summaries are corrected, and stored copies rewritten', () => {
  const migrations = SUMMARY_MIGRATIONS_BY_VERSION[9]
  for (const { label, to } of migrations) assert.equal(BUILT_IN_SUMMARIES[label], to)
  const retired = ['stack-stored', 'heap-stored', 'stored directly on the stack', 'stored on the stack', 'returning null or undefined', 'generates a unique 256-bit', 'distinguished from pure/view', 'See: Types/Data Types → Modules', '~17-second', 'Linux distributions and macOS']
  for (const text of Object.values(BUILT_IN_SUMMARIES)) {
    for (const phrase of retired) assert.equal(text.includes(phrase), false, `${phrase} in ${text}`)
  }

  const before = buildMap(['Root', [
    ...migrations.map(({ label, from }) => [label, [], { summary: from }]),
    ['Bash', [], { summary: 'My own Bash notes.' }],
    ['Uncles'],
  ]])
  const { nodes, changed } = applySummaryMigrations(before)
  assert.equal(changed, true)
  migrations.forEach(({ to }, index) => assert.equal(nodes[index + 1].summary, to))
  assert.equal(nodes.at(-2).summary, 'My own Bash notes.')
  assert.equal('summary' in nodes.at(-1), false)
  assert.equal(applySummaryMigrations(nodes).changed, false)
})

// The custom Solidity nodes of production map 7, as stored on 2026-10-21.
const SOLIDITY_NODES = [
  { id: 2465, label: 'address x y = z;', parentId: 1197, hidden: false },
  { id: 2467, label: 'x', parentId: 2465, hidden: false, isCustom: true, order: 0, summary: 'the variable name' },
  { id: 3059, label: 'y', parentId: 2465, hidden: false, isCustom: true, order: 1, summary: 'optional visibility modifiers' },
  { id: 3060, label: 'Options', parentId: 3059, hidden: true, isCustom: true },
  { id: 2468, label: 'z', parentId: 2465, hidden: false, isCustom: true, order: 2, summary: 'the Ethereum address value, where 0x indicates it\'s a hexadecimal number.' },
  { id: 3071, label: 'y', parentId: 2475, hidden: false, isCustom: true, summary: 'optional visibility modifiers' },
  { id: 3295, label: 'x[y]', parentId: 3294, hidden: false, isCustom: true, summary: 'Selects any element that has the attribute x, regardless of its value.' },
  { id: 2419, label: '>=0.8.7', parentId: 2418, hidden: false, isCustom: true, summary: 'Returns true if the left operand is greater than or equal to the right operand.' },
  { id: 2603, label: '^0.8.7', parentId: 2418, hidden: false, isCustom: true },
  { id: 2604, label: '0.8.7', parentId: 2418, hidden: false, isCustom: true },
  { id: 2427, label: 'True', parentId: 2426, hidden: false, isCustom: true },
  { id: 2428, label: 'False', parentId: 2426, hidden: false, isCustom: true },
  { id: 3105, label: 'Default Value', parentId: 2425, hidden: false, isCustom: true, summary: 'False' },
  { id: 3414, label: 'selfdestruct', parentId: 1204, hidden: false, isCustom: true, summary: 'destroys a contract and forwards its remaining ETH balance to a specified address, though it is deprecated and its behavior is changing in future Ethereum upgrades.' },
  { id: 3316, label: 'x', parentId: 3315, hidden: false, isCustom: true, summary: 'the name of the event.  Typically contractname_event (this is an industry standard.' },
  { id: 3293, label: 'Arrays', parentId: 3244, hidden: false, isCustom: true, summary: 'A fixed-size, contiguous block of memory storing elements of the same type with O(1) random access.' },
  { id: 3183, label: 'Custom Errors', parentId: 3171, hidden: false, isCustom: true, summary: 'named, optionally parameterized error types declared at the contract level that can only be triggered with revert, and are more gas efficient than string messages.' },
]

test('custom Solidity nodes of map 7 take corrected labels and summaries', () => {
  const { nodes, changed } = applyNodeEdits(SOLIDITY_NODES)
  assert.equal(changed, true)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  assert.match(byId.get(3295).summary, /^Mapping access: returns the value stored for key y in mapping x/)
  assert.match(byId.get(2419).summary, /0\.8\.7 or newer/)
  assert.match(byId.get(2603).summary, />=0\.8\.7 <0\.9\.0/)
  assert.equal(byId.get(2604).summary, 'Exactly compiler version 0.8.7.')
  assert.deepEqual([2427, 2428].map((id) => byId.get(id).label), ['true', 'false'])
  assert.equal(byId.get(3105).summary, 'false')
  assert.match(byId.get(3414).summary, /EIP-6780/)
  assert.match(byId.get(3316).summary, /CapWords/)
  assert.match(byId.get(3293).summary, /fixed or dynamic length/)
  assert.match(byId.get(3183).summary, /require\(condition, MyError\(\)\)/)
  // Only labels, summaries and the swapped orders change, and only on edited nodes.
  const editedIds = new Set(NODE_EDITS_BY_VERSION[9].flatMap((edit) => (edit.swap || [edit]).map(({ id }) => id)))
  for (const node of SOLIDITY_NODES) {
    const strip = (n) => Object.fromEntries(Object.entries(n).filter(([key]) => !['label', 'summary', 'order'].includes(key)))
    assert.deepEqual(editedIds.has(node.id) ? strip(byId.get(node.id)) : byId.get(node.id), editedIds.has(node.id) ? strip(node) : node)
  }
  assert.equal(applyNodeEdits(nodes).changed, false)
})

test('address x y = z; puts visibility before the name, keeping each placeholder\'s summary and subtree', () => {
  const { nodes } = applyNodeEdits(SOLIDITY_NODES)
  const children = nodes.filter((n) => n.parentId === 2465).sort((a, b) => a.order - b.order)
  assert.deepEqual(children.map((n) => [n.label, n.summary]), [
    ['x', 'optional visibility modifiers'],
    ['y', 'the variable name'],
    ['z', 'the Ethereum address value, where 0x indicates it\'s a hexadecimal number.'],
  ])
  assert.equal(nodes.find((n) => n.id === 3060).parentId, 3059)
  // The bytes placeholder with the same text is already in the right order.
  assert.deepEqual(nodes.find((n) => n.id === 3071), SOLIDITY_NODES.find((n) => n.id === 3071))

  // Without stored orders the swap adds none.
  const unordered = SOLIDITY_NODES.map((node) => Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'order')))
  const swapped = applyNodeEdits(unordered).nodes
  assert.deepEqual([2467, 3059].map((id) => swapped.find((n) => n.id === id)), [
    { id: 2467, label: 'y', parentId: 2465, hidden: false, isCustom: true, summary: 'the variable name' },
    { id: 3059, label: 'x', parentId: 2465, hidden: false, isCustom: true, summary: 'optional visibility modifiers' },
  ])
})

test('node edits leave nodes the owner has edited, and other maps\' nodes, alone', () => {
  const edited = SOLIDITY_NODES.map((node) => {
    if (node.id === 3295) return { ...node, summary: 'Mine.' }
    if (node.id === 2427) return { ...node, label: 'TRUE' }
    if (node.id === 2603) return { ...node, summary: 'Caret range.' }
    if (node.id === 3059) return { ...node, summary: 'visibility' }
    return node
  })
  const byId = new Map(applyNodeEdits(edited).nodes.map((n) => [n.id, n]))
  for (const id of [3295, 2427, 2603, 2467, 3059]) assert.deepEqual(byId.get(id), edited.find((n) => n.id === id))
  assert.equal(byId.get(2428).label, 'false')

  // The same labels and text under other ids are not touched.
  const elsewhere = SOLIDITY_NODES.map((node) => ({ ...node, id: node.id + 100000 }))
  assert.equal(applyNodeEdits(elsewhere).changed, false)

  // A built-in node that shares an edited id and text is not touched.
  const builtInArrays = { id: 3293, label: 'Arrays', parentId: 12, hidden: false, summary: SOLIDITY_NODES.find((n) => n.id === 3293).summary }
  assert.equal(builtInArrays.summary, BUILT_IN_SUMMARIES.Arrays)
  const builtIn = applyNodeEdits([builtInArrays])
  assert.equal(builtIn.changed, false)
  assert.deepEqual(builtIn.nodes, [builtInArrays])
})

const OLD_SERMON = '5:13–7:27 (The Sermon on the Mount)'
const SERMON = '5–7 (The Sermon on the Mount)'
const BEATITUDES = '5:1–12 (The Beatitudes)'
const GALILEAN_MINISTRY = '4:12–9:35 (The Galilean Ministry Begins)'
const OLD_JOB_REPLY = '23–24 (Job\'s Sixth Response)'
const OLD_PETER = '18:15-27 (Peter\'s First Denial and High Priest Questioning)'
const PETER = '18:15-27 (Peter\'s Denials and Jesus Before Annas)'
const OLD_PETER_SUMMARY = 'Peter follows into the high priest\'s courtyard and denies Jesus twice at the gate; meanwhile Jesus is questioned about his teaching and struck by a guard.'
const PSALMS_19_24 = '19–24 (God\'s Glory, Law, and Kingship)'
const PSALM_21 = '21 (The King\'s Joy in God\'s Strength)'
const ASSYRIA = '14:24–27 (The Oracle Against Assyria)'
const PHILISTIA = '14:28–32 (The Oracle Against Philistia)'
const ISAIAH_29 = 'Do not rejoice, all you Philistines, that the rod that struck you is broken; from the root of that snake will spring up a viper, its fruit will be a darting, venomous serpent.'

// Rewrites a built-in tuple tree the way the taxonomy stood before migration 10.
const toOldBible = ([label, children, extra]) => {
  const old = children.map(toOldBible)
  if (label === SERMON) return [OLD_SERMON, old.filter(([child]) => child !== BEATITUDES), extra]
  if (label === GALILEAN_MINISTRY) {
    const sermonAt = old.findIndex(([child]) => child === OLD_SERMON)
    const beatitudes = children.find(([child]) => child === SERMON)[1].find(([child]) => child === BEATITUDES)
    return [label, [...old.slice(0, sermonAt), beatitudes, ...old.slice(sermonAt)], extra]
  }
  if (label === '23–24 (Job\'s Seventh Response)') return [OLD_JOB_REPLY, old, extra]
  if (label === PETER) return [OLD_PETER, old, extra]
  if (label === PSALMS_19_24) return [label, old.filter(([child]) => child !== PSALM_21), extra]
  return [label, old, extra]
}

// The Bible books the fixes touch, stored the way the live map held them.
const bibleMap = () => {
  const books = ['Isaiah', 'Job', '1–41 (Book I: Genesis Comparison)', 'Matthew', 'John'].map((label) => toOldBible(builtIn(label)))
  const nodes = buildMap(['Root', books, { isCustom: true }])
  const assyria = nodes.find((n) => n.label === ASSYRIA)
  nodes.push({ id: 5076, label: '29', parentId: assyria.id, hidden: false, isCustom: true, summary: ISAIAH_29, order: 0 })
  return nodes
}

const labelsUnder = (mapNodes, label) => {
  const [parent] = mapNodes.filter((n) => n.label === label)
  return mapNodes.filter((n) => n.parentId === parent.id).map((n) => n.label)
}

test('the taxonomy fixes the Isaiah, Job, Psalms, Matthew and John slips', () => {
  assert.ok(TOPIC_SUBDIVISIONS['22–27 (The Third Cycle of Speeches)'].includes('23–24 (Job\'s Seventh Response)'))
  assert.ok(TOPIC_SUBDIVISIONS.John.includes(PETER))
  assert.ok(appSummary(PETER).includes('three times, once at the gate and twice by the fire'))
  assert.deepEqual([...TOPIC_SUBDIVISIONS[PSALMS_19_24]].map((label) => label.split(' ')[0]), ['19', '20', '21', '22', '23', '24'])
  assert.ok(appSummary(PSALM_21))
  assert.equal(TOPIC_SUBDIVISIONS[SERMON][0], BEATITUDES)
  assert.ok(!TOPIC_SUBDIVISIONS[GALILEAN_MINISTRY].includes(BEATITUDES))
  assert.ok(TOPIC_SUBDIVISIONS[GALILEAN_MINISTRY].includes(SERMON))
  assert.ok(appSummary(SERMON))
  for (const label of [OLD_SERMON, OLD_JOB_REPLY, OLD_PETER]) {
    assert.equal(TOPIC_SUBDIVISIONS[label], undefined)
    assert.equal(appSummary(label), '')
  }
})

test('migration 10 fixes the stored Bible slips without losing notes or children', () => {
  const before = bibleMap()
  const note = { id: 'note-sermon', text: 'mine', level: 0 }
  const sermonBefore = before.find((n) => n.label === OLD_SERMON)
  sermonBefore.notes = [note]
  before.push({ id: 9001, label: 'My Sermon Notes', parentId: sermonBefore.id, hidden: false, isCustom: true, order: 3 })
  const beatitudesBefore = before.find((n) => n.label === BEATITUDES)
  beatitudesBefore.notes = [{ id: 'note-beatitudes', text: 'blessed', level: 0 }]
  const sermonSubtree = descendantsOf(before, sermonBefore.id)

  const { nodes, changed } = normalize(before, appSummary)

  assert.equal(changed, true)
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(nodes.length, before.length + 1)

  const verse = nodes.find((n) => n.id === 5076)
  assert.equal(pathOf(nodes, verse), `Root > Isaiah > 1–35 (Judgment and Promise) > 13:1–23:18 (Oracles Against the Nations) > ${PHILISTIA} > 29`)
  assert.equal(verse.summary, ISAIAH_29)
  assert.equal(verse.isCustom, true)
  assert.deepEqual(labelsUnder(nodes, ASSYRIA), [])

  assert.deepEqual(nodes.filter((n) => n.label === OLD_JOB_REPLY), [])
  assert.equal(pathOf(nodes, nodes.find((n) => n.label === '23–24 (Job\'s Seventh Response)')), 'Root > Job > 3–31 (The Dialogue Cycles) > 22–27 (The Third Cycle of Speeches) > 23–24 (Job\'s Seventh Response)')
  assert.deepEqual(nodes.filter((n) => n.label === OLD_PETER), [])
  assert.equal(pathOf(nodes, nodes.find((n) => n.label === PETER)), `Root > John > ${PETER}`)

  assert.deepEqual(labelsUnder(nodes, PSALMS_19_24).sort(), [...TOPIC_SUBDIVISIONS[PSALMS_19_24]].sort())
  assert.equal(nodes.find((n) => n.label === PSALM_21).hidden, false)

  const sermon = nodes.find((n) => n.id === sermonBefore.id)
  assert.equal(sermon.label, SERMON)
  assert.deepEqual(sermon.notes, [note])
  assert.equal(pathOf(nodes, sermon), `Root > Matthew > ${GALILEAN_MINISTRY} > ${SERMON}`)
  const beatitudes = nodes.find((n) => n.id === beatitudesBefore.id)
  assert.equal(beatitudes.parentId, sermon.id)
  assert.deepEqual(beatitudes.notes, beatitudesBefore.notes)
  assert.deepEqual(descendantsOf(nodes, sermon.id).filter((n) => n.id !== beatitudes.id), sermonSubtree)
  assert.ok(!labelsUnder(nodes, GALILEAN_MINISTRY).includes(BEATITUDES))

  assert.equal(normalize(nodes, appSummary).changed, false)
})

test('migration 10 leaves nodes the owner already changed alone', () => {
  const before = bibleMap()
  const verse = before.find((n) => n.id === 5076)
  verse.label = '14:29'
  const peter = before.find((n) => n.label === OLD_PETER)
  peter.summary = 'My own summary.'
  const { nodes } = normalize(before, appSummary)

  assert.equal(nodes.find((n) => n.id === 5076).parentId, verse.parentId)
  const renamed = nodes.find((n) => n.id === peter.id)
  assert.equal(renamed.label, PETER)
  assert.equal(renamed.summary, 'My own summary.')

  // Another map's custom 29 under the Assyria oracle has a different id and stays.
  const other = bibleMap()
  other.find((n) => n.id === 5076).id = 6000
  const moved = normalize(other, appSummary).nodes.find((n) => n.id === 6000)
  assert.equal(moved.parentId, other.find((n) => n.label === ASSYRIA).id)
})

test('a stored copy of the old Peter summary is dropped so the corrected one shows', () => {
  const before = bibleMap()
  before.find((n) => n.label === OLD_PETER).summary = OLD_PETER_SUMMARY
  const { nodes } = normalize(before, appSummary)
  assert.equal(nodes.find((n) => n.label === PETER).summary, undefined)
})

test('an unexpanded Sermon on the Mount gets its full built-in set around the Beatitudes', () => {
  const before = buildMap(['Root', [
    ['Matthew', [[GALILEAN_MINISTRY, [
      ['4:12–25 (Jesus Begins His Ministry and Calls the First Disciples)'],
      [BEATITUDES, [], { hidden: true }],
      [OLD_SERMON, [], { hidden: true }],
    ]]]],
  ], { isCustom: true }])
  const { nodes } = normalize(before, appSummary)
  assert.deepEqual([...labelsUnder(nodes, SERMON)].sort(), [...TOPIC_SUBDIVISIONS[SERMON]].sort())
  assert.deepEqual(orphansOf(nodes), [])
  assert.equal(normalize(nodes, appSummary).changed, false)

  // Psalms 19–24 that was never expanded generates Psalm 21 on expand instead.
  const psalms = buildMap(['Root', [['1–41 (Book I: Genesis Comparison)', [[PSALMS_19_24]]]], { isCustom: true }])
  assert.equal(normalize(psalms, appSummary).changed, false)
})

const labelsOf = (mapNodes) => mapNodes.map((n) => n.label)

test('a custom node with an old built-in label is never renamed', () => {
  const before = buildMap(['Everything', [
    ['Humanities', [['Art', [], { isCustom: true }], ['Philosophy', [['Ethics', [], { isCustom: true }]]]]],
    ['Personal', [['Free Will', [], { isPersonal: true }]], { isPersonal: true }],
  ]])
  const { nodes } = relabel(before)
  assert.deepEqual(labelsOf(nodes), labelsOf(before))
})

test('a built-in node with an old label is renamed only under its built-in parent', () => {
  const before = buildMap(['Everything', [
    ['Humanities', [
      ['Art'],
      ['Philosophy', [['Ethics'], ['Metaphysics', [['Free Will vs. Determinism', [['Free Will']]]]]]],
      ['Sociology', [['Ethics']]],
    ]],
  ]])
  const { nodes, changed } = relabel(before)
  assert.equal(changed, true)
  assert.deepEqual(labelsOf(nodes), [
    'Everything', 'Humanities', 'Arts', 'Philosophy', 'Ethics/Moral Philosophy', 'Metaphysics',
    'Free Will vs. Determinism', 'Free Will', 'Sociology', 'Ethics',
  ])
  assert.equal(nodes[0].labelMigrationVersion, LATEST_LABEL_MIGRATION_VERSION)
})

test('renames run once: a second load changes nothing, even a node given an old label since', () => {
  const first = relabel(buildMap(['Everything', [['Humanities', [['Art']]]]])).nodes
  assert.deepEqual(relabel(first), { nodes: first, changed: false })

  const later = first.map((n) => (n.label === 'Arts' ? { ...n, label: 'Art' } : n))
  assert.deepEqual(relabel(later), { nodes: later, changed: false })
})

test('a map that already carries the new labels keeps them, gaining only the version', () => {
  const before = buildMap(['Everything', [
    ['Humanities', [['Arts'], ['History', [['Modern Era (1453 - present)', [['Early Modern Period (1453 - 1789)']]]]]]],
  ]])
  const { nodes, changed } = relabel(before)
  assert.equal(changed, true)
  assert.deepEqual(nodes.slice(1), before.slice(1))
  assert.deepEqual(nodes[0], { ...before[0], labelMigrationVersion: LATEST_LABEL_MIGRATION_VERSION })
  assert.equal(relabel(nodes).changed, false)
})

test('a renamed parent is known when its children are judged', () => {
  const { nodes } = relabel(buildMap(['Everything', [
    ['Humanities', [['History', [['1453 - present Modern Era', [['1453 - 1789 Early Modern Period', [['1300 - 1600 Renaissance']]]]]]]]],
  ]]))
  assert.deepEqual(labelsOf(nodes).slice(3), ['Modern Era (1453 - present)', 'Early Modern Period (1453 - 1789)', 'Renaissance (1300 - 1600)'])
})

test('a map at an older version runs only the newer renames', () => {
  const medieval = ['Medieval Period (476 - 1453)', [['Early Middle Ages (476 - 1000)', [['Migration Period (750 - 800)']]]]]
  const before = buildMap(['Everything', [['Humanities', [['Art'], ['History', [medieval]]]]], { labelMigrationVersion: 2 }])
  const { nodes } = relabel(before)
  assert.deepEqual(labelsOf(nodes).slice(2), ['Art', 'History', 'Medieval Period (476 - 1453)', 'Early Middle Ages (476 - 1000)', 'Rise of the Carolingians (750 - 800)'])
})

test('the owner-requested Trump presidency fix reaches the custom node only under its parent', () => {
  const custom = { isCustom: true }
  const before = buildMap(['Everything', [
    ['America During the Post-Cold War Era', [['First Trump Presidency (2016 - 2020)', [], custom]], custom],
    ['My Notes', [['First Trump Presidency (2016 - 2020)', [], custom]], custom],
  ]])
  const { nodes } = relabel(before)
  assert.deepEqual(labelsOf(nodes).slice(2), ['First Trump Presidency (2017 - 2021)', 'My Notes', 'First Trump Presidency (2016 - 2020)'])
  assert.equal(nodes[2].isCustom, true)
})

test('a built-in node beside a custom namesake is renamed in place, nothing merged', () => {
  const before = buildMap(['Everything', [['Humanities', [
    ['Art', [['Painting'], ['Painting Notes', [], { isCustom: true }]], { notes: [{ id: 'n1', text: 'built-in', level: 0 }] }],
    ['Arts', [['Sculpture Notes', [], { isCustom: true }]], { isCustom: true, notes: [{ id: 'n2', text: 'mine', level: 0 }] }],
  ]]]])
  const { nodes } = relabel(before)
  assert.equal(nodes.length, before.length)
  const art = before.find((n) => n.label === 'Art')
  assert.deepEqual(nodes.find((n) => n.id === art.id), { ...art, label: 'Arts' })
  for (const node of before.filter((n) => n.id !== art.id && n.parentId !== null)) {
    assert.deepEqual(nodes.find((n) => n.id === node.id), node)
  }
})

const HOP = 'History of Philosophy'
const VEDIC = 'Vedic Indian Philosophy (16th c BC - 6th c BC)'
const CLASSICAL_INDIAN = 'Classical Indian Philosophy (6th c BC - 11th c AD)'
const MEDIEVAL_INDIAN = 'Medieval Indian Philosophy (8th c - 18th c)'
const VEDANTA_SCHOOLS = 'Vedanta Schools (8th c - present)'
const NEOPLATONISM = 'Neoplatonism (3rd c AD - 6th c AD)'
const LATE_NEOPLATONISM = 'Late Neoplatonism (350 AD - 500 AD)'
const NOMINALISM = 'Nominalism (11th c - 21st c)'
const EARLY_MODERN = 'Early Modern Western Philosophy (17th c - 18th c)'
const BRITISH_EMPIRICISM = 'British Empiricism (17th c - 18th c)'
const ANALYTIC = 'Analytic Philosophy (1900s - present)'
const CONTINENTAL = 'Continental Philosophy (1920s - present)'
const PHENOMENOLOGY = 'Phenomenology (19th c - present)'
const HERMENEUTICS = 'Hermeneutics (19th c - present)'
const SHANKARA = 'Adi Shankara (788 AD - 820 AD)'
const PROCLUS = 'Proclus (412 AD - 485 AD)'
const HOBBES = 'Thomas Hobbes (1588-1679)'
const GASSENDI = 'Pierre Gassendi (1592-1655)'
const GOODMAN = 'Nelson Goodman (1906-1998)'
const EPICUREANISM = 'Epicureanism (306 BC - present)'
const PHILOSOPHY_OF_SCIENCE = 'Philosophy of Science (20th c - present)'
const GADAMER = 'Hans-Georg Gadamer (1900-2002)'
const DARSHANA_FOUNDERS = [
  ['Vyasa (1500 BC)', 'Bādarāyaṇa (Vyāsa) (c. 2nd c BC)', 'Early Vedānta (c. 2nd c BC - 8th c AD)'],
  ['Kapila (7th c BC)', 'Kapila (legendary, c. 6th c BC)', 'Sāṃkhya (c. 6th c BC - 16th c AD)'],
  ['Gautama (6th c BC)', 'Akṣapāda Gautama (c. 2nd c AD)', 'Nyāya (c. 2nd c AD - 10th c AD)'],
  ['Kanada (6th c BC)', 'Kaṇāda (c. 2nd c BC)', 'Vaiśeṣika (c. 2nd c BC - 10th c AD)'],
  ['Jaimini (6th c BC)', 'Jaimini (c. 2nd c BC)', 'Mīmāṃsā (c. 2nd c BC - present)'],
]
const STALE_PRESENT = [
  ['Jürgen Habermas (1929-present)', 'Jürgen Habermas (1929-2026)'],
  ['V. Y. Mudimbe (1941-present)', 'V. Y. Mudimbe (1941-2025)'],
  ['Paulin J. Hountondji (1942-present)', 'Paulin J. Hountondji (1942-2024)'],
  ['Li Zehou (1930-present)', 'Li Zehou (1930-2021)'],
]
const NEW_TRADITIONS = [
  'Early Africana Philosophy (c. 24th c BC - 19th c)',
  'Jewish Philosophy (1st c - 21st c)',
  'Byzantine Philosophy (4th c - 15th c)',
  'Korean Philosophy (7th c - 19th c)',
  'Classical and Medieval Japanese Philosophy (794-1603)',
  'Latin American and Iberian Philosophy (16th c - 21st c)',
]

// Every label under History of Philosophy, with the parent listing it.
const philosophyParents = () => {
  const parents = new Map()
  const walk = (label) => {
    for (const child of TOPIC_SUBDIVISIONS[label] || []) {
      parents.set(child, [...(parents.get(child) || []), label])
      walk(child)
    }
  }
  walk(HOP)
  return parents
}

test('the History of Philosophy taxonomy files each figure once, in its school', () => {
  const parents = philosophyParents()
  for (const [label, listedBy] of parents) {
    assert.equal(listedBy.length, 1, `${label} is listed by ${listedBy.join(', ')}`)
    assert.ok(Array.isArray(TOPIC_SUBDIVISIONS[label]), `${label} has no taxonomy entry`)
    assert.ok(appSummary(label), `${label} has no summary`)
  }
  assert.deepEqual([...TOPIC_SUBDIVISIONS[VEDIC]], ['Yajnavalkya (8th c BC)'])
  for (const [oldLabel, label, school] of DARSHANA_FOUNDERS) {
    assert.deepEqual(parents.get(label), [school])
    assert.deepEqual(parents.get(school), [CLASSICAL_INDIAN])
    if (oldLabel !== label) {
      assert.equal(TOPIC_SUBDIVISIONS[oldLabel], undefined)
      assert.equal(appSummary(oldLabel), '')
    }
  }
  assert.deepEqual(parents.get(SHANKARA), [VEDANTA_SCHOOLS])
  assert.deepEqual(parents.get(PROCLUS), [LATE_NEOPLATONISM])
  assert.deepEqual(parents.get(HOBBES), [BRITISH_EMPIRICISM])
  assert.deepEqual(parents.get(GASSENDI), [EPICUREANISM])
  assert.deepEqual(parents.get(GOODMAN), [PHILOSOPHY_OF_SCIENCE])
  assert.deepEqual(parents.get(GADAMER), [HERMENEUTICS])
  assert.ok(TOPIC_SUBDIVISIONS[CONTINENTAL].includes('Structuralism (1910s - 1970s)'))
  for (const [oldLabel, label] of STALE_PRESENT) {
    assert.ok(parents.has(label) && !parents.has(oldLabel), label)
  }
})

test('History of Philosophy gains the six missing traditions in chronological order', () => {
  const buckets = TOPIC_SUBDIVISIONS[HOP]
  const after = (label, earlier) => assert.ok(buckets.indexOf(label) > buckets.indexOf(earlier), `${label} after ${earlier}`)
  assert.equal(buckets[0], NEW_TRADITIONS[0])
  after(NEW_TRADITIONS[1], 'Imperial Chinese Philosophy (3rd c BC - 20th c AD)')
  after('Medieval Western Philosophy (5th c - 15th c)', NEW_TRADITIONS[2])
  after(NEW_TRADITIONS[3], 'Medieval Western Philosophy (5th c - 15th c)')
  after('Golden Age Islamic Philosophy (8th c - 13th c)', NEW_TRADITIONS[3])
  after(NEW_TRADITIONS[4], MEDIEVAL_INDIAN)
  after('Edo Japanese Philosophy (1603-1868)', NEW_TRADITIONS[4])
  after(NEW_TRADITIONS[5], 'Western Renaissance Philosophy (15th c - 16th c)')
  after(EARLY_MODERN, NEW_TRADITIONS[5])
  for (const tradition of NEW_TRADITIONS) assert.ok(TOPIC_SUBDIVISIONS[tradition].length > 0, tradition)
})

test('migration 11 names only places that exist in the built-in taxonomy', () => {
  const lists = (path, label) => {
    for (let i = 1; i < path.length; i++) assert.ok((TOPIC_SUBDIVISIONS[path[i - 1]] || []).includes(path[i]), `${path[i - 1]} > ${path[i]}`)
    assert.ok(TOPIC_SUBDIVISIONS[path.at(-1)].includes(label), `${path.at(-1)} > ${label}`)
  }
  for (const migration of STRUCTURAL_MIGRATIONS_BY_VERSION[11]) {
    if (migration.add) lists(migration.under, migration.add)
    else if (migration.homePath) lists(migration.homePath, migration.label)
    else {
      // A renamed founder's old label is retired and its new one has a home entry.
      assert.equal(TOPIC_SUBDIVISIONS[migration.rename.at(-1)], undefined)
      assert.ok(STRUCTURAL_MIGRATIONS_BY_VERSION[11].some((m) => m.homePath && m.label === migration.label), migration.label)
    }
  }
})

// Map 7's stored History of Philosophy before this change: every era bucket,
// with the old built-in children stored under the expanded ones.
const storedPhilosophyMap = () => {
  const leaves = (labels) => labels.map((label) => [label])
  const ancient = ['Ancient Western Philosophy (6th c BC - 5th c AD)', [
    ['Ancient Greek Philosophy (6th c BC - 1st c BC)'],
    ['Roman Philosophy (1st c AD - 5th c)'],
    ['Late Antiquity (1st c AD - 6th c AD)', [
      ['Imperial Philosophy (27 BC - 6th c AD)', [[NEOPLATONISM, leaves([
        'Plotinus (~204 AD - 270 AD)', 'Porphyry (234 AD - 305 AD)', 'Iamblichus (245 AD - 325 AD)', 'Hypatia of Alexandria (360 AD - 415 AD)', PROCLUS,
      ])]]],
      ['Early Christian Philosophy (150 AD - 500 AD)'],
      [LATE_NEOPLATONISM, leaves([PROCLUS, 'Damascius (480-550)', 'Simplicius of Cilicia (490-560)', 'Olympiodorus the Younger (5th c - 6th c)'])],
      ['The Transition to Medieval Philosophy (500 AD - 800 AD)'],
    ]],
  ]]
  const medieval = ['Medieval Western Philosophy (5th c - 15th c)', [
    ['Early Medieval (5th c - 11th c)'],
    ['Scholasticism (11th c - 17th c)', [
      [NOMINALISM, [
        ...leaves(['Roscellinus (1050-1125)', 'Peter Abelard (1079-1142)', 'William of Ockham (1287-1347)']),
        [HOBBES, [], { notes: [{ id: 'note-hobbes', text: 'Leviathan', level: 0 }] }],
        [GASSENDI], [GOODMAN],
      ]],
      ['Thomism (13th c - 21st c)'],
      ['Scotism (13th c - 21st c)'],
    ]],
  ]]
  const contemporary = ['Contemporary Western Philosophy (19th c - 21st c)', [
    ['Pragmatism (1870s - present)'],
    ['Contemporary Political Philosophy (19th c - 21st c)'],
    [ANALYTIC],
    [CONTINENTAL, [
      [PHENOMENOLOGY, [['Edmund Husserl (1859-1938)']]],
      [GADAMER, [], { notes: [{ id: 'note-gadamer', text: 'Truth and Method', level: 0 }] }],
      ['Critical Theory (1920s-present)', [
        ['Erich Fromm (1900-1980)'],
        ['The Frankfurt School (1923 - present)', leaves(['Walter Benjamin (1892-1940)', 'Max Horkheimer (1895-1973)', 'Herbert Marcuse (1898-1979)', 'Theodor W. Adorno (1903-1969)', 'Jürgen Habermas (1929-present)'])],
        ['Slavoj Žižek (1949-present)'],
      ]],
      ['Post-structuralism (1960s-present)'],
      ['Postmodernism (1960-present)'],
    ]],
    ['Cognitive Philosophical Synthesis (1980s - present)'],
  ]]
  const buckets = {
    [VEDIC]: [VEDIC, [
      ['Vyasa (1500 BC)', [], { notes: [{ id: 'note-vyasa', text: 'Brahma Sutras', level: 0 }] }],
      ['Yajnavalkya (8th c BC)'],
      ['Kapila (7th c BC)', [['My Samkhya Notes', [], { isCustom: true }]]],
      ['Gautama (6th c BC)'],
      ['Kanada (6th c BC)'],
      ['Jaimini (6th c BC)'],
      [SHANKARA, [], { notes: [{ id: 'note-shankara', text: 'Advaita', level: 0 }] }],
    ]],
    'Ancient Western Philosophy (6th c BC - 5th c AD)': ancient,
    'Medieval Western Philosophy (5th c - 15th c)': medieval,
    'Modern African Philosophy (20th c - 21st c)': ['Modern African Philosophy (20th c - 21st c)', leaves([
      'Kwasi Wiredu (1931-2022)', 'Sophie Oluwole (1935-2018)', 'V. Y. Mudimbe (1941-present)', 'Paulin J. Hountondji (1942-present)', 'Kwame Anthony Appiah (1954-present)',
    ])],
    'Contemporary Western Philosophy (19th c - 21st c)': contemporary,
  }
  const oldBuckets = TOPIC_SUBDIVISIONS[HOP].filter((label) => !NEW_TRADITIONS.includes(label))
  return buildMap(['Everything', [['Humanities', [['Philosophy', [[HOP, oldBuckets.map((label) => buckets[label] || [label])]]]]]]])
}

const loadMap = (mapNodes) => {
  const relabelled = relabel(mapNodes)
  const normalized = normalize(relabelled.nodes, appSummary)
  return { nodes: normalized.nodes, changed: relabelled.changed || normalized.changed }
}

const nodeAt = (mapNodes, path) => mapNodes.filter((n) => pathOf(mapNodes, n).endsWith(path.join(' > ')))

test('migration 11 refiles the stored philosophy figures with their ids, notes and children', () => {
  const before = storedPhilosophyMap()
  const idOf = (label) => before.find((n) => n.label === label).id
  const { nodes } = loadMap(before)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parentLabel = (node) => byId.get(node.parentId).label

  assert.deepEqual(orphansOf(nodes), [])
  assert.deepEqual(labelsUnder(nodes, VEDIC), ['Yajnavalkya (8th c BC)'])
  for (const [oldLabel, label, school] of DARSHANA_FOUNDERS) {
    const founder = byId.get(idOf(oldLabel))
    assert.equal(founder.label, label)
    assert.equal(pathOf(nodes, founder), `Everything > Humanities > Philosophy > ${HOP} > ${CLASSICAL_INDIAN} > ${school} > ${label}`)
    assert.deepEqual(labelsUnder(nodes, school).sort(), [...TOPIC_SUBDIVISIONS[school]].sort())
  }
  assert.deepEqual(byId.get(idOf('Vyasa (1500 BC)')).notes, [{ id: 'note-vyasa', text: 'Brahma Sutras', level: 0 }])
  assert.equal(parentLabel(nodes.find((n) => n.label === 'My Samkhya Notes')), 'Kapila (legendary, c. 6th c BC)')
  assert.deepEqual(labelsUnder(nodes, CLASSICAL_INDIAN).sort(), [...TOPIC_SUBDIVISIONS[CLASSICAL_INDIAN]].sort())

  const shankara = nodes.filter((n) => n.label === SHANKARA)
  assert.equal(shankara.length, 1)
  assert.equal(shankara[0].id, idOf(SHANKARA))
  assert.equal(parentLabel(shankara[0]), VEDANTA_SCHOOLS)
  assert.deepEqual(shankara[0].notes, [{ id: 'note-shankara', text: 'Advaita', level: 0 }])
  assert.deepEqual(labelsUnder(nodes, MEDIEVAL_INDIAN).sort(), [...TOPIC_SUBDIVISIONS[MEDIEVAL_INDIAN]].sort())
  assert.deepEqual(labelsUnder(nodes, VEDANTA_SCHOOLS).sort(), [...TOPIC_SUBDIVISIONS[VEDANTA_SCHOOLS]].sort())

  const proclus = nodes.filter((n) => n.label === PROCLUS)
  assert.equal(proclus.length, 1)
  assert.equal(parentLabel(proclus[0]), LATE_NEOPLATONISM)
  assert.deepEqual(labelsUnder(nodes, NEOPLATONISM), [...TOPIC_SUBDIVISIONS[NEOPLATONISM]])

  const hobbes = byId.get(idOf(HOBBES))
  assert.equal(pathOf(nodes, hobbes), `Everything > Humanities > Philosophy > ${HOP} > ${EARLY_MODERN} > ${BRITISH_EMPIRICISM} > ${HOBBES}`)
  assert.deepEqual(hobbes.notes, [{ id: 'note-hobbes', text: 'Leviathan', level: 0 }])
  assert.equal(parentLabel(byId.get(idOf(GASSENDI))), EPICUREANISM)
  assert.equal(parentLabel(byId.get(idOf(GOODMAN))), PHILOSOPHY_OF_SCIENCE)
  assert.deepEqual(labelsUnder(nodes, EPICUREANISM).sort(), [...TOPIC_SUBDIVISIONS[EPICUREANISM]].sort())
  assert.deepEqual(labelsUnder(nodes, EARLY_MODERN).sort(), [...TOPIC_SUBDIVISIONS[EARLY_MODERN]].sort())
  assert.deepEqual(labelsUnder(nodes, ANALYTIC).sort(), [...TOPIC_SUBDIVISIONS[ANALYTIC]].sort())
  assert.deepEqual(labelsUnder(nodes, NOMINALISM).sort(), [...TOPIC_SUBDIVISIONS[NOMINALISM]].sort())

  const gadamer = byId.get(idOf(GADAMER))
  assert.equal(parentLabel(gadamer), HERMENEUTICS)
  assert.deepEqual(gadamer.notes, [{ id: 'note-gadamer', text: 'Truth and Method', level: 0 }])
  assert.deepEqual(labelsUnder(nodes, HERMENEUTICS).sort(), [...TOPIC_SUBDIVISIONS[HERMENEUTICS]].sort())
  assert.deepEqual(labelsUnder(nodes, CONTINENTAL).sort(), [...TOPIC_SUBDIVISIONS[CONTINENTAL]].sort())
  assert.deepEqual(labelsUnder(nodes, PHENOMENOLOGY).sort(), [...TOPIC_SUBDIVISIONS[PHENOMENOLOGY]].sort())

  // Expanded parents gain their new built-in children; the stale dates are fixed in place.
  assert.deepEqual(labelsUnder(nodes, HOP).sort(), [...TOPIC_SUBDIVISIONS[HOP]].sort())
  for (const [oldLabel, label] of STALE_PRESENT.filter(([oldLabel]) => before.some((n) => n.label === oldLabel))) {
    assert.equal(byId.get(idOf(oldLabel)).label, label)
  }

  // Every stored built-in node sits where the taxonomy lists it, once.
  const hop = nodes.find((n) => n.label === HOP)
  const seen = new Set()
  for (const node of descendantsOf(nodes, hop.id).filter((n) => !n.isCustom)) {
    assert.ok(TOPIC_SUBDIVISIONS[parentLabel(node)].includes(node.label), pathOf(nodes, node))
    assert.ok(!seen.has(node.label), `${node.label} is stored twice`)
    seen.add(node.label)
  }

  assert.deepEqual(loadMap(nodes), { nodes, changed: false })
})

test('migration 11 leaves an unexpanded History of Philosophy, and custom copies, alone', () => {
  const unexpanded = buildMap(['Everything', [['Humanities', [['Philosophy', [[HOP]]]]]]])
  assert.equal(normalize(unexpanded, appSummary).changed, false)

  const vedic = TOPIC_SUBDIVISIONS[HOP].filter((label) => !NEW_TRADITIONS.includes(label)).map((label) => [label])
  vedic[0] = [VEDIC, [['Yajnavalkya (8th c BC)'], ['Kapila (7th c BC)', [], { isCustom: true }], [SHANKARA, [], { isPersonal: true }]]]
  const before = buildMap(['Everything', [['Humanities', [['Philosophy', [[HOP, vedic]]]]]]])
  const { nodes } = normalize(before, appSummary)
  for (const label of ['Kapila (7th c BC)', SHANKARA]) {
    const node = nodes.find((n) => n.label === label)
    assert.equal(nodeAt(nodes, [VEDIC, label]).length, 1)
    assert.deepEqual(node, before.find((n) => n.label === label))
  }
})

// Migration 12: each figure that sat loose beside the schools of a period or
// tradition, with the school it now belongs to.
const LOOSE_FIGURE_HOMES = [
  ['Heraclitus of Ephesus (535 BC - 475 BC)', 'Milesian School/Ionian School (6th c BC)'],
  ['Plato (~428 BC - ~347 BC)', 'The Academy (c. 387 BC - 1st c BC)'],
  ['Aristotle (384 BC - 322 BC)', 'Peripatetic School (335 BC - 3rd c AD)'],
  ['Bhartṛhari (c. 5th c AD)', 'Vyākaraṇa/Grammarian School (c. 4th c BC - 18th c AD)'],
  ['Albertus Magnus (c. 1200-1280)', 'High Scholasticism (13th c - 14th c)'],
  ['Roger Bacon (c. 1214-1292)', 'High Scholasticism (13th c - 14th c)'],
  ['Bonaventure (c. 1217-1274)', 'High Scholasticism (13th c - 14th c)'],
  ['Marsilius of Padua (c. 1275-1342)', 'High Scholasticism (13th c - 14th c)'],
  ['Al-Ghazali (1058-1111)', 'Kalām (8th c - present)'],
  ['Al-Kindi (801-873)', 'Falsafa (9th c - 12th c)'],
  ['Al-Farabi (872-950)', 'Falsafa (9th c - 12th c)'],
  ['Avicenna (Ibn Sina) (980-1037)', 'Falsafa (9th c - 12th c)'],
  ['Ibn Bajjah (Avempace) (1085-1138)', 'Falsafa (9th c - 12th c)'],
  ['Ibn Tufail (1105-1185)', 'Falsafa (9th c - 12th c)'],
  ['Ibn Rushd (Averroes) (1126-1198)', 'Falsafa (9th c - 12th c)'],
  ['Abhinavagupta (c. 950-1016)', 'Shaiva Philosophy (9th c - present)'],
  ['Basava (1131-1167)', 'Shaiva Philosophy (9th c - present)'],
  ['Gangesha Upadhyaya (13th c - 14th c)', 'Nyaya and Vaisheshika (10th c - present)'],
  [GASSENDI, EPICUREANISM],
  ['Joseph Butler (1692-1752)', 'The Enlightenment (18th c)'],
  ['Herbert Spencer (1820-1903)', 'Utilitarianism (18th c - present)'],
  ['Alfred North Whitehead (1861-1947)', 'Process and Life Philosophy (1880s - present)'],
  ['Bernard Bolzano (1781-1848)', 'Early Analytic Philosophy (1870s - 1930s)'],
  ['Gottlob Frege (1848-1925)', 'Early Analytic Philosophy (1870s - 1930s)'],
  ['Bertrand Russell (1872-1970)', 'Early Analytic Philosophy (1870s - 1930s)'],
  ['G. E. Moore (1873-1958)', 'Early Analytic Philosophy (1870s - 1930s)'],
  ['Ludwig Wittgenstein (1889-1951)', 'Early Analytic Philosophy (1870s - 1930s)'],
  ['Rudolf Carnap (1891-1970)', 'Logical Positivism (1920s - 1950s)'],
  ['Alfred Tarski (1901-1983)', 'Philosophy of Logic and Mathematics (20th c - present)'],
  ['Kurt Gödel (1906-1978)', 'Philosophy of Logic and Mathematics (20th c - present)'],
  [GOODMAN, PHILOSOPHY_OF_SCIENCE],
  ['P. F. Strawson (1919-2006)', 'Ordinary Language Philosophy (1940s - 1960s)'],
  ['Willard Van Orman Quine (1908-2000)', 'Philosophy of Language (20th c - present)'],
  ['Donald Davidson (1917-2003)', 'Philosophy of Language (20th c - present)'],
  ['Saul Kripke (1940-2022)', 'Philosophy of Language (20th c - present)'],
  ['David Lewis (1941-2001)', 'Philosophy of Language (20th c - present)'],
  ['Hilary Putnam (1926-2016)', 'Philosophy of Mind (20th c - present)'],
  ['Wilfrid Sellars (1912-1989)', 'Analytic Epistemology (20th c - present)'],
  ['Edmund Gettier (1927-2021)', 'Analytic Epistemology (20th c - present)'],
  ['Bernard Williams (1929-2003)', 'Analytic Ethics (20th c - present)'],
  ['Derek Parfit (1942-2017)', 'Analytic Ethics (20th c - present)'],
  ['Walter Lippmann (1889-1974)', 'Classical Liberalism (17th c - present)'],
  ['Isaiah Berlin (1909-1997)', 'Classical Liberalism (17th c - present)'],
  ['Alexis de Tocqueville (1805-1859)', 'Civic Republicanism (15th c - present)'],
  ['Hannah Arendt (1906-1975)', 'Civic Republicanism (15th c - present)'],
  ['Leo Strauss (1899-1973)', 'Conservatism (18th c - present)'],
  ['Michael Oakeshott (1901-1990)', 'Conservatism (18th c - present)'],
  ['Ayn Rand (1905-1982)', 'Objectivism (1940s - present)'],
  ['Charles Taylor (1931-present)', 'Communitarianism (1980s - present)'],
  ['John Rawls (1921-2002)', 'Liberal Egalitarianism (1970s - present)'],
  ['Martha Nussbaum (1947-present)', 'Liberal Egalitarianism (1970s - present)'],
  ['Simone Weil (1909-1943)', 'Christian Platonism and Religious Thought (20th c)'],
  ['René Girard (1923-2015)', 'Christian Platonism and Religious Thought (20th c)'],
]
// Period and tradition nodes that divide into schools; Socrates, who founded
// none, is the one figure left directly under one.
const SCHOOL_DIVIDED = [
  'Pre-Socratic Philosophy (6th c BC - 5th c BC)',
  'Classical Greek Philosophy (5th c BC - 4th c BC)',
  CLASSICAL_INDIAN,
  'Scholasticism (11th c - 17th c)',
  'Golden Age Islamic Philosophy (8th c - 13th c)',
  MEDIEVAL_INDIAN,
  EARLY_MODERN,
  'Late Modern Western Philosophy (19th c)',
  ANALYTIC,
  'Contemporary Political Philosophy (19th c - 21st c)',
  'American Political Philosophy (20th c)',
  CONTINENTAL,
]
const INDEPENDENTS = ['Socrates (469 BC - 399 BC)']

test('migration 12 gives every loose History of Philosophy figure a school', () => {
  const parents = philosophyParents()
  for (const [label, school] of LOOSE_FIGURE_HOMES) assert.deepEqual(parents.get(label), [school], label)
  for (const label of SCHOOL_DIVIDED) {
    for (const child of TOPIC_SUBDIVISIONS[label]) {
      assert.ok(TOPIC_SUBDIVISIONS[child].length > 0 || INDEPENDENTS.includes(child), `${child} hangs loose under ${label}`)
    }
  }
  for (const school of new Set(LOOSE_FIGURE_HOMES.map(([, school]) => school))) {
    assert.ok(appSummary(school), `${school} has no summary`)
  }
})

test('migration 12 names only places that exist in the built-in taxonomy', () => {
  const lists = (path, label) => {
    for (let i = 1; i < path.length; i++) assert.ok((TOPIC_SUBDIVISIONS[path[i - 1]] || []).includes(path[i]), `${path[i - 1]} > ${path[i]}`)
    if (label) assert.ok(TOPIC_SUBDIVISIONS[path.at(-1)].includes(label), `${path.at(-1)} > ${label}`)
  }
  const refiled = new Set()
  for (const migration of STRUCTURAL_MIGRATIONS_BY_VERSION[12]) {
    if (migration.add) {
      lists(migration.under, migration.add)
      continue
    }
    lists(migration.into)
    for (const from of migration.refile) {
      const label = from.at(-1)
      lists(from.slice(0, -1))
      assert.ok(!TOPIC_SUBDIVISIONS[from.at(-2)].includes(label), `${label} still listed under ${from.at(-2)}`)
      assert.ok(TOPIC_SUBDIVISIONS[migration.into.at(-1)].includes(label), `${migration.into.at(-1)} > ${label}`)
      refiled.add(label)
    }
  }
  const moved = LOOSE_FIGURE_HOMES.map(([label]) => label).filter((label) => label !== GASSENDI && label !== GOODMAN)
  assert.deepEqual([...refiled].sort(), moved.sort())
})

// A stored History of Philosophy from before migration 12, with the loose
// figures in their old places (some with notes or a custom child), several
// schools never expanded, and custom and Personal namesakes.
const storedLooseMap = () => {
  const leaves = (labels) => labels.map((label) => [label])
  const noted = (label, text) => [label, [], { notes: [{ id: `note-${label}`, text, level: 0 }] }]
  const ancient = ['Ancient Western Philosophy (6th c BC - 5th c AD)', [
    ['Ancient Greek Philosophy (6th c BC - 1st c BC)', [
      ['Pre-Socratic Philosophy (6th c BC - 5th c BC)', [
        ['Milesian School/Ionian School (6th c BC)', leaves(['Thales of Miletus (~624 BC - ~545 BC)', 'Anaximander of Miletus (610 BC - 546 BC)', 'Anaximenes of Miletus (545 BC)'])],
        ['Italian School (6th c BC - 5th c BC)'],
        noted('Heraclitus of Ephesus (535 BC - 475 BC)', 'Logos'),
        ['Pluralists (5th c BC)'],
        ['Atomists (5th c BC)'],
      ]],
      ['Classical Greek Philosophy (5th c BC - 4th c BC)', [
        ['Sophists (5th c BC - 4th c BC)'],
        ['Socrates (469 BC - 399 BC)'],
        ['Cyrenaics (4th c BC - 3rd c BC)'],
        ['Plato (~428 BC - ~347 BC)', [['My Republic Notes', [], { isCustom: true }]]],
        ['Plato (~428 BC - ~347 BC)', [], { isPersonal: true }],
        noted('Aristotle (384 BC - 322 BC)', 'Nicomachean Ethics'),
      ]],
      ['Hellenistic Philosophy (3rd c BC - 1st c BC)', [
        ['Peripatetic School (335 BC - 3rd c AD)'],
        ['Skepticism (4th c BC - 3rd c AD)'],
        ['The Cynics (4th c BC - 4th c AD)'],
        [EPICUREANISM],
        ['Stoicism (300 BC - present)'],
      ]],
    ]],
    ['Roman Philosophy (1st c AD - 5th c)'],
    ['Late Antiquity (1st c AD - 6th c AD)'],
  ]]
  const classicalIndian = [CLASSICAL_INDIAN, [
    ...leaves(['Jainism (8th c BC - present)', 'Indian Buddhism (6th c BC - present)', 'Sāṃkhya (c. 6th c BC - 16th c AD)', 'Mīmāṃsā (c. 2nd c BC - present)', 'Vaiśeṣika (c. 2nd c BC - 10th c AD)', 'Yoga (c. 2nd c BC - present)', 'Early Vedānta (c. 2nd c BC - 8th c AD)', 'Nyāya (c. 2nd c AD - 10th c AD)']),
    noted('Bhartṛhari (c. 5th c AD)', 'Vākyapadīya'),
  ]]
  const medieval = ['Medieval Western Philosophy (5th c - 15th c)', [
    ['Early Medieval (5th c - 11th c)'],
    ['Scholasticism (11th c - 17th c)', [
      ['Early Scholasticism (11th c - 12th c)'],
      [NOMINALISM],
      noted('Albertus Magnus (c. 1200-1280)', 'Teacher of Aquinas'),
      ...leaves(['Roger Bacon (c. 1214-1292)', 'Bonaventure (c. 1217-1274)', 'Thomism (13th c - 21st c)', 'Scotism (13th c - 21st c)', 'Marsilius of Padua (c. 1275-1342)']),
    ]],
    ['Medieval Mysticism (13th c - 15th c)'],
  ]]
  const goldenAge = ['Golden Age Islamic Philosophy (8th c - 13th c)', [
    ['Kalām (8th c - present)'],
    ...leaves(['Al-Kindi (801-873)', 'Al-Farabi (872-950)']),
    noted('Avicenna (Ibn Sina) (980-1037)', 'Floating man'),
    noted('Al-Ghazali (1058-1111)', 'Incoherence of the Philosophers'),
    ...leaves(['Ibn Bajjah (Avempace) (1085-1138)', 'Ibn Tufail (1105-1185)', 'Ibn Rushd (Averroes) (1126-1198)']),
  ]]
  const medievalIndian = [MEDIEVAL_INDIAN, [
    ...leaves([VEDANTA_SCHOOLS, 'Tibetan Buddhist Philosophy (8th c - present)']),
    ['Nyaya and Vaisheshika (10th c - present)', leaves(['Udayana (10th c - 11th c)'])],
    ...leaves(['Abhinavagupta (c. 950-1016)', 'Basava (1131-1167)', 'Gangesha Upadhyaya (13th c - 14th c)']),
  ]]
  const earlyModern = [EARLY_MODERN, [
    ...leaves(['Continental Rationalism (17th c)', BRITISH_EMPIRICISM, 'Modern Natural Law (17th c - 18th c)']),
    noted(GASSENDI, 'Syntagma'),
    ['The Enlightenment (18th c)', leaves([...TOPIC_SUBDIVISIONS['The Enlightenment (18th c)']].filter((label) => label !== 'Joseph Butler (1692-1752)'))],
    noted('Joseph Butler (1692-1752)', 'Fifteen Sermons'),
    ['Scottish Enlightenment (1740-1790)'],
  ]]
  const lateModern = ['Late Modern Western Philosophy (19th c)', [
    ['Utilitarianism (18th c - present)', leaves(['Jeremy Bentham (1748-1832)', 'John Stuart Mill (1806-1873)', 'Henry Sidgwick (1838-1900)', 'R.M. Hare (1919-2002)', 'Peter Singer (1946-present)'])],
    ...leaves(['German Idealism (1780\'s - 1840s)', 'Pessimism (19th c)', 'Positivism (1830s - 1900s)', 'Anthropological Materialism (19th c)', 'Anarchism (1840s - present)', 'Existentialism (19th c - present)', 'Transcendentalism (1830s-1860s)', 'Herbert Spencer (1820-1903)', 'British Idealism (1860s - 1920s)', 'Process and Life Philosophy (1880s - present)', 'Depth Psychology/Analytical Psychology/Psychology of Religion (1880-1970)']),
  ]]
  const analytic = [ANALYTIC, [
    ...leaves(['Bernard Bolzano (1781-1848)', 'Gottlob Frege (1848-1925)']),
    noted('Alfred North Whitehead (1861-1947)', 'Process and Reality'),
    ...leaves(['Bertrand Russell (1872-1970)', 'G. E. Moore (1873-1958)', 'Ludwig Wittgenstein (1889-1951)', 'Rudolf Carnap (1891-1970)']),
    ['Logical Positivism (1920s - 1950s)', leaves(['Moritz Schlick (1882-1936)', 'Otto Neurath (1882-1945)', 'A. J. Ayer (1910-1989)'])],
    ...leaves(['Alfred Tarski (1901-1983)', 'Kurt Gödel (1906-1978)', GOODMAN, 'Willard Van Orman Quine (1908-2000)', 'Ordinary Language Philosophy (1940s - 1960s)', PHILOSOPHY_OF_SCIENCE, 'Wilfrid Sellars (1912-1989)', 'Donald Davidson (1917-2003)', 'P. F. Strawson (1919-2006)', 'Virtue Ethics Revival (1958 - present)', 'Hilary Putnam (1926-2016)', 'Edmund Gettier (1927-2021)', 'Bernard Williams (1929-2003)', 'Saul Kripke (1940-2022)', 'David Lewis (1941-2001)', 'Derek Parfit (1942-2017)', 'Philosophy of Mind (20th c - present)', 'Analytic Philosophy of Religion (1960s - present)']),
  ]]
  const political = ['Contemporary Political Philosophy (19th c - 21st c)', [
    ['Alexis de Tocqueville (1805-1859)'],
    ['Classical Liberalism (17th c - present)'],
    ['Political Realism (20th c - 21st c)'],
    ['American Political Philosophy (20th c)', [['Walter Lippmann (1889-1974)'], noted('John Rawls (1921-2002)', 'A Theory of Justice'), ['Libertarianism (20th c - 21st c)']]],
    ...leaves(['Leo Strauss (1899-1973)', 'Michael Oakeshott (1901-1990)', 'Ayn Rand (1905-1982)', 'Hannah Arendt (1906-1975)', 'Isaiah Berlin (1909-1997)', 'Charles Taylor (1931-present)', 'Martha Nussbaum (1947-present)']),
  ]]
  const continental = [CONTINENTAL, [
    ...leaves([PHENOMENOLOGY, HERMENEUTICS, 'Structuralism (1910s - 1970s)', 'Critical Theory (1920s-present)']),
    noted('Simone Weil (1909-1943)', 'Gravity and Grace'),
    ['René Girard (1923-2015)'],
    ['René Girard (1923-2015)', [], { isCustom: true, summary: 'My own Girard notes' }],
    ...leaves(['Post-structuralism (1960s-present)', 'Postmodernism (1960-present)', 'Feminist Philosophy (20th c - present)']),
  ]]
  const contemporary = ['Contemporary Western Philosophy (19th c - 21st c)', [
    ['Pragmatism (1870s - present)'], political, analytic, continental, ['Cognitive Philosophical Synthesis (1980s - present)'],
  ]]
  const buckets = Object.fromEntries([ancient, classicalIndian, medieval, goldenAge, medievalIndian, earlyModern, lateModern, contemporary].map((bucket) => [bucket[0], bucket]))
  return buildMap(['Everything', [['Humanities', [['Philosophy', [
    [HOP, TOPIC_SUBDIVISIONS[HOP].map((label) => buckets[label] || [label])],
    // A built-in namesake outside its old place is not refiled.
    ['Metaphysics', [noted('Aristotle (384 BC - 322 BC)', 'Metaphysics Z')]],
  ]]]]]])
}

test('migration 12 refiles the stored loose figures into their schools with their ids, notes and children', () => {
  const before = storedLooseMap()
  const builtInId = (label) => before.find((n) => n.label === label && !n.isCustom && !n.isPersonal && pathOf(before, n).includes(HOP)).id
  const { nodes } = loadMap(before)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parentLabel = (node) => byId.get(node.parentId).label

  assert.deepEqual(orphansOf(nodes), [])
  for (const [label, school] of LOOSE_FIGURE_HOMES) {
    const id = builtInId(label)
    const figure = byId.get(id)
    assert.equal(figure?.label, label, `${label} kept its id`)
    assert.equal(parentLabel(figure), school, label)
    assert.deepEqual(figure.notes, before.find((n) => n.id === id).notes, `${label} kept its notes`)
    assert.deepEqual(labelsUnder(nodes, school).sort(), [...TOPIC_SUBDIVISIONS[school]].sort(), school)
  }
  assert.equal(parentLabel(nodes.find((n) => n.label === 'My Republic Notes')), 'Plato (~428 BC - ~347 BC)')
  for (const label of SCHOOL_DIVIDED) assert.deepEqual(labelsUnder(nodes, label).filter((l) => !l.startsWith('Plato') && !l.startsWith('René')).sort(), [...TOPIC_SUBDIVISIONS[label]].sort(), label)

  // Custom, Personal and out-of-place namesakes stay where they were, untouched.
  for (const node of before.filter((n) => n.isCustom || n.isPersonal || pathOf(before, n).includes('Metaphysics'))) {
    assert.deepEqual(byId.get(node.id), node)
  }

  // Every stored built-in node under History of Philosophy sits where the taxonomy lists it, once.
  const hop = nodes.find((n) => n.label === HOP)
  const seen = new Set()
  for (const node of descendantsOf(nodes, hop.id).filter((n) => !n.isCustom && !n.isPersonal)) {
    assert.ok(TOPIC_SUBDIVISIONS[parentLabel(node)].includes(node.label), pathOf(nodes, node))
    assert.ok(!seen.has(node.label), `${node.label} is stored twice`)
    seen.add(node.label)
  }

  assert.deepEqual(loadMap(nodes), { nodes, changed: false })
})

test('migration 12 does not bring back a figure the owner deleted from the old parent', () => {
  const FREGE = 'Gottlob Frege (1848-1925)'
  const EARLY_ANALYTIC = 'Early Analytic Philosophy (1870s - 1930s)'
  const before = storedLooseMap()
    .filter((n) => n.label !== FREGE)
    .map((n) => (n.label === ANALYTIC ? { ...n, excludedChildLabels: [FREGE] } : n))
  const { nodes } = loadMap(before)
  assert.ok(!nodes.some((n) => n.label === FREGE))
  assert.deepEqual(labelsUnder(nodes, EARLY_ANALYTIC).sort(), [...TOPIC_SUBDIVISIONS[EARLY_ANALYTIC]].filter((l) => l !== FREGE).sort())
  assert.deepEqual(nodes.find((n) => n.label === EARLY_ANALYTIC).excludedChildLabels, [FREGE])
  assert.deepEqual(loadMap(nodes), { nodes, changed: false })
})

test('migration 12 does not bring back a figure the owner deleted from another old parent of the same school', () => {
  const NUSSBAUM = 'Martha Nussbaum (1947-present)'
  const LIBERAL_EGALITARIANISM = 'Liberal Egalitarianism (1970s - present)'
  const before = storedLooseMap()
    .filter((n) => n.label !== NUSSBAUM)
    .map((n) => (n.label === 'Contemporary Political Philosophy (19th c - 21st c)' ? { ...n, excludedChildLabels: [NUSSBAUM] } : n))
  const { nodes } = loadMap(before)
  assert.ok(!nodes.some((n) => n.label === NUSSBAUM))
  assert.deepEqual(labelsUnder(nodes, LIBERAL_EGALITARIANISM), ['John Rawls (1921-2002)'])
  assert.deepEqual(nodes.find((n) => n.label === LIBERAL_EGALITARIANISM).excludedChildLabels, [NUSSBAUM])
  assert.deepEqual(loadMap(nodes), { nodes, changed: false })
})

test('migration 12 adds the new schools under parents expanded without the loose figures', () => {
  const before = buildMap(['Everything', [['Humanities', [['Philosophy', [[HOP, TOPIC_SUBDIVISIONS[HOP].map((label) => (label === CLASSICAL_INDIAN
    ? [label, ['Jainism (8th c BC - present)', 'Indian Buddhism (6th c BC - present)'].map((school) => [school])]
    : [label]))]]]]]]])
  const { nodes } = normalize(before, appSummary)
  assert.ok(labelsUnder(nodes, CLASSICAL_INDIAN).includes('Vyākaraṇa/Grammarian School (c. 4th c BC - 18th c AD)'))
  assert.deepEqual(normalize(nodes, appSummary), { nodes, changed: false })
})
