// Structural map migrations run on every load, so each one must be
// idempotent: a map that is already migrated comes back unchanged.

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
//   With `everyCopy`, it also does so under a copy with nothing stored under
//   it yet, built-in or custom (one whose label the owner saved in the
//   editor, which never offers its built-in children otherwise); a copy
//   holding only custom children is left alone. Give such a node an entry for
//   each of its built-in children, so the first one stored does not stand in
//   for the rest.
// - `move` reparents the node, with its subtree, under the node at `into`,
//   creating `into` when only its parent is stored. With `id`, it moves the
//   node with that id at the path instead, custom or not.
// - `remove` merges the node into its namesake under `mergeInto` (notes,
//   children carry over, a differing summary becomes a note). With `as`, it
//   merges into the node labelled `as` there instead, creating the missing
//   levels of that path from the built-in taxonomy, and `summary` stands in
//   for the removed node's retired built-in summary. Without a target, a node holding anything
//   the owner wrote becomes custom and stays put; a bare one is deleted (a
//   stored copy of `summary` on the node itself does not count as the owner's).
//   With `exclude`, the label also goes into the parent's excludedChildLabels,
//   for a parent label whose built-in children other copies of it still need.
// A node that lands beside a namesake is merged into it the same way.
//
// `rehomeOrphans` reattaches nodes whose parent no longer exists (left behind
// when an older app version dropped a stale built-in node but not its
// children); see rehomeOrphans below.
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
const FINE_ARTS = ['Arts', 'Visual Arts', 'Fine Arts']
const MEDIA_ARTS = ['Arts', 'Media Arts']
const ISAIAH_ORACLES = ['Isaiah', '1–35 (Judgment and Promise)', '13:1–23:18 (Oracles Against the Nations)']
const GALILEAN_MINISTRY = ['Matthew', '4:12–9:35 (The Galilean Ministry Begins)']
const PETERS_DENIALS_SUMMARY = 'Peter follows into the high priest\'s courtyard and denies Jesus twice at the gate; meanwhile Jesus is questioned about his teaching and struck by a guard.'
const FINE_ARTS_SUMMARY = 'The visual and performing arts created primarily for aesthetic and expressive purposes, including film, painting, and sculpture.'
const KECCAK256_SUMMARY = 'Computes the Keccak-256 hash (a bytes32) of a bytes input, often built with abi.encode or abi.encodePacked, e.g. keccak256(abi.encodePacked("x")).'
const HISTORY_OF_PHILOSOPHY = ['History of Philosophy']
const VEDIC = [...HISTORY_OF_PHILOSOPHY, 'Vedic Indian Philosophy (16th c BC - 6th c BC)']
const CLASSICAL_CHINESE = [...HISTORY_OF_PHILOSOPHY, 'Classical Chinese Philosophy (6th c BC - 3rd c BC)']
const DAOISM = [...CLASSICAL_CHINESE, 'Daoism (6th c BC - present)']
const CONFUCIANISM = [...CLASSICAL_CHINESE, 'Confucianism (551 BC - present)']
const EARLY_AFRICANA = [...HISTORY_OF_PHILOSOPHY, 'Early Africana Philosophy (c. 24th c BC - 19th c)']
const ANCIENT_GREEK = [...HISTORY_OF_PHILOSOPHY, 'Ancient Western Philosophy (6th c BC - 5th c AD)', 'Ancient Greek Philosophy (6th c BC - 1st c BC)']
const CLASSICAL_GREEK = [...ANCIENT_GREEK, 'Classical Greek Philosophy (5th c BC - 4th c BC)']
const HELLENISTIC = [...ANCIENT_GREEK, 'Hellenistic Philosophy (3rd c BC - 1st c BC)']
const LATE_NEOPLATONISM = [...HISTORY_OF_PHILOSOPHY, 'Ancient Western Philosophy (6th c BC - 5th c AD)', 'Late Antiquity (1st c AD - 6th c AD)', 'Late Neoplatonism (350 AD - 500 AD)']
const CLASSICAL_INDIAN = [...HISTORY_OF_PHILOSOPHY, 'Classical Indian Philosophy (6th c BC - 11th c AD)']
const INDIAN_BUDDHISM = [...CLASSICAL_INDIAN, 'Indian Buddhism (6th c BC - present)']
const IMPERIAL_CHINESE = [...HISTORY_OF_PHILOSOPHY, 'Imperial Chinese Philosophy (3rd c BC - 20th c AD)']
const MEDIEVAL_WESTERN = [...HISTORY_OF_PHILOSOPHY, 'Medieval Western Philosophy (5th c - 15th c)']
const SCHOLASTICISM = [...MEDIEVAL_WESTERN, 'Scholasticism (11th c - 17th c)']
const MEDIEVAL_INDIAN = [...HISTORY_OF_PHILOSOPHY, 'Medieval Indian Philosophy (8th c - 18th c)']
const EARLY_MODERN = [...HISTORY_OF_PHILOSOPHY, 'Early Modern Western Philosophy (17th c - 18th c)']
const LATE_MODERN = [...HISTORY_OF_PHILOSOPHY, 'Late Modern Western Philosophy (19th c)']
const CONTEMPORARY_WESTERN = [...HISTORY_OF_PHILOSOPHY, 'Contemporary Western Philosophy (19th c - 21st c)']
const ANALYTIC = [...CONTEMPORARY_WESTERN, 'Analytic Philosophy (1900s - present)']
const CONTINENTAL = [...CONTEMPORARY_WESTERN, 'Continental Philosophy (1920s - present)']
const PRE_SOCRATIC = [...ANCIENT_GREEK, 'Pre-Socratic Philosophy (6th c BC - 5th c BC)']
const GOLDEN_AGE_ISLAMIC = [...HISTORY_OF_PHILOSOPHY, 'Golden Age Islamic Philosophy (8th c - 13th c)']
const CONTEMPORARY_POLITICAL = [...CONTEMPORARY_WESTERN, 'Contemporary Political Philosophy (19th c - 21st c)']
const AMERICAN_POLITICAL = [...CONTEMPORARY_POLITICAL, 'American Political Philosophy (20th c)']
const VYASA_SUMMARY = 'Emphasized the interconnectedness of all existence and the pursuit of liberation (moksha) through self-knowledge and righteous action.'
// `add` entries for built-in children new under `under`, in taxonomy order.
const COGNITIVE_PSYCHOLOGY = ['Psychology', 'Cognitive Psychology']
const COGNITION = [...COGNITIVE_PSYCHOLOGY, 'Cognition']
const TYPES_OF_INTELLIGENCE = [...COGNITION, 'General Intelligence (g)', 'Types of Intelligence']
const EARLY_BRONZE_AGE = ['Bronze Age (3,200 BC - 1,200 BC)', 'Early Bronze Age (3,200 BC - 2,000 BC)']
const ASK_A_DEEP_QUESTION_SUMMARY = 'The first step in the Loop for Understanding: posing a meaningful question that invites the partner to share something real about themselves.'
const EXPRESSIONISM_SUMMARY = 'The view that art expresses the emotions, feelings, or inner states of the artist.'
const JEWISH_PHILOSOPHY_SUMMARY = 'The philosophical thought developing from Jewish theological and ethical traditions.'
const addEach = (under, labels) => labels.map((add) => ({ add, under }))
const addEachToEveryCopy = (under, labels) => labels.map((add) => ({ add, under, everyCopy: true }))
const refileEach = (from, labels, into) => ({ refile: labels.map((label) => [...from, label]), into })
const ANCIENT_MIGRATION_PERIOD_SUMMARY = 'Characterized by significant movements of various peoples, primarily Germanic tribes, leading to widespread upheaval, the decline of the Western Roman Empire, and the emergence of new political entities across Europe.'

// The admin map's hidden Mossad Killed Kennedy summary, archived off-map.
const ARCHIVED_MOSSAD_SUMMARY = "The theory that Israeli intelligence orchestrated Kennedy's assassination in response to his pressure on Israel to open its Dimona nuclear facility to international inspection."

