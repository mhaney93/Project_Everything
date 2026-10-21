import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { applyStructuralMigrations, applySummaryMigrations, SUMMARY_MIGRATIONS_BY_VERSION, removeStalePredefinedChildren } from './mapMigrations.js'

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

// LABEL_MIGRATIONS_BY_VERSION ends with `};`, so loadAppObject cannot find it.
const LABEL_MIGRATIONS = (() => {
  const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
  const start = source.indexOf('{', source.indexOf('const LABEL_MIGRATIONS_BY_VERSION = {'))
  return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n};\n', start) + 2)})`)
})()

// Mirrors applyLabelMigrations in App.jsx, which runs before the structural migrations.
const relabel = (mapNodes) => mapNodes.map((node) => {
  let label = node.label
  for (const version of Object.keys(LABEL_MIGRATIONS).map(Number).sort((a, b) => a - b)) label = LABEL_MIGRATIONS[version][label] || label
  return label === node.label ? node : { ...node, label }
})

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
  const { nodes } = normalize(relabel(before), appSummary)

  assert.equal(nodes.length, before.length)
  for (const node of before) assert.deepEqual(nodes.find((n) => n.id === node.id), { ...node, label: renames[node.label] || node.label })
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Early Middle Ages (476 - 1000)']], ['Late Antiquity (500 - 750)', 'Rise of the Carolingians (750 - 800)', 'Carolingian Era (800 - 887)', 'Post-Carolingian Era (887 - 1000)'])
  assert.deepEqual([...TOPIC_SUBDIVISIONS['Late Antiquity (500 - 750)']], ['Migration Period (c. 375 - 568)'])
  assert.equal(BUILT_IN_SUMMARIES['Migration Period (c. 375 - 568)'], lateAntiquitySummary)
  assert.equal(BUILT_IN_SUMMARIES['Rise of the Carolingians (750 - 800)'], carolingianSummary)
  for (const label of ['Migration Period (500 - 750)', 'Migration Period (750 - 800)']) {
    assert.equal(label in TOPIC_SUBDIVISIONS, false)
    assert.equal(label in BUILT_IN_SUMMARIES, false)
  }
  assert.deepEqual(relabel(nodes), nodes)
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
