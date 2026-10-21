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
const engineeringMap = () => buildMap(
  ['Root', [
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
  ]],
)

const SOFTWARE_DEVELOPMENT = 'Root > Software Engineering > Software Development/Programming'
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
  const before = buildMap(['Root', [
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
  ]])
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
  assert.equal(pathOf(nodes, forLoop), 'Root > Blockchain levels > Solidity levels > Control Flow > Loops > For Loops > for (x i = 0; i < 10; i++) {\ny\n}')
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