// Label renames, old label to new. Unlike the migrations below they run once
// per map: the map's root records the last version applied
// (labelMigrationVersion), so a node the owner later gives an old label keeps
// it. A built-in node is renamed only under a parent whose built-in children
// list the new label (or the parent named in LABEL_MIGRATION_PARENTS), so a
// namesake elsewhere in the map is left alone. Personal nodes are never
// renamed, and custom nodes only where their entry there sets `custom`.
export const LABEL_MIGRATIONS_BY_VERSION = {
  1: {
    Art: 'Arts',
  },
  2: {
    '3.3 million years ago - 3,200 BC Prehistory': 'Prehistory (3.3 million years ago - 3,200 BC)',
    '3,200 BC - 476 AD Ancient History': 'Ancient History (3,200 BC - 476 AD)',
    '476 - 1453 Medieval Period': 'Medieval Period (476 - 1453)',
    '1453 - present Modern Era': 'Modern Era (1453 - present)',
    '3.3 million years ago - 3,300 BC Stone Age': 'Stone Age (3.3 million years ago - 3,300 BC)',
    '3,300 BC - 3,200 BC Early Bronze Age (Prehistoric)': 'Early Bronze Age (3,300 BC - 3,200 BC)',
    '3.3 million years ago - 10,000 BC Paleolithic Era': 'Paleolithic Era (3.3 million years ago - 10,000 BC)',
    '10,000 BC - 8,000 BC Mesolithic Era': 'Mesolithic Era (10,000 BC - 8,000 BC)',
    '8,000 BC - 4,500 BC Neolithic Era': 'Neolithic Era (8,000 BC - 4,500 BC)',
    '4,500 BC - 3,300 BC Copper Age': 'Copper Age (4,500 BC - 3,300 BC)',
    '3.3 million years ago - 300,000 years ago Lower Paleolithic': 'Lower Paleolithic (3.3 million years ago - 300,000 years ago)',
    '300,000 years ago - 40,000 years ago Middle Paleolithic': 'Middle Paleolithic (300,000 years ago - 40,000 years ago)',
    '40,000 years ago - 10,000 BC Upper Paleolithic': 'Upper Paleolithic (40,000 years ago - 10,000 BC)',
    '300,000 years ago - 120,000 years ago Early Middle Paleolithic': 'Early Middle Paleolithic (300,000 years ago - 120,000 years ago)',
    '120,000 years ago - 40,000 years ago Last Glacial Period (Middle Paleolithic)': 'Last Glacial Period, Middle Paleolithic (120,000 years ago - 40,000 years ago)',
    '40,000 years ago - 10,000 BC Last Glacial Period (Upper Paleolithic)': 'Last Glacial Period, Upper Paleolithic (40,000 years ago - 10,000 BC)',
    '10,875 BC - 10,000 BC Younger Dryas Event (Upper Paleolithic)': 'Younger Dryas Event, Upper Paleolithic (10,875 BC - 10,000 BC)',
    '10,000 BC - 9,675 BC Last Glacial Period End (Mesolithic)': 'Last Glacial Period End, Mesolithic (10,000 BC - 9,675 BC)',
    '10,000 BC - 9,675 BC Younger Dryas Event (Mesolithic)': 'Younger Dryas Event, Mesolithic (10,000 BC - 9,675 BC)',
    '9,675 BC - 9,575 BC Younger Dryas End (Late Mesolithic)': 'Younger Dryas End, Late Mesolithic (9,675 BC - 9,575 BC)',
    '9,675 BC - 8,000 BC Late Mesolithic': 'Late Mesolithic (9,675 BC - 8,000 BC)',
    '4,100 BC - 3,300 BC Sumerian Civilization (Copper Age)': 'Sumerian Civilization (4,100 BC - 3,300 BC)',
    '4,100 BC - 3,300 BC Uruk Period': 'Uruk Period (4,100 BC - 3,300 BC)',
    '4,100 BC - 3,300 BC Predynastic Egypt (Copper Age)': 'Predynastic Egypt (4,100 BC - 3,300 BC)',
    '3,500 BC - 3,300 BC Ebla Civilization (Copper Age)': 'Ebla Civilization (3,500 BC - 3,300 BC)',
    '3,300 BC - 3,200 BC Indus Valley Civilization (Prehistoric)': 'Indus Valley Civilization (3,300 BC - 3,200 BC)',
    '3,300 BC - 3,200 BC Cycladic Civilization (Prehistoric)': 'Cycladic Civilization (3,300 BC - 3,200 BC)',
    '3,200 BC - 1,200 BC Bronze Age (Ancient)': 'Bronze Age (3,200 BC - 1,200 BC)',
    '1,200 BC - 600 BC Iron Age': 'Iron Age (1,200 BC - 600 BC)',
    '3,100 BC - 30 BC Ancient Egypt': 'Ancient Egypt (3,100 BC - 30 BC)',
    '3,500 BC - 539 BC Ancient Mesopotamia': 'Ancient Mesopotamia (3,500 BC - 539 BC)',
    '3,300 BC - 600 AD Ancient India': 'Ancient India (3,300 BC - 600 AD)',
    '2,070 BC - 220 AD Ancient China': 'Ancient China (2,070 BC - 220 AD)',
    '800 BC - 146 BC Ancient Greece': 'Ancient Greece (800 BC - 146 BC)',
    '753 BC - 476 AD Ancient Rome': 'Ancient Rome (753 BC - 476 AD)',
    '476 - 1000 Early Middle Ages': 'Early Middle Ages (476 - 1000)',
    '1000 - 1250 High Middle Ages': 'High Middle Ages (1000 - 1250)',
    '1250 - 1453 Late Middle Ages': 'Late Middle Ages (1250 - 1453)',
    '330 - 1453 Byzantine Empire': 'Byzantine Empire (330 - 1453)',
    '750 - 1258 Islamic Golden Age': 'Islamic Golden Age (750 - 1258)',
    '1453 - 1789 Early Modern Period': 'Early Modern Period (1453 - 1789)',
    '1789 - 1945 Late Modern Period': 'Late Modern Period (1789 - 1945)',
    '1945 - present Contemporary Period': 'Contemporary Period (1945 - present)',
    '1300 - 1600 Renaissance': 'Renaissance (1300 - 1600)',
    '1400 - 1800 Age of Discovery': 'Age of Discovery (1400 - 1800)',
    '1517 - 1648 Reformation': 'Reformation (1517 - 1648)',
    '1637 - 1800 Enlightenment': 'Enlightenment (1637 - 1800)',
    '1543 - 1687 Scientific Revolution': 'Scientific Revolution (1543 - 1687)',
    '1760 - 1840 Industrial Revolution': 'Industrial Revolution (1760 - 1840)',
    '1774 - 1849 Age of Revolutions': 'Age of Revolutions (1774 - 1849)',
    '1800 - 1945 Imperialism': 'Imperialism (1800 - 1945)',
    '1914 - 1918 World War I': 'World War I (1914 - 1918)',
    '1918 - 1939 Interwar Period': 'Interwar Period (1918 - 1939)',
    '1939 - 1945 World War II': 'World War II (1939 - 1945)',
    'Ethics': 'Ethics/Moral Philosophy',
    'Gettier Problem': 'The Gettier Problem',
    'Virtue Ethics': 'Aristotle\'s Virtue Ethics',
    'Deontology': 'Kant\'s Deontology',
    'Alternate Theory: Israel Killed Kennedy': 'Alternate Theories',
    'Ockham\'s Radical Nominalism': 'Ockham\'s Conceptualism',
    'Free Will': 'Free Will vs. Determinism',
    '1947 - 1991 Cold War': 'Cold War Era (1947 - 1991)',
    'Cold War (1947 - 1991)': 'Cold War Era (1947 - 1991)',
    '1991 - 2001 Post-Cold War Era': 'Post-Cold War Era (1991 - 2001)',
    '2001 - present 21st Century': '21st Century (2001 - present)',
  },
  3: {
    'First Trump Presidency (2016 - 2020)': 'First Trump Presidency (2017 - 2021)',
    'Migration Period (500 - 750)': 'Migration Period (c. 375 - 568)',
    'Migration Period (750 - 800)': 'Rise of the Carolingians (750 - 800)',
  },
  4: {
    'Jürgen Habermas (1929-present)': 'Jürgen Habermas (1929-2026)',
    'V. Y. Mudimbe (1941-present)': 'V. Y. Mudimbe (1941-2025)',
    'Paulin J. Hountondji (1942-present)': 'Paulin J. Hountondji (1942-2024)',
    'Li Zehou (1930-present)': 'Li Zehou (1930-2021)',
  },
}

