// Personal (private) nodes that are seeded into the owner's own saved map.
// They are flagged isPersonal, so the server never serves them to anyone else
// (see getLatestGlobalNodes in server/routes/maps.js), and each seed runs once
// per map: the root records it, so deleting the nodes later keeps them gone.

export const OWNER_EMAIL = 'matthew.haney1993@gmail.com'
export const MY_ANCESTRY = 'My Ancestry (23andMe)'
const ANCESTRY_SEED_KEY = 'ancestry23andMeSeeded'
const ANCESTRY_HOME = 'Human Genetics'

// 23andMe Ancestry Composition (v7, updated 2025-09-15).
const ANCESTRY = [
  ['European 93.2%', [
    ['Western European 42.0%', [
      ['Swiss, Southwestern German & Western Austrian 29.5%'],
      ['Belgian, Rhinelander & Southern Dutch 6.9%'],
      ['French 5.6%'],
    ]],
    ['British & Irish 34.5%', [
      ['English 19.1%'],
      ['Scottish 12.3%'],
      ['Welsh 2.5%'],
      ['Irish 0.6%'],
    ]],
    ['Nordic 13.5%', [
      ['Swedish 11.3%'],
      ['Finnish 1.1%'],
      ['Danish 0.7%'],
      ['Norwegian 0.4%'],
    ]],
    ['Spanish & Portuguese 1.6%', [['Canary Islander 1.6%']]],
    ['Ashkenazi Jewish 1.1%'],
    ['Central & Eastern European 0.5%', [['Estonian 0.5%']]],
  ]],
  ['Indigenous American 6.1%', [
    ['North American 5.9%', [['Otomí']]],
    ['Western North American 0.2%'],
  ]],
  ['Trace Ancestry 0.7%'],
]

// Adds My Ancestry (23andMe) under Human Genetics once. Returns the same array
// when there is nothing to do.
export const seedMyAncestry = (mapNodes) => {
  if (!Array.isArray(mapNodes)) return { nodes: [], changed: false }
  const root = mapNodes.find((node) => node.parentId === null)
  const home = mapNodes.find((node) => node.label === ANCESTRY_HOME && !node.isCustom && !node.isPersonal)
  if (!root || !home || root[ANCESTRY_SEED_KEY]) return { nodes: mapNodes, changed: false }

  let nextId = Math.max(0, ...mapNodes.map((node) => (Number.isFinite(node.id) ? node.id : 0))) + 1
  const added = []
  const add = (label, parentId, children = [], extra = {}) => {
    const id = nextId++
    added.push({ id, label, parentId, isCustom: true, isPersonal: true, hidden: true, summary: '', order: added.filter((n) => n.parentId === parentId).length, ...extra })
    children.forEach(([childLabel, grandchildren]) => add(childLabel, id, grandchildren))
  }
  add(MY_ANCESTRY, home.id, ANCESTRY, { summary: 'My ancestry composition from 23andMe (v7, updated 2025-09-15).' })
  const nodes = mapNodes.map((node) => (node === root ? { ...node, [ANCESTRY_SEED_KEY]: true } : node))
  return { nodes: [...nodes, ...added], changed: true }
}