// The parent of a renamed label that its built-in parent no longer lists.
// `custom` lets the rename reach the owner's own custom node (never a Personal
// one), for a fix the owner asked for.
const LABEL_MIGRATION_PARENTS = {
  '21st Century (2001 - present)': { parent: 'Contemporary Period (1945 - present)' },
  // Owner-requested date correction from PR #8: terms run inauguration to inauguration, so 2017 - 2021.
  // The one deliberate rename of an owner-made node, limited to this parent and run once per map.
  'First Trump Presidency (2017 - 2021)': { parent: 'America During the Post-Cold War Era', custom: true },
}

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
    {
      remove: ['Late Antiquity (250 - 500 AD)', 'Migration Period (300 - 500 AD)'],
      mergeInto: ['History', 'Medieval Period (476 - 1453)', 'Early Middle Ages (476 - 1000)', 'Late Antiquity (500 - 750)'],
      as: 'Migration Period (c. 375 - 568)',
      summary: ANCIENT_MIGRATION_PERIOD_SUMMARY,
    },
  ],
  7: [
    // The admin map's old JFK assassination, Church Committee, Dimona and
    // Aliyahs children lost their parents; put them back in the tree. The
    // hidden Mossad theory is too speculative to restore (archived off-map).
    { rehomeOrphans: true, dropArchived: [{ label: 'Mossad Killed Kennedy', summary: ARCHIVED_MOSSAD_SUMMARY }] },
  ],
  8: [
    // Film and Video Games are media arts, not visual arts: Fine Arts held only
    // Film, and Interactive Art is for gallery installations.
    { add: MEDIA_ARTS.at(-1), under: MEDIA_ARTS.slice(0, -1) },
    { move: [...FINE_ARTS, 'Film'], into: MEDIA_ARTS },
    { move: ['Arts', 'Visual Arts', 'Digital Art', 'Interactive Art', 'Video Games'], into: MEDIA_ARTS },
    { add: 'Film', under: MEDIA_ARTS },
    { add: 'Video Games', under: MEDIA_ARTS },
    { remove: FINE_ARTS, summary: FINE_ARTS_SUMMARY },
  ],
  10: [
    // Isaiah 14:29 warns the Philistines; the admin map's custom verse node sat
    // under the Assyria oracle.
    { move: [...ISAIAH_ORACLES, '14:24–27 (The Oracle Against Assyria)', '29'], id: 5076, into: [...ISAIAH_ORACLES, '14:28–32 (The Oracle Against Philistia)'] },
    // Job's replies are 6–7, 9–10, 12–14, 16–17, 19, 21 and then 23–24.
    { rename: ['22–27 (The Third Cycle of Speeches)', '23–24 (Job\'s Sixth Response)'], label: '23–24 (Job\'s Seventh Response)' },
    // John 18:15-27 holds all three denials, only the first of them at the gate.
    {
      rename: ['John', '18:15-27 (Peter\'s First Denial and High Priest Questioning)'],
      label: '18:15-27 (Peter\'s Denials and Jesus Before Annas)',
      dropSummaries: [PETERS_DENIALS_SUMMARY],
    },
    { add: '21 (The King\'s Joy in God\'s Strength)', under: ['1–41 (Book I: Genesis Comparison)', '19–24 (God\'s Glory, Law, and Kingship)'] },
    // The Sermon on the Mount is Matthew 5–7 and opens with the Beatitudes.
    { rename: [...GALILEAN_MINISTRY, '5:13–7:27 (The Sermon on the Mount)'], label: '5–7 (The Sermon on the Mount)' },
    { label: '5:1–12 (The Beatitudes)', homePath: [...GALILEAN_MINISTRY, '5–7 (The Sermon on the Mount)'] },
  ],
  11: [
    // The darśana founders are classical, not Vedic: date them by their sūtras
    // and give each its school under Classical Indian Philosophy.
    { rename: [...VEDIC, 'Vyasa (1500 BC)'], label: 'Bādarāyaṇa (Vyāsa) (c. 2nd c BC)', dropSummaries: [VYASA_SUMMARY] },
    { rename: [...VEDIC, 'Kapila (7th c BC)'], label: 'Kapila (legendary, c. 6th c BC)' },
    { rename: [...VEDIC, 'Gautama (6th c BC)'], label: 'Akṣapāda Gautama (c. 2nd c AD)' },
    { rename: [...VEDIC, 'Kanada (6th c BC)'], label: 'Kaṇāda (c. 2nd c BC)' },
    { rename: [...VEDIC, 'Jaimini (6th c BC)'], label: 'Jaimini (c. 2nd c BC)' },
    // New traditions, schools and figures under built-in parents that are already stored.
    ...addEach(HISTORY_OF_PHILOSOPHY, [
      'Early Africana Philosophy (c. 24th c BC - 19th c)',
      'Jewish Philosophy (1st c - 21st c)',
      'Byzantine Philosophy (4th c - 15th c)',
      'Korean Philosophy (7th c - 19th c)',
      'Classical and Medieval Japanese Philosophy (794-1603)',
      'Latin American and Iberian Philosophy (16th c - 21st c)',
    ]),
    ...addEach(CLASSICAL_CHINESE, ['Mohism (5th c BC - 3rd c BC)', 'School of Names (4th c BC - 3rd c BC)']),
    ...addEach(CLASSICAL_GREEK, ['Cyrenaics (4th c BC - 3rd c BC)']),
    ...addEach(HELLENISTIC, ['Peripatetic School (335 BC - 3rd c AD)']),
    ...addEach([...HELLENISTIC, 'Skepticism (4th c BC - 3rd c AD)'], ['Academic Skepticism (3rd c BC - 1st c BC)']),
    ...addEach(CLASSICAL_INDIAN, [
      'Sāṃkhya (c. 6th c BC - 16th c AD)',
      'Mīmāṃsā (c. 2nd c BC - present)',
      'Vaiśeṣika (c. 2nd c BC - 10th c AD)',
      'Yoga (c. 2nd c BC - present)',
      'Early Vedānta (c. 2nd c BC - 8th c AD)',
      'Nyāya (c. 2nd c AD - 10th c AD)',
    ]),
    ...addEach(INDIAN_BUDDHISM, ['Asaṅga (4th c AD)', 'Buddhaghosa (5th c AD)', 'Candrakīrti (c. 600 AD - c. 650 AD)', 'Dharmakīrti (7th c AD)']),
    ...addEach(IMPERIAL_CHINESE, ['Neo-Daoism/Xuanxue (3rd c - 4th c)']),
    ...addEach([...IMPERIAL_CHINESE, 'Neo-Confucianism (960 - present)'], ['Lu Xiangshan (1139-1193)', 'Wang Fuzhi (1619-1692)', 'Dai Zhen (1724-1777)']),
    ...addEach(MEDIEVAL_WESTERN, ['Medieval Mysticism (13th c - 15th c)']),
    ...addEach(SCHOLASTICISM, ['Early Scholasticism (11th c - 12th c)']),
    ...addEach([...SCHOLASTICISM, 'Nominalism (11th c - 21st c)'], ['Jean Buridan (c. 1300-c. 1360)']),
    ...addEach(GOLDEN_AGE_ISLAMIC, ['Kalām (8th c - present)']),
    ...addEach(MEDIEVAL_INDIAN, ['Tibetan Buddhist Philosophy (8th c - present)']),
    ...addEach([...HISTORY_OF_PHILOSOPHY, 'Post-Classical Islamic Philosophy (13th c - 19th c)'], ['Ibn Taymiyya (1263-1328)']),
    ...addEach([...HISTORY_OF_PHILOSOPHY, 'Western Renaissance Philosophy (15th c - 16th c)'], ['Nicholas of Cusa (1401-1464)']),
    ...addEach(EARLY_MODERN, ['Modern Natural Law (17th c - 18th c)']),
    ...addEach([...EARLY_MODERN, 'Continental Rationalism (17th c)'], ['Nicolas Malebranche (1638-1715)', 'Pierre Bayle (1647-1706)']),
    ...addEach([...EARLY_MODERN, 'British Empiricism (17th c - 18th c)'], ['Francis Bacon (1561-1626)']),
    ...addEach([...EARLY_MODERN, 'The Enlightenment (18th c)'], ['Giambattista Vico (1668-1744)', 'Edmund Burke (1729-1797)', 'Johann Gottfried Herder (1744-1803)']),
    ...addEach(LATE_MODERN, ['Positivism (1830s - 1900s)', 'Anarchism (1840s - present)', 'British Idealism (1860s - 1920s)', 'Process and Life Philosophy (1880s - present)']),
    ...addEach([...LATE_MODERN, 'Transcendentalism (1830s-1860s)'], ['Ralph Waldo Emerson (1803-1882)']),
    ...addEach([...HISTORY_OF_PHILOSOPHY, 'Modern Indian Philosophy (19th c - 21st c)'], ['K. C. Bhattacharya (1875-1949)', 'Bimal Krishna Matilal (1935-1991)']),
    ...addEach([...HISTORY_OF_PHILOSOPHY, 'Modern Japanese Philosophy (19th c - 21st c)'], ['D. T. Suzuki (1870-1966)']),
    ...addEach([...HISTORY_OF_PHILOSOPHY, 'Modern Islamic Philosophy (20th c - 21st c)'], ['Seyyed Hossein Nasr (1933-present)']),
    ...addEach([...HISTORY_OF_PHILOSOPHY, 'Modern African Philosophy (20th c - 21st c)'], [
      'Placide Tempels (1906-1977)',
      'Léopold Sédar Senghor (1906-2001)',
      'Kwame Nkrumah (1909-1972)',
      'Frantz Fanon (1925-1961)',
      'Kwame Gyekye (1939-2019)',
      'Henry Odera Oruka (1944-1995)',
    ]),
    ...addEach(ANALYTIC, [
      'Logical Positivism (1920s - 1950s)',
      'Ordinary Language Philosophy (1940s - 1960s)',
      'Philosophy of Science (20th c - present)',
      'Virtue Ethics Revival (1958 - present)',
      'Philosophy of Mind (20th c - present)',
      'Analytic Philosophy of Religion (1960s - present)',
    ]),
    ...addEach(CONTEMPORARY_POLITICAL, ['Classical Liberalism (17th c - present)']),
    ...addEach(CONTINENTAL, ['Hermeneutics (19th c - present)', 'Structuralism (1910s - 1970s)', 'Feminist Philosophy (20th c - present)']),
    ...addEach([...CONTINENTAL, 'Phenomenology (19th c - present)'], ['Franz Brentano (1838-1917)', 'Max Scheler (1874-1928)', 'Emmanuel Levinas (1906-1995)', 'Maurice Merleau-Ponty (1908-1961)']),
    // Stored figures move to their one home with their ids, notes and subtrees;
    // a duplicate copy (Shankara under Vedic, Proclus under Neoplatonism) merges in.
    { label: 'Bādarāyaṇa (Vyāsa) (c. 2nd c BC)', homePath: [...CLASSICAL_INDIAN, 'Early Vedānta (c. 2nd c BC - 8th c AD)'] },
    { label: 'Kapila (legendary, c. 6th c BC)', homePath: [...CLASSICAL_INDIAN, 'Sāṃkhya (c. 6th c BC - 16th c AD)'] },
    { label: 'Akṣapāda Gautama (c. 2nd c AD)', homePath: [...CLASSICAL_INDIAN, 'Nyāya (c. 2nd c AD - 10th c AD)'] },
    { label: 'Kaṇāda (c. 2nd c BC)', homePath: [...CLASSICAL_INDIAN, 'Vaiśeṣika (c. 2nd c BC - 10th c AD)'] },
    { label: 'Jaimini (c. 2nd c BC)', homePath: [...CLASSICAL_INDIAN, 'Mīmāṃsā (c. 2nd c BC - present)'] },
    { label: 'Adi Shankara (788 AD - 820 AD)', homePath: [...MEDIEVAL_INDIAN, 'Vedanta Schools (8th c - present)'] },
    { label: 'Proclus (412 AD - 485 AD)', homePath: LATE_NEOPLATONISM },
    // Hobbes, Gassendi and Goodman are not medieval nominalists. Gassendi, who
    // revived Epicurus, and Goodman share migration 12's homes for them.
    { label: 'Pierre Gassendi (1592-1655)', homePath: [...HELLENISTIC, 'Epicureanism (306 BC - present)'] },
    { label: 'Thomas Hobbes (1588-1679)', homePath: [...EARLY_MODERN, 'British Empiricism (17th c - 18th c)'] },
    { label: 'Nelson Goodman (1906-1998)', homePath: [...ANALYTIC, 'Philosophy of Science (20th c - present)'] },
    { label: 'Hans-Georg Gadamer (1900-2002)', homePath: [...CONTINENTAL, 'Hermeneutics (19th c - present)'] },
  ],
  12: [
    // Figures that sat loose under a period or tradition beside its schools
    // move into a school: an existing one, or a new subgroup the sources name.
    // Each refile moves the built-in copies stored in the figure's old place,
    // with their ids, notes and subtrees; the subgroups are also added under
    // parents already expanded, for maps that never stored the figures.
    ...addEach(CLASSICAL_GREEK, ['The Academy (c. 387 BC - 1st c BC)']),
    ...addEach(CLASSICAL_INDIAN, ['Vyākaraṇa/Grammarian School (c. 4th c BC - 18th c AD)']),
    ...addEach(SCHOLASTICISM, ['High Scholasticism (13th c - 14th c)']),
    ...addEach(GOLDEN_AGE_ISLAMIC, ['Falsafa (9th c - 12th c)']),
    ...addEach(MEDIEVAL_INDIAN, ['Shaiva Philosophy (9th c - present)']),
    ...addEach(ANALYTIC, [
      'Early Analytic Philosophy (1870s - 1930s)',
      'Philosophy of Logic and Mathematics (20th c - present)',
      'Philosophy of Language (20th c - present)',
      'Analytic Epistemology (20th c - present)',
      'Analytic Ethics (20th c - present)',
    ]),
    ...addEach(CONTEMPORARY_POLITICAL, [
      'Civic Republicanism (15th c - present)',
      'Conservatism (18th c - present)',
      'Objectivism (1940s - present)',
      'Communitarianism (1980s - present)',
    ]),
    ...addEach(AMERICAN_POLITICAL, ['Liberal Egalitarianism (1970s - present)']),
    ...addEach(CONTINENTAL, ['Christian Platonism and Religious Thought (20th c)']),
    refileEach(PRE_SOCRATIC, ['Heraclitus of Ephesus (535 BC - 475 BC)'], [...PRE_SOCRATIC, 'Milesian School/Ionian School (6th c BC)']),
    refileEach(CLASSICAL_GREEK, ['Plato (~428 BC - ~347 BC)'], [...CLASSICAL_GREEK, 'The Academy (c. 387 BC - 1st c BC)']),
    refileEach(CLASSICAL_GREEK, ['Aristotle (384 BC - 322 BC)'], [...HELLENISTIC, 'Peripatetic School (335 BC - 3rd c AD)']),
    refileEach(CLASSICAL_INDIAN, ['Bhartṛhari (c. 5th c AD)'], [...CLASSICAL_INDIAN, 'Vyākaraṇa/Grammarian School (c. 4th c BC - 18th c AD)']),
    refileEach(SCHOLASTICISM, ['Albertus Magnus (c. 1200-1280)', 'Roger Bacon (c. 1214-1292)', 'Bonaventure (c. 1217-1274)', 'Marsilius of Padua (c. 1275-1342)'], [...SCHOLASTICISM, 'High Scholasticism (13th c - 14th c)']),
    refileEach(GOLDEN_AGE_ISLAMIC, ['Al-Ghazali (1058-1111)'], [...GOLDEN_AGE_ISLAMIC, 'Kalām (8th c - present)']),
    refileEach(GOLDEN_AGE_ISLAMIC, [
      'Al-Kindi (801-873)',
      'Al-Farabi (872-950)',
      'Avicenna (Ibn Sina) (980-1037)',
      'Ibn Bajjah (Avempace) (1085-1138)',
      'Ibn Tufail (1105-1185)',
      'Ibn Rushd (Averroes) (1126-1198)',
    ], [...GOLDEN_AGE_ISLAMIC, 'Falsafa (9th c - 12th c)']),
    refileEach(MEDIEVAL_INDIAN, ['Abhinavagupta (c. 950-1016)', 'Basava (1131-1167)'], [...MEDIEVAL_INDIAN, 'Shaiva Philosophy (9th c - present)']),
    refileEach(MEDIEVAL_INDIAN, ['Gangesha Upadhyaya (13th c - 14th c)'], [...MEDIEVAL_INDIAN, 'Nyaya and Vaisheshika (10th c - present)']),
    refileEach(EARLY_MODERN, ['Joseph Butler (1692-1752)'], [...EARLY_MODERN, 'The Enlightenment (18th c)']),
    refileEach(LATE_MODERN, ['Herbert Spencer (1820-1903)'], [...LATE_MODERN, 'Utilitarianism (18th c - present)']),
    refileEach(ANALYTIC, ['Alfred North Whitehead (1861-1947)'], [...LATE_MODERN, 'Process and Life Philosophy (1880s - present)']),
    refileEach(ANALYTIC, [
      'Bernard Bolzano (1781-1848)',
      'Gottlob Frege (1848-1925)',
      'Bertrand Russell (1872-1970)',
      'G. E. Moore (1873-1958)',
      'Ludwig Wittgenstein (1889-1951)',
    ], [...ANALYTIC, 'Early Analytic Philosophy (1870s - 1930s)']),
    refileEach(ANALYTIC, ['Rudolf Carnap (1891-1970)'], [...ANALYTIC, 'Logical Positivism (1920s - 1950s)']),
    refileEach(ANALYTIC, ['Alfred Tarski (1901-1983)', 'Kurt Gödel (1906-1978)'], [...ANALYTIC, 'Philosophy of Logic and Mathematics (20th c - present)']),
    refileEach(ANALYTIC, ['P. F. Strawson (1919-2006)'], [...ANALYTIC, 'Ordinary Language Philosophy (1940s - 1960s)']),
    refileEach(ANALYTIC, ['Willard Van Orman Quine (1908-2000)', 'Donald Davidson (1917-2003)', 'Saul Kripke (1940-2022)', 'David Lewis (1941-2001)'], [...ANALYTIC, 'Philosophy of Language (20th c - present)']),
    refileEach(ANALYTIC, ['Hilary Putnam (1926-2016)'], [...ANALYTIC, 'Philosophy of Mind (20th c - present)']),
    refileEach(ANALYTIC, ['Wilfrid Sellars (1912-1989)', 'Edmund Gettier (1927-2021)'], [...ANALYTIC, 'Analytic Epistemology (20th c - present)']),
    refileEach(ANALYTIC, ['Bernard Williams (1929-2003)', 'Derek Parfit (1942-2017)'], [...ANALYTIC, 'Analytic Ethics (20th c - present)']),
    {
      refile: [[...AMERICAN_POLITICAL, 'Walter Lippmann (1889-1974)'], [...CONTEMPORARY_POLITICAL, 'Isaiah Berlin (1909-1997)']],
      into: [...CONTEMPORARY_POLITICAL, 'Classical Liberalism (17th c - present)'],
    },
    refileEach(CONTEMPORARY_POLITICAL, ['Alexis de Tocqueville (1805-1859)', 'Hannah Arendt (1906-1975)'], [...CONTEMPORARY_POLITICAL, 'Civic Republicanism (15th c - present)']),
    refileEach(CONTEMPORARY_POLITICAL, ['Leo Strauss (1899-1973)', 'Michael Oakeshott (1901-1990)'], [...CONTEMPORARY_POLITICAL, 'Conservatism (18th c - present)']),
    refileEach(CONTEMPORARY_POLITICAL, ['Ayn Rand (1905-1982)'], [...CONTEMPORARY_POLITICAL, 'Objectivism (1940s - present)']),
    refileEach(CONTEMPORARY_POLITICAL, ['Charles Taylor (1931-present)'], [...CONTEMPORARY_POLITICAL, 'Communitarianism (1980s - present)']),
    {
      refile: [[...AMERICAN_POLITICAL, 'John Rawls (1921-2002)'], [...CONTEMPORARY_POLITICAL, 'Martha Nussbaum (1947-present)']],
      into: [...AMERICAN_POLITICAL, 'Liberal Egalitarianism (1970s - present)'],
    },
    refileEach(CONTINENTAL, ['Simone Weil (1909-1943)', 'René Girard (1923-2015)'], [...CONTINENTAL, 'Christian Platonism and Religious Thought (20th c)']),
  ],
  13: [
    // Pre-Socratic figures new to schools a stored map may already have expanded.
    ...addEach([...PRE_SOCRATIC, 'Milesian School/Ionian School (6th c BC)'], ['Archelaus (~450 BC)', 'Diogenes of Apollonia (~440 BC)']),
    ...addEach([...PRE_SOCRATIC, 'Italian School (6th c BC - 5th c BC)', 'Pythagorean School (6th - 5th c BC)'], ['Philolaus (~470 BC - ~385 BC)']),
    ...addEach([...PRE_SOCRATIC, 'Italian School (6th c BC - 5th c BC)', 'Eleatic School (5th c BC)'], ['Melissus of Samos (~440 BC)']),
  ],
  14: [
    // One node per concept, each kept where a specialist would file it.
    { label: 'Statistics', homePath: ['Sciences', 'Formal Sciences'] },
    { label: 'Executive Functions', homePath: COGNITIVE_PSYCHOLOGY },
    // The neuroscience Cognition holds the admin map's General Intelligence (g)
    // branch; its built-in Intelligence folds into that branch.
    { label: 'Cognition', homePath: COGNITIVE_PSYCHOLOGY },
    { remove: [...COGNITION, 'Intelligence', 'Fluid Intelligence'], mergeInto: TYPES_OF_INTELLIGENCE },
    { remove: [...COGNITION, 'Intelligence', 'Crystallized Intelligence'], mergeInto: TYPES_OF_INTELLIGENCE },
    { remove: [...COGNITION, 'Intelligence'] },
    { label: 'Cognitive Behavioral Therapy (CBT)', homePath: ['Psychotherapy', 'Behavioral Therapy'] },
    { remove: ['Components of Emotions', 'Qualia'] },
    { remove: ['Workaround|Negativity Bias', 'Gratitude'] },
    { remove: ['Emotional Intimacy', 'Esteem'] },
    { remove: ['Happiness', 'Gratitude', 'Admiration'] },
    { remove: ['Manipulation Techniques/Strategies', 'Indirect', 'Projection'] },
    { remove: ['Manipulation Techniques/Strategies', 'Indirect', 'Scapegoating'] },
    { remove: ['Loop for Understanding', 'Ask a Deep Question'], summary: ASK_A_DEEP_QUESTION_SUMMARY },
    { remove: ['Loop for Understanding', 'Ask Follow-Up Questions'], mergeInto: ['Demonstrating Active Listening'] },
    { remove: ['Specific Persuasion Tactics', 'Emotional Appeals'] },
    { remove: ['Aristotle\'s Virtue Ethics', 'Aristotelian Ethics'] },
    { remove: ['Aristotle\'s Virtue Ethics', 'Practical Wisdom'] },
    { move: ['Aesthetics', 'Expression Theory'], into: ['Aesthetics', 'Art Theory'] },
    { remove: ['Art Theory', 'Expressionism'], summary: EXPRESSIONISM_SUMMARY },
    { remove: ['Judaism', 'Jewish Philosophy'], summary: JEWISH_PHILOSOPHY_SUMMARY },
    { remove: ['Ancient History (3,200 BC - 476 AD)', 'Late Antiquity (250 - 500 AD)'] },
    {
      remove: ['Prehistory (3.3 million years ago - 3,200 BC)', 'Early Bronze Age (3,300 BC - 3,200 BC)'],
      mergeInto: EARLY_BRONZE_AGE.slice(0, -1),
      as: EARLY_BRONZE_AGE.at(-1),
    },
    { rename: [...EARLY_BRONZE_AGE, 'Indus Valley Civilization (3,300 BC - 3,200 BC)'], label: 'Indus Valley Civilization (3,300 BC - 2,000 BC)' },
    { rename: [...EARLY_BRONZE_AGE, 'Cycladic Civilization (3,300 BC - 3,200 BC)'], label: 'Cycladic Civilization (3,300 BC - 2,000 BC)' },
    ...addEach(EARLY_BRONZE_AGE, ['Indus Valley Civilization (3,300 BC - 2,000 BC)', 'Cycladic Civilization (3,300 BC - 2,000 BC)']),
    { move: ['Neuroscience', 'Systems/Cognitive Neuroscience', 'Cognitive Neuroscience'], into: ['Biology', 'Neuroscience'] },
    { remove: ['Neuroscience', 'Systems/Cognitive Neuroscience'] },
    { remove: ['Smart Contract Development', 'Security'] },
    // JavaScript keeps its built-in ternary node; Solidity's own sits under Syntax > Operators.
    { remove: ['Solidity', 'Data Types', 'Functions', 'Control Flow', 'Conditional Statements', 'Conditional Operator/Ternary Operator'], exclude: true },
    { remove: ['Browser Environment|auth', 'Local Storage|auth'] },
    { remove: ['Browser Environment|auth', 'Session Storage|auth'] },
    { remove: ['CLI Tools', 'TypeScript|cli'] },
    // The opcode and Solidity's keccak256() differ; a suffixed label gives the opcode its own summary.
    { rename: ['opcodes (operation codes)', 'keccak256'], label: 'keccak256|opcode' },
  ],
  15: [
    // Each philosopher's named ideas. The philosophers were leaves, and a copy
    // saved from the label editor is custom, so it showed none of them.
    ...addEachToEveryCopy([...EARLY_AFRICANA, 'Ptahhotep (c. 24th c BC)'], ['Ma\'at']),
    ...addEachToEveryCopy([...EARLY_AFRICANA, 'Anton Wilhelm Amo (c. 1703-c. 1759)'], ['Impassivity of the Mind']),
    ...addEachToEveryCopy([...EARLY_AFRICANA, 'Frederick Douglass (1818-1895)'], ['Composite Nationality']),
    ...addEachToEveryCopy([...EARLY_AFRICANA, 'W. E. B. Du Bois (1868-1963)'], ['Double Consciousness', 'Psychological Wage', 'Talented Tenth']),
    ...addEachToEveryCopy([...VEDIC, 'Yajnavalkya (8th c BC)'], ['Atman', 'Atman-Brahman Identity', 'Karma', 'Neti Neti']),
    ...addEachToEveryCopy([...DAOISM, 'Laozi (Lao Tzu) (6th c BC)'], ['Dao', 'Wu Wei', 'Ziran']),
    ...addEachToEveryCopy([...DAOISM, 'Zhuangzi (Chuang Tzu) (369 BC - 286 BC)'], ['Butterfly Dream', 'Cook Ding', 'Happy Fish Debate', 'Perspectivism (Qiwulun)', 'Usefulness of the Useless']),
    ...addEachToEveryCopy([...CONFUCIANISM, 'Confucius (Kong Fuzi) (551 BC - 479 BC)'], ['Filial Piety', 'Golden Rule (Shu)', 'Junzi', 'Li', 'Rectification of Names', 'Ren', 'Rule by Virtue']),
    ...addEachToEveryCopy([...CONFUCIANISM, 'Mencius (Mengzi) (372 BC - 289 BC)'], [
      'Child at the Well', 'Constant Means, Constant Heart', 'Extension', 'Fish and Bear\'s Paw', 'Flood-like Qi', 'Four Sprouts', 'Graded Love',
      'Great Body and Small Body', 'Human Nature Is Good', 'Mandate of Heaven', 'Ox Mountain', 'Right of Revolution', 'Righteousness over Profit',
    ]),
  ],
  16: [
    // Xunzi's named ideas, stored the same way as migration 15's.
    ...addEachToEveryCopy([...CONFUCIANISM, 'Xunzi (Xun Kuang) (3rd c BC)'], [
      'Division of Heaven and Humans',
      'Emptiness, Unity and Stillness',
      'Fen',
      'Heavenly Ruler',
      'Human Nature Is Bad',
      'Li|xunzi',
      'Obscuration',
      'Potter and Clay',
      'Rectification of Names|xunzi',
      'Rule of Man',
      'The Man in the Street Can Become Yu',
      'Warped Wood',
      'Wei',
    ]),
  ],
  17: [
    // Dong Zhongshu's named ideas, stored the same way as migration 15's.
    ...addEachToEveryCopy([...CONFUCIANISM, 'Dong Zhongshu (179 BC - 104 BC)'], [
      'Dismiss the Hundred Schools',
      'Five Constants',
      'Heaven Does Not Change, Nor Does the Way',
      'Rice and Grain',
      'Subtle Words and Great Meaning',
      'Three Bonds',
      'Tianren Ganying',
      'Uncrowned King',
      'Virtue Primary, Punishment Secondary',
      'Zaiyi',
    ]),
  ],
  18: [
    // Mozi's named ideas, stored the same way as migration 15's.
    ...addEachToEveryCopy([...CLASSICAL_CHINESE, 'Mohism (5th c BC - 3rd c BC)', 'Mozi (Mo Di) (c. 470 BC - c. 391 BC)'], [
      'Fa',
      'Fei Gong',
      'Fei Ming',
      'Fei Yue',
      'Jian Ai',
      'Jie Yong',
      'Jie Zang',
      'Ming Gui',
      'San Biao',
      'Shang Tong',
      'Shang Xian',
      'Tian Zhi',
      'Zhu',
    ]),
  ],
  19: [
    // Hui Shi's named ideas, stored the same way as migration 15's.
    ...addEachToEveryCopy([...CLASSICAL_CHINESE, 'School of Names (4th c BC - 3rd c BC)', 'Hui Shi (c. 370 BC - c. 310 BC)'], [
      'Fan Ai',
      'Great One',
      'Great Sameness and Difference',
      'One Body',
      'Pi',
      'Quarrel on a Snail\'s Horns',
      'Small One',
      'Small Sameness and Difference',
      'Wu Qing',
    ]),
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
  9: [
    {
      label: 'Data Types',
      from: 'The set of value types (fixed-size, stack-stored) and reference types (dynamic, heap-stored) available in Solidity for representing and organizing contract data.',
      to: 'Solidity\'s value types, copied whenever they are assigned or passed, and reference types (arrays, structs, mappings), which refer to data in storage, memory or calldata.',
    },
    {
      label: 'Value Types/Static Types/Fixed-Size Data Types',
      from: 'Types whose size is known and fixed at compile time, stored directly on the stack — includes booleans, integers, addresses, and fixed-size byte arrays.',
      to: 'Types whose size is fixed at compile time and whose values are copied whenever they are assigned or passed — includes booleans, integers, addresses, and fixed-size byte arrays.',
    },
    {
      label: 'Primitive/Value',
      from: 'Immutable value types stored on the stack: Number, BigInt, String, Boolean, Undefined, Null, Symbol.',
      to: 'Immutable values that are not objects and are copied and compared by value: Number, BigInt, String, Boolean, Undefined, Null, Symbol.',
    },
    {
      label: 'Chaining Operator|JSX',
      from: 'The optional chaining operator in JSX — safely accesses a property, returning null or undefined instead of throwing an error.',
      to: 'The optional chaining operator ?. (plain JavaScript since ES2020, so it also works in JSX): a?.b returns undefined instead of throwing if a is null or undefined.',
    },
    {
      label: 'keccak256',
      from: 'A cryptographic hash function native to the EVM that generates a unique 256-bit hash of its input; input must be ABI-encoded first using abi.encodePacked(), e.g. keccak256(abi.encodePacked("x")).',
      to: KECCAK256_SUMMARY,
    },
    {
      label: 'keccak256',
      from: 'A cryptographic hash function native to the EVM that generates a unique 256-bit hash of its input; input must be ABI-encoded first using abi.encodePacked()',
      to: KECCAK256_SUMMARY,
    },
    {
      label: 'Methods',
      from: 'Functions defined within a contract that interact with its state variables, distinguished from pure/view functions by their ability to modify on-chain state.',
      to: 'Solidity has no separate method kind: a "method" is a function called on a value with dot syntax, such as array.push(x) or a library function attached with using A for B.',
    },
    {
      label: 'Modules|py-packages',
      from: 'See: Types/Data Types → Modules',
      to: 'A single .py file whose definitions can be imported; a package is a directory of modules.',
    },
    {
      label: 'Bash',
      from: 'The Bourne-Again SHell — a popular command-line interpreter and scripting language, the default shell on most Linux distributions and macOS, enabling users to interact with the OS by typing commands.',
      to: 'The Bourne-Again SHell — a popular command-line interpreter and scripting language, the default shell on most Linux distributions (and on macOS until Catalina switched to zsh in 2019), enabling users to interact with the OS by typing commands.',
    },
    {
      label: 'Uncles',
      from: 'Valid but non-canonical blocks that narrowly lost the race to be included in the main chain, rewarded by Ethereum to reduce centralization pressure caused by its fast ~17-second block times.',
      to: 'Under proof-of-work Ethereum (before The Merge, September 2022): valid but non-canonical blocks that narrowly lost the race to be included in the main chain, rewarded to reduce centralization pressure from its fast ~13-second block times. Proof-of-stake Ethereum has no uncles.',
    },
    {
      label: 'Ethash (PoW)',
      from: 'Ethereum\'s original memory-hard, ASIC-resistant proof-of-work mining algorithm, designed to favor GPU miners over centralized mining farms by requiring large amounts of memory.',
      to: 'Ethereum\'s original memory-hard, ASIC-resistant proof-of-work mining algorithm, designed to favor GPU miners over centralized mining farms by requiring large amounts of memory. Retired at The Merge (September 2022), when Ethereum moved to proof-of-stake.',
    },
  ],
}

// Each entry edits one stored custom node, found by `id`, only while it is
// still custom and has exactly `label` and `summary` ('' for none), so a node
// the owner has edited since, or a built-in node that happens to share the
// id on another map, is left alone. `set` holds the new label and/or summary.
// A `swap` entry exchanges the labels and sibling order of two such nodes,
// so each keeps its summary and subtree under the other's placeholder.
// A `mergeInto` entry ({ id, label } of the node to keep) merges a duplicate
// custom node into another node, as a structural `remove` does; with
// `takeSummary` the kept node shows the duplicate's summary and keeps its own
// as a note.
// Use these only for custom nodes, which have no built-in text to fix.
export const NODE_EDITS_BY_VERSION = {
  9: [
    {
      id: 3295,
      label: 'x[y]',
      summary: 'Selects any element that has the attribute x, regardless of its value.',
      set: { summary: 'Mapping access: returns the value stored for key y in mapping x, or the value type\'s zero value if y was never set.' },
    },
    {
      id: 2419,
      label: '>=0.8.7',
      summary: 'Returns true if the left operand is greater than or equal to the right operand.',
      set: { summary: 'Any compiler version 0.8.7 or newer, including 0.9.0 and later breaking releases.' },
    },
    { id: 2603, label: '^0.8.7', summary: '', set: { summary: 'Any 0.8.x compiler from 0.8.7 up: the same as >=0.8.7 <0.9.0.' } },
    { id: 2604, label: '0.8.7', summary: '', set: { summary: 'Exactly compiler version 0.8.7.' } },
    // In `address x y = z;` visibility comes before the name, as in `address public owner = ...;`.
    {
      swap: [
        { id: 2467, label: 'x', summary: 'the variable name' },
        { id: 3059, label: 'y', summary: 'optional visibility modifiers' },
      ],
    },
    { id: 2427, label: 'True', summary: '', set: { label: 'true' } },
    { id: 2428, label: 'False', summary: '', set: { label: 'false' } },
    { id: 3105, label: 'Default Value', summary: 'False', set: { summary: 'false' } },
    {
      id: 3414,
      label: 'selfdestruct',
      summary: 'destroys a contract and forwards its remaining ETH balance to a specified address, though it is deprecated and its behavior is changing in future Ethereum upgrades.',
      set: { summary: 'sends the contract\'s whole ETH balance to a specified address. Since the Dencun upgrade (EIP-6780, March 2024) it deletes the contract\'s code and storage only when called in the transaction that created the contract; otherwise it only sends the ETH. Deprecated since Solidity 0.8.18.' },
    },
    {
      id: 3316,
      label: 'x',
      summary: 'the name of the event.  Typically contractname_event (this is an industry standard.',
      set: { summary: 'the name of the event, conventionally in CapWords (e.g. Transfer, Approval).' },
    },
    {
      id: 3293,
      label: 'Arrays',
      summary: 'A fixed-size, contiguous block of memory storing elements of the same type with O(1) random access.',
      set: { summary: 'An ordered collection of same-type elements, of fixed or dynamic length, accessed by zero-based index.' },
    },
    {
      id: 3183,
      label: 'Custom Errors',
      summary: 'named, optionally parameterized error types declared at the contract level that can only be triggered with revert, and are more gas efficient than string messages.',
      set: { summary: 'named, optionally parameterized error types, triggered with revert or (since 0.8.26 via IR, 0.8.27 in the legacy pipeline) require(condition, MyError()), and more gas efficient than string messages.' },
    },
  ],
  14: [
    // Operation Horev began on 22 Dec 1948; the 1949 copy is the same node.
    {
      id: 1496,
      label: 'Operation Horev (Dec. - Jan.)',
      summary: 'The large-scale Israeli offensive against Egyptian forces in the Western Negev, pushing into the Sinai and forcing Egypt to seek an armistice.',
      mergeInto: { id: 1377, label: 'Operation Horev (Dec. - Jan.)' },
    },
    // Aliyah Bet ran until May 1948.
    {
      id: 1499,
      label: 'Aliyah Bet (1934 - 1947)',
      summary: 'Clandestine Jewish immigration to Palestine carried out in defiance of British restrictions, organized to rescue Jews from persecution in Europe.',
      mergeInto: { id: 1527, label: 'Aliyah Bet (1934 - 1948)' },
    },
    {
      id: 1455,
      label: 'Iranian Revolution (Jan. - Apr.)',
      summary: 'The overthrow of the Shah\'s regime and establishment of an Islamic Republic under Ayatollah Khomeini, fundamentally reshaping the Middle East.',
      mergeInto: { id: 1252, label: 'Iranian Revolution of 1979' },
    },
    // The Cold War node restated its Cold War Era parent; its events move up a level.
    {
      id: 1391,
      label: 'The Cold War (1947 - 1991)',
      summary: 'a decades-long global struggle for ideological and geopolitical supremacy between the United States and the Soviet Union, characterized by proxy wars, nuclear brinkmanship, and the eventual collapse of the Eastern Bloc in 1991.',
      mergeInto: { id: 208, label: 'Cold War Era (1947 - 1991)' },
      takeSummary: true,
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

// Like holdsOwnerContent, but a stored summary equal to one of `knownSummaries`
// is not the owner's.
const holdsOwnerContentBesides = (node, knownSummaries) =>
  holdsOwnerContent({ ...node, summary: knownSummaries.includes(node.summary) ? undefined : node.summary })

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

// Stores the built-in child `label` under `parent` the way expanding it would:
// a parent without built-in children gets its full built-in set, otherwise
// just that child. Returns null when the taxonomy does not list it there.
const storeBuiltInChild = (mapNodes, parent, label, topicSubdivisions) => {
  const excluded = parent.excludedChildLabels || []
  const expected = (topicSubdivisions[parent.label] || []).filter((childLabel) => !excluded.includes(childLabel))
  if (!expected.includes(label)) return null
  const children = mapNodes.filter((node) => node.parentId === parent.id)
  const taken = new Set(children.map((child) => child.label).filter((childLabel) => childLabel !== label))
  const labels = children.some((child) => !child.isCustom) ? [label] : [...new Set(expected)].filter((l) => !taken.has(l))
  const hidden = children[0]?.hidden ?? true
  let maxId = maxIdOf(mapNodes)
  const created = labels.map((childLabel) => ({ id: ++maxId, label: childLabel, parentId: parent.id, hidden }))
  return { nodes: [...mapNodes, ...created], child: created.find((node) => node.label === label) }
}

// Finds the deepest stored node along `homePath` and creates the levels below
// it with storeBuiltInChild.
const ensureHome = (mapNodes, homePath, topicSubdivisions) => {
  const byId = new Map(mapNodes.map((node) => [node.id, node]))
  let depth = homePath.length
  let anchor = findHome(mapNodes, byId, homePath)
  while (!anchor && depth > 1) anchor = findHome(mapNodes, byId, homePath.slice(0, --depth))
  if (!anchor) return null

  let nodes = mapNodes
  for (const label of homePath.slice(depth)) {
    const stored = storeBuiltInChild(nodes, anchor, label, topicSubdivisions)
    if (!stored) return null
    nodes = stored.nodes
    anchor = stored.child
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

const addBuiltInNode = (mapNodes, { add, under, everyCopy }) => {
  const byId = new Map(mapNodes.map((node) => [node.id, node]))
  const childrenByParent = buildChildrenByParent(mapNodes)
  let maxId = maxIdOf(mapNodes)
  const created = []
  const accepts = everyCopy ? (node) => !node.isPersonal : isBuiltIn
  for (const parent of nodesAtPath(mapNodes, byId, under, accepts)) {
    const children = childrenByParent.get(parent.id) || []
    if (!children.some((child) => !child.isCustom) && !(everyCopy && children.length === 0)) continue
    if (children.some((child) => child.label === add)) continue
    if ((parent.excludedChildLabels || []).includes(add)) continue
    created.push({ id: ++maxId, label: add, parentId: parent.id, hidden: children[0]?.hidden ?? true })
  }
  if (created.length === 0) return { nodes: mapNodes, changed: false }
  return { nodes: [...mapNodes, ...created], changed: true }
}

const moveBuiltInNode = (mapNodes, { move, id, into }, builtInSummary) => {
  let nodes = mapNodes
  const accepts = id === undefined ? isBuiltIn : (node) => node.id === id
  for (const source of nodesAtPath(mapNodes, new Map(mapNodes.map((node) => [node.id, node])), move, accepts)) {
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

// Moves the built-in nodes stored at each of `refile`'s label paths under the
// built-in node at `into`, with their ids, notes and subtrees, merging one into
// a namesake already there. A missing home and the levels above it are stored
// as expanding them would; a home that held no built-in children before also
// gets the rest of its built-in set, so it never needs expanding again, less
// any label the owner took out of a parent a refile path names.
const refileBuiltInNodes = (mapNodes, { refile, into }, builtInSummary, topicSubdivisions) => {
  const byIdAtStart = new Map(mapNodes.map((node) => [node.id, node]))
  const sources = refile.flatMap((path) => nodesAtPath(mapNodes, byIdAtStart, path))
  if (sources.length === 0) return { nodes: mapNodes, changed: false }

  let nodes = mapNodes
  let home = findHome(nodes, byIdAtStart, into)
  if (!home) {
    const ensured = ensureHome(nodes, into, topicSubdivisions)
    if (!ensured) return { nodes: mapNodes, changed: false }
    nodes = ensured.nodes
    home = ensured.home
  }
  const homeChildren = nodes.filter((node) => node.parentId === home.id)
  const hidden = homeChildren[0]?.hidden ?? (home.hidden || sources[0].hidden)
  const moved = []
  for (const source of sources) {
    if (isAncestorOrSelf(new Map(nodes.map((node) => [node.id, node])), source.id, home.id)) continue
    const sourcePath = labelPathOf(nodes, source.id)
    nodes = nodes.map((node) => (node.id === source.id ? withoutOrder({ ...node, parentId: home.id, hidden }) : node))
    nodes = settleUnder(nodes, source.id, home.id, builtInSummary, sourcePath)
    moved.push(source.label)
  }
  if (moved.length === 0) return { nodes: mapNodes, changed: false }

  if (!homeChildren.some((child) => !child.isCustom)) {
    const present = new Set(nodes.filter((node) => node.parentId === home.id).map((node) => node.label))
    const expected = [...new Set(expectedChildren(home, topicSubdivisions))].filter((label) => !present.has(label))
    const oldParents = refile.flatMap((path) => nodesAtPath(mapNodes, byIdAtStart, path.slice(0, -1)))
    const ownerExcluded = new Set(oldParents.flatMap((parent) => parent.excludedChildLabels || []))
    const dropped = expected.filter((label) => ownerExcluded.has(label))
    let maxId = maxIdOf(nodes)
    const created = expected
      .filter((label) => !ownerExcluded.has(label))
      .map((label) => ({ id: ++maxId, label, parentId: home.id, hidden }))
    if (dropped.length > 0) {
      const excludedChildLabels = [...(home.excludedChildLabels || []), ...dropped]
      nodes = nodes.map((node) => (node.id === home.id ? { ...node, excludedChildLabels } : node))
    }
    nodes = [...nodes, ...created]
  }
  return { nodes, changed: true }
}

const excludeChildLabel = (mapNodes, parentId, label) => mapNodes.map((node) => {
  if (node.id !== parentId || (node.excludedChildLabels || []).includes(label)) return node
  return { ...node, excludedChildLabels: [...(node.excludedChildLabels || []), label] }
})

const removeBuiltInNode = (mapNodes, { remove, mergeInto, as, summary: retiredSummary, exclude }, builtInSummary, topicSubdivisions) => {
  let nodes = mapNodes
  const sourceSummary = (label) => (label === remove.at(-1) && retiredSummary) || builtInSummary(label)
  for (const source of nodesAtPath(mapNodes, new Map(mapNodes.map((node) => [node.id, node])), remove)) {
    if (exclude) nodes = excludeChildLabel(nodes, source.parentId, source.label)
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const notPersonal = (node) => !node.isPersonal
    let target = mergeInto && nodesAtPath(nodes, byId, [...mergeInto, as || source.label], notPersonal).find((node) => node.id !== source.id)
    if (!target && as) {
      const ensured = ensureHome(nodes, [...mergeInto, as], topicSubdivisions)
      if (ensured) {
        nodes = ensured.nodes
        target = ensured.home
      }
    }
    if (target) {
      nodes = mergeNode(nodes, source.id, target.id, sourceSummary)
      continue
    }
    const ids = subtreeIds(buildChildrenByParent(nodes), source.id)
    const ownerWrote = (id) => holdsOwnerContentBesides(byId.get(id), id === source.id && retiredSummary ? [retiredSummary] : [])
    if (ids.some(ownerWrote)) {
      const summary = source.summary || sourceSummary(source.label) || undefined
      nodes = nodes.map((node) => (node.id === source.id ? { ...node, isCustom: true, summary } : node))
    } else {
      const removed = new Set(ids)
      nodes = nodes.filter((node) => !removed.has(node.id))
    }
  }
  return { nodes, changed: nodes !== mapNodes }
}

const isRoot = (node) => node.parentId === null || node.parentId === undefined

const reachableIds = (mapNodes) => {
  const childrenByParent = buildChildrenByParent(mapNodes)
  const ids = new Set()
  const stack = mapNodes.filter(isRoot).map((node) => node.id)
  while (stack.length > 0) {
    const id = stack.pop()
    if (ids.has(id)) continue
    ids.add(id)
    for (const child of childrenByParent.get(id) || []) stack.push(child.id)
  }
  return ids
}

const expectedChildren = (node, topicSubdivisions) => {
  const excluded = node.excludedChildLabels || []
  return (topicSubdivisions[node.label] || []).filter((label) => !excluded.includes(label))
}

const describe = (node) => (node.isPersonal ? `#${node.id} (personal)` : `#${node.id} "${node.label}"`)

// Reattaches each node whose parent no longer exists (an orphan), oldest first:
// 1. It merges into its one reachable built-in namesake (narrowed to those
//    whose parent's built-in children list it): the namesake keeps its own
//    summary or takes the orphan's, notes and children carry over.
// 2. Otherwise its home is the one reachable node whose built-in children list
//    it, or else a built-in level that lists it, when exactly one reachable
//    node lists such a level; that level is stored first, and stored alone
//    among ordered siblings it takes the lowest free order, the slot its lost
//    copy left. An orphan holding nothing the owner wrote except summaries
//    already stored under its home (or under the one parent the owner took
//    its label out of) is a duplicate and is deleted; any other moves under
//    its home.
// 3. Without a home it is deleted if it holds nothing the owner wrote, and
//    otherwise left untouched.
// Personal orphans are left untouched. Before any of this, an unreachable node
// labelled as one of `dropArchived` is deleted with its subtree when that
// holds nothing the owner wrote beyond the built-in or archived summary.
// `log`, when given, collects one line per action.
const rehomeOrphans = (mapNodes, { dropArchived = [] }, builtInSummary, topicSubdivisions, log) => {
  const note = (line) => log?.push(line)
  const pathText = (mapNodesNow, id) => labelPathOf(mapNodesNow, id).join(' > ')
  let nodes = mapNodes
  const reachableAtStart = reachableIds(nodes)
  const byIdAtStart = new Map(nodes.map((node) => [node.id, node]))
  const childrenAtStart = buildChildrenByParent(nodes)
  const removed = new Set()
  for (const node of nodes) {
    const archived = dropArchived.find(({ label }) => label === node.label)
    if (!archived || reachableAtStart.has(node.id) || removed.has(node.id)) continue
    const ids = subtreeIds(childrenAtStart, node.id)
    const subtree = ids.map((id) => byIdAtStart.get(id))
    if (subtree.some((member) => holdsOwnerContentBesides(member, [builtInSummary(member.label), archived.summary]))) continue
    for (const id of ids) removed.add(id)
    note(`deleted ${describe(node)} (${ids.length} node(s)): archived off-map`)
  }
  if (removed.size > 0) nodes = nodes.filter((node) => !removed.has(node.id))
  const skipped = new Set()
  for (;;) {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const orphan = nodes
      .filter((node) => !isRoot(node) && !byId.has(node.parentId) && !skipped.has(node.id))
      .sort((a, b) => a.id - b.id)[0]
    if (!orphan) break
    skipped.add(orphan.id)
    if (orphan.isPersonal) {
      note(`left ${describe(orphan)} untouched: personal orphans are not moved`)
      continue
    }

    const childrenByParent = buildChildrenByParent(nodes)
    const reachable = [...reachableIds(nodes)].map((id) => byId.get(id)).filter((node) => !node.isPersonal)
    const subtree = subtreeIds(childrenByParent, orphan.id).map((id) => byId.get(id))
    const listsOrphan = (node) => expectedChildren(node, topicSubdivisions).includes(orphan.label)

    let namesakes = reachable.filter((node) => node.label === orphan.label && !node.isCustom)
    if (namesakes.length > 1) namesakes = namesakes.filter((node) => listsOrphan(byId.get(node.parentId) || {}))
    if (namesakes.length === 1) {
      const [target] = namesakes
      const summaryNote = orphan.summary && !target.summary ? ', summary copied' : ''
      nodes = mergeNode(nodes, orphan.id, target.id, builtInSummary, labelPathOf(nodes, orphan.id))
      note(`merged ${describe(orphan)} into ${describe(target)} at ${pathText(nodes, target.id)}${summaryNote}`)
      continue
    }

    const homes = reachable.filter(listsOrphan)
    let home = homes.length === 1 ? homes[0] : null
    let level = null
    if (!home) {
      const levels = reachable.flatMap((node) => expectedChildren(node, topicSubdivisions)
        .filter((label) => (topicSubdivisions[label] || []).includes(orphan.label))
        .filter((label) => !nodes.some((child) => child.parentId === node.id && child.label === label))
        .map((label) => ({ parent: node, label })))
      if (levels.length === 1) [level] = levels
    }

    // A parent the owner took this label out of (excludedChildLabels) does not
    // take it back, but a copy the owner refiled under it still counts.
    const refiledFrom = home || level ? [] : reachable.filter((node) =>
      (topicSubdivisions[node.label] || []).includes(orphan.label) && (node.excludedChildLabels || []).includes(orphan.label))
    const checkAt = home || (refiledFrom.length === 1 ? refiledFrom[0] : null)
    const storedThere = new Set(checkAt ? subtreeIds(childrenByParent, checkAt.id).map((id) => byId.get(id).summary).filter(Boolean) : [])
    const duplicate = subtree.every((node) =>
      !holdsOwnerContent({ ...node, summary: storedThere.has(node.summary) ? undefined : node.summary }))
    if (duplicate) {
      const removed = new Set(subtree.map((node) => node.id))
      nodes = nodes.filter((node) => !removed.has(node.id))
      const reason = checkAt ? `its summaries are already stored under ${describe(checkAt)}` : 'it holds nothing the owner wrote'
      note(`deleted ${describe(orphan)} (${subtree.length} node(s)): ${reason}`)
      continue
    }

    if (level) {
      const stored = storeBuiltInChild(nodes, level.parent, level.label, topicSubdivisions)
      const created = stored.nodes.slice(nodes.length)
      const siblings = nodes.filter((node) => node.parentId === level.parent.id)
      if (created.length === 1 && siblings.length > 0 && siblings.every((node) => Number.isInteger(node.order))) {
        const used = new Set(siblings.map((node) => node.order))
        let order = 0
        while (used.has(order)) order++
        stored.child.order = order
      }
      nodes = stored.nodes
      home = stored.child
      note(`created ${describe(home)} under ${describe(level.parent)} at ${pathText(nodes, level.parent.id)}`)
    }
    if (!home) {
      note(`left ${describe(orphan)} untouched: it has no home`)
      continue
    }

    const siblings = nodes.filter((node) => node.parentId === home.id)
    const hidden = siblings[0]?.hidden ?? (home.hidden || orphan.hidden)
    const sourcePath = labelPathOf(nodes, orphan.id)
    nodes = nodes.map((node) => (node.id === orphan.id ? withoutOrder({ ...node, parentId: home.id, hidden }) : node))
    note(`moved ${describe(orphan)} (${subtree.length} node(s)) under ${describe(home)} at ${pathText(nodes, home.id)}`)
    nodes = settleUnder(nodes, orphan.id, home.id, builtInSummary, sourcePath)
  }
  return { nodes, changed: nodes !== mapNodes }
}

const runStructuralMigration = (mapNodes, migration, builtInSummary, topicSubdivisions, log) => {
  if (migration.rehomeOrphans) return rehomeOrphans(mapNodes, migration, builtInSummary, topicSubdivisions, log)
  if (migration.rename) return renameBuiltInNode(mapNodes, migration, builtInSummary)
  if (migration.add) return addBuiltInNode(mapNodes, migration)
  if (migration.move) return moveBuiltInNode(mapNodes, migration, builtInSummary)
  if (migration.refile) return refileBuiltInNodes(mapNodes, migration, builtInSummary, topicSubdivisions)
  if (migration.remove) return removeBuiltInNode(mapNodes, migration, builtInSummary, topicSubdivisions)
  return consolidateBuiltInNode(mapNodes, migration, builtInSummary, topicSubdivisions)
}

// builtInSummary(label) returns the built-in summary text for a label, so a
// merged copy's displayed summary can be kept on a custom node.
// topicSubdivisions maps a label to its built-in child labels.
// log, when given, collects a line per orphan rehoming action.
export const applyStructuralMigrations = (mapNodes, builtInSummary = () => '', topicSubdivisions = {}, log = null) => {
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
      const result = runStructuralMigration(nodes, migration, builtInSummary, topicSubdivisions, log)
      nodes = result.nodes
      changed = changed || result.changed
    }
  }
  return { nodes, changed }
}

export const LATEST_LABEL_MIGRATION_VERSION = Math.max(...Object.keys(LABEL_MIGRATIONS_BY_VERSION).map(Number))

// topicSubdivisions is as for applyStructuralMigrations. A renamed node is
// relabelled in place, even beside a sibling that already has the new label.
export const applyLabelMigrations = (mapNodes, topicSubdivisions = {}) => {
  if (!Array.isArray(mapNodes)) return { nodes: [], changed: false }
  const roots = mapNodes.filter(isRoot)
  const applied = Math.max(0, ...roots.map((root) => Number(root.labelMigrationVersion) || 0))
  if (roots.length === 0 || applied >= LATEST_LABEL_MIGRATION_VERSION) return { nodes: mapNodes, changed: false }

  const pending = Object.keys(LABEL_MIGRATIONS_BY_VERSION)
    .map(Number)
    .filter((version) => version > applied)
    .sort((a, b) => a - b)
    .map((version) => LABEL_MIGRATIONS_BY_VERSION[version])
  const migrate = (label) => pending.reduce((current, renames) => renames[current] || current, label)
  const belongsUnder = (label, parentLabel) => {
    const home = LABEL_MIGRATION_PARENTS[label]
    return home ? home.parent === parentLabel : (topicSubdivisions[parentLabel] || []).includes(label)
  }

  // Walk down from the roots, so a parent's new label is known before its children.
  const childrenByParent = buildChildrenByParent(mapNodes)
  const labelAfter = new Map()
  const renames = new Map()
  const queue = [...roots]
  const seen = new Set()
  while (queue.length > 0) {
    const node = queue.shift()
    if (seen.has(node.id)) continue
    seen.add(node.id)
    labelAfter.set(node.id, node.label)
    const label = migrate(node.label)
    const parentLabel = labelAfter.get(node.parentId)
    const allowed = isBuiltIn(node) || (LABEL_MIGRATION_PARENTS[label]?.custom && !node.isPersonal)
    if (label !== node.label && allowed && parentLabel !== undefined && belongsUnder(label, parentLabel)) {
      labelAfter.set(node.id, label)
      renames.set(node.id, label)
    }
    queue.push(...(childrenByParent.get(node.id) || []))
  }

  const nodes = mapNodes.map((node) => {
    if (isRoot(node)) return { ...node, labelMigrationVersion: LATEST_LABEL_MIGRATION_VERSION }
    return renames.has(node.id) ? { ...node, label: renames.get(node.id) } : node
  })
  return { nodes, changed: true }
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

// Merges the custom node `source` into `target` with mergeNode. Its children
// take its place among the target's children, in their own order, when the
// source, they and those siblings are all ordered.
const mergeCustomNode = (mapNodes, source, target, takeSummary) => {
  let nodes = mapNodes
  if (takeSummary && source.summary && source.summary !== target.summary) {
    const earlier = target.summary ? [{ id: `replaced-summary-${target.id}`, text: `Earlier summary: ${target.summary}`, level: 0 }] : []
    const notes = mergeNotes(target.notes, earlier)
    nodes = nodes.map((node) => (node.id === target.id ? { ...node, summary: source.summary, notes } : node))
  }
  const siblings = nodes.filter((node) => node.parentId === target.id && node.id !== source.id)
  const children = nodes.filter((node) => node.parentId === source.id)
  nodes = mergeNode(nodes, source.id, target.id, () => '')

  const ordered = (list) => list.every((node) => Number.isInteger(node.order))
  if (!Number.isInteger(source.order) || !ordered(siblings) || !ordered(children)) return nodes
  const childIds = new Set(children.map((node) => node.id))
  const movedIds = new Set(nodes.filter((node) => node.parentId === target.id && childIds.has(node.id)).map((node) => node.id))
  if (movedIds.size === 0) return nodes
  const byOrder = (a, b) => a.order - b.order
  const sequence = [
    ...siblings.filter((node) => node.order < source.order).sort(byOrder),
    ...children.filter((node) => movedIds.has(node.id)).sort(byOrder),
    ...siblings.filter((node) => node.order >= source.order).sort(byOrder),
  ]
  const orderOf = new Map(sequence.map((node, index) => [node.id, index]))
  return nodes.map((node) => (orderOf.has(node.id) ? { ...node, order: orderOf.get(node.id) } : node))
}

export const applyNodeEdits = (mapNodes) => {
  if (!Array.isArray(mapNodes)) return { nodes: [], changed: false }

  const edits = Object.keys(NODE_EDITS_BY_VERSION)
    .map((version) => Number(version))
    .sort((a, b) => a - b)
    .flatMap((version) => NODE_EDITS_BY_VERSION[version])

  let nodes = mapNodes
  const unedited = ({ id, label, summary }) => {
    const node = nodes.find((n) => n.id === id)
    return node && node.isCustom === true && node.label === label && (node.summary || '') === summary ? node : null
  }
  const takePlaceOf = (node, other) => {
    const moved = withoutOrder({ ...node, label: other.label })
    return 'order' in other ? { ...moved, order: other.order } : moved
  }
  for (const edit of edits) {
    if (edit.mergeInto) {
      const node = unedited(edit)
      const target = node && nodes.find((n) => n.id === edit.mergeInto.id && n.label === edit.mergeInto.label)
      if (target) nodes = mergeCustomNode(nodes, node, target, edit.takeSummary)
      continue
    }
    const updates = new Map()
    if (edit.swap) {
      const [a, b] = edit.swap.map(unedited)
      if (!a || !b) continue
      updates.set(a.id, takePlaceOf(a, b))
      updates.set(b.id, takePlaceOf(b, a))
    } else {
      const node = unedited(edit)
      if (!node) continue
      updates.set(node.id, { ...node, ...edit.set })
    }
    nodes = nodes.map((node) => updates.get(node.id) || node)
  }
  return { nodes, changed: nodes !== mapNodes }
}

// Drops the stale built-in children `staleIds` together with their subtrees,
// so no descendant is left behind without a parent. A child whose subtree
// holds a custom or Personal node or a note becomes custom and stays put
// instead, keeping the summary it showed, so nothing the owner wrote is lost.
// So does a stored summary that differs from the built-in one (the owner wrote
// or edited it); a stored copy of the built-in summary does not keep it.
export const dropStaleChildren = (mapNodes, staleIds, builtInSummary = () => '') => {
  const byId = new Map(mapNodes.map((node) => [node.id, node]))
  const childrenByParent = buildChildrenByParent(mapNodes)
  const removed = new Set()
  const kept = new Set()
  for (const id of staleIds) {
    if (!byId.has(id) || removed.has(id)) continue
    const ids = subtreeIds(childrenByParent, id)
    const nodesInSubtree = ids.map((subtreeId) => byId.get(subtreeId))
    if (nodesInSubtree.some((node) => holdsOwnerContentBesides(node, [builtInSummary(node.label)]))) kept.add(id)
    else for (const subtreeId of ids) removed.add(subtreeId)
  }
  if (removed.size === 0 && kept.size === 0) return { nodes: mapNodes, changed: false }
  const nodes = mapNodes
    .filter((node) => !removed.has(node.id))
    .map((node) => {
      if (!kept.has(node.id)) return node
      const summary = node.summary || builtInSummary(node.label)
      return summary ? { ...node, isCustom: true, summary } : { ...node, isCustom: true }
    })
  return { nodes, changed: true }
}

// Remove stale predefined children: for any node with known subdivisions,
// drop predefined children whose labels are not in the expected set, with
// dropStaleChildren. addChildren recreates correct children on first expand.
// A copy of a structurally migrated or refiled label is never dropped: if its
// home could not be stored (the owner deleted a level of it), it stays put.
export const removeStalePredefinedChildren = (mapNodes, topicSubdivisions, builtInSummary = () => '') => {
  const childrenByParent = buildChildrenByParent(mapNodes)
  const migratedLabels = new Set(Object.values(STRUCTURAL_MIGRATIONS_BY_VERSION).flat()
    .flatMap(({ label, refile }) => (refile ? refile.map((path) => path.at(-1)) : [label]))
    .filter(Boolean))

  const staleIds = []
  for (const node of mapNodes) {
    const expected = topicSubdivisions[node.label]
    if (!expected || expected.length === 0) continue
    for (const child of childrenByParent.get(node.id) || []) {
      if (!child.isCustom && !expected.includes(child.label) && !migratedLabels.has(child.label)) staleIds.push(child.id)
    }
  }
  return dropStaleChildren(mapNodes, staleIds, builtInSummary)
}
