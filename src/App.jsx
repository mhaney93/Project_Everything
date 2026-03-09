
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { authAPI, mapsAPI, filesAPI, API_BASE_URL } from './api';

// v2: Humanities integration complete
const NODE_WIDTH = 176;
const NODE_HEIGHT = 52;
const NODE_SIZE_MIN = 0.85;
const NODE_SIZE_MAX = 1.8;
const NODE_SIZE_STEP = 0.1;

const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (value) => value.length >= 8,
  },
  // Add more rules here as needed
  ];

// ...existing code...

// Debug logger utility
const debugLog = (...args) => {
  if (window && window.localStorage && window.localStorage.getItem('debugMapLog') === 'true') {
    console.log('[MAP-DEBUG]', ...args);
  }
};

// Recenter map when root node is selected, using latest layout and viewport
// (This useEffect should be placed after all state and ref declarations in the App component)
const H_GAP = 5;
const V_GAP = 45;
const PADDING = 90;
const DOTS_OFFSET = 12;

const INITIAL_NODES = [
  { id: 1, label: 'Everything', parentId: null, hidden: false },
];

const LABEL_MIGRATIONS_BY_VERSION = {
  1: {
    Art: 'Arts',
  },
};

// Parents whose children should use TOPIC_SUBDIVISIONS defined order (e.g., chronological)
// All other parents will be alphabetized by default
const ORDERED_CHILDREN_PARENTS = new Set([
  'History',
]);

// Topic keywords for semantic search fallback - helps suggest related topics when no exact match
const TOPIC_KEYWORDS = {
  'Philosophy': ['metaphysic', 'epistem', 'ethics', 'logic', 'ontology', 'kant', 'plato', 'aristotle', 'descartes', 'hume', 'locke', 'spinoza', 'nietzsche', 'wittgenstein', 'phenomenology', 'hermeneutic', 'moral philosophy', 'political philosophy', 'philosophy of mind', 'ancient philosophy', 'modern philosophy', 'continental philosophy', 'analytic philosophy'],
  'Metaphysics': ['being', 'substance', 'exist', 'reality', 'essence', 'modal', 'necessity', 'abstract', 'universal', 'free will', 'mind body', 'personal identity'],
  'Epistemology': ['knowledge', 'justify', 'belief', 'truth', 'reason', 'empiric', 'rational', 'induction', 'deduction', 'skeptic', 'theory of knowledge', 'justified true belief'],
  'Ethics': ['moral', 'virtue', 'value', 'right', 'wrong', 'good', 'duty', 'consequent', 'utilit', 'deontolog', 'moral philosophy', 'virtue ethics', 'applied ethics', 'moral theory'],
  'Aesthetics': ['beauty', 'art', 'taste', 'sublime', 'aesthetic', 'judgment', 'form', 'expression', 'creative', 'philosophy of art', 'aesthetic experience'],
  'Logic': ['argument', 'premise', 'conclusion', 'valid', 'fallacy', 'symbolic', 'propositional', 'predicate', 'formal logic', 'symbolic logic', 'logical reasoning'],
  'Political Philosophy': ['government', 'state', 'power', 'rights', 'freedom', 'justice', 'law', 'democracy', 'politics', 'authority', 'social contract', 'sovereignty', 'constitution', 'political theory', 'civil rights', 'human rights'],
  
  'Biology': ['organism', 'genetic', 'cell', 'evolution', 'species', 'anatomy', 'physiology', 'reproductive', 'penis', 'vagina', 'breast', 'uterus', 'ovary', 'testis', 'dna', 'protein', 'enzyme', 'metabolism', 'photosynthesis', 'biodiversity', 'ecology', 'mutation', 'blood', 'heart', 'lung', 'kidney', 'liver', 'brain', 'nerve', 'muscle', 'bone', 'tissue', 'cell biology', 'molecular biology', 'evolutionary biology', 'marine biology', 'human biology', 'natural selection'],
  'Chemistry': ['chemical', 'molecule', 'element', 'compound', 'reaction', 'atom', 'periodic', 'carbon', 'hydrogen', 'bond', 'oxidation', 'crystalline', 'ionic', 'valence', 'electrolyte', 'organic chemistry', 'inorganic chemistry', 'physical chemistry', 'chemical reaction', 'periodic table'],
  'Physics': ['motion', 'energy', 'force', 'quantum', 'relativity', 'gravity', 'wave', 'particle', 'einstein', 'newtonian', 'acceleration', 'velocity', 'momentum', 'thermodynamic', 'electromag', 'quantum mechanics', 'quantum physics', 'theory of relativity', 'general relativity', 'special relativity', 'particle physics', 'nuclear physics', 'classical mechanics'],
  'Mathematics': ['number', 'algebra', 'geometry', 'calculus', 'equation', 'theorem', 'proof', 'probability', 'linear', 'matrix', 'trigonometry', 'topology', 'set theory', 'function', 'integral', 'derivative', 'number theory', 'abstract algebra', 'differential equations', 'linear algebra'],
  'Astronomy': ['space', 'star', 'planet', 'galaxy', 'cosmic', 'universe', 'asteroid', 'satellite', 'nebula', 'black hole', 'constellation', 'orbit', 'celestial', 'meteor', 'solar system', 'milky way', 'outer space', 'planetary science'],
  'Earth Science': ['geology', 'earth', 'weather', 'climate', 'mineral', 'rock', 'plate tectonics', 'volcano', 'earthquake', 'erosion', 'atmosphere', 'ocean', 'soil', 'climate change', 'global warming', 'natural disaster', 'earth science'],
  
  'History': ['ancient', 'medieval', 'modern', 'era', 'period', 'century', 'war', 'civilization', 'revolution', 'empire', 'dynasty', 'renaissance', 'industrial', 'historical', 'world war', 'civil war', 'cold war', 'ancient history', 'modern history', 'medieval period', 'ancient greece', 'ancient rome', 'ancient egypt', 'world history', 'european history', 'american history', 'industrial revolution', 'french revolution'],
  'Religious Studies': ['religion', 'theology', 'faith', 'spiritual', 'church', 'prayer', 'sermon', 'scripture', 'god', 'divine', 'sacred', 'ritual', 'worship', 'doctrine', 'belief system', 'world religion', 'comparative religion', 'religious studies'],
  'Western Religions': ['christianity', 'judaism', 'islam', 'church', 'torah', 'quran', 'theology', 'monotheistic', 'abrahamic religions', 'western religion'],
  'Eastern Religions': ['buddhism', 'hinduism', 'taoism', 'confucian', 'zen', 'karma', 'dharma', 'meditation', 'enlightenment', 'eastern philosophy', 'eastern religion', 'zen buddhism'],
  'Christianity': ['jesus', 'christ', 'gospel', 'church', 'trinity', 'salvation', 'cross', 'theology', 'sacrament', 'new testament', 'old testament', 'christian theology'],
  'Islam': ['allah', 'muhammad', 'quran', 'mosque', 'jihad', 'shariah', 'five pillar', 'sunni', 'shia', 'islamic law', 'five pillars', 'islamic theology'],
  'Buddhism': ['buddha', 'enlightenment', 'dharma', 'karma', 'meditation', 'nirvana', 'bodhisattva', 'zen', 'tibetan', 'buddhist philosophy', 'tibetan buddhism', 'zen buddhism'],
  
  'Psychology': ['mind', 'behavior', 'conscious', 'mental', 'cognitive', 'freud', 'brain', 'emotion', 'therapy', 'psyche', 'conditioning', 'perception', 'memory', 'development', 'personality', 'disorder', 'cognitive psychology', 'social psychology', 'developmental psychology', 'clinical psychology', 'mental health', 'behavioral psychology'],
  'Neuroscience': ['brain', 'neural', 'cognitive', 'synapse', 'neuron', 'neurological', 'behavioral', 'cortex', 'cerebral', 'cognitive neuroscience', 'brain science', 'neural network'],
  'Sociology': ['society', 'social', 'culture', 'community', 'group', 'institution', 'class', 'identity', 'network', 'conflict', 'structure', 'norm', 'social structure', 'social science', 'social theory', 'cultural sociology'],
  'Anthropology': ['culture', 'human', 'society', 'ritual', 'kinship', 'ethnography', 'tribe', 'social structure', 'evolutionary', 'cultural anthropology', 'physical anthropology', 'human evolution'],
  'Economics': ['market', 'trade', 'money', 'economy', 'business', 'price', 'supply', 'demand', 'investment', 'capital', 'labor', 'inflation', 'gdp', 'commerce', 'supply and demand', 'economic theory', 'market economy', 'free market', 'macroeconomics', 'microeconomics'],
  
  'Arts': ['art', 'visual', 'painting', 'sculpture', 'gallery', 'creative', 'aesthetic', 'design', 'craft', 'medium', 'composition', 'perspective', 'visual arts', 'fine arts', 'modern art', 'contemporary art', 'art history'],
  'Visual Arts': ['painting', 'sculpture', 'drawing', 'graphics', 'color', 'form', 'perspective', 'composition', 'architecture', 'visual art', 'fine art', 'graphic design'],
  'Performing Arts': ['theater', 'dance', 'performance', 'acting', 'stage', 'drama', 'script', 'choreography', 'performing art', 'theatre arts'],
  'Music': ['musical', 'song', 'melody', 'harmony', 'composition', 'instrument', 'audio', 'rhythm', 'note', 'scale', 'tempo', 'orchestra', 'concert', 'classical music', 'jazz music', 'rock music', 'music theory', 'music history'],
  'Literature': ['novel', 'poetry', 'writing', 'author', 'story', 'narrative', 'character', 'plot', 'fiction', 'prose', 'verse', 'metaphor', 'world literature', 'english literature', 'american literature', 'literary theory', 'creative writing'],
  'Languages': ['language', 'linguistic', 'grammar', 'syntax', 'translation', 'dialect', 'communication', 'phonetic', 'semantic', 'etymology', 'vocabulary', 'second language', 'foreign language', 'language learning'],
  'Statistics': ['data', 'probability', 'distribution', 'variance', 'mean', 'regression', 'sampling', 'hypothesis', 'correlation', 'statistical analysis', 'data analysis', 'probability theory'],
}

const applyLabelMigrations = (mapNodes) => {
  if (!Array.isArray(mapNodes)) return { nodes: [], changed: false }

  const orderedVersions = Object.keys(LABEL_MIGRATIONS_BY_VERSION)
    .map((version) => Number(version))
    .sort((a, b) => a - b)

  let changed = false
  const migratedNodes = mapNodes.map((node) => {
    let nextLabel = node.label

    orderedVersions.forEach((version) => {
      const versionMap = LABEL_MIGRATIONS_BY_VERSION[version]
      nextLabel = versionMap[nextLabel] || nextLabel
    })

    if (nextLabel === node.label) return node

    changed = true
    return {
      ...node,
      label: nextLabel,
    }
  })

  return { nodes: migratedNodes, changed }
}

const buildLayout = (nodes, topicSubdivisions = {}, nodeWidth = NODE_WIDTH, nodeHeight = NODE_HEIGHT) => {
  if (nodes.length === 0) {
    return { positions: new Map(), edges: [], bounds: null };
  }

  const root = nodes.find((node) => node.parentId == null) || nodes[0];
  const childrenById = new Map();
  nodes.forEach((node) => {
    childrenById.set(node.id, []);
  });
  nodes.forEach((node) => {
    if (node.parentId != null && childrenById.has(node.parentId) && !node.hidden) {
      childrenById.get(node.parentId).push(node);
    }
  });

  // Sort children: use topicSubdivisions order for specific parents, otherwise alphabetically
  childrenById.forEach((children, parentId) => {
    const parentNode = nodes.find(n => n.id === parentId);
    const parentLabel = parentNode?.label;
    
    // If this parent is marked for ordered children, use topicSubdivisions order; otherwise alphabetize
    if (parentLabel && topicSubdivisions[parentLabel] && ORDERED_CHILDREN_PARENTS.has(parentLabel)) {
      const definedOrder = topicSubdivisions[parentLabel];
      children.sort((a, b) => {
        if (a.isCustom || b.isCustom) {
          return a.label.localeCompare(b.label);
        }
        const indexA = definedOrder.indexOf(a.label);
        const indexB = definedOrder.indexOf(b.label);
        // If both exist in defined order, use that; otherwise sort alphabetically
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
    } else {
      // Default alphabetical sort for nodes without defined order
      children.sort((a, b) => a.label.localeCompare(b.label));
    }
  });

  const positions = new Map();
  const edges = [];
  const subtreeWidths = new Map();

  const calculateSubtreeWidth = (nodeId) => {
    const kids = childrenById.get(nodeId) || [];
    if (kids.length === 0) {
      subtreeWidths.set(nodeId, nodeWidth);
      return nodeWidth;
    }

    let totalWidth = 0;
    kids.forEach((child, index) => {
      totalWidth += calculateSubtreeWidth(child.id);
      if (index > 0) totalWidth += H_GAP;
    });

    const width = Math.max(totalWidth, nodeWidth);
    subtreeWidths.set(nodeId, width);
    return width;
  };

  const assignPositions = (nodeId, x, y) => {
    const kids = childrenById.get(nodeId) || [];
    const subtreeWidth = subtreeWidths.get(nodeId) || nodeWidth;
    const nodeX = x + (subtreeWidth - nodeWidth) / 2;

    positions.set(nodeId, { x: nodeX, y });

    let childX = x;
    kids.forEach((child) => {
      edges.push({ from: nodeId, to: child.id });
      const childWidth = subtreeWidths.get(child.id) || nodeWidth;
      assignPositions(child.id, childX, y + nodeHeight + V_GAP);
      childX += childWidth + H_GAP;
    });
  };

  calculateSubtreeWidth(root.id);
  assignPositions(root.id, 0, 0);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });

  return {
    positions,
    edges,
    bounds: { minX, minY, maxX, maxY },
  };
};

function App() {

  // State to force recenter animation
  const [recenterKey, setRecenterKey] = useState(0);
  const [forceRecenter, setForceRecenter] = useState(false);
  // ...existing hooks and constants...


    // Robustly skip auto-save after backend loads
    const skipNextAutoSave = useRef(false);

    // Helper for backend-driven node updates
    const setNodesFromBackend = (newNodes) => {
      skipNextAutoSave.current = true;
      setNodes(newNodes);
    };

    const normalizeLoadedNodes = (mapNodes) => {
      return applyLabelMigrations(mapNodes)
    }

    const collapseNodesToRoot = (mapNodes) => {
      return mapNodes.map((node) => ({
        ...node,
        hidden: node.parentId !== null,
      }))
    }
  const [nodes, setNodes] = useState(INITIAL_NODES)
  const [selectedId, setSelectedId] = useState(null)
  const [focusedElement, setFocusedElement] = useState(null) // { nodeId, type: 'node' | 'dots' } or null

  // Log selection changes
  useEffect(() => {
    debugLog('Selected node changed:', selectedId);
  }, [selectedId]);
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [transitionsEnabled, setTransitionsEnabled] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [headerHeight, setHeaderHeight] = useState(0)
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })
  const [animatingIds, setAnimatingIds] = useState(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [basePanOffset, setBasePanOffset] = useState({ x: 0, y: 0 })
  const [dragButton, setDragButton] = useState(null)

  // Log drag events
  useEffect(() => {
    debugLog('Drag start:', dragStart, 'Drag offset:', dragOffset, 'Base pan offset:', basePanOffset);
  }, [dragStart]);
  useEffect(() => {
    debugLog('Drag offset changed:', dragOffset);
  }, [dragOffset]);
  useEffect(() => {
    debugLog('Base pan offset changed:', basePanOffset);
  }, [basePanOffset]);
  const [openTooltip, setOpenTooltip] = useState(null)
  const [enableAnimations, setEnableAnimations] = useState(true)
  const [smoothPanning, setSmoothPanning] = useState(true)
  const [autoExpand, setAutoExpand] = useState(true)
  const [isFullscreenMode, setIsFullscreenMode] = useState(false)
  const [showFullscreenHint, setShowFullscreenHint] = useState(false)
  const [showCreateNodeHint, setShowCreateNodeHint] = useState(false)
  const [nodeSizeScale, setNodeSizeScale] = useState(() => {
    const raw = window.localStorage.getItem('nodeSizeScale')
    const parsed = Number.parseFloat(raw || '')
    if (!Number.isFinite(parsed)) return 1
    return Math.max(NODE_SIZE_MIN, Math.min(NODE_SIZE_MAX, parsed))
  })
  const [currentUser, setCurrentUser] = useState(null)
  const [nodeFiles, setNodeFiles] = useState({}) // Map of nodeId -> files array
  const [uploadingNodeId, setUploadingNodeId] = useState(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [storageUsage, setStorageUsage] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1)
  const [relatedIdeas, setRelatedIdeas] = useState([])
  const [hasValidSearchWords, setHasValidSearchWords] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState(null) // For tree view editing
  const [editingSidebarNodeId, setEditingSidebarNodeId] = useState(null) // For sidebar title editing
  const [deleteConfirmation, setDeleteConfirmation] = useState(null) // { nodeId, message }
  const [editingSummaryId, setEditingSummaryId] = useState(null)
  const [notification, setNotification] = useState(null) // { message, type: 'error' | 'success' | 'info' }
  const [lastCreatedGridId, setLastCreatedGridId] = useState(null) // Track newly created grid for Tab indent
  const [deleteModalChoice, setDeleteModalChoice] = useState('cancel') // 'cancel' | 'delete'
  const [createNodeMode, setCreateNodeMode] = useState(null) // 'child' | 'sibling' | null - for button-based node creation
  const [createNodeHintPosition, setCreateNodeHintPosition] = useState(null)

  const canvasRef = useRef(null)
  const editInputRef = useRef(null)
  const mapPanelRef = useRef(null)
  const headerRef = useRef(null)
  const createModeButtonsRef = useRef(null)
  const searchInputRef = useRef(null)
  const searchRowRef = useRef(null)
  const searchSuggestionsRef = useRef(null)
  const anchorSizeRef = useRef({ width: 0, height: 0 })
  const nextId = useRef(2)
  const prevSelectedIdRef = useRef(null)
  const prevFocusedElementRef = useRef(null)
  const lastShiftRef = useRef({ x: 0, y: 0 })
  const lastFocusedIdRef = useRef(null)
  const didDragRef = useRef(false)
  const suppressClickRef = useRef(false)
  const noteInputRefs = useRef({})
  const deleteCancelButtonRef = useRef(null)
  const deleteConfirmButtonRef = useRef(null)
  const searchRequestIdRef = useRef(0)
  const searchDebounceTimeoutRef = useRef(null)
  const datamuseWordValidityCacheRef = useRef(new Map())
  const datamuseSuggestionCacheRef = useRef(new Map())
  const draftNoteIdsRef = useRef(new Set())
  const draftGridIdsRef = useRef(new Set())

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => {
      setNotification(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    return () => {
      if (searchDebounceTimeoutRef.current) {
        clearTimeout(searchDebounceTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!showFullscreenHint) return
    const timer = setTimeout(() => {
      setShowFullscreenHint(false)
    }, 2200)
    return () => clearTimeout(timer)
  }, [showFullscreenHint])

  useEffect(() => {
    if (!showCreateNodeHint) return
    const timer = setTimeout(() => {
      setShowCreateNodeHint(false)
    }, 2200)
    return () => clearTimeout(timer)
  }, [showCreateNodeHint])

  useEffect(() => {
    if (!showCreateNodeHint || !createNodeMode) {
      setCreateNodeHintPosition(null)
      return
    }

    const updateHintPosition = () => {
      const buttonGroup = createModeButtonsRef.current
      if (!buttonGroup) return
      const rect = buttonGroup.getBoundingClientRect()
      setCreateNodeHintPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      })
    }

    updateHintPosition()
    window.addEventListener('resize', updateHintPosition)
    window.addEventListener('scroll', updateHintPosition, true)

    return () => {
      window.removeEventListener('resize', updateHintPosition)
      window.removeEventListener('scroll', updateHintPosition, true)
    }
  }, [showCreateNodeHint, createNodeMode])

  const toggleFullscreenMode = () => {
    setIsFullscreenMode((prev) => {
      const next = !prev
      if (next) {
        setShowFullscreenHint(true)
      } else {
        setShowFullscreenHint(false)
      }
      setOpenTooltip(null)
      return next
    })
  }

  const toggleCreateNodeMode = (mode) => {
    setCreateNodeMode((prev) => {
      const next = prev === mode ? null : mode
      setShowCreateNodeHint(next !== null)
      if (next === null) {
        setCreateNodeHintPosition(null)
      }
      return next
    })
  }

  // Keep keyboard focus aligned with the selected delete modal option.
  useEffect(() => {
    if (!deleteConfirmation) return
    const targetRef = deleteModalChoice === 'delete' ? deleteConfirmButtonRef : deleteCancelButtonRef
    targetRef.current?.focus()
  }, [deleteConfirmation, deleteModalChoice])

  // Close side panel when ESC is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && panelOpen) {
        e.preventDefault()
        setPanelOpen(false)
        setSelectedId(null)
        setPanelExpanded(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [panelOpen])

  // Auto-scroll highlighted suggestion into view
  useEffect(() => {
    if (highlightedSuggestion >= 0 && searchSuggestionsRef.current) {
      const container = searchSuggestionsRef.current;
      const items = container.querySelectorAll('[data-suggestion-index]');
      if (items[highlightedSuggestion]) {
        const item = items[highlightedSuggestion];
        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        if (itemRect.bottom > containerRect.bottom) {
          container.scrollTop += itemRect.bottom - containerRect.bottom + 10;
        } else if (itemRect.top < containerRect.top) {
          container.scrollTop -= containerRect.top - itemRect.top + 10;
        }
      }
    }
  }, [highlightedSuggestion]);

  // Knowledge base mapping topics to their meaningful subdivisions (must be before layout useMemo)
  const TOPIC_SUBDIVISIONS = {
    // Root level
    'Everything': ['Humanities', 'Sciences'],
    'Humanities': ['Philosophy', 'History', 'Religious Studies', 'Arts', 'Languages'],
    'Sciences': ['Physics', 'Chemistry', 'Biology', 'Earth Science', 'Astronomy', 'Mathematics'],
    
    // Philosophy
    'Philosophy': ['Metaphysics', 'Epistemology', 'Ethics', 'Aesthetics', 'Logic', 'Political Philosophy', 'Phenomenology', 'History of Philosophy', 'Metaphilosophy'],
    
    // Ethics (Restructured with Normative/Metaethics/Applied)
    'Ethics': ['Normative Ethics', 'Metaethics', 'Applied Ethics'],
    'Normative Ethics': ['Virtue Ethics', 'Deontology', 'Consequentialism'],
    'Virtue Ethics': ['Virtues', 'Character Development', 'Aristotelian Ethics', 'Flourishing', 'Practical Wisdom', 'Moral Exemplars'],
    'Virtues': ['Courage', 'Wisdom', 'Temperance', 'Justice', 'Compassion', 'Honesty'],
    'Character Development': [],
    'Aristotelian Ethics': [],
    'Flourishing': [],
    'Practical Wisdom': [],
    'Moral Exemplars': [],
    'Courage': [],
    'Wisdom': [],
    'Temperance': [],
    'Justice': [],
    'Compassion': [],
    'Honesty': [],
    'Deontology': ['Duty', 'Kant', 'Rules', 'Rights', 'Categorical Imperative', 'Moral Law'],
    'Duty': [],
// ...existing code...
    'Agency': [],
    'Responsibility': [],
    'Libertarianism': [],
    'Causality': [],
    'Substance Theory': [],
    'Time': [],
    'Philosophy of Mind': ['Consciousness', 'Intentionality', 'Qualia', 'Personal Identity', 'Artificial Intelligence'],
    'Consciousness': [],
    'Intentionality': [],
    'Qualia': [],
    'Personal Identity': [],
    'Artificial Intelligence': [],
    
    // Epistemology
    'Epistemology': ['Knowledge', 'Skepticism', 'Justification', 'Belief', 'Truth', 'Rationalism', 'Empiricism', 'Foundationalism'],
    'Knowledge': ['Propositional Knowledge', 'Acquaintance Knowledge', 'Skill Knowledge', 'Gettier Problem', 'Infallibilism', 'Fallibilism'],
    'Propositional Knowledge': [],
    'Acquaintance Knowledge': [],
    'Skill Knowledge': [],
    'Gettier Problem': [],
    'Infallibilism': [],
    'Fallibilism': [],
    'Skepticism': [],
    'Justification': [],
    'Belief': [],
    'Truth': ['Correspondence Theory', 'Coherence Theory', 'Pragmatism', 'Deflationism', 'Pluralism', 'Relativism'],
    'Correspondence Theory': [],
    'Coherence Theory': [],
    'Pragmatism': [],
    'Deflationism': [],
    'Pluralism': [],
    'Relativism': [],
    'Rationalism': [],
    'Empiricism': [],
    'Foundationalism': [],
    
    // Logic
    'Logic': ['Formal Logic', 'Symbolic Logic', 'Reasoning', 'Fallacies', 'Set Theory', 'Model Theory'],
    'Formal Logic': ['Propositional Logic', 'Predicate Logic', 'Modal Logic', 'Temporal Logic', 'Fuzzy Logic', 'Paraconsistent Logic'],
    'Propositional Logic': [],
    'Predicate Logic': [],
    'Modal Logic': [],
    'Temporal Logic': [],
    'Fuzzy Logic': [],
    'Paraconsistent Logic': [],
    'Symbolic Logic': [],
    'Reasoning': [],
    'Fallacies': [],
    'Set Theory': [],
    'Model Theory': [],
    
    // Aesthetics
    'Aesthetics': ['Beauty', 'Art Theory', 'Taste', 'Sublime', 'Expression Theory'],
    'Beauty': ['Classical Beauty', 'Kant on Beauty', 'Aesthetic Experience', 'Form and Content', 'Subjective Beauty', 'Objective Beauty'],
    'Classical Beauty': [],
    'Kant on Beauty': [],
    'Aesthetic Experience': [],
    'Form and Content': [],
    'Subjective Beauty': [],
    'Objective Beauty': [],
    'Art Theory': ['Representationalism', 'Formalism', 'Expressionism', 'Conceptual Art', 'Aestheticism', 'Institutional Theory'],
    'Representationalism': [],
    'Formalism': [],
    'Expressionism': [],
    'Conceptual Art': [],
    'Aestheticism': [],
    'Institutional Theory': [],
    'Taste': [],
    'Sublime': [],
    'Expression Theory': [],
    
    // Political Philosophy
    'Political Philosophy': ['Justice', 'Rights', 'Democracy', 'Authoritarianism', 'Anarchism', 'Libertarianism'],
    
    // History of Philosophy
    'History of Philosophy': ['Ancient Philosophy', 'Medieval Philosophy', 'Modern Philosophy', 'Contemporary Philosophy'],
    'Ancient Philosophy': [],
    'Medieval Philosophy': [],
    'Modern Philosophy': [],
    'Contemporary Philosophy': [],
    
    // Metaphilosophy
    'Metaphilosophy': ['Philosophy of Logic', 'Philosophy of Language', 'Philosophy of Science'],
    'Philosophy of Logic': [],
    'Philosophy of Language': [],
    'Philosophy of Science': [],
    
    // History
    'History': [
      '3.3 million years ago - 3,200 BC Prehistory',
      '3,200 BC - 476 AD Ancient History',
      '476 - 1453 Medieval Period',
      '1453 - present Modern Era'
    ],
    '3.3 million years ago - 3,200 BC Prehistory': ['3.3 million years ago - 3,300 BC Stone Age', '3,300 BC - 3,200 BC Early Bronze Age (Prehistoric)'],
    '3.3 million years ago - 3,300 BC Stone Age': ['3.3 million years ago - 10,000 BC Paleolithic Era', '10,000 BC - 8,000 BC Mesolithic Era', '8,000 BC - 4,500 BC Neolithic Era', '4,500 BC - 3,300 BC Copper Age'],
    
    // Paleolithic Era
    '3.3 million years ago - 10,000 BC Paleolithic Era': ['3.3 million years ago - 300,000 years ago Lower Paleolithic', '300,000 years ago - 40,000 years ago Middle Paleolithic', '40,000 years ago - 10,000 BC Upper Paleolithic'],
    '3.3 million years ago - 300,000 years ago Lower Paleolithic': [],
    '300,000 years ago - 40,000 years ago Middle Paleolithic': ['300,000 years ago - 120,000 years ago Early Middle Paleolithic', '120,000 years ago - 40,000 years ago Last Glacial Period (Middle Paleolithic)'],
    '300,000 years ago - 120,000 years ago Early Middle Paleolithic': [],
    '120,000 years ago - 40,000 years ago Last Glacial Period (Middle Paleolithic)': [],
    '40,000 years ago - 10,000 BC Upper Paleolithic': ['40,000 years ago - 10,000 BC Last Glacial Period (Upper Paleolithic)', '10,875 BC - 10,000 BC Younger Dryas Event (Upper Paleolithic)'],
    '40,000 years ago - 10,000 BC Last Glacial Period (Upper Paleolithic)': [],
    '10,875 BC - 10,000 BC Younger Dryas Event (Upper Paleolithic)': [],
    
    // Mesolithic Era
    '10,000 BC - 8,000 BC Mesolithic Era': ['10,000 BC - 9,675 BC Last Glacial Period End (Mesolithic)', '9,675 BC - 8,000 BC Late Mesolithic'],
    '10,000 BC - 9,675 BC Last Glacial Period End (Mesolithic)': ['10,000 BC - 9,675 BC Younger Dryas Event (Mesolithic)', '9,675 BC - 9,575 BC Younger Dryas End (Late Mesolithic)'],
    '10,000 BC - 9,675 BC Younger Dryas Event (Mesolithic)': [],
    '9,675 BC - 9,575 BC Younger Dryas End (Late Mesolithic)': [],
    '9,675 BC - 8,000 BC Late Mesolithic': [],
    
    // Neolithic Era
    '8,000 BC - 4,500 BC Neolithic Era': [],
    
    // Copper Age
    '4,500 BC - 3,300 BC Copper Age': ['4,100 BC - 3,300 BC Sumerian Civilization (Copper Age)', '4,100 BC - 3,300 BC Predynastic Egypt (Copper Age)', '3,500 BC - 3,300 BC Ebla Civilization (Copper Age)'],
    '4,100 BC - 3,300 BC Sumerian Civilization (Copper Age)': ['4,100 BC - 3,300 BC Uruk Period'],
    '4,100 BC - 3,300 BC Uruk Period': [],
    '4,100 BC - 3,300 BC Predynastic Egypt (Copper Age)': [],
    '3,500 BC - 3,300 BC Ebla Civilization (Copper Age)': [],
    
    // Early Bronze Age (Prehistoric)
    '3,300 BC - 3,200 BC Early Bronze Age (Prehistoric)': ['3,300 BC - 3,200 BC Indus Valley Civilization (Prehistoric)', '3,300 BC - 3,200 BC Cycladic Civilization (Prehistoric)'],
    '3,300 BC - 3,200 BC Indus Valley Civilization (Prehistoric)': [],
    '3,300 BC - 3,200 BC Cycladic Civilization (Prehistoric)': [],
    '3,200 BC - 476 AD Ancient History': ['3,200 BC - 1,200 BC Bronze Age (Ancient)', '1,200 BC - 600 BC Iron Age', '3,100 BC - 30 BC Ancient Egypt', '3,500 BC - 539 BC Ancient Mesopotamia', '3,300 BC - 600 AD Ancient India', '2,070 BC - 220 AD Ancient China', '800 BC - 146 BC Ancient Greece', '753 BC - 476 AD Ancient Rome'],
    '3,200 BC - 1,200 BC Bronze Age (Ancient)': [],
    '1,200 BC - 600 BC Iron Age': [],
    '3,100 BC - 30 BC Ancient Egypt': [],
    '3,500 BC - 539 BC Ancient Mesopotamia': [],
    '3,300 BC - 600 AD Ancient India': [],
    '2,070 BC - 220 AD Ancient China': [],
    '800 BC - 146 BC Ancient Greece': [],
    '753 BC - 476 AD Ancient Rome': [],
    '476 - 1453 Medieval Period': ['476 - 1000 Early Middle Ages', '1000 - 1250 High Middle Ages', '1250 - 1453 Late Middle Ages', '330 - 1453 Byzantine Empire', '750 - 1258 Islamic Golden Age'],
    '476 - 1000 Early Middle Ages': [],
    '1000 - 1250 High Middle Ages': [],
    '1250 - 1453 Late Middle Ages': [],
    '330 - 1453 Byzantine Empire': [],
    '750 - 1258 Islamic Golden Age': [],
    '1453 - present Modern Era': ['1453 - 1789 Early Modern Period', '1789 - 1945 Late Modern Period', '1945 - present Contemporary Period'],
    '1453 - 1789 Early Modern Period': ['1300 - 1600 Renaissance', '1400 - 1800 Age of Discovery', '1517 - 1648 Reformation', '1637 - 1800 Enlightenment', '1543 - 1687 Scientific Revolution'],
    '1300 - 1600 Renaissance': [],
    '1400 - 1800 Age of Discovery': [],
    '1517 - 1648 Reformation': [],
    '1637 - 1800 Enlightenment': [],
    '1543 - 1687 Scientific Revolution': [],
    '1789 - 1945 Late Modern Period': ['1760 - 1840 Industrial Revolution', '1774 - 1849 Age of Revolutions', '1800 - 1945 Imperialism', '1914 - 1918 World War I', '1918 - 1939 Interwar Period', '1939 - 1945 World War II'],
    '1760 - 1840 Industrial Revolution': [],
    '1774 - 1849 Age of Revolutions': [],
    '1800 - 1945 Imperialism': [],
    '1914 - 1918 World War I': [],
    '1918 - 1939 Interwar Period': [],
    '1939 - 1945 World War II': [],
    '1945 - present Contemporary Period': ['1947 - 1991 Cold War', '1991 - 2001 Post-Cold War Era', '2001 - present 21st Century'],
    '1947 - 1991 Cold War': [],
    '1991 - 2001 Post-Cold War Era': [],
    '2001 - present 21st Century': [],
    
    // Religious Studies
    'Religious Studies': ['Western Religions', 'Eastern Religions', 'Biblical Studies', 'Comparative Religion', 'Religious Philosophy', 'Mythology'],
    'Western Religions': ['Christianity', 'Judaism', 'Islam'],
    'Christianity': ['Catholicism', 'Protestantism', 'Orthodox Christianity', 'Christian Theology', 'Christian History'],
    'Catholicism': [],
    'Protestantism': [],
    'Orthodox Christianity': [],
    'Christian Theology': [],
    'Christian History': [],
    'Judaism': ['Jewish Law', 'Jewish Philosophy', 'Jewish History', 'Kabbalah'],
    'Jewish Law': [],
    'Jewish Philosophy': [],
    'Jewish History': [],
    'Kabbalah': [],
    'Islam': ['Islamic Law', 'Islamic Theology', 'Islamic Philosophy', 'Islamic History', 'Qur\'anic Studies'],
    'Islamic Law': [],
    'Islamic Theology': [],
    'Islamic Philosophy': [],
    'Islamic History': [],
    'Qur\'anic Studies': [],
    'Eastern Religions': ['Buddhism', 'Hinduism', 'Taoism', 'Shinto', 'Sikhism', 'Jainism'],
    'Buddhism': ['Theravada', 'Mahayana', 'Vajrayana', 'Buddhist Philosophy', 'Buddhist History'],
    'Theravada': [],
    'Mahayana': [],
    'Vajrayana': [],
    'Buddhist Philosophy': [],
    'Buddhist History': [],
    'Hinduism': ['Vedanta', 'Yoga', 'Hindu Philosophy', 'Hindu History'],
    'Vedanta': [],
    'Yoga': [],
    'Hindu Mythology': [],
    'Hindu Philosophy': [],
    'Hindu History': [],
    'Taoism': [],
    'Shinto': [],
    'Sikhism': [],
    'Jainism': [],
    'Biblical Studies': ['Old Testament', 'New Testament', 'Biblical Theology', 'Biblical Archaeology', 'Biblical Languages'],
    'Old Testament': ['Torah', 'Prophets', 'Historical Books', 'Wisdom Literature', 'Psalms'],
    'Torah': [],
    'Prophets': [],
    'Historical Books': [],
    'Wisdom Literature': [],
    'Psalms': [],
    'New Testament': ['Gospels', 'Epistles', 'Revelation', 'Acts', 'Pauline Theology'],
    'Gospels': [],
    'Epistles': [],
    'Revelation': [],
    'Acts': [],
    'Pauline Theology': [],
    'Biblical Theology': [],
    'Biblical Archaeology': [],
    'Biblical Languages': [],
    'Comparative Religion': [],
    'Religious Philosophy': [],
    'Mythology': ['Greek Mythology', 'Roman Mythology', 'Norse Mythology', 'Hindu Mythology', 'Egyptian Mythology'],
    'Greek Mythology': [],
    'Roman Mythology': [],
    'Norse Mythology': [],
    'Egyptian Mythology': [],
    
    // Arts
    'Arts': ['Literature', 'Visual Arts', 'Performing Arts', 'Music', 'Design'],
    
    // Literature
    'Literature': ['Fiction', 'Poetry', 'Drama', 'Literary Theory', 'World Literature', 'Classics', 'Essays', 'Narrative Forms'],
    'Fiction': ['Novels', 'Short Stories', 'Science Fiction', 'Fantasy', 'Historical Fiction', 'Literary Fiction'],
    'Novels': ['Victorian Novel', 'Modern Novel', 'Postmodern Novel', 'Contemporary Novel', 'Experimental Fiction', 'Realism'],
    'Victorian Novel': [],
    'Modern Novel': [],
    'Postmodern Novel': [],
    'Contemporary Novel': [],
    'Experimental Fiction': [],
    'Realism': [],
    'Short Stories': [],
    'Science Fiction': [],
    'Fantasy': [],
    'Historical Fiction': [],
    'Literary Fiction': [],
    'Poetry': ['Ancient Poetry', 'Medieval Poetry', 'Renaissance Poetry', 'Romantic Poetry', 'Modern Poetry', 'Contemporary Poetry', 'Epic Poetry', 'Lyric Poetry'],
    'Ancient Poetry': [],
    'Medieval Poetry': [],
    'Renaissance Poetry': [],
    'Romantic Poetry': [],
    'Modern Poetry': [],
    'Contemporary Poetry': [],
    'Epic Poetry': [],
    'Lyric Poetry': [],
    'Drama': ['Comedy', 'Tragedy', 'Tragicomedy', 'Classical Drama', 'Modern Drama', 'Contemporary Drama', 'Melodrama'],
    'Comedy': [],
    'Tragedy': [],
    'Tragicomedy': [],
    'Classical Drama': [],
    'Modern Drama': [],
    'Contemporary Drama': [],
    'Melodrama': [],
    'Literary Theory': ['Structuralism', 'Deconstruction', 'Rhetoric', 'Semiotics', 'Narratology', 'Literary Criticism'],
    'Structuralism': [],
    'Deconstruction': [],
    'Rhetoric': [],
    'Semiotics': [],
    'Narratology': [],
    'Literary Criticism': [],
    'World Literature': [],
    'Classics': [],
    'Essays': [],
    'Narrative Forms': [],
    
    // Visual Arts
    'Visual Arts': ['Painting', 'Sculpture', 'Architecture', 'Photography', 'Film', 'Installation Art', 'Digital Art', 'Graphic Design', 'Printmaking'],
    'Painting': ['Renaissance Painting', 'Baroque Painting', 'Impressionism', 'Modernism', 'Abstract Art', 'Contemporary Painting', 'Color Theory', 'Technique'],
    'Renaissance Painting': [],
    'Baroque Painting': [],
    'Impressionism': [],
    'Modernism': [],
    'Abstract Art': [],
    'Contemporary Painting': [],
    'Color Theory': [],
    'Technique': [],
    'Sculpture': ['Classical Sculpture', 'Renaissance Sculpture', 'Modern Sculpture', 'Public Sculpture', 'Installation Sculpture', 'Contemporary Sculpture'],
    'Classical Sculpture': [],
    'Renaissance Sculpture': [],
    'Modern Sculpture': [],
    'Public Sculpture': [],
    'Installation Sculpture': [],
    'Contemporary Sculpture': [],
    'Architecture': ['Classical Architecture', 'Medieval Architecture', 'Renaissance Architecture', 'Modern Architecture', 'Postmodern Architecture', 'Contemporary Architecture', 'Architectural Theory', 'Urban Design'],
    'Classical Architecture': [],
    'Medieval Architecture': [],
    'Renaissance Architecture': [],
    'Modern Architecture': [],
    'Postmodern Architecture': [],
    'Contemporary Architecture': [],
    'Architectural Theory': [],
    'Urban Design': [],
    'Photography': ['Black and White Photography', 'Color Photography', 'Documentary Photography', 'Fine Art Photography', 'Photojournalism'],
    'Black and White Photography': [],
    'Color Photography': [],
    'Documentary Photography': [],
    'Fine Art Photography': [],
    'Photojournalism': [],
    'Film': ['Film History', 'Film Theory', 'Cinematography', 'Film Genres', 'Film Criticism', 'Animation', 'Documentary Film'],
    'Film History': [],
    'Film Theory': [],
    'Cinematography': [],
    'Film Genres': [],
    'Film Criticism': [],
    'Animation': [],
    'Documentary Film': [],
    'Installation Art': [],
    'Digital Art': ['Digital Painting', 'Digital Sculpture', 'Virtual Reality Art', 'Generative Art', 'Interactive Art'],
    'Digital Painting': [],
    'Digital Sculpture': [],
    'Virtual Reality Art': [],
    'Generative Art': [],
    'Interactive Art': [],
    'Graphic Design': ['Typography', 'Logo Design', 'Web Design', 'Branding', 'Layout Design'],
    'Typography': [],
    'Logo Design': [],
    'Web Design': [],
    'Branding': [],
    'Layout Design': [],
    'Printmaking': [],
    
    // Performing Arts
    'Performing Arts': ['Theatre', 'Dance', 'Performance Art', 'Musical Theatre'],
    'Theatre': ['Classical Theatre', 'Modern Theatre', 'Contemporary Theatre', 'Theatre Theory', 'Directing', 'Acting', 'Stage Design'],
    'Classical Theatre': [],
    'Modern Theatre': [],
    'Contemporary Theatre': [],
    'Theatre Theory': [],
    'Directing': [],
    'Acting': [],
    'Stage Design': [],
    'Dance': ['Classical Dance', 'Modern Dance', 'Contemporary Dance', 'Ballet', 'Jazz Dance', 'Hip Hop Dance'],
    'Classical Dance': [],
    'Modern Dance': [],
    'Contemporary Dance': [],
    'Ballet': [],
    'Jazz Dance': [],
    'Hip Hop Dance': [],
    'Performance Art': [],
    'Musical Theatre': [],
    
    // Music
    'Music': ['Classical Music', 'Jazz', 'Rock', 'Pop', 'World Music', 'Electronic Music', 'Music Theory', 'Composition'],
    'Classical Music': ['Baroque', 'Classical Period', 'Romantic', 'Modern Classical', 'Contemporary Classical', 'Opera', 'Orchestral Music', 'Chamber Music'],
    'Baroque': [],
    'Classical Period': [],
    'Romantic': [],
    'Modern Classical': [],
    'Contemporary Classical': [],
    'Orchestral Music': [],
    'Chamber Music': [],
    'Jazz': ['Early Jazz', 'Swing', 'Bebop', 'Cool Jazz', 'Free Jazz', 'Fusion', 'Modal Jazz', 'Jazz Standards'],
    'Early Jazz': [],
    'Swing': [],
    'Bebop': [],
    'Cool Jazz': [],
    'Free Jazz': [],
    'Fusion': [],
    'Modal Jazz': [],
    'Jazz Standards': [],
    'Rock': ['Classic Rock', 'Progressive Rock', 'Punk Rock', 'Alternative Rock', 'Heavy Metal'],
    'Classic Rock': [],
    'Progressive Rock': [],
    'Punk Rock': [],
    'Alternative Rock': [],
    'Heavy Metal': [],
    'Pop': [],
    'World Music': [],
    'Electronic Music': [],
    'Music Theory': [],
    'Composition': [],
    
    // Design
    'Design': ['Industrial Design', 'Fashion Design', 'Interaction Design', 'Game Design'],
    'Industrial Design': [],
    'Fashion Design': [],
    'Interaction Design': [],
    'Game Design': [],
    
    // Languages
    'Languages': ['Indo-European Languages', 'Sino-Tibetan Languages', 'Afro-Asiatic Languages', 'Austronesian Languages', 'Altaic Languages', 'Grammar', 'Linguistics', 'Translation', 'Phonetics', 'Semantics'],
    'Indo-European Languages': [],
    'Sino-Tibetan Languages': [],
    'Afro-Asiatic Languages': [],
    'Austronesian Languages': [],
    'Altaic Languages': [],
    'Grammar': [],
    'Linguistics': [],
    'Translation': [],
    'Phonetics': [],
    'Semantics': [],
    
    // Physics
    'Physics': ['Mechanics', 'Thermodynamics', 'Electromagnetism', 'Optics', 'Quantum Physics', 'Relativity'],
    'Mechanics': ['Classical Mechanics', 'Kinematics', 'Dynamics', 'Statics', 'Fluid Dynamics', 'Wave Motion'],
    'Classical Mechanics': [],
    'Kinematics': [],
    'Dynamics': [],
    'Statics': [],
    'Fluid Dynamics': [],
    'Wave Motion': [],
    'Thermodynamics': ['First Law', 'Second Law', 'Entropy', 'Heat Transfer', 'Phase Transitions', 'Cryogenics'],
    'First Law': [],
    'Second Law': [],
    'Entropy': [],
    'Heat Transfer': [],
    'Phase Transitions': [],
    'Cryogenics': [],
    'Electromagnetism': ['Electric Fields', 'Magnetic Fields', 'Maxwell Equations', 'Light', 'Radiation', 'Plasma'],
    'Electric Fields': [],
    'Magnetic Fields': [],
    'Maxwell Equations': [],
    'Light': [],
    'Radiation': [],
    'Plasma': [],
    'Optics': ['Geometric Optics', 'Wave Optics', 'Quantum Optics', 'Photonics', 'Lasers', 'Color'],
    'Geometric Optics': [],
    'Wave Optics': [],
    'Quantum Optics': [],
    'Photonics': [],
    'Lasers': [],
    'Color': [],
    'Quantum Physics': ['Wave-Particle Duality', 'Superposition', 'Entanglement', 'Uncertainty Principle', 'Quantum Computing', 'Quantum Field Theory'],
    'Wave-Particle Duality': [],
    'Superposition': [],
    'Entanglement': [],
    'Uncertainty Principle': [],
    'Quantum Computing': [],
    'Quantum Field Theory': [],
    'Relativity': ['Special Relativity', 'General Relativity', 'Spacetime', 'Gravity', 'Black Holes', 'Cosmological Constant'],
    'Special Relativity': [],
    'General Relativity': [],
    'Spacetime': [],
    'Gravity': [],
    'Cosmological Constant': [],
    
    // Chemistry
    'Chemistry': ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Biochemistry', 'Analytical Chemistry', 'Materials Science'],
    'Organic Chemistry': ['Hydrocarbons', 'Functional Groups', 'Reactions', 'Synthesis', 'Natural Products', 'Polymers'],
    'Hydrocarbons': [],
    'Functional Groups': [],
    'Reactions': [],
    'Synthesis': [],
    'Natural Products': [],
    'Polymers': [],
    'Inorganic Chemistry': ['Main Group Chemistry', 'Transition Metals', 'Coordination Chemistry', 'Solid State Chemistry', 'Crystal Chemistry', 'Geochemistry'],
    'Main Group Chemistry': [],
    'Transition Metals': [],
    'Coordination Chemistry': [],
    'Solid State Chemistry': [],
    'Crystal Chemistry': [],
    'Geochemistry': [],
    'Physical Chemistry': ['Kinetics', 'Quantum Chemistry', 'Spectroscopy', 'Electrochemistry', 'Surface Chemistry'],
    'Kinetics': [],
    'Quantum Chemistry': [],
    'Spectroscopy': [],
    'Electrochemistry': [],
    'Surface Chemistry': [],
    'Biochemistry': ['Proteins', 'Carbohydrates', 'Lipids', 'Nucleic Acids', 'Enzymes', 'Metabolism'],
    'Proteins': [],
    'Carbohydrates': [],
    'Lipids': [],
    'Nucleic Acids': [],
    'Enzymes': [],
    'Metabolism': [],
    'Analytical Chemistry': [],
    'Materials Science': [],
    
    // Biology
    'Biology': ['Botany', 'Zoology', 'Microbiology', 'Genetics', 'Ecology', 'Molecular Biology'],
    'Botany': ['Plant Structure', 'Plant Physiology', 'Plant Reproduction', 'Plant Ecology', 'Agricultural Botany', 'Ethnobotany'],
    'Plant Structure': [],
    'Plant Physiology': [],
    'Plant Reproduction': [],
    'Plant Ecology': [],
    'Agricultural Botany': [],
    'Ethnobotany': [],
    'Zoology': ['Vertebrate Zoology', 'Invertebrate Zoology', 'Animal Behavior', 'Animal Physiology', 'Comparative Anatomy', 'Evolution'],
    'Vertebrate Zoology': [],
    'Invertebrate Zoology': [],
    'Animal Behavior': [],
    'Animal Physiology': [],
    'Comparative Anatomy': [],
    'Evolution': [],
    'Microbiology': ['Bacteriology', 'Virology', 'Mycology', 'Parasitology', 'Microbial Ecology', 'Microbial Genetics'],
    'Bacteriology': [],
    'Virology': [],
    'Mycology': [],
    'Parasitology': [],
    'Microbial Ecology': [],
    'Microbial Genetics': [],
    'Genetics': ['Classical Genetics', 'Molecular Genetics', 'Population Genetics', 'Quantitative Genetics', 'Evolutionary Genetics', 'Human Genetics'],
    'Classical Genetics': [],
    'Molecular Genetics': [],
    'Population Genetics': [],
    'Quantitative Genetics': [],
    'Evolutionary Genetics': [],
    'Human Genetics': [],
    'Ecology': ['Population Ecology', 'Community Ecology', 'Ecosystem Ecology', 'Biogeography', 'Conservation Biology', 'Restoration Ecology'],
    'Population Ecology': [],
    'Community Ecology': [],
    'Ecosystem Ecology': [],
    'Biogeography': [],
    'Conservation Biology': [],
    'Restoration Ecology': [],
    'Molecular Biology': ['DNA', 'RNA', 'Protein Synthesis', 'Gene Expression', 'Cell Biology', 'Developmental Biology'],
    'DNA': [],
    'RNA': [],
    'Protein Synthesis': [],
    'Gene Expression': [],
    'Cell Biology': [],
    'Developmental Biology': [],
    
    // Mathematics
    'Mathematics': ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Number Theory'],
    'Algebra': ['Linear Algebra', 'Abstract Algebra', 'Commutative Algebra', 'Homological Algebra', 'Representation Theory', 'Category Theory'],
    'Linear Algebra': [],
    'Abstract Algebra': [],
    'Commutative Algebra': [],
    'Homological Algebra': [],
    'Representation Theory': [],
    'Category Theory': [],
    'Geometry': ['Euclidean Geometry', 'Non-Euclidean Geometry', 'Differential Geometry', 'Algebraic Geometry', 'Topology', 'Discrete Geometry'],
    'Euclidean Geometry': [],
    'Non-Euclidean Geometry': [],
    'Differential Geometry': [],
    'Algebraic Geometry': [],
    'Topology': [],
    'Discrete Geometry': [],
    'Calculus': ['Differential Calculus', 'Integral Calculus', 'Multivariable Calculus', 'Complex Analysis', 'Functional Analysis', 'Harmonic Analysis'],
    'Differential Calculus': [],
    'Integral Calculus': [],
    'Multivariable Calculus': [],
    'Complex Analysis': [],
    'Functional Analysis': [],
    'Harmonic Analysis': [],
    'Statistics': ['Probability', 'Descriptive Statistics', 'Inferential Statistics', 'Regression', 'Bayesian Statistics', 'Experimental Design'],
    'Probability': [],
    'Descriptive Statistics': [],
    'Inferential Statistics': [],
    'Regression': [],
    'Bayesian Statistics': [],
    'Experimental Design': [],
    'Number Theory': ['Prime Numbers', 'Modular Arithmetic', 'Diophantine Equations', 'Cryptography', 'Analytic Number Theory', 'Algebraic Number Theory'],
    'Prime Numbers': [],
    'Modular Arithmetic': [],
    'Diophantine Equations': [],
    'Cryptography': [],
    'Analytic Number Theory': [],
    'Algebraic Number Theory': [],
    
    // Earth Science
    'Earth Science': ['Geology', 'Meteorology', 'Oceanography', 'Mineralogy', 'Seismology', 'Paleontology'],
    'Geology': ['Plate Tectonics', 'Rock Formation', 'Mineral Science', 'Structural Geology', 'Stratigraphy', 'Geomorphology'],
    'Plate Tectonics': [],
    'Rock Formation': [],
    'Mineral Science': [],
    'Structural Geology': [],
    'Stratigraphy': [],
    'Geomorphology': [],
    'Meteorology': ['Atmospheric Composition', 'Weather Patterns', 'Climate Systems', 'Storms', 'Air Pollution', 'Climate Change'],
    'Atmospheric Composition': [],
    'Weather Patterns': [],
    'Climate Systems': [],
    'Storms': [],
    'Air Pollution': [],
    'Climate Change': [],
    'Oceanography': [],
    'Mineralogy': [],
    'Seismology': [],
    'Paleontology': [],
    
    // Astronomy
    'Astronomy': ['Observational Astronomy', 'Planetary Science', 'Stellar Astronomy', 'Galactic Astronomy', 'Extragalactic Astronomy', 'Cosmology'],
    'Observational Astronomy': [],
    'Planetary Science': ['Inner Planets', 'Outer Planets', 'Moons', 'Asteroids', 'Comets', 'Exoplanets'],
    'Inner Planets': [],
    'Outer Planets': [],
    'Moons': [],
    'Asteroids': [],
    'Comets': [],
    'Exoplanets': [],
    'Stellar Astronomy': ['Star Formation', 'Star Life Cycle', 'Stellar Classification', 'Binary Stars', 'Pulsars', 'Neutron Stars'],
    'Star Formation': [],
    'Star Life Cycle': [],
    'Stellar Classification': [],
    'Binary Stars': [],
    'Pulsars': [],
    'Neutron Stars': [],
    'Galactic Astronomy': [],
    'Extragalactic Astronomy': [],
    'Cosmology': ['Origin of Universe', 'Structure of Universe', 'Big Bang', 'Black Holes', 'Dark Matter', 'Multiverse'],
    'Origin of Universe': [],
    'Structure of Universe': [],
    'Big Bang': [],
    'Black Holes': [],
    'Dark Matter': [],
    'Multiverse': [],
  }

  const nodeWidth = Math.round(NODE_WIDTH * nodeSizeScale)
  const nodeHeight = Math.round(NODE_HEIGHT * nodeSizeScale)
  const nodeSizePercent = Math.round(nodeSizeScale * 100)

  const adjustNodeSize = (delta) => {
    setNodeSizeScale((prev) => {
      const next = prev + delta
      const clamped = Math.max(NODE_SIZE_MIN, Math.min(NODE_SIZE_MAX, next))
      return Math.round(clamped * 100) / 100
    })
  }

  useEffect(() => {
    window.localStorage.setItem('nodeSizeScale', String(nodeSizeScale))
  }, [nodeSizeScale])

  const layout = useMemo(
    () => buildLayout(nodes, TOPIC_SUBDIVISIONS, nodeWidth, nodeHeight),
    [nodes, recenterKey, TOPIC_SUBDIVISIONS, nodeWidth, nodeHeight],
  )
  const selectedNode = nodes.find((node) => node.id === selectedId)
  const isAuthenticated = Boolean(currentUser)

  // Calculate font size based on label length to ensure text fits in node
  const getNodeFontSize = (label) => {
    const length = label.length
    let baseSizeRem = 0.6
    if (length <= 15) baseSizeRem = 1.0
    else if (length <= 25) baseSizeRem = 0.9
    else if (length <= 35) baseSizeRem = 0.8
    else if (length <= 45) baseSizeRem = 0.7

    const scaledSize = baseSizeRem * nodeSizeScale
    return `${scaledSize.toFixed(2)}rem`
  }

  // Deselect if the selected node becomes hidden
  useEffect(() => {
    if (selectedId !== null) {
      const node = nodes.find((n) => n.id === selectedId)
      if (node && node.hidden) {
        setSelectedId(null)
        setPanelOpen(false)
      }
    }
  }, [selectedId, nodes])

  // Unfocus if the focused node becomes hidden
  useEffect(() => {
    if (!focusedElement) return;
    
    const node = nodes.find((n) => n.id === focusedElement.nodeId)
    if (node && node.hidden) {
      setFocusedElement(null)
    }
  }, [focusedElement, nodes])

  const generateSummary = (label) => {
    // Build a complete set of all node labels from the map structure
    const allLabels = new Set();
    // Add all keys and their children from TOPIC_SUBDIVISIONS
    Object.keys(TOPIC_SUBDIVISIONS).forEach((key) => {
      allLabels.add(key);
      (TOPIC_SUBDIVISIONS[key] || []).forEach((child) => allLabels.add(child));
    });

    // Existing detailed summaries
    // Duplicates removed: only the last occurrence of each key is kept for predictable behavior
    const summaries = {
      // Root level
      'Everything': 'A conceptual map connecting all fields of human knowledge and inquiry.',
      'Humanities': 'Disciplines that study human culture, history, language, and values.',
      'Sciences': 'Fields that investigate the natural world through observation and experimentation.',
      'Philosophy': 'The pursuit of wisdom through critical analysis of existence, knowledge, and ethics.',
      'Ethics': 'The branch of philosophy concerned with moral principles and how we ought to act.',
      'Virtue Ethics': 'An ethical approach emphasizing the development of good character and virtues.',
      'Character Development': 'The process of cultivating moral excellence and virtuous habits over time.',
      'Aristotelian Ethics': 'The ethical framework developed by Aristotle emphasizing virtue, practical wisdom, and human flourishing.',
      'Flourishing': 'The state of living well and achieving one\'s full potential as a human being.',
      'Practical Wisdom': 'The ability to discern the right course of action in particular circumstances.',
      'Moral Exemplars': 'Individuals who embody exceptional moral character and serve as models for ethical conduct.',
      'Virtues': 'Positive character traits or dispositions to act morally and excellently.',
      'Courage': 'The virtue of facing fear, danger, or adversity with strength and determination.',
      'Wisdom': 'The virtue of sound judgment, insight, and understanding in practical and theoretical matters.',
      'Temperance': 'The virtue of self-control, moderation, and restraint in desires and actions.',
      'Justice': 'The virtue of fairness, equity, and giving each person their due.',
      'Compassion': 'The virtue of empathetic concern for the suffering of others coupled with a desire to help.',
      'Honesty': 'The virtue of truthfulness, sincerity, and integrity in one\'s words and actions.',
      'Deontology': 'An ethical theory focused on duties, rules, and moral obligations regardless of outcomes.',
      'Duty': 'A moral or legal obligation to perform certain actions based on ethical principles.',
      'Kant': 'Immanuel Kant, the philosopher who developed deontological ethics and the categorical imperative.',
      'Rules': 'Principles or directives that prescribe or prohibit specific actions in ethical systems.',
      'Rights': 'Entitlements or claims that individuals possess based on moral or legal principles.',
      'Categorical Imperative': 'Kant\'s central ethical principle that one should act only according to maxims that could become universal laws.',
      'Moral Law': 'Universal principles of right conduct that bind all rational agents.',
      'Consequentialism': 'The ethical view that the morality of actions depends on their outcomes or consequences.',
      'Utilitarianism': 'A form of consequentialism that seeks the greatest happiness or well-being for the greatest number.',
      'Act Utilitarianism': 'The view that the rightness of an action is determined by whether it maximizes utility in that particular situation.',
      'Rule Utilitarianism': 'The view that the rightness of an action is determined by whether it conforms to rules that maximize overall utility.',
      'Preference Utilitarianism': 'The view that the best action is the one that satisfies the most preferences or desires.',
      'Hedonic Calculus': 'A method for calculating the amount of pleasure or pain produced by an action.',
      'Singer': 'Peter Singer, a contemporary utilitarian philosopher known for work on animal rights and effective altruism.',
      'Bentham': 'Jeremy Bentham, founder of modern utilitarianism and creator of the hedonic calculus.',
      'Happiness': 'A state of well-being, contentment, or pleasure central to utilitarian ethics.',
      'Well-being': 'The state of living a good life characterized by health, happiness, and fulfillment.',
      'Preference Satisfaction': 'The fulfillment of an individual\'s desires or preferences as a measure of utility.',
      'Cost-Benefit Analysis': 'A systematic approach to estimating the strengths and weaknesses of alternatives to determine the best option.',
      'Greatest Good': 'The utilitarian principle of maximizing overall benefit or happiness for the largest number of people.',
      'Applied Ethics': 'The practical application of ethical theories to real-world issues and dilemmas.',
      'Bioethics': 'The study of ethical issues in medicine, biology, and the life sciences.',
      'Environmental Ethics': 'The examination of moral relationships between humans and the environment.',
      'Metaphysics': 'The branch of philosophy that explores the fundamental nature of reality and existence.',
      'Ontology': 'A subfield of metaphysics concerned with the categories and nature of being.',
      'Being': 'The most fundamental concept in ontology, referring to existence itself.',
      'Existence': 'The state of having objective reality or presence in the universe.',
      'Categories': 'The most general classes or types of entities that exist.',
      'Properties': 'Characteristics or attributes that entities possess.',
      'Relations': 'Connections or associations between two or more entities.',
      'Universals': 'Abstract entities or qualities that can be instantiated by multiple particular things.',
      'Cosmology': 'The scientific and philosophical study of the origin, structure, and evolution of the universe.',
      'Origin of Universe': 'The study of how the universe came into being and its earliest moments.',
      'Structure of Universe': 'The organization and composition of matter, energy, and space on the largest scales.',
      'Big Bang': 'The prevailing cosmological model describing the universe\'s expansion from an extremely hot, dense initial state.',
      'Black Holes': 'Regions of spacetime where gravity is so strong that nothing, not even light, can escape.',
      'Dark Matter': 'Invisible matter that does not interact with electromagnetic radiation but exerts gravitational effects.',
      'Multiverse': 'The hypothetical collection of multiple or infinite universes comprising all of existence.',
      'Free Will': 'The capacity of agents to choose and act independently of external causes.',
      'Determinism': 'The view that all events, including human actions, are caused by prior events according to natural laws.',
      'Indeterminism': 'The view that not all events are necessarily determined by prior causes.',
      'Compatibilism': 'The view that free will and determinism can both be true.',
      'Agency': 'The capacity of individuals to act independently and make their own choices.',
      'Responsibility': 'The state of being accountable for one\'s actions and their consequences.',
      'Libertarianism': 'The metaphysical view that free will exists and is incompatible with determinism.',
      'Causality': 'The relationship between cause and effect, or how one event brings about another.',
      'Substance Theory': 'The metaphysical view that objects are composed of an underlying substance and its properties.',
      'Time': 'The dimension along which events occur in sequence, from past through present to future.',
      'Epistemology': 'The study of knowledge, its nature, sources, and limits.',
      'Knowledge': 'Justified true belief or warranted information about the world.',
      'Propositional Knowledge': 'Knowledge of facts or propositions, expressed as "knowing that."',
      'Acquaintance Knowledge': 'Direct experiential awareness of objects, people, or places, expressed as "knowing of."',
      'Skill Knowledge': 'Practical expertise or ability to do something, expressed as "knowing how."',
      'Gettier Problem': 'Philosophical challenge showing that justified true belief may not be sufficient for knowledge.',
      'Infallibilism': 'The view that knowledge requires absolute certainty and cannot be mistaken.',
      'Fallibilism': 'The view that knowledge is possible even though our beliefs may be subject to error.',
      'Skepticism': 'The philosophical position that questions the possibility of certain or complete knowledge.',
      'Justification': 'The reasons or evidence that support a belief or claim to knowledge.',
      'Belief': 'A mental state of accepting something as true or real.',
      'Truth': 'The property of statements, beliefs, or propositions corresponding to reality or facts.',
      'Correspondence Theory': 'The view that truth consists in correspondence or agreement with facts or reality.',
      'Coherence Theory': 'The view that truth consists in coherence with a system of beliefs or propositions.',
      'Pragmatism': 'The view that truth is defined by practical consequences and usefulness.',
      'Deflationism': 'The view that truth is a simple, minimal concept without substantial philosophical content.',
      'Pluralism': 'The view that there are multiple ways of knowing or that truth can take multiple forms.',
      'Relativism': 'The view that truth, knowledge, or morality varies depending on culture, context, or perspective.',
      'Rationalism': 'The epistemological view that reason is the primary source of knowledge.',
      'Logic': 'The systematic study of valid reasoning, argument, and inference.',
      'Formal Logic': 'The study of inference using abstract formal systems.',
      'Propositional Logic': 'The branch of logic dealing with propositions and their logical relationships.',
      'Predicate Logic': 'The branch of logic that analyzes the internal structure of propositions using predicates and quantifiers.',
      'Modal Logic': 'The branch of logic dealing with necessity, possibility, and related concepts.',
      'Temporal Logic': 'The branch of logic dealing with time and temporal relationships.',
      'Fuzzy Logic': 'A form of logic that allows for degrees of truth rather than binary true/false values.',
      'Paraconsistent Logic': 'A form of logic that allows for contradictions without trivializing the entire system.',
      'Symbolic Logic': 'The use of symbols and formal notation to represent logical structures and reasoning.',
      'Reasoning': 'The process of drawing conclusions from premises through logical inference.',
      'Fallacies': 'Common errors or flaws in reasoning that undermine the logic of arguments.',
      'Set Theory': 'The mathematical study of collections of objects and their properties.',
      'Model Theory': 'The study of the relationships between formal languages and their interpretations.',
      'Aesthetics': 'The branch of philosophy that explores the nature of beauty, art, and taste.',
      'Beauty': 'The quality of being aesthetically pleasing or possessing qualities that give pleasure to the senses or mind.',
      'Classical Beauty': 'The conception of beauty based on harmony, proportion, and order derived from ancient Greek and Roman ideals.',
      'Kant on Beauty': 'Kant\'s theory that beauty is experienced through disinterested pleasure and universal subjective judgments.',
      'Aesthetic Experience': 'The distinctive mode of perceiving and responding to art, beauty, or aesthetic objects.',
      'Form and Content': 'The distinction between the structural elements of an artwork and its subject matter or meaning.',
      'Subjective Beauty': 'The view that beauty is dependent on individual perception and preference.',
      'Objective Beauty': 'The view that beauty is an inherent property of objects independent of individual perception.',
      'Art Theory': 'Philosophical inquiry into the nature, purpose, and value of art.',
      'Representationalism': 'The view that art represents or depicts objects, scenes, or ideas from reality.',
      'Formalism': 'The view that the value of art lies in its formal elements such as line, color, and composition.',
      'Expressionism': 'The view that art expresses the emotions, feelings, or inner states of the artist.',
      'Conceptual Art': 'Art in which the concept or idea is more important than the physical form or execution.',
      'Aestheticism': 'The view that art has intrinsic value and should be appreciated for its beauty alone.',
      'Institutional Theory': 'The view that art is defined by the practices and conventions of the art world.',
      'Taste': 'The capacity to make discerning judgments about aesthetic qualities.',
      'Sublime': 'An aesthetic quality involving awe, grandeur, or overwhelming beauty that transcends ordinary experience.',
      'Expression Theory': 'The view that art is valuable because it expresses human emotions and experiences.',
      'Political Philosophy': 'The study of fundamental questions about government, justice, rights, law, and the nature of political authority.',
      'History': 'The study of past human events, societies, and civilizations across time.',
      '3.3 million years ago - 3,200 BC Prehistory': 'The period of human history before the invention of writing, spanning from 3.3 million years ago to 3,200 BC.',
      '3.3 million years ago - 3,300 BC Stone Age': 'The prehistoric period when stone tools were predominantly used, spanning from 3.3 million years ago to 3,300 BC.',
      '3,300 BC - 1,200 BC Bronze Age': 'The period characterized by the use of bronze tools and weapons, from 3,300 BC to 1,200 BC.',
      '1,200 BC - 600 BC Iron Age': 'The period characterized by the widespread use of iron tools and weapons, from 1,200 BC to 600 BC.',
      '3,200 BC - 476 AD Ancient History': 'The era of the earliest civilizations, from the invention of writing (3,200 BC) to the fall of the Western Roman Empire (476 AD).',
      '3,100 BC - 30 BC Ancient Egypt': 'The civilization along the Nile River known for pyramids, pharaohs, and hieroglyphic writing, from 3,100 BC to 30 BC.',
      '3,500 BC - 539 BC Ancient Mesopotamia': 'The region between the Tigris and Euphrates rivers, cradle of civilization with Sumerians, Babylonians, and Assyrians, from 3,500 BC to 539 BC.',
      '3,300 BC - 600 AD Ancient India': 'The early civilizations of the Indian subcontinent including the Indus Valley and Vedic periods, from 3,300 BC to 600 AD.',
      '2,070 BC - 220 AD Ancient China': 'Early Chinese civilization including the Shang, Zhou, Qin, and Han dynasties, from 2,070 BC to 220 AD.',
      '800 BC - 146 BC Ancient Greece': 'The civilization that developed philosophy, democracy, and classical art, from 800 BC to 146 BC.',
      '753 BC - 476 AD Ancient Rome': 'The civilization that grew from a city-state to an empire dominating the Mediterranean world, from 753 BC to 476 AD.',
      '476 - 1453 Medieval Period': 'The historical period spanning from 476 to 1453, characterized by feudalism, the dominance of the Church in Europe, and ending with the fall of Constantinople.',
      '476 - 1000 Early Middle Ages': 'The period following the fall of Rome marked by the rise of Christianity and formation of new kingdoms, from 476 to 1000.',
      '1000 - 1250 High Middle Ages': 'The period of population growth, urbanization, and cultural flourishing including Gothic architecture and scholasticism, from 1000 to 1250.',
      '1250 - 1453 Late Middle Ages': 'The period marked by plague, war, and social upheaval leading to the end of the medieval era, from 1250 to 1453.',
      '330 - 1453 Byzantine Empire': 'The continuation of the Eastern Roman Empire preserving classical knowledge and Christian Orthodoxy, from 330 to 1453.',
      '750 - 1258 Islamic Golden Age': 'The period of scientific, cultural, and economic flourishing in the Islamic world, from 750 to 1258.',
      '1453 - present Modern Era': 'The period from 1453 to the present, marked by the transition from medieval to contemporary society.',
      '1453 - 1789 Early Modern Period': 'A period of significant cultural, intellectual, and political transformation from 1453 to 1789, including the Renaissance, Reformation, and Enlightenment.',
      '1300 - 1600 Renaissance': 'The cultural rebirth in Europe marked by renewed interest in classical learning, art, and humanism, from 1300 to 1600.',
      '1400 - 1800 Age of Discovery': 'The period of European exploration and colonization of the Americas, Africa, and Asia, from 1400 to 1800.',
      '1517 - 1648 Reformation': 'The religious movement that split Western Christianity and led to the Protestant churches, from 1517 to 1648.',
      '1637 - 1800 Enlightenment': 'The intellectual movement emphasizing reason, science, and individual rights, from 1637 to 1800.',
      '1543 - 1687 Scientific Revolution': 'The period of major advances in science that laid the foundation of modern science, from 1543 to 1687.',
      '1789 - 1945 Late Modern Period': 'The period from 1789 to 1945, marked by industrialization, imperialism, world wars, and major social upheaval.',
      '1760 - 1840 Industrial Revolution': 'The transformation from agrarian to industrial society through mechanization and technological innovation, from 1760 to 1840.',
      '1774 - 1849 Age of Revolutions': 'The period of political upheaval with revolutions in America, France, and Latin America, from 1774 to 1849.',
      '1800 - 1945 Imperialism': 'The expansion of European powers through colonization and control of territories worldwide, from 1800 to 1945.',
      '1914 - 1918 World War I': 'The global conflict involving major world powers, from 1914 to 1918.',
      '1918 - 1939 Interwar Period': 'The period between the world wars marked by economic depression and the rise of totalitarianism, from 1918 to 1939.',
      '1939 - 1945 World War II': 'The global conflict between Allied and Axis powers, the deadliest war in history, from 1939 to 1945.',
      '1945 - present Contemporary Period': 'The period from 1945 to the present, shaped by decolonization, the Cold War, technological advancement, and globalization.',
      '1947 - 1991 Cold War': 'The geopolitical tension between the United States and Soviet Union without direct military conflict, from 1947 to 1991.',
      '1991 - 2001 Post-Cold War Era': 'The period following the Cold War marked by globalization and the spread of democracy, from 1991 to 2001.',
      '2001 - present 21st Century': 'The current century characterized by rapid technological change, terrorism, and climate concerns, from 2001 to present.',
      // Prehistoric Timeline Details
      '3.3 million years ago - 10,000 BC Paleolithic Era': 'The Old Stone Age when early humans used stone tools and lived as hunter-gatherers, from 3.3 million years ago to 10,000 BC.',
      '3.3 million years ago - 300,000 years ago Lower Paleolithic': 'The earliest phase of the Stone Age marked by the first stone tools and early human ancestors, from 3.3 million years ago to 300,000 years ago.',
      '300,000 years ago - 40,000 years ago Middle Paleolithic': 'The Stone Age period associated with Neanderthals and early Homo sapiens, featuring more sophisticated tools, from 300,000 to 40,000 years ago.',
      '300,000 years ago - 120,000 years ago Early Middle Paleolithic': 'The initial phase of the Middle Paleolithic with developing tool technologies and early human migration, from 300,000 to 120,000 years ago.',
      '120,000 years ago - 40,000 years ago Last Glacial Period (Middle Paleolithic)': 'The Ice Age during the Middle Paleolithic when much of the northern hemisphere was covered by glaciers, from 120,000 to 40,000 years ago.',
      '40,000 years ago - 10,000 BC Upper Paleolithic': 'The Late Stone Age period marked by modern human expansion, cave art, and advanced tools, from 40,000 years ago to 10,000 BC.',
      '40,000 years ago - 10,000 BC Last Glacial Period (Upper Paleolithic)': 'The final phase of the Ice Age during which modern humans spread across continents and developed sophisticated cultures, from 40,000 years ago to 10,000 BC.',
      '10,875 BC - 10,000 BC Younger Dryas Event (Upper Paleolithic)': 'A dramatic cold snap interrupting the warming trend at the end of the Ice Age, from 10,875 BC to 10,000 BC.',
      '10,000 BC - 8,000 BC Mesolithic Era': 'The Middle Stone Age transitional period between Paleolithic hunter-gatherers and Neolithic farmers, from 10,000 BC to 8,000 BC.',
      '10,000 BC - 9,675 BC Last Glacial Period End (Mesolithic)': 'The final phase of the Ice Age as glaciers retreated and climate warmed, from 10,000 BC to 9,675 BC.',
      '10,000 BC - 9,675 BC Younger Dryas Event (Mesolithic)': 'The continuation of the Younger Dryas cold period into the Mesolithic era, ending around 9,675 BC.',
      '9,675 BC - 9,575 BC Younger Dryas End (Late Mesolithic)': 'The conclusion of the Younger Dryas cold event, marking rapid climate warming, from 9,675 BC to 9,575 BC.',
      '9,675 BC - 8,000 BC Late Mesolithic': 'The final phase of the Middle Stone Age with warming climate and development of more complex hunter-gatherer societies, from 9,675 BC to 8,000 BC.',
      '8,000 BC - 4,500 BC Neolithic Era': 'The New Stone Age characterized by the development of agriculture, domestication of animals, and permanent settlements, from 8,000 BC to 4,500 BC.',
      '4,500 BC - 3,300 BC Copper Age': 'The Chalcolithic period when copper tools began to supplement stone implements, marking the transition to metal working, from 4,500 BC to 3,300 BC.',
      '4,100 BC - 3,300 BC Sumerian Civilization (Copper Age)': 'The early Sumerian culture in Mesopotamia developing irrigation, writing, and urban centers, from 4,100 BC to 3,300 BC.',
      '4,100 BC - 3,300 BC Uruk Period': 'The phase of Sumerian civilization centered on the city of Uruk, featuring the earliest known writing and monumental architecture, from 4,100 BC to 3,300 BC.',
      '4,100 BC - 3,300 BC Predynastic Egypt (Copper Age)': 'The period of Egyptian civilization before the unification under pharaonic rule, developing agriculture and settlements along the Nile, from 4,100 BC to 3,300 BC.',
      '3,500 BC - 3,300 BC Ebla Civilization (Copper Age)': 'The ancient Syrian city-state that flourished as a trade center in the Copper Age, from 3,500 BC to 3,300 BC.',
      '3,300 BC - 3,200 BC Early Bronze Age (Prehistoric)': 'The brief transitional period at the beginning of the Bronze Age before the development of writing systems, from 3,300 BC to 3,200 BC.',
      '3,300 BC - 3,200 BC Indus Valley Civilization (Prehistoric)': 'The earliest phase of the Harappan civilization in South Asia featuring planned cities and trade networks, from 3,300 BC to 3,200 BC.',
      '3,300 BC - 3,200 BC Cycladic Civilization (Prehistoric)': 'The early Bronze Age culture of the Cycladic islands in the Aegean Sea known for distinctive marble figurines, from 3,300 BC to 3,200 BC.',
      '3,200 BC - 1,200 BC Bronze Age (Ancient)': 'The historical period characterized by bronze metallurgy, the rise of civilizations, and the invention of writing, from 3,200 BC to 1,200 BC.',
      'Literature': 'Written works considered to have artistic or intellectual value, including fiction, poetry, and drama.',
      'Fiction': 'Imaginative narrative works including novels, short stories, and various genres.',
      'Novels': 'Extended works of prose fiction exploring characters, themes, and narratives.',
      'Victorian Novel': 'Novels from the Victorian era known for social commentary and moral themes.',
      'Modern Novel': 'Novels from the early 20th century characterized by experimental techniques and psychological depth.',
      'Postmodern Novel': 'Novels that challenge traditional narrative structures and question objective reality.',
      'Contemporary Novel': 'Current novels reflecting present-day themes, styles, and concerns.',
      'Experimental Fiction': 'Fiction that challenges conventional narrative forms and literary techniques.',
      'Realism': 'Literary movement depicting life accurately and objectively without idealization.',
      'Short Stories': 'Brief prose narratives focusing on a single incident or character.',
      'Science Fiction': 'Fiction exploring imaginative concepts often involving futuristic science and technology.',
      'Fantasy': 'Fiction featuring magical or supernatural elements in invented worlds.',
      'Historical Fiction': 'Fiction set in the past that blends historical facts with imaginative narratives.',
      'Literary Fiction': 'Fiction emphasizing literary merit, style, and thematic depth over commercial appeal.',
      'Poetry': 'Literary work using rhythm, imagery, and concentrated language to evoke emotion and meaning.',
      'Ancient Poetry': 'Poetry from ancient civilizations including epics, lyrics, and religious verse.',
      'Medieval Poetry': 'Poetry from the Middle Ages including courtly love, chivalric romance, and religious themes.',
      'Renaissance Poetry': 'Poetry from the Renaissance featuring humanism, classical influences, and sonnet forms.',
      'Romantic Poetry': 'Poetry emphasizing emotion, nature, imagination, and individual experience.',
      'Modern Poetry': 'Poetry from the early 20th century featuring free verse and experimental forms.',
      'Contemporary Poetry': 'Current poetry reflecting diverse voices, styles, and contemporary themes.',
      'Drama': 'Literature intended for theatrical performance exploring human conflicts and experiences.',
      'Comedy': 'Dramatic works using humor, wit, and happy endings to entertain and critique society.',
      'Tragedy': 'Dramatic works depicting the downfall of a protagonist through fatal flaws or circumstances.',
      'Tragicomedy': 'Dramatic works blending tragic and comic elements.',
      'Experimental Theatre': 'Drama that challenges conventional theatrical forms and audience expectations.',
      'Classical Drama': 'Drama from ancient Greece and Rome establishing foundational theatrical forms.',
      'Modern Drama': 'Drama from the late 19th and 20th centuries exploring psychological realism and social issues.',
      'Literary Theory': 'Critical frameworks for analyzing and interpreting literature.',
      'Structuralism': 'The theory that analyzes cultural phenomena through underlying structures and systems.',
      'Deconstruction': 'The critical approach questioning fixed meanings and revealing tensions in texts.',
      'Phenomenology': 'The philosophical approach examining consciousness and lived experience.',
      'Rhetoric': 'The art of persuasive speaking and writing using language effectively.',
      'Semiotics': 'The study of signs, symbols, and how meaning is created and communicated.',
      'Narratology': 'The study of narrative structure, techniques, and storytelling conventions.',
      'World Literature': 'Literary works from diverse cultures and languages across the globe.',
      'Classics': 'Ancient Greek and Roman literature of enduring influence and quality.',
      'Art': 'The expression or application of human creativity and imagination, producing works appreciated for their beauty or emotional power.',
      'Painting': 'The art of applying pigments to surfaces to create visual images.',
      'Renaissance Painting': 'Painting from the Renaissance featuring perspective, realism, and humanistic themes.',
      'Baroque Painting': 'Dramatic painting from the 17th century emphasizing movement, contrast, and emotional intensity.',
      'Impressionism': 'Late 19th century painting capturing light, color, and momentary impressions.',
      'Modernism': 'Early 20th century art movement breaking from traditional forms and embracing abstraction.',
      'Abstract Art': 'Art that uses shapes, colors, and forms rather than realistic representation.',
      'Contemporary Painting': 'Current painting reflecting diverse styles, media, and conceptual approaches.',
      'Sculpture': 'Three-dimensional art created by shaping materials such as stone, metal, or clay.',
      'Classical Sculpture': 'Sculpture from ancient Greece and Rome emphasizing idealized human forms.',
      'Renaissance Sculpture': 'Sculpture reviving classical techniques with heightened naturalism and emotion.',
      'Modern Sculpture': 'Sculpture from the 20th century exploring abstraction and new materials.',
      'Public Sculpture': 'Sculpture designed for display in public spaces and community engagement.',
      'Installation Sculpture': 'Large-scale sculptures transforming entire spaces into immersive environments.',
      'Performance Art': 'Art in which the artist\'s actions or presence constitute the work.',
      'Architecture': 'The art and science of designing and constructing buildings and structures.',
      'Classical Architecture': 'Architecture from ancient Greece and Rome emphasizing columns, symmetry, and proportion.',
      'Medieval Architecture': 'Architecture from the Middle Ages including Romanesque and Gothic styles.',
      'Renaissance Architecture': 'Architecture reviving classical principles with refined proportions and harmony.',
      'Modern Architecture': 'Architecture from the 20th century emphasizing function, simplicity, and new materials.',
      'Postmodern Architecture': 'Architecture challenging modernist principles with eclecticism and ornamentation.',
      'Contemporary Architecture': 'Current architecture using advanced technology and sustainable design.',
      'Photography': 'The art of creating images using light-sensitive materials or digital sensors.',
      'Installation Art': 'Art created for specific spaces, often immersive and multimedia.',
      'Digital Art': 'Art created using digital technology and computer software.',
      'Music': 'The art of arranging sounds in time to produce a composition through melody, harmony, rhythm, and timbre.',
      'Classical Music': 'Western art music from various historical periods emphasizing formal composition.',
      'Baroque': 'Music from 1600-1750 characterized by ornate melodies and figured bass.',
      'Classical Period': 'Music from 1750-1820 emphasizing clarity, balance, and formal structure.',
      'Romantic': 'Music from the 19th century emphasizing emotion, expression, and individualism.',
      'Modern Classical': 'Classical music from the early 20th century featuring new harmonies and atonality.',
      'Contemporary Classical': 'Current classical music exploring diverse styles and experimental techniques.',
      'Opera': 'Dramatic theatrical work combining music, singing, and staging.',
      'Jazz': 'American music genre featuring improvisation, syncopation, and swing rhythms.',
      'Early Jazz': 'Jazz from New Orleans and Chicago in the early 20th century.',
      'Swing': 'Jazz style from the 1930s-1940s featuring big bands and danceable rhythms.',
      'Bebop': 'Complex jazz style from the 1940s emphasizing fast tempos and improvisation.',
      'Cool Jazz': 'Relaxed jazz style from the 1950s featuring softer tones and more formal arrangements.',
      'Free Jazz': 'Experimental jazz from the 1960s breaking from conventional structures.',
      'Fusion': 'Jazz blending elements of rock, funk, and world music.',
      'Rock': 'Popular music genre characterized by electric guitars, drums, and strong rhythms.',
      'Pop': 'Popular music emphasizing catchy melodies and broad commercial appeal.',
      'World Music': 'Traditional and popular music from non-Western cultures.',
      'Electronic Music': 'Music produced using electronic instruments and digital technology.',
      'Languages': 'Systems of communication using symbols, sounds, or gestures, fundamental to human interaction and culture.',
      'Indo-European Languages': 'The largest language family including English, Spanish, Hindi, and Russian.',
      'Sino-Tibetan Languages': 'Language family including Chinese, Tibetan, and Burmese languages.',
      'Afro-Asiatic Languages': 'Language family including Arabic, Hebrew, and various African languages.',
      'Grammar': 'The system of rules governing the structure and use of language.',
      'Linguistics': 'The scientific study of language structure, development, and use.',
      'Translation': 'The process of converting text or speech from one language to another.',
      'Physics': 'The science of matter, energy, and the fundamental forces of nature, seeking to understand the universe\'s behavior.',
      'Mechanics': 'The branch of physics dealing with motion and forces acting on objects.',
      'Classical Mechanics': 'The study of motion of macroscopic objects based on Newton\'s laws.',
      'Kinematics': 'The description of motion without considering its causes.',
      'Dynamics': 'The study of forces and their effects on motion.',
      'Statics': 'The study of forces in equilibrium and bodies at rest.',
      'Fluid Dynamics': 'The study of the motion of liquids and gases.',
      'Wave Motion': 'The propagation of disturbances through a medium.',
      'Thermodynamics': 'The study of heat, energy, and their transformations.',
      'First Law': 'The law of conservation of energy stating energy cannot be created or destroyed.',
      'Second Law': 'The law stating that entropy in an isolated system always increases.',
      'Entropy': 'A measure of disorder or randomness in a system.',
      'Heat Transfer': 'The movement of thermal energy from one object or system to another.',
      'Phase Transitions': 'The transformation of matter between solid, liquid, gas, and plasma states.',
      'Cryogenics': 'The study of materials and phenomena at very low temperatures.',
      'Electromagnetism': 'The study of electric and magnetic fields and their interactions.',
      'Electric Fields': 'Regions of space where electric charges experience forces.',
      'Magnetic Fields': 'Regions of space where magnetic materials experience forces.',
      'Maxwell Equations': 'The four fundamental equations describing all electromagnetic phenomena.',
      'Light': 'Electromagnetic radiation visible to the human eye.',
      'Radiation': 'The emission or transmission of energy through space or matter.',
      'Plasma': 'The fourth state of matter consisting of ionized gas.',
      'Optics': 'The study of light and its interactions with matter.',
      'Geometric Optics': 'The study of light as rays traveling in straight lines.',
      'Wave Optics': 'The study of light as waves exhibiting interference and diffraction.',
      'Quantum Optics': 'The study of light-matter interactions at the quantum level.',
      'Photonics': 'The science and technology of generating, controlling, and detecting photons.',
      'Lasers': 'Devices that emit coherent, monochromatic light through stimulated emission.',
      'Color': 'The perception of different wavelengths of visible light.',
      'Quantum Physics': 'The study of matter and energy at atomic and subatomic scales.',
      'Wave-Particle Duality': 'The concept that particles can exhibit both wave and particle properties.',
      'Superposition': 'The quantum principle that systems can exist in multiple states simultaneously.',
      'Entanglement': 'The quantum phenomenon where particles remain correlated regardless of distance.',
      'Uncertainty Principle': 'Heisenberg\'s principle stating that certain pairs of properties cannot be simultaneously measured with precision.',
      'Quantum Computing': 'Computing using quantum phenomena like superposition and entanglement.',
      'Quantum Field Theory': 'The theoretical framework combining quantum mechanics and special relativity.',
      'Relativity': 'Einstein\'s theories describing space, time, and gravity.',
      'Special Relativity': 'The theory describing physics for objects moving at constant high speeds.',
      'General Relativity': 'Einstein\'s theory of gravitation describing gravity as curved spacetime.',
      'Spacetime': 'The four-dimensional continuum combining space and time.',
      'Gravity': 'The fundamental force attracting objects with mass toward each other.',
      'Cosmological Constant': 'A term in Einstein\'s equations representing dark energy or vacuum energy.',
      'Chemistry': 'The science of substances, their properties, reactions, and the changes they undergo.',
      'Organic Chemistry': 'The study of the structure, properties, composition, reactions, and synthesis of carbon-containing compounds.',
      'Hydrocarbons': 'Organic compounds consisting entirely of hydrogen and carbon.',
      'Functional Groups': 'Specific groups of atoms that determine the chemical properties of organic molecules.',
      'Reactions': 'Chemical processes in which substances are transformed into different compounds.',
      'Synthesis': 'The process of combining simpler compounds to form more complex molecules.',
      'Natural Products': 'Chemical compounds produced by living organisms.',
      'Polymers': 'Large molecules composed of repeating structural units.',
      'Inorganic Chemistry': 'The study of inorganic compounds, typically those that do not contain carbon-hydrogen bonds.',
      'Main Group Chemistry': 'The chemistry of elements in groups 1, 2, and 13-18 of the periodic table.',
      'Transition Metals': 'Elements in groups 3-12 of the periodic table with characteristic properties.',
      'Coordination Chemistry': 'The study of complexes formed between metal ions and ligands.',
      'Solid State Chemistry': 'The study of the structure, properties, and synthesis of solid materials.',
      'Crystal Chemistry': 'The study of the relationship between chemical composition and crystal structure.',
      'Geochemistry': 'The study of the chemical composition and processes of the Earth.',
      'Physical Chemistry': 'The branch of chemistry dealing with the physical properties and behavior of chemical systems.',
      'Kinetics': 'The study of the rates of chemical reactions and the factors affecting them.',
      'Quantum Chemistry': 'The application of quantum mechanics to chemical problems.',
      'Spectroscopy': 'The study of the interaction between matter and electromagnetic radiation.',
      'Electrochemistry': 'The study of chemical reactions involving electron transfer.',
      'Surface Chemistry': 'The study of chemical processes occurring at interfaces.',
      'Biochemistry': 'The study of the chemical processes and substances that occur within living organisms.',
      'Proteins': 'Large biomolecules consisting of amino acid chains performing diverse biological functions.',
      'Carbohydrates': 'Organic compounds consisting of carbon, hydrogen, and oxygen, serving as energy sources.',
      'Lipids': 'Hydrophobic or amphipathic molecules including fats, oils, and steroids.',
      'Nucleic Acids': 'Biomolecules including DNA and RNA that store and transmit genetic information.',
      'Enzymes': 'Biological catalysts that accelerate chemical reactions in living organisms.',
      'Metabolism': 'The chemical processes that occur within organisms to maintain life.',
      'Analytical Chemistry': 'The science of obtaining, processing, and communicating information about the composition and structure of matter.',
      'Materials Science': 'The study of the properties, performance, and applications of materials of all types.',
      'Biology': 'The scientific study of life and living organisms, encompassing their structure, function, growth, origin, evolution, and distribution.',
      'Botany': 'The scientific study of plants, including their physiology, structure, genetics, ecology, distribution, and classification.',
      'Plant Structure': 'The anatomical organization of plants including roots, stems, leaves, and tissues.',
      'Plant Physiology': 'The study of the functions and processes of plants.',
      'Plant Reproduction': 'The processes by which plants produce offspring through sexual and asexual means.',
      'Plant Ecology': 'The study of relationships between plants and their environment.',
      'Agricultural Botany': 'The application of botanical knowledge to crop production and farming.',
      'Ethnobotany': 'The study of relationships between people and plants, including traditional uses.',
      'Zoology': 'The scientific study of animals, including their biology, physiology, behavior, and evolution.',
      'Vertebrate Zoology': 'The study of animals with backbones including fish, amphibians, reptiles, birds, and mammals.',
      'Invertebrate Zoology': 'The study of animals without backbones including insects, mollusks, and worms.',
      'Animal Behavior': 'The study of how animals interact with each other and their environment.',
      'Animal Physiology': 'The study of the functions and processes of animal bodies.',
      'Comparative Anatomy': 'The study of similarities and differences in animal structures across species.',
      'Evolution': 'The process of change in living organisms over generations through natural selection.',
      'Microbiology': 'The study of microscopic organisms, such as bacteria, viruses, archaea, fungi, and protozoa.',
      'Bacteriology': 'The study of bacteria and their characteristics, diseases, and roles.',
      'Virology': 'The study of viruses and viral diseases.',
      'Mycology': 'The study of fungi including their genetics, biochemistry, and uses.',
      'Parasitology': 'The study of parasites and their relationships with host organisms.',
      'Microbial Ecology': 'The study of the interactions of microorganisms with their environment.',
      'Microbial Genetics': 'The study of the genetics of microorganisms.',
      'Genetics': 'The study of genes, genetic variation, and heredity in living organisms.',
      'Classical Genetics': 'The study of inheritance patterns using breeding experiments and pedigree analysis.',
      'Molecular Genetics': 'The study of the structure and function of genes at the molecular level.',
      'Population Genetics': 'The study of genetic variation and change within populations.',
      'Quantitative Genetics': 'The study of traits controlled by multiple genes and environmental factors.',
      'Evolutionary Genetics': 'The study of genetic mechanisms underlying evolutionary change.',
      'Human Genetics': 'The study of inheritance as it occurs in human beings.',
      'Ecology': 'The study of interactions among organisms and their environment.',
      'Population Ecology': 'The study of populations of organisms and their dynamics.',
      'Community Ecology': 'The study of interactions between species in ecological communities.',
      'Ecosystem Ecology': 'The study of energy flow and nutrient cycling in ecosystems.',
      'Biogeography': 'The study of the distribution of species and ecosystems across space and time.',
      'Conservation Biology': 'The science of protecting and preserving biodiversity.',
      'Restoration Ecology': 'The practice of renewing and restoring degraded ecosystems.',
      'Molecular Biology': 'The branch of biology that deals with the molecular basis of biological activity.',
      'DNA': 'The molecule that carries genetic information in living organisms.',
      'RNA': 'Nucleic acid molecules involved in protein synthesis and gene regulation.',
      'Protein Synthesis': 'The process by which cells build proteins from amino acids.',
      'Gene Expression': 'The process by which information from genes is used to synthesize functional products.',
      'Cell Biology': 'The study of the structure, function, and behavior of cells.',
      'Developmental Biology': 'The study of the processes by which organisms grow and develop.',
      'Earth Science': 'The study of the Earth\'s structure, properties, processes, and history, including geology, meteorology, and oceanography.',
      'Geology': 'The science concerned with the Earth\'s physical structure, substance, history, and processes.',
      'Plate Tectonics': 'The theory that Earth\'s outer shell is divided into moving plates.',
      'Rock Formation': 'The processes by which rocks are created, modified, and destroyed.',
      'Mineral Science': 'The study of minerals, their properties, and formation.',
      'Structural Geology': 'The study of rock deformation and the architecture of Earth\'s crust.',
      'Stratigraphy': 'The study of rock layers and their sequences.',
      'Geomorphology': 'The study of landforms and the processes that shape them.',
      'Meteorology': 'The study of the atmosphere and weather processes.',
      'Atmospheric Composition': 'The chemical makeup and structure of Earth\'s atmosphere.',
      'Weather Patterns': 'Recurring atmospheric conditions and their spatial distributions.',
      'Climate Systems': 'Long-term patterns of temperature, precipitation, and other atmospheric conditions.',
      'Storms': 'Atmospheric disturbances characterized by strong winds, precipitation, and other phenomena.',
      'Air Pollution': 'The contamination of the atmosphere by harmful substances.',
      'Climate Change': 'Long-term shifts in global temperatures and weather patterns.',
      'Oceanography': 'The exploration and scientific study of the ocean and its phenomena.',
      'Mineralogy': 'The study of minerals, their structure, properties, and classification.',
      'Seismology': 'The study of earthquakes and the propagation of seismic waves.',
      'Paleontology': 'The study of fossils and ancient life forms.',
      'Mathematics': 'The abstract science of numbers, quantity, structure, space, and change, using logical reasoning and quantitative calculation.',
      'Algebra': 'The branch of mathematics dealing with symbols and rules for manipulating them.',
      'Linear Algebra': 'The study of vectors, vector spaces, and linear transformations.',
      'Abstract Algebra': 'The study of algebraic structures such as groups, rings, and fields.',
      'Commutative Algebra': 'The study of commutative rings and their ideals and modules.',
      'Homological Algebra': 'The study of homology and cohomology in algebraic structures.',
      'Representation Theory': 'The study of abstract algebraic structures by representing their elements as linear transformations.',
      'Category Theory': 'The mathematical study of abstract structures and relationships between them.',
      'Geometry': 'The branch of mathematics concerned with properties of space, shapes, and figures.',
      'Euclidean Geometry': 'The study of plane and solid geometry based on Euclid\'s axioms.',
      'Non-Euclidean Geometry': 'Geometries that modify or reject Euclid\'s parallel postulate.',
      'Differential Geometry': 'The study of geometry using calculus and differential equations.',
      'Algebraic Geometry': 'The study of geometric objects defined by polynomial equations.',
      'Topology': 'The study of properties preserved under continuous deformations.',
      'Discrete Geometry': 'The study of geometric objects with discrete or combinatorial properties.',
      'Calculus': 'The mathematical study of continuous change involving derivatives and integrals.',
      'Differential Calculus': 'The study of rates of change and slopes of curves.',
      'Integral Calculus': 'The study of accumulation and areas under curves.',
      'Multivariable Calculus': 'The extension of calculus to functions of multiple variables.',
      'Complex Analysis': 'The study of functions of complex numbers.',
      'Functional Analysis': 'The study of infinite-dimensional vector spaces and operators.',
      'Harmonic Analysis': 'The study of representing functions as superpositions of basic waves.',
      'Statistics': 'The science of collecting, analyzing, interpreting, and presenting data.',
      'Probability': 'The mathematical study of random phenomena and likelihood.',
      'Descriptive Statistics': 'Methods for summarizing and describing data.',
      'Inferential Statistics': 'Methods for making inferences about populations from samples.',
      'Regression': 'Statistical methods for modeling relationships between variables.',
      'Bayesian Statistics': 'Statistical methods based on Bayes\' theorem and prior probabilities.',
      'Experimental Design': 'The planning of experiments to ensure valid and reliable results.',
      'Number Theory': 'The branch of mathematics devoted to the study of integers and their properties.',
      'Prime Numbers': 'Natural numbers greater than 1 divisible only by 1 and themselves.',
      'Modular Arithmetic': 'Arithmetic for integers where numbers wrap around after reaching a certain value.',
      'Diophantine Equations': 'Polynomial equations where only integer solutions are sought.',
      'Cryptography': 'The practice of secure communication using mathematical techniques.',
      'Analytic Number Theory': 'The use of analytical techniques to study properties of integers.',
      'Algebraic Number Theory': 'The study of algebraic structures related to algebraic integers.',
      'Astronomy': 'The scientific study of celestial objects, space, and the universe as a whole.',
      'Observational Astronomy': 'The practice of observing celestial objects and phenomena.',
      'Planetary Science': 'The study of planets, moons, and planetary systems.',
      'Inner Planets': 'The rocky planets closest to the Sun: Mercury, Venus, Earth, and Mars.',
      'Outer Planets': 'The gas and ice giants: Jupiter, Saturn, Uranus, and Neptune.',
      'Moons': 'Natural satellites orbiting planets and other celestial bodies.',
      'Asteroids': 'Small rocky bodies orbiting the Sun, primarily in the asteroid belt.',
      'Comets': 'Icy bodies that develop tails when approaching the Sun.',
      'Exoplanets': 'Planets orbiting stars outside our solar system.',
      'Stellar Astronomy': 'The study of stars, their properties, and evolution.',
      'Star Formation': 'The process by which dense regions of molecular clouds collapse to form stars.',
      'Star Life Cycle': 'The stages through which stars evolve from birth to death.',
      'Stellar Classification': 'The categorization of stars by their spectral characteristics.',
      'Binary Stars': 'Star systems consisting of two stars orbiting their common center of mass.',
      'Pulsars': 'Highly magnetized rotating neutron stars emitting beams of electromagnetic radiation.',
      'Neutron Stars': 'Extremely dense stellar remnants composed primarily of neutrons.',
      'Galactic Astronomy': 'The study of our Milky Way galaxy and its structure.',
      'Extragalactic Astronomy': 'The study of objects beyond the Milky Way galaxy.',
      // New Ethics Subdivisions (Normative/Metaethics/Applied)
      'Normative Ethics': 'The branch of ethics concerned with establishing criteria for right and wrong action.',
      'Metaethics': 'The philosophical study of the nature, origins, and status of moral facts and principles.',
      'Moral Realism': 'The view that moral truths exist objectively, independent of individual opinions or beliefs.',
      'Moral Relativism': 'The view that moral truths vary depending on culture, individual perspective, or historical context.',
      'Moral Nihilism': 'The view that there are no objective moral facts or truths.',
      'Cognitivism': 'The view that moral judgments express beliefs that can be true or false.',
      'Emotivism': 'The view that moral judgments are expressions of emotional attitudes rather than factual claims.',
      'Gene Ethics': 'The ethical examination of genetic engineering, modification, and inheritance manipulation.',
      'Organ Transplantation': 'The ethical issues surrounding the donation, allocation, and use of organs for medical purposes.',
      'Genetic Testing': 'The ethical considerations in testing for genetic conditions and disease predispositions.',
      'Reproductive Ethics': 'The ethical examination of reproduction, fertility, contraception, and genetic selection.',
      'Business Ethics': 'The examination of ethical principles in corporate behavior, profit, and stakeholder responsibility.',
      'Computer Ethics': 'The ethical issues surrounding technology, artificial intelligence, privacy, and digital rights.',
      // Philosophy of Mind
      'Philosophy of Mind': 'The philosophical study of consciousness, mental states, perception, and their relationship to the physical world.',
      'Consciousness': 'The subjective experience of awareness, perception, sensation, and thought.',
      'Intentionality': 'The phenomenological property of mental states being directed toward objects or content.',
      'Qualia': 'The subjective quality of experiences, such as the redness of red or painfulness of pain.',
      'Personal Identity': 'The philosophical question of what makes an individual the same person over time.',
      'Artificial Intelligence': 'The creation of intelligent machines and the philosophical questions about machine consciousness and understanding.',
      // Additional Epistemology
      'Empiricism': 'The epistemological view that sense experience is the primary source of knowledge.',
      'Foundationalism': 'The epistemological view that justified beliefs rest on a foundation of self-evident or basic beliefs.',
      // History of Philosophy
      'History of Philosophy': 'The chronological study of philosophical ideas, thinkers, and schools of thought across cultures and eras.',
      'Ancient Philosophy': 'The philosophical traditions of ancient Greece, Rome, China, and India.',
      'Medieval Philosophy': 'The philosophical traditions of medieval Christendom, Islam, and Judaism.',
      'Modern Philosophy': 'The philosophical developments from the Renaissance through the 18th century.',
      'Contemporary Philosophy': 'Current philosophical movements and debates in the 20th and 21st centuries.',
      // Metaphilosophy
      'Metaphilosophy': 'The philosophical study of philosophy itself, its methods, foundations, and nature.',
      'Philosophy of Logic': 'The examination of the foundations, nature, and validity of logical systems and reasoning.',
      'Philosophy of Language': 'The study of the nature of language, meaning, reference, and communication.',
      'Philosophy of Science': 'The examination of the methods, assumptions, and implications of scientific inquiry.',
      // Political Philosophy additions
      'Democracy': 'A system of government based on popular sovereignty and equal political participation.',
      'Authoritarianism': 'Political systems characterized by concentrated power and limited individual freedoms.',
      'Anarchism': 'The political philosophy advocating for the abolition of hierarchical authority and the state.',
      // Religious Studies (New major section)
      'Religious Studies': 'The academic study of religion, religious beliefs, practices, institutions, and their cultural significance.',
      'Western Religions': 'The major monotheistic faiths originating in the Middle East, including Christianity, Judaism, and Islam.',
      'Christianity': 'The world\'s largest religion based on the life and teachings of Jesus Christ.',
      'Catholicism': 'The largest Christian denomination centered on papal authority and apostolic succession.',
      'Protestantism': 'Christian denominations originating from the 16th century Reformation emphasizing scripture and personal faith.',
      'Orthodox Christianity': 'Eastern Christian churches emphasizing apostolic tradition, sacramental theology, and liturgical worship.',
      'Christian Theology': 'The systematic study of Christian doctrine, God\'s nature, and salvation history.',
      'Christian History': 'The chronological study of Christianity\'s development from its origins through the present day.',
      'Judaism': 'The ancient monotheistic religion based on the Torah and Jewish law and tradition.',
      'Jewish Law': 'The system of religious and civil law in Judaism, derived from the Torah and rabbinic interpretation.',
      'Jewish Philosophy': 'The philosophical thought developing from Jewish theological and ethical traditions.',
      'Jewish History': 'The history of the Jewish people, their migrations, persecution, and cultural developments.',
      'Kabbalah': 'The esoteric tradition within Judaism focusing on hidden divine knowledge and mystical interpretation.',
      'Islam': 'The world\'s second-largest religion based on the teachings of Muhammad and the Qur\'an.',
      'Islamic Law': 'The legal system derived from the Qur\'an, Hadith, and scholarly consensus in Islamic societies.',
      'Islamic Theology': 'The systematic exposition of Islamic beliefs regarding Allah, revelation, and human destiny.',
      'Islamic Philosophy': 'The philosophical synthesis of Greek philosophy with Islamic theology and ethics.',
      'Islamic History': 'The history of Islam from the 7th century through contemporary Muslim-majority societies.',
      'Qur\'anic Studies': 'The scholarly examination of the Qur\'an\'s text, interpretation, and historical context.',
      'Eastern Religions': 'The major religious traditions originating in Asia, including Buddhism, Hinduism, and Taoism.',
      'Buddhism': 'The spiritual tradition founded on the teachings of Buddha emphasizing the elimination of suffering.',
      'Theravada': 'The oldest Buddhist school emphasizing individual enlightenment through meditation and monastic practice.',
      'Mahayana': 'The major Buddhist tradition emphasizing universal enlightenment and the role of bodhisattvas.',
      'Vajrayana': 'The Buddhist school emphasizing tantric practices and visualization for rapid enlightenment.',
      'Buddhist Philosophy': 'The philosophical teachings of Buddhism regarding the nature of self, suffering, and enlightenment.',
      'Buddhist History': 'The development and spread of Buddhism across Asia from the 5th century BC to the present.',
      'Hinduism': 'The major Indian religion with diverse practices centered on dharma, karma, and ultimate liberation.',
      'Vedanta': 'The Hindu philosophical school emphasizing the unity of Brahman and pursuing spiritual liberation.',
      'Yoga': 'Hindu spiritual and physical practices aimed at union with the divine and enlightenment.',
      'Hindu Mythology': 'The stories of Hindu gods, heroes, and cosmic principles in the Vedas and Puranas.',
      'Hindu Philosophy': 'The systematic philosophical traditions within Hinduism exploring ultimate reality and human purpose.',
      'Hindu History': 'The history of Hindu civilization from the Vedic period through contemporary India.',
      'Taoism': 'The Chinese philosophical and religious tradition emphasizing harmony with the Way (Tao) of nature.',
      'Shinto': 'The indigenous Japanese religious tradition focused on kami (spirits) and harmonic relationships with nature.',
      'Sikhism': 'The Indian monotheistic religion founded by Guru Nanak emphasizing social equality and devotion to God.',
      'Jainism': 'The Indian religion emphasizing non-violence, asceticism, and liberation through spiritual discipline.',
      'Biblical Studies': 'The scholarly examination of the Hebrew Bible and New Testament, including their history and interpretation.',
      'Old Testament': 'The Hebrew scriptures encompassing law, history, prophecy, and wisdom literature.',
      'Torah': 'The Five Books of Moses containing law, creation narrative, and covenant history.',
      'Prophets': 'The biblical books of Hebrew prophets delivering God\'s messages and predictions.',
      'Historical Books': 'Old Testament books narrating Israel\'s history from conquest through exile.',
      'Wisdom Literature': 'Old Testament books offering practical wisdom, philosophical reflection, and spiritual insight.',
      'Psalms': 'The Hebrew Bible\'s book of liturgical poems and prayers expressing praise, lament, and petition to God.',
      'New Testament': 'The Christian scriptures narrating Jesus\'s life and early Christian history and theology.',
      'Gospels': 'The four accounts of Jesus\'s life, teachings, death, and resurrection in the New Testament.',
      'Epistles': 'Letters written by early Christian leaders addressing theological and practical matters.',
      'Revelation': 'The apocalyptic final book of the New Testament prophesying the end times and God\'s ultimate triumph.',
      'Acts': 'The New Testament narrative of the early church\'s growth, apostolic authority, and missionary expansion.',
      'Pauline Theology': 'The theological teachings of Paul regarding grace, faith, salvation, and Christian living.',
      'Biblical Theology': 'The systematic study of theological themes within biblical texts.',
      'Biblical Archaeology': 'The archaeological investigation of ancient biblical sites and their cultural context.',
      'Biblical Languages': 'The study of Hebrew, Aramaic, and Koine Greek in which biblical texts were composed.',
      'Comparative Religion': 'The systematic study of similarities and differences in beliefs, practices, and structures across religions.',
      'Religious Philosophy': 'The philosophical examination of god, faith, religious knowledge, and the problem of evil.',
      'Mythology': 'The collection and interpretation of myths from various cultures explaining origins and cosmic order.',
      'Greek Mythology': 'The myths and legends of ancient Greece featuring gods, heroes, and cosmic narratives.',
      'Roman Mythology': 'The myths and pantheon of ancient Rome, often adapted from Greek sources.',
      'Norse Mythology': 'The myths of ancient Scandinavia featuring gods, giants, and the apocalyptic Ragnarok.',
      'Egyptian Mythology': 'The myths and religious beliefs of ancient Egypt regarding the gods and afterlife.',
      // Arts Reorganization
      'Arts': 'The collective expression of human creativity through visual, performing, and literary means.',
      // Visual Arts
      'Visual Arts': 'The branches of art emphasizing visual representation including painting, sculpture, and design.',
      'Color Theory': 'The science and art of color relationships, harmony, and emotional expression in visual composition.',
      'Technique': 'The practical skills, methods, and technical processes used in creating visual artworks.',
      'Contemporary Sculpture': 'Current sculptural practices exploring new materials, conceptual approaches, and public engagement.',
      'Architectural Theory': 'The philosophy and critical analysis of architectural principles, movements, and design methodology.',
      'Urban Design': 'The planning and design of cities, public spaces, and urban environments for livability and aesthetics.',
      'Black and White Photography': 'Photography using monochromatic tones emphasizing form, contrast, and emotional intensity.',
      'Color Photography': 'The art of photography using color to convey mood, meaning, and aesthetic beauty.',
      'Documentary Photography': 'Photography that records real events and conditions, often advocating for social issues.',
      'Fine Art Photography': 'Photography created primarily for aesthetic and conceptual merit rather than commercial use.',
      'Photojournalism': 'The practice of telling news stories through photographs, presenting factual visual documentation.',
      'Film': 'The art and industry of moving images and sound, a powerful medium for narrative and expression.',
      'Film History': 'The chronological development of cinema from its invention through contemporary filmmaking.',
      'Film Theory': 'The critical and philosophical analysis of film aesthetics, narrative, and cultural significance.',
      'Cinematography': 'The technical art of capturing images through lighting, composition, and camera techniques.',
      'Film Genres': 'The categories and conventions of film including drama, comedy, horror, science fiction, and romance.',
      'Film Criticism': 'The analysis and evaluation of films as artworks and cultural artifacts.',
      'Animation': 'The art of creating the illusion of movement through sequential image display.',
      'Documentary Film': 'Films presenting factual information and reality rather than fictional narratives.',
      'Digital Painting': 'Painting created using digital software and electronic tools on tablets or computers.',
      'Digital Sculpture': 'Three-dimensional artwork created, modified, or displayed using digital technology.',
      'Virtual Reality Art': 'Immersive art experiences using head-mounted displays creating artificial environments.',
      'Generative Art': 'Art created using algorithms, code, or autonomous systems to produce unpredictable outcomes.',
      'Interactive Art': 'Sculptures and installations encouraging audience participation and engagement with the artwork.',
      'Typography': 'The art and technique of arranging type to make written language visually appealing and readable.',
      'Logo Design': 'The creation of distinctive visual brands and symbolic marks representing companies or organizations.',
      'Web Design': 'The artistic and technical design of websites for aesthetics, functionality, and user experience.',
      'Branding': 'The strategic design and communication of a company\'s identity, values, and market position.',
      'Layout Design': 'The arrangement of visual and textual elements in space to create organized, attractive compositions.',
      'Printmaking': 'The artistic technique of creating images through inking, pressing, and transferring onto paper or fabric.',
      // Performing Arts
      'Performing Arts': 'The branches of art involving live performance including theatre, dance, and performance art.',
      'Theatre': 'The dramatic art of storytelling and character portrayal through live performance on stage.',
      'Classical Theatre': 'Theatre from ancient Greece and Rome, including works by Aeschylus, Sophocles, Euripides, and Plautus.',
      'Modern Theatre': 'Theatre from the late 19th and 20th centuries exploring realism and psychological depth.',
      'Contemporary Theatre': 'Current theatrical practices with diverse aesthetics and engagement with social issues.',
      'Theatre Theory': 'The critical and philosophical analysis of dramatic structure, performance, and theatrical meaning.',
      'Directing': 'The creative leadership of actors and artistic teams in realizing a dramatic vision.',
      'Acting': 'The craft of portraying characters, using voice, body, and emotion to convey authentic human experience.',
      'Stage Design': 'The visual design of theatrical environments including scenery, lighting, and spatial arrangement.',
      'Dance': 'The art form using structured movement, rhythm, and expression of the human body.',
      'Classical Dance': 'Formal dance traditions with codified techniques and long historical development.',
      'Modern Dance': 'Dance emphasizing personal expression and freedom from classical ballet traditions.',
      'Contemporary Dance': 'Current dance exploring diverse styles, fusion, and experimental movement vocabulary.',
      'Ballet': 'The classical dance form emphasizing technique, grace, storytelling, and ethereal movement quality.',
      'Jazz Dance': 'Dance style incorporating jazz music rhythms, improvisation, and energetic hip iso lations.',
      'Hip Hop Dance': 'Street dance culture incorporating breaking, locking, popping, and freestyle movement.',
      'Musical Theatre': 'Theatre combining drama, music, dance, and spectacle to tell stories through song.',
      // Design
      'Design': 'The process of planning and creating solutions for human needs through form and function.',
      'Industrial Design': 'The design of manufactured goods balancing aesthetics, function, and commercial viability.',
      'Fashion Design': 'The creation of clothing and accessories expressing personal style and cultural values.',
      'Interaction Design': 'The design of digital interfaces making technology intuitive and usable for humans.',
      'Game Design': 'The creation of rules, mechanics, and narrative experiences in video games and tabletop games.',
      // Additional Language topics
      'Austronesian Languages': 'Language family including Indonesian, Tagalog, and languages of the Pacific islands.',
      'Altaic Languages': 'Disputed language grouping potentially including Turkish, Mongolian, and Tungusic languages.',
      'Phonetics': 'The study of sounds in human speech and how they are produced and perceived.',
      'Semantics': 'The study of meaning in language, including how words and sentences convey significance.',
      // Additional Music topics
      'Music Theory': 'The study of musical structure, harmony, melody, rhythm, and the principles of composition.',
      'Composition': 'The creation of original musical works using melody, harmony, and orchestration.',
      'Orchestral Music': 'Music composed for large ensembles of orchestral instruments with diverse timbral possibilities.',
      'Chamber Music': 'Music composed for small ensembles, typically one instrument per part, emphasizing intimacy.',
      'Modal Jazz': 'Jazz style based on scales or modes rather than traditional chord changes.',
      'Jazz Standards': 'Widely recognized jazz tunes from earlier eras that form the repertoire of jazz musicians.',
      'Classic Rock': 'Rock music from the 1960s-1980s emphasizing guitar-driven songs and album-oriented rock.',
      'Progressive Rock': 'Rock music using complex structures, diverse instruments, and musical sophistication.',
      'Punk Rock': 'Rock movement emphasizing fast tempos, simple chords, and DIY attitude and ethics.',
      'Alternative Rock': 'Rock music from the 1980s-1990s rejecting mainstream conventions.',
      'Heavy Metal': 'Rock music with distorted guitars, powerful vocals, and dark, intense themes.',
      // Literature expansions
      'Essays': 'Short non-fiction prose compositions exploring ideas from a personal or argumentative perspective.',
      'Narrative Forms': 'The structures and techniques of storytelling across various literary genres and media.',
      'Epic Poetry': 'Long narrative poems narrating heroic deeds and cultural mythology.',
      'Lyric Poetry': 'Poetry emphasizing personal emotion, imagery, and musical qualities of language.',
      'Contemporary Drama': 'Current theatrical works engaging with contemporary social, political, and personal issues.',
      'Melodrama': 'Dramatic works emphasizing emotional extremes, clear moral distinctions, and spectacular effects.',
      // Additional Literary Theory concepts
      'Literary Criticism': 'The analysis and interpretation of literature examining meaning, themes, and artistic achievement.',
    }
    // If a summary exists, use it
    if (summaries[label]) return summaries[label];
    // No custom summary available - return empty string instead of placeholder
    return '';
  }

  // Knowledge base mapping topics to their meaningful subdivisions
  const hasKnownSubdivisions = (label) => {
    return TOPIC_SUBDIVISIONS.hasOwnProperty(label) && TOPIC_SUBDIVISIONS[label].length > 0
  }

  const fetchWikipediaSuggestions = async (query) => {
    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=categories&cllimit=50&format=json&origin=*`
      )
      const data = await response.json()
      const pages = data.query?.pages || {}
      const categories = []
      
      for (const page of Object.values(pages)) {
        if (page.categories) {
          categories.push(...page.categories.map((c) => c.title.replace('Category:', '')))
        }
      }
      
      // Return categories that look like subcategories (contain the query term or are plausible topics)
      // Use word boundary matching to avoid matching substrings inside words
      return categories
        .filter((cat) => {
          if (cat.length <= 5) return false
          const regex = new RegExp(`\\b${query.toLowerCase()}`, 'i')
          return regex.test(cat) || cat.toLowerCase().startsWith(query.toLowerCase())
        })
    } catch (error) {
      console.error('Failed to fetch Wikipedia suggestions:', error)
      return []
    }
  }

  const getChildSuggestions = async (parentLabel) => {
    // First check if we have curated subdivisions for this topic
    if (TOPIC_SUBDIVISIONS[parentLabel]) {
      return TOPIC_SUBDIVISIONS[parentLabel]
    }
    
    // Fallback to generic labels (will be replaced with curated content over time)
    return ['Concept A', 'Concept B']
  }

  useEffect(() => {
    if (!transitionsEnabled && canvasSize.width > 0 && canvasSize.height > 0 && viewportSize.width > 0) {
      const id = requestAnimationFrame(() => setTransitionsEnabled(true))
      return () => cancelAnimationFrame(id)
    }
    return undefined
  }, [canvasSize.width, canvasSize.height, viewportSize.width, transitionsEnabled])

  const addCustomChild = (parentNodeId) => {
    if (!isAuthenticated) {
      alert('Please sign in to add custom nodes to your private map.')
      return
    }

    const maxExistingId = nodes.reduce((maxId, node) => {
      if (!node || !Number.isFinite(node.id)) return maxId
      return Math.max(maxId, node.id)
    }, 0)
    const newId = Math.max(nextId.current, maxExistingId + 1)

    const newNode = {
      id: newId,
      label: 'New Node',
      parentId: parentNodeId,
      isCustom: true,
      hidden: false,
      summary: '',
    }

    nextId.current = newId + 1

    if (enableAnimations) {
      setAnimatingIds(new Set([newId]))
      setNodes((prev) => {
        // Insert in alphabetical order among siblings
        const insertIdx = prev.findIndex(n => {
          if (n.parentId !== parentNodeId) return false
          return 'New Node'.localeCompare(n.label) < 0
        })
        const finalIdx = insertIdx === -1 ? prev.length : insertIdx
        return [...prev.slice(0, finalIdx), newNode, ...prev.slice(finalIdx)]
      })
      requestAnimationFrame(() => setAnimatingIds(new Set()))
    } else {
      setNodes((prev) => {
        // Insert in alphabetical order among siblings
        const insertIdx = prev.findIndex(n => {
          if (n.parentId !== parentNodeId) return false
          return 'New Node'.localeCompare(n.label) < 0
        })
        const finalIdx = insertIdx === -1 ? prev.length : insertIdx
        return [...prev.slice(0, finalIdx), newNode, ...prev.slice(finalIdx)]
      })
    }

    // Focus the new node and enter edit mode
    setFocusedElement({ nodeId: newId, type: 'node' })
    setEditingNodeId(newId)
    // Focus the input after a short delay to ensure rendering
    setTimeout(() => editInputRef.current?.focus(), 100)
  }

  const addCustomSibling = (referenceNodeId) => {
    if (!isAuthenticated) {
      alert('Please sign in to add custom nodes to your private map.')
      return
    }

    const referenceNode = nodes.find((node) => node.id === referenceNodeId)
    if (!referenceNode || referenceNode.parentId === null) {
      alert('Cannot add a sibling to the root node.')
      return
    }

    const maxExistingId = nodes.reduce((maxId, node) => {
      if (!node || !Number.isFinite(node.id)) return maxId
      return Math.max(maxId, node.id)
    }, 0)
    const newId = Math.max(nextId.current, maxExistingId + 1)

    const newNode = {
      id: newId,
      label: 'New Node',
      parentId: referenceNode.parentId,
      isCustom: true,
      hidden: false,
      summary: '',
    }

    nextId.current = newId + 1

    if (enableAnimations) {
      setAnimatingIds(new Set([newId]))
      setNodes((prev) => {
        // Insert in alphabetical order among siblings
        const insertIdx = prev.findIndex(n => {
          if (n.parentId !== referenceNode.parentId) return false
          return 'New Node'.localeCompare(n.label) < 0
        })
        const finalIdx = insertIdx === -1 ? prev.length : insertIdx
        return [...prev.slice(0, finalIdx), newNode, ...prev.slice(finalIdx)]
      })
      requestAnimationFrame(() => setAnimatingIds(new Set()))
    } else {
      setNodes((prev) => {
        // Insert in alphabetical order among siblings
        const insertIdx = prev.findIndex(n => {
          if (n.parentId !== referenceNode.parentId) return false
          return 'New Node'.localeCompare(n.label) < 0
        })
        const finalIdx = insertIdx === -1 ? prev.length : insertIdx
        return [...prev.slice(0, finalIdx), newNode, ...prev.slice(finalIdx)]
      })
    }

    // Focus the new node and enter edit mode
    setFocusedElement({ nodeId: newId, type: 'node' })
    setEditingNodeId(newId)
  }

  const deleteCustomNode = (nodeId) => {
    if (!isAuthenticated) {
      alert('Please sign in to delete custom nodes.')
      return
    }

    const nodeToDelete = nodes.find((node) => node.id === nodeId)
    if (!nodeToDelete) return

    if (!nodeToDelete.isCustom) {
      alert('Only custom nodes can be deleted.')
      return
    }

    const hasChildren = nodes.some((node) => node.parentId === nodeId)
    const confirmMessage = hasChildren 
      ? `Delete "${nodeToDelete.label}" and all its children?`
      : `Delete "${nodeToDelete.label}"?`

    // Show modern confirmation modal instead of window.confirm
    setDeleteModalChoice('cancel')
    setDeleteConfirmation({ nodeId, message: confirmMessage, includeChildren: hasChildren })
  }

  const confirmDelete = () => {
    if (!deleteConfirmation) return
    const nodeId = deleteConfirmation.nodeId

    // Remove the node and all its descendants
    const nodeIdsToRemove = new Set([nodeId])
    const findDescendants = (parentId) => {
      nodes.forEach((node) => {
        if (node.parentId === parentId) {
          nodeIdsToRemove.add(node.id)
          findDescendants(node.id)
        }
      })
    }
    findDescendants(nodeId)

    setNodes((prev) => prev.filter((node) => !nodeIdsToRemove.has(node.id)))
    
    // Clear selection and focus if the deleted node was selected/focused
    if (selectedId === nodeId) {
      setSelectedId(null)
      setPanelOpen(false)
    }
    if (focusedElement?.nodeId === nodeId) {
      setFocusedElement(null)
    }

    setDeleteModalChoice('cancel')
    setDeleteConfirmation(null)
  }

  const cancelDelete = () => {
    setDeleteModalChoice('cancel')
    setDeleteConfirmation(null)
  }

  const updateNodeLabel = (nodeId, newLabel) => {
    if (!newLabel.trim()) {
      // If empty, revert to default or delete the node
      const node = nodes.find(n => n.id === nodeId)
      if (node && node.isCustom) {
        // Show modern modal instead of window.confirm
        setDeleteModalChoice('cancel')
        setDeleteConfirmation({ nodeId, message: 'Delete this empty node?', includeChildren: false })
      }
      setEditingNodeId(null)
      return
    }

    // Check if this is a custom node BEFORE updating state
    const node = nodes.find(n => n.id === nodeId)
    const isCustom = node?.isCustom
    const parentId = node?.parentId

    setNodes((prev) => {
      // Update the label
      const updated = prev.map((n) =>
        n.id === nodeId ? { ...n, label: newLabel.trim() } : n
      )

      // If it's a custom node, reorder it alphabetically among siblings
      if (isCustom && parentId !== undefined) {
        // Find the current node in updated array
        const nodeIdx = updated.findIndex(n => n.id === nodeId)
        if (nodeIdx !== -1) {
          const nodeToMove = updated[nodeIdx]
          const withoutNode = [...updated.slice(0, nodeIdx), ...updated.slice(nodeIdx + 1)]
          
          // Find correct position alphabetically
          const insertIdx = withoutNode.findIndex(n => {
            if (n.parentId !== parentId) return false
            return nodeToMove.label.localeCompare(n.label) < 0
          })
          
          // Insert at correct position
          const finalIdx = insertIdx === -1 ? withoutNode.length : insertIdx
          return [...withoutNode.slice(0, finalIdx), nodeToMove, ...withoutNode.slice(finalIdx)]
        }
      }
      
      return updated
    })
    
    setEditingNodeId(null)

    // Auto-select and open sidebar for custom nodes after editing
    if (isCustom) {
      setSelectedId(nodeId)
      setPanelOpen(true)
      setPanelExpanded(false)
    }
  }

  const addChildren = async (parentNodeId) => {
    const parent = nodes.find((node) => node.id === parentNodeId)
    if (!parent) return { expanded: false }

    const existingChildren = nodes.filter((node) => node.parentId === parentNodeId && !node.hidden)
    const nonCustomChildren = existingChildren.filter((node) => !node.isCustom)
    const hiddenChildren = nodes.filter((node) => node.parentId === parentNodeId && node.hidden)

    if (existingChildren.length > 0) {
      setNodes((prev) =>
        prev.map((node) =>
          node.parentId === parentNodeId ? { ...node, hidden: true } : node
        )
      )
      if (existingChildren.length > 0) {
        setNodes((prev) =>
          prev.map((node) =>
            node.parentId === parentNodeId ? { ...node, hidden: true } : node
          )
        )
        setAnimatingIds(new Set())
        setSelectedId(null)
        setBasePanOffset({ x: 0, y: 0 })
        setRecenterKey((k) => k + 1)
        return { expanded: false }
      } else {
        let updatedNodes = nodes.map((node) => {
          if (node.parentId === parentNodeId && node.hidden) {
            return { ...node, hidden: false }
          }
          if (node.parentId !== parentNodeId) {
            const ancestors = new Set()
            let current = node
            while (current && current.parentId) {
              ancestors.add(current.parentId)
              current = nodes.find(n => n.id === current.parentId)
            }
            if (ancestors.has(parentNodeId)) {
              return { ...node, hidden: true }
            }
          }
          return node
        })

        const allChildren = updatedNodes.filter((node) => node.parentId === parentNodeId)
        const existingPredefined = allChildren.filter((node) => !node.isCustom)

        let firstChildId = null;
        if (existingPredefined.length === 0) {
          let labels = ['Concept A', 'Concept B']
          if (parentNodeId === 1) {
            labels = ['Humanities', 'Sciences']
          } else {
            labels = await getChildSuggestions(parent.label)
          }

          const maxExistingId = updatedNodes.reduce((maxId, node) => {
            if (!node || !Number.isFinite(node.id)) return maxId
            return Math.max(maxId, node.id)
          }, 0)
          const startId = Math.max(nextId.current, maxExistingId + 1)
          const newNodeIds = Array.from({ length: labels.length }, (_, i) => startId + i)
          const newNodes = Array.from({ length: labels.length }, (_, index) => ({
            id: startId + index,
            label: labels[index],
            parentId: parentNodeId,
            hidden: false,
            summary: generateSummary(labels[index]),
          }))

          nextId.current = startId + newNodes.length
          firstChildId = newNodes[0]?.id;

          if (enableAnimations) {
            setAnimatingIds(new Set(newNodeIds))
            updatedNodes = [...updatedNodes, ...newNodes]
            setNodes(updatedNodes)
            requestAnimationFrame(() => setAnimatingIds(new Set()))
          } else {
            updatedNodes = [...updatedNodes, ...newNodes]
            setNodes(updatedNodes)
          }
        } else {
          setNodes(updatedNodes)
          const firstChild = updatedNodes.find((node) => node.parentId === parentNodeId && !node.hidden)
          firstChildId = firstChild?.id;
        }

        // Center on the first child after expansion
        if (firstChildId) {
          // Wait for layout update
          setTimeout(() => {
            const layout = buildLayout(updatedNodes, TOPIC_SUBDIVISIONS, NODE_WIDTH, NODE_HEIGHT);
            const pos = layout.positions.get(firstChildId);
            if (pos) {
              setBasePanOffset({ x: -pos.x + windowSize.width / 2 - NODE_WIDTH / 2, y: -pos.y + windowSize.height / 2 - NODE_HEIGHT / 2 });
              setRecenterKey((k) => k + 1);
            }
          }, 0);
        }
        return { expanded: true, firstChildId };
      }
    }

  const addNoteToNode = (nodeId, options = {}) => {
    const { afterNoteId = null, level = 0 } = options;
    const newNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: '',
      level: Math.max(0, Math.min(5, level)),
      createdAt: new Date().toISOString(),
    };

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (() => {
                const notes = [...(node.notes || [])]
                if (!afterNoteId) return [...notes, newNote]
                const insertIndex = notes.findIndex((note) => note.id === afterNoteId)
                if (insertIndex === -1) return [...notes, newNote]
                return [
                  ...notes.slice(0, insertIndex + 1),
                  newNote,
                  ...notes.slice(insertIndex + 1),
                ]
              })(),
            }
          : node
      )
    )

    draftNoteIdsRef.current.add(newNote.id)

    requestAnimationFrame(() => {
      const input = noteInputRefs.current[newNote.id]
      if (input) {
        input.focus()
        input.setSelectionRange(input.value.length, input.value.length)
      }
    })
  }

  const updateNoteText = (nodeId, noteId, text) => {
    if ((text || '').trim()) {
      draftNoteIdsRef.current.delete(noteId)
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === noteId ? { ...note, text } : note
              ),
            }
          : node
      )
    )
  }

  const updateNoteLevel = (nodeId, noteId, delta) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) => {
                if (note.id !== noteId) return note
                const currentLevel = Number.isFinite(note.level) ? note.level : 0
                return {
                  ...note,
                  level: Math.max(0, Math.min(5, currentLevel + delta)),
                }
              }),
            }
          : node
      )
    )
  }

  const removeNoteFromNode = (nodeId, noteId) => {
    draftNoteIdsRef.current.delete(noteId)
    draftGridIdsRef.current.delete(noteId)
    if (lastCreatedGridId === noteId) {
      setLastCreatedGridId(null)
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? { ...node, notes: (node.notes || []).filter((note) => note.id !== noteId) }
          : node
      )
    )
  }

  const handleNoteKeyDown = (event, nodeId, note) => {
    if (event.key === 'Escape') {
      const isDraft = draftNoteIdsRef.current.has(note.id)
      const isEmpty = !(note.text || '').trim()
      if (isDraft && isEmpty) {
        event.preventDefault()
        event.stopPropagation()
        removeNoteFromNode(nodeId, note.id)
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      const noteLevel = Number.isFinite(note.level) ? note.level : 0
      addNoteToNode(nodeId, { afterNoteId: note.id, level: noteLevel })
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      updateNoteLevel(nodeId, note.id, event.shiftKey ? -1 : 1)
      return
    }

    if (event.key === 'Backspace') {
      const target = event.currentTarget
      const noteLevel = Number.isFinite(note.level) ? note.level : 0
      const atStart = target.selectionStart === 0 && target.selectionEnd === 0
      if (atStart && noteLevel > 0) {
        event.preventDefault()
        event.stopPropagation()
        updateNoteLevel(nodeId, note.id, -1)
      }
    }
  }

  const addGridToNode = (nodeId, options = {}) => {
    const { afterNoteId = null, level = 0, rows = 3, cols = 3 } = options
    const newGrid = {
      id: `grid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'grid',
      rows,
      cols,
      data: Array(rows).fill(null).map(() => Array(cols).fill('')),
      level: Math.max(0, Math.min(5, level)),
      createdAt: new Date().toISOString(),
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (() => {
                const notes = [...(node.notes || [])]
                if (!afterNoteId) return [...notes, newGrid]
                const insertIndex = notes.findIndex((note) => note.id === afterNoteId)
                if (insertIndex === -1) return [...notes, newGrid]
                return [
                  ...notes.slice(0, insertIndex + 1),
                  newGrid,
                  ...notes.slice(insertIndex + 1),
                ]
              })(),
            }
          : node
      )
    )

    draftGridIdsRef.current.add(newGrid.id)
    setLastCreatedGridId(newGrid.id)
  }

  const isGridEmpty = (grid) => {
    if (!grid || !Array.isArray(grid.data)) return true
    return grid.data.every((row) =>
      Array.isArray(row) ? row.every((cell) => !(String(cell || '').trim())) : true
    )
  }

  const updateGridCell = (nodeId, gridId, rowIndex, colIndex, value) => {
    if ((value || '').trim()) {
      draftGridIdsRef.current.delete(gridId)
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid'
                  ? {
                      ...note,
                      data: note.data.map((row, rIdx) =>
                        rIdx === rowIndex
                          ? row.map((cell, cIdx) => (cIdx === colIndex ? value : cell))
                          : row
                      ),
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const handleGridKeyDown = (event, nodeId, gridId, grid) => {
    if (event.key === 'Escape') {
      const isDraft = draftGridIdsRef.current.has(gridId)
      if (isDraft && isGridEmpty(grid)) {
        event.preventDefault()
        event.stopPropagation()
        removeNoteFromNode(nodeId, gridId)
      }
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      updateNoteLevel(nodeId, gridId, event.shiftKey ? -1 : 1)
      return
    }

    if (event.key === 'Backspace') {
      const gridLevel = Number.isFinite(grid.level) ? grid.level : 0
      if (gridLevel <= 0) return

      // Match note behavior: only outdent when cursor is at the start.
      // For grids, this applies only to the top-left cell (row 0, col 0).
      const target = event.target
      const isGridInput = target.classList && target.classList.contains('grid-cell-input')

      if (isGridInput) {
        const atStart = target.selectionStart === 0 && target.selectionEnd === 0
        if (!atStart) return

        const currentTd = target.closest('td')
        const currentTr = target.closest('tr')
        const isFirstCol = currentTd && currentTd.previousElementSibling === null
        const isFirstRow = currentTr && currentTr.previousElementSibling === null

        if (isFirstRow && isFirstCol) {
          event.preventDefault()
          event.stopPropagation()
          updateNoteLevel(nodeId, gridId, -1)
        }
        return
      }

      // Allow outdent when the grid container itself has focus.
      event.preventDefault()
      event.stopPropagation()
      updateNoteLevel(nodeId, gridId, -1)
    }
  }

  const addGridRow = (nodeId, gridId) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid'
                  ? {
                      ...note,
                      rows: note.rows + 1,
                      data: [...note.data, Array(note.cols).fill('')],
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const removeGridRow = (nodeId, gridId) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid' && note.rows > 1
                  ? {
                      ...note,
                      rows: note.rows - 1,
                      data: note.data.slice(0, -1),
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const addGridColumn = (nodeId, gridId) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid'
                  ? {
                      ...note,
                      cols: note.cols + 1,
                      data: note.data.map((row) => [...row, '']),
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const removeGridColumn = (nodeId, gridId) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              notes: (node.notes || []).map((note) =>
                note.id === gridId && note.type === 'grid' && note.cols > 1
                  ? {
                      ...note,
                      cols: note.cols - 1,
                      data: note.data.map((row) => row.slice(0, -1)),
                    }
                  : note
              ),
            }
          : node
      )
    )
  }

  const updateNodeSummary = (nodeId, summary) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? { ...node, summary: summary.trim() }
          : node
      )
    )
  }

  const handleFileUpload = async (nodeId, file) => {
    try {
      setUploadingNodeId(nodeId)
      const uploadedFile = await filesAPI.uploadFile(file, nodeId)
      
      // Add file to nodeFiles state
      setNodeFiles((prev) => ({
        ...prev,
        [nodeId]: [...(prev[nodeId] || []), uploadedFile]
      }))
    } catch (err) {
      console.error('File upload error:', err)
      alert(`Failed to upload file: ${err.message}`)
    } finally {
      setUploadingNodeId(null)
    }
  }

  const handleFileDelete = async (nodeId, fileId) => {
    try {
      await filesAPI.deleteFile(fileId)
      setNodeFiles((prev) => ({
        ...prev,
        [nodeId]: (prev[nodeId] || []).filter((f) => f.id !== fileId)
      }))
    } catch (err) {
      console.error('File delete error:', err)
      alert(`Failed to delete file: ${err.message}`)
    }
  }

  const loadFilesForNode = async (nodeId) => {
    try {
      const files = await filesAPI.getFiles(nodeId)
      setNodeFiles((prev) => ({
        ...prev,
        [nodeId]: files
      }))
    } catch (err) {
      console.error('Failed to load files:', err)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setCanvasSize({ width, height })
      if (!anchorSizeRef.current.width && !anchorSizeRef.current.height) {
        anchorSizeRef.current = { width, height }
      }
    })

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const mapPanel = mapPanelRef.current
    if (!mapPanel) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setViewportSize({ width, height })
    })

    observer.observe(mapPanel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isFullscreenMode) return

    const header = headerRef.current
    if (!header) return

    // Measure immediately so panel offset is correct right after exiting fullscreen.
    setHeaderHeight(header.getBoundingClientRect().height)

    const observer = new ResizeObserver(([entry]) => {
      setHeaderHeight(entry.contentRect.height)
    })

    observer.observe(header)
    return () => observer.disconnect()
  }, [isFullscreenMode])

  // Close tooltips when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.top-right')) {
        setOpenTooltip(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Track window resize for re-centering
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load user and maps from backend if authenticated
  useEffect(() => {
    const loadUserData = async () => {
      // Try to get cached user email first
      const cachedUserEmail = localStorage.getItem('everything_user_email')

      try {
        // Try to verify authentication by loading maps
        // The cookie will be sent automatically with credentials: 'include'
        const mapData = await mapsAPI.getMap()
        if (Array.isArray(mapData.nodes) && mapData.nodes.length > 0) {
          const { nodes: normalizedNodes, changed } = normalizeLoadedNodes(mapData.nodes)
          if (changed) {
            await mapsAPI.saveMap(normalizedNodes)
          }
          const nodesWithHidden = normalizedNodes.map((node) =>
            ('hidden' in node) ? node : { ...node, hidden: false }
          )
          setNodesFromBackend(collapseNodesToRoot(nodesWithHidden))
        }

        // Use cached email or set a temporary user object
        if (cachedUserEmail) {
          setCurrentUser({ email: cachedUserEmail })
        } else {
          setCurrentUser({ authenticated: true })
        }
      } catch (err) {
        // Not authenticated, clear cached email
        localStorage.removeItem('everything_user_email')
        console.log('User session invalid')
      }
    }
    loadUserData()
  }, [])

  useEffect(() => {
    if (!currentUser) return;

    if (skipNextAutoSave.current) {
      skipNextAutoSave.current = false;
      return;
    }

    const saveTimer = setTimeout(async () => {
      try {
        await mapsAPI.saveMap(nodes);
      } catch (err) {
        console.error('Failed to save map:', err);
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [nodes, currentUser]);

  // Load files for selected node
  useEffect(() => {
    if (selectedId && isAuthenticated) {
      loadFilesForNode(selectedId)
    }
  }, [selectedId, isAuthenticated]);

  const bounds = layout.bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  const baseOffsetX = PADDING - bounds.minX
  const baseOffsetY = PADDING - bounds.minY
  const baseWidth = bounds.maxX - bounds.minX + PADDING * 2
  const baseHeight = bounds.maxY - bounds.minY + nodeHeight + PADDING * 2

  const rootNode = nodes.find((node) => node.parentId == null) || nodes[0]
  // If Everything node is selected, reset lastFocusedIdRef to root
  // If Everything node is selected, reset pan and drag offsets to center
  // Only update lastFocusedIdRef synchronously
  if (selectedId !== null) {
    lastFocusedIdRef.current = selectedId;
  }

  // Removed effect that reset pan/drag offsets when root node is selected
  // Always center on root if selectedId is root, even after deep node
  let focusId;
  if (focusedElement !== null) {
    // When navigating with arrow keys, center on the focused node (takes priority)
    focusId = focusedElement.nodeId;
  } else if (selectedId !== null) {
    focusId = selectedId;
  } else if (lastFocusedIdRef.current !== null && lastFocusedIdRef.current === rootNode.id) {
    focusId = rootNode.id;
  } else {
    focusId = lastFocusedIdRef.current ?? rootNode?.id;
  }
  const focusNode = nodes.find((node) => node.id === focusId) || rootNode;
  const focusPos = layout.positions.get(focusNode?.id);
  
  // Use anchor size only when root is the focus (to prevent drift when children added)
  // For deep nodes or when resizing, use actual visible viewport dimensions
  // When root is focused with no selection, use current viewport to allow re-centering on resize
  const isRootFocus = focusNode.id === rootNode.id
  const hasSelection = selectedId !== null
  const rootFocusedNoSelection = isRootFocus && !hasSelection
  
  // Get the actual viewport dimensions - use clientWidth synchronously if available (not relying on ResizeObserver timing)
  // The ResizeObserver might not update synchronously with window resize events
  const mapPanelElement = mapPanelRef.current
  const actualViewportWidth = mapPanelElement?.clientWidth ?? viewportSize.width
  const actualViewportHeight = mapPanelElement?.clientHeight ?? viewportSize.height
  
  const visibleViewportWidth = actualViewportWidth > 0 ? actualViewportWidth : (windowSize.width - 40)
  const effectiveHeaderHeight = isFullscreenMode ? 0 : headerHeight
  const visibleViewportHeight = actualViewportHeight > 0 ? actualViewportHeight : (windowSize.height - effectiveHeaderHeight)
  
  // When a node is selected or root is focused without selection, always use current viewport size
  // This ensures re-centering works immediately on window resize
  const centerWidth = (hasSelection || rootFocusedNoSelection)
    ? visibleViewportWidth
    : (anchorSizeRef.current.width || canvasSize.width)
  const centerHeight = (hasSelection || rootFocusedNoSelection)
    ? visibleViewportHeight
    : (anchorSizeRef.current.height || canvasSize.height)
  
  // Account for fixed side panel taking up visual space on the right
  // The side panel is position: fixed, so it doesn't reduce map-panel width but takes up screen space
  // Calculate approximate side-panel width when open using the same clamp logic as CSS: clamp(200px, 58vw, 700px)
  const sidePanelWidthWhenOpen = panelOpen ? Math.max(200, Math.min(windowSize.width * 0.58, 700)) : 0
  
  // Visual center point accounts for the side-panel pushing the center left
  // The visible map area is from 0 to (centerWidth - sidePanelWidth), so center it there
  const centerX = centerWidth ? (centerWidth - sidePanelWidthWhenOpen) / 2 : baseWidth / 2
  // Center the focused node vertically in the visible area
  const centerY = centerHeight ? centerHeight / 2 : baseHeight / 2
  const focusCenterX = focusPos
    ? focusPos.x + baseOffsetX + nodeWidth / 2
    : baseOffsetX + nodeWidth / 2
  const focusCenterY = focusPos
    ? focusPos.y + baseOffsetY + nodeHeight / 2
    : baseOffsetY + nodeHeight / 2

  // Apply centering shift when:
  // 1. Initially loading (root centered)
  // 2. A node is currently selected
  // 3. Root is focused (to re-center on viewport resize)
  // 4. Arrow keys changed focus (focusedElement changed)
  // When deselecting a non-root node, keep the last applied shift to avoid camera jumps
  const initialLoad = prevSelectedIdRef.current === null && selectedId === null
  const rootIsFocused = selectedId === null && focusNode.id === rootNode.id
  const focusedNodeChanged = JSON.stringify(prevFocusedElementRef.current) !== JSON.stringify(focusedElement) && focusedElement !== null
  let shiftX, shiftY;
  const shouldApplyShift = selectedId !== null || initialLoad || rootIsFocused || forceRecenter || focusedNodeChanged;
  const nextShiftX = centerX - focusCenterX;
  const nextShiftY = centerY - focusCenterY;
  if (shouldApplyShift) {
    lastShiftRef.current = { x: nextShiftX, y: nextShiftY };
    shiftX = nextShiftX;
    shiftY = nextShiftY;
  } else {
    shiftX = lastShiftRef.current.x;
    shiftY = lastShiftRef.current.y;
  }

  if (selectedId !== prevSelectedIdRef.current) {
    prevSelectedIdRef.current = selectedId
  }

  if (JSON.stringify(focusedElement) !== JSON.stringify(prevFocusedElementRef.current)) {
    prevFocusedElementRef.current = focusedElement
  }

  const baseOffsetXCentered = baseOffsetX + shiftX
  const baseOffsetYCentered = baseOffsetY + shiftY

  // Always apply pan/drag offsets so dragging with a selected node does not snap back to recenter
  const safe = (v) => Number.isFinite(v) ? v : 0;
  let offsetX = safe(baseOffsetXCentered) - safe(basePanOffset?.x) - safe(dragOffset?.x);
  let offsetY = safe(baseOffsetYCentered) - safe(basePanOffset?.y) - safe(dragOffset?.y);
  debugLog('Offset calculation:', {
    baseOffsetXCentered,
    baseOffsetYCentered,
    basePanOffset,
    dragOffset,
    offsetX,
    offsetY,
    selectedId,
    focusNode,
    lastShift: lastShiftRef.current
  });

  // Offset reset effect for root node removed to avoid interfering with drag logic

  // (Removed accidental top-level code. All logic is inside App function.)
  // Calculate stable bounds without drag offset
  let finalMinX = 0
  let finalMaxX = 0
  let finalMinY = 0
  let finalMaxY = 0
  layout.positions.forEach((pos) => {
    const left = pos.x + baseOffsetXCentered
    const right = pos.x + baseOffsetXCentered + nodeWidth
    const top = pos.y + baseOffsetYCentered
    const bottom = pos.y + baseOffsetYCentered + nodeHeight
    finalMinX = Math.min(finalMinX, left)
    finalMaxX = Math.max(finalMaxX, right)
    finalMinY = Math.min(finalMinY, top)
    finalMaxY = Math.max(finalMaxY, bottom)
  })
  
  // Add padding only if nodes go negative
  // But when focusing on a child node, don't apply renderOffset - allow ancestors to go off-screen
  const renderOffsetX = (finalMinX < 0 && focusNode.id === rootNode.id) ? -finalMinX + PADDING / 2 : 0
  const renderOffsetY = (finalMinY < 0 && focusNode.id === rootNode.id) ? -finalMinY + PADDING / 2 : 0

  
  // Calculate actual SVG bounds
  const svgWidth = Math.max(finalMaxX + renderOffsetX + PADDING / 2, viewportSize.width || 1000)
  const svgHeight = Math.max(finalMaxY + renderOffsetY + PADDING / 2, viewportSize.height || 800)

  const mapWidth = svgWidth
  const mapHeight = svgHeight

  // For each node, check if its top edge is above the header (search bar)
  // Hide any node whose top is at or above the header
  const nodeScreenY = (node, customOffsetY = offsetY) => {
    const pos = layout.positions.get(node.id);
    if (!pos) return 0;
    return pos.y + customOffsetY + renderOffsetY;
  };

  // Do not clamp vertical pan: allow content to move behind the header region.
  // To prevent pop/re-overlap artifacts while dragging, never fall back to showing hidden nodes.
  // Viewport culling: only render nodes visible in viewport (with buffer for smooth panning)
  // Increase buffer for mobile devices to ensure distant nodes render during drag/pan
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window);
  const VIEWPORT_BUFFER = isMobile ? 2000 : 500; // Larger buffer for mobile
  // Disable viewport culling for mobile devices to render all nodes
  const renderableNodes = nodes.filter((node) => {
    if (node.hidden === true) return false;
    if (isMobile) return true;
    const pos = layout.positions.get(node.id);
    if (!pos) return true;
    const screenX = pos.x + offsetX + renderOffsetX;
    const screenY = pos.y + offsetY + renderOffsetY;
    if (screenY < effectiveHeaderHeight) return false;
    const viewportLeft = -VIEWPORT_BUFFER;
    const viewportRight = windowSize.width + VIEWPORT_BUFFER;
    const viewportTop = effectiveHeaderHeight - VIEWPORT_BUFFER;
    const viewportBottom = windowSize.height + VIEWPORT_BUFFER;
    if (screenX + nodeWidth < viewportLeft) return false;
    if (screenX > viewportRight) return false;
    if (screenY + nodeHeight < viewportTop) return false;
    if (screenY > viewportBottom) return false;
    return true;
  });
  const renderableNodeIds = new Set(renderableNodes.map((node) => node.id));
  const fileDownloadBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '')
  const passwordRuleChecks = useMemo(() => getPasswordRuleChecks(loginForm.password), [loginForm.password])
  const isPasswordCompliant = passwordRuleChecks.every((rule) => rule.met)

  // Separate set for edge rendering: only hide edges for nodes above header, not for horizontal off-screen nodes
  const nodesForEdgeRendering = nodes.filter((node) => {
    // Always exclude explicitly hidden nodes
    if (node.hidden === true) return false;
    
    const pos = layout.positions.get(node.id);
    if (!pos) return true;
    
    // Calculate node position on screen
    const screenY = pos.y + offsetY + renderOffsetY;
    
    // Only exclude nodes whose top edge is at or above the header (vertical culling only)
    if (screenY < effectiveHeaderHeight) return false;
    
    return true;
  });
  const nodeIdsForEdges = new Set(nodesForEdgeRendering.map((node) => node.id));

  // Determine if the root node is above the header (search bar)
  let isRootAboveHeader = false;
  if (rootNode) {
    const rootY = layout.positions.get(rootNode.id)?.y ?? 0;
    const rootScreenY = rootY + offsetY + renderOffsetY;
    isRootAboveHeader = rootScreenY < effectiveHeaderHeight;
  }

  // Auth handlers
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setAuthError('Please fill in both email and password.')
      return
    }

    if (isSignUp && !isPasswordCompliant) {
      setAuthError('Password does not meet all requirements listed below.')
      return
    }

    setAuthError('')

    try {
      // Remove logging of sensitive information
      // console.log(loginForm.email, loginForm.password);
      const response = isSignUp 
        ? await authAPI.register(loginForm.email, loginForm.password)
        : await authAPI.login(loginForm.email, loginForm.password)

      setCurrentUser(response.user)
      localStorage.setItem('everything_user_email', response.user.email)
      setLoginForm({ email: '', password: '' })
      setAuthError('')
      setOpenTooltip(null)
      setIsSignUp(false)

      // Load user's saved map
      try {
        const mapData = await mapsAPI.getMap()
        if (mapData.nodes && mapData.nodes.length > 0) {
          const { nodes: normalizedNodes, changed } = normalizeLoadedNodes(mapData.nodes)
          if (changed) {
            await mapsAPI.saveMap(normalizedNodes)
          }
          // Ensure all nodes have hidden field
          const nodesWithHidden = normalizedNodes.map(node => 
            ('hidden' in node) ? node : { ...node, hidden: false }
          )
          setNodesFromBackend(collapseNodesToRoot(nodesWithHidden))
        }
      } catch (err) {
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed')
    }
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch (err) {
      console.log('Logout error:', err.message)
    }
    setCurrentUser(null)
    localStorage.removeItem('everything_user_email')
    setNodesFromBackend(INITIAL_NODES)
    setOpenTooltip(null)
  }

  useEffect(() => {
    const handleShortcut = async (event) => {
      if (isFullscreenMode && event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setIsFullscreenMode(false)
        setShowFullscreenHint(false)
        return
      }

      if (deleteConfirmation) {
        const modalNavKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape']
        if (!modalNavKeys.includes(event.key)) return

        event.preventDefault()
        event.stopPropagation()

        if (event.key === 'Escape') {
          cancelDelete()
          return
        }

        if (event.key === 'Enter') {
          if (deleteModalChoice === 'delete') {
            confirmDelete()
          } else {
            cancelDelete()
          }
          return
        }

        setDeleteModalChoice((prev) => (prev === 'cancel' ? 'delete' : 'cancel'))
        return
      }

      const isSaveShortcut = (event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')
      if (isSaveShortcut) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // Handle Shift+Enter: add custom child node
      if (event.key === 'Enter' && event.shiftKey && (selectedId !== null || focusedElement !== null)) {
        event.preventDefault()
        const targetNodeId = focusedElement?.nodeId || selectedId
        if (targetNodeId !== null) {
          addCustomChild(targetNodeId)
        }
        return
      }

      // Handle Tab: indent grid if just created, otherwise add custom sibling node
      if (event.key === 'Tab' && (selectedId !== null || focusedElement !== null)) {
        event.preventDefault()
        const targetNodeId = focusedElement?.nodeId || selectedId
        if (targetNodeId !== null) {
          // Check if last created grid is in this node and indent it instead of creating sibling
          if (lastCreatedGridId) {
            const selectedNode = nodes.find((n) => n.id === targetNodeId)
            const lastNote = selectedNode?.notes?.[selectedNode.notes.length - 1]
            if (lastNote?.id === lastCreatedGridId) {
              updateNoteLevel(targetNodeId, lastCreatedGridId, 1)
              setLastCreatedGridId(null)
              return
            }
          }
          addCustomSibling(targetNodeId)
        }
        return
      }

      // Handle Enter key: select the focused node or expand dots
      if (event.key === 'Enter' && focusedElement !== null) {
        event.preventDefault()
        if (focusedElement.type === 'node') {
          setSelectedId(focusedElement.nodeId)
          setPanelOpen(true)
          setPanelExpanded(false)
          setFocusedElement(null)
        } else if (focusedElement.type === 'dots') {
          const result = await addChildren(focusedElement.nodeId)
          if (result?.expanded && result?.firstChildId) {
            // Focus on the first child after expansion
            setFocusedElement({ nodeId: result.firstChildId, type: 'node' })
          } else {
            setFocusedElement(null)
          }
        }
        return
      }

      // Handle Delete key: delete custom node
      if (event.key === 'Delete' && selectedId !== null && isAuthenticated) {
        const selectedNode = nodes.find((n) => n.id === selectedId)
        if (selectedNode && selectedNode.isCustom) {
          event.preventDefault()
          deleteCustomNode(selectedId)
        }
        return
      }

      // Arrow key navigation: focus nodes and dots without selecting them
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (arrowKeys.includes(event.key) && (selectedId !== null || focusedElement !== null)) {
        const isGridInput = event.target.classList && event.target.classList.contains('grid-cell-input')
        const isTextEditable =
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.isContentEditable

        // If we're inside a grid cell input, handle grid navigation instead of node navigation
        if (isGridInput) {
          event.preventDefault()
          
          const currentCell = event.target
          const currentTd = currentCell.parentElement
          const currentTr = currentTd.parentElement
          const currentTbody = currentTr.parentElement
          
          let targetCell = null
          
          if (event.key === 'ArrowUp') {
            const prevRow = currentTr.previousElementSibling
            if (prevRow) {
              const cellIndex = Array.from(currentTr.children).indexOf(currentTd)
              targetCell = prevRow.children[cellIndex]?.querySelector('input')
            }
          } else if (event.key === 'ArrowDown') {
            const nextRow = currentTr.nextElementSibling
            if (nextRow) {
              const cellIndex = Array.from(currentTr.children).indexOf(currentTd)
              targetCell = nextRow.children[cellIndex]?.querySelector('input')
            }
          } else if (event.key === 'ArrowLeft') {
            const prevTd = currentTd.previousElementSibling
            if (prevTd) {
              targetCell = prevTd.querySelector('input')
            }
          } else if (event.key === 'ArrowRight') {
            const nextTd = currentTd.nextElementSibling
            if (nextTd) {
              targetCell = nextTd.querySelector('input')
            }
          }
          
          if (targetCell) {
            targetCell.focus()
            targetCell.select()
          }
          
          return
        }

        // If we're typing in a regular text field (notes, summary, etc.), keep normal caret movement.
        if (isTextEditable) {
          return
        }
        
        event.preventDefault()
        
        // Use focusedElement if set, otherwise use selectedId as the starting point
        let startNodeId, startType
        if (focusedElement !== null) {
          startNodeId = focusedElement.nodeId
          startType = focusedElement.type
        } else {
          startNodeId = selectedId
          startType = 'node'
        }
        
        const currentNode = nodes.find((n) => n.id === startNodeId)
        const currentPos = layout.positions.get(startNodeId)
        
        if (!currentNode || !currentPos) return
        
        // Special handling for Down/Up when navigating to/from dots
        if (event.key === 'ArrowDown') {
          if (startType === 'node' && hasKnownSubdivisions(currentNode.label)) {
            // Move from node to its dots
            setFocusedElement({ nodeId: startNodeId, type: 'dots' })
            return
          } else if (startType === 'dots') {
            // Move from dots to the next node
            startType = 'node' // Continue as if we're on the node for finding next
          }
        } else if (event.key === 'ArrowUp' && startType === 'dots') {
          // Move from dots back up to its node
          setFocusedElement({ nodeId: startNodeId, type: 'node' })
          return
        }
        
        // For Left/Right or normal Up/Down, navigate between nodes
        const siblings = nodes.filter((n) => n.parentId === currentNode.parentId && n.id !== startNodeId)
        
        let nextNode = null
        
        if (event.key === 'ArrowUp') {
          const siblingsAbove = siblings.filter((n) => {
            const pos = layout.positions.get(n.id)
            return pos && pos.y < currentPos.y
          })
          if (siblingsAbove.length > 0) {
            siblingsAbove.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posB.y - posA.y
            })
            nextNode = siblingsAbove[0]
          } else {
            const candidatesAbove = nodes.filter((n) => {
              const pos = layout.positions.get(n.id)
              return pos && pos.y < currentPos.y && n.id !== startNodeId
            })
            candidatesAbove.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posB.y - posA.y
            })
            nextNode = candidatesAbove[0]
          }
        } else if (event.key === 'ArrowDown') {
          const siblingsBelow = siblings.filter((n) => {
            const pos = layout.positions.get(n.id)
            return pos && pos.y > currentPos.y
          })
          if (siblingsBelow.length > 0) {
            siblingsBelow.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posA.y - posB.y
            })
            nextNode = siblingsBelow[0]
          } else {
            const candidatesBelow = nodes.filter((n) => {
              const pos = layout.positions.get(n.id)
              return pos && pos.y > currentPos.y && n.id !== startNodeId
            })
            candidatesBelow.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posA.y - posB.y
            })
            nextNode = candidatesBelow[0]
          }
        } else if (event.key === 'ArrowLeft') {
          const siblingsLeft = siblings.filter((n) => {
            const pos = layout.positions.get(n.id)
            return pos && pos.x < currentPos.x
          })
          if (siblingsLeft.length > 0) {
            siblingsLeft.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posB.x - posA.x
            })
            nextNode = siblingsLeft[0]
          } else {
            const candidatesLeft = nodes.filter((n) => {
              const pos = layout.positions.get(n.id)
              return pos && pos.x < currentPos.x && n.id !== startNodeId
            })
            candidatesLeft.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posB.x - posA.x
            })
            nextNode = candidatesLeft[0]
          }
        } else if (event.key === 'ArrowRight') {
          const siblingsRight = siblings.filter((n) => {
            const pos = layout.positions.get(n.id)
            return pos && pos.x > currentPos.x
          })
          if (siblingsRight.length > 0) {
            siblingsRight.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posA.x - posB.x
            })
            nextNode = siblingsRight[0]
          } else {
            const candidatesRight = nodes.filter((n) => {
              const pos = layout.positions.get(n.id)
              return pos && pos.x > currentPos.x && n.id !== startNodeId
            })
            candidatesRight.sort((a, b) => {
              const posA = layout.positions.get(a.id)
              const posB = layout.positions.get(b.id)
              return posA.x - posB.x
            })
            nextNode = candidatesRight[0]
          }
        }
        
        if (nextNode) {
          setFocusedElement({ nodeId: nextNode.id, type: 'node' })
        }
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [selectedId, focusedElement, nodes, layout.positions, hasKnownSubdivisions, addChildren, addCustomChild, addCustomSibling, deleteCustomNode, isAuthenticated, deleteConfirmation, deleteModalChoice, isFullscreenMode])

  // Close search suggestions when clicking outside the search row
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRowRef.current && !searchRowRef.current.contains(event.target)) {
        setSearchSuggestions([])
        setHighlightedSuggestion(-1)
      }
    }

    if (searchSuggestions.length > 0) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [searchSuggestions.length])

  const generateSearchSuggestions = (query, activeWords = null) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setSearchSuggestions([])
      setRelatedIdeas([])
      return
    }

    const validQueryWords = getValidQueryWords(trimmedQuery, activeWords)
    if (validQueryWords.length === 0) {
      setSearchSuggestions([])
      setHighlightedSuggestion(-1)
      return []
    }
    const lowerQuery = validQueryWords.join(' ')
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matchesQuery = (label) => {
      const lowerLabel = label.toLowerCase()
      if (validQueryWords.length === 1) {
        const word = validQueryWords[0]
        const regex = new RegExp(`\\b${escapeRegex(word)}`, 'i')
        return regex.test(label) || lowerLabel.startsWith(word)
      }
      return validQueryWords.every((word) => {
        const regex = new RegExp(`\\b${escapeRegex(word)}`, 'i')
        return regex.test(label)
      })
    }
    const allTopics = Object.keys(TOPIC_SUBDIVISIONS)
    
    // Get all topics (include both keys and their values)
    const allLabels = new Set(allTopics)
    Object.values(TOPIC_SUBDIVISIONS).forEach((children) => {
      children.forEach((child) => allLabels.add(child))
    })

    // Add custom nodes from current state
    nodes.forEach((node) => {
      if (typeof node.label === 'string' && node.label.trim()) {
        allLabels.add(node.label)
      }
    })

    const labels = Array.from(allLabels).filter((label) => typeof label === 'string')

    const suggestions = labels
      .filter(matchesQuery)
      .sort((a, b) => {
        const lowerA = a.toLowerCase()
        const lowerB = b.toLowerCase()
        
        // Prioritize exact starts with the full query or first word
        const aStartsFull = lowerA.startsWith(lowerQuery)
        const bStartsFull = lowerB.startsWith(lowerQuery)
        if (aStartsFull && !bStartsFull) return -1
        if (!aStartsFull && bStartsFull) return 1
        
        // For multi-word, prioritize labels where words appear in order
        if (validQueryWords.length > 1) {
          const aInOrder = validQueryWords.every((word, i) => {
            const idx = lowerA.indexOf(word)
            if (idx === -1) return false
            if (i === 0) return true
            const prevIdx = lowerA.indexOf(validQueryWords[i - 1])
            return idx > prevIdx
          })
          const bInOrder = validQueryWords.every((word, i) => {
            const idx = lowerB.indexOf(word)
            if (idx === -1) return false
            if (i === 0) return true
            const prevIdx = lowerB.indexOf(validQueryWords[i - 1])
            return idx > prevIdx
          })
          if (aInOrder && !bInOrder) return -1
          if (!aInOrder && bInOrder) return 1
        }
        
        return a.localeCompare(b)
      })
      .slice(0, 8) // Limit to 8 suggestions

    setSearchSuggestions(suggestions)
    // Auto-select the first suggestion
    setHighlightedSuggestion(suggestions.length > 0 ? 0 : -1)
    
    return suggestions
  }

  const extractWordTokens = (value) => {
    if (typeof value !== 'string') return []
    const matches = value.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)
    return matches || []
  }

  const getValidQueryWords = (query, activeWords = null) => {
    if (Array.isArray(activeWords) && activeWords.length > 0) {
      return activeWords
        .filter((word) => typeof word === 'string' && word.trim())
        .map((word) => word.toLowerCase())
    }
    return extractWordTokens(query)
  }

  const isExactWordMatch = (results, token) => {
    if (!Array.isArray(results)) return false
    return results.some((item) => {
      if (!item || typeof item.word !== 'string') return false
      return item.word.toLowerCase() === token
    })
  }

  const isValidWord = async (token) => {
    if (!token) return false
    if (token === 'a' || token === 'i') return true
    if (token.length === 1) return false
    if (datamuseWordValidityCacheRef.current.has(token)) {
      return datamuseWordValidityCacheRef.current.get(token)
    }

    try {
      const response = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(token)}&max=12`)
      const data = await response.json()
      const valid = isExactWordMatch(data, token)
      datamuseWordValidityCacheRef.current.set(token, valid)
      return valid
    } catch (error) {
      // Conservative fallback: suppress suggestions if word validation is unavailable.
      datamuseWordValidityCacheRef.current.set(token, false)
      return false
    }
  }

  const getRealWordTokens = async (query) => {
    const tokens = extractWordTokens(query)
    if (tokens.length === 0) return []

    // If query doesn't end with whitespace, exclude the last token (still being typed)
    const trimmedQuery = query.trim()
    const endsWithSpace = query !== trimmedQuery && query.endsWith(' ')
    const tokensToValidate = endsWithSpace || tokens.length === 1 ? tokens : tokens.slice(0, -1)
    
    if (tokensToValidate.length === 0) return []

    const validity = await Promise.all(tokensToValidate.map((token) => isValidWord(token)))
    return tokensToValidate.filter((_, index) => validity[index])
  }

  const queryContainsOnlyRealWords = async (query) => {
    const realWords = await getRealWordTokens(query)
    return realWords.length > 0
  }

  const fetchDatamuseSuggestions = async (query, realWordTokens = null) => {
    const normalizedQuery = Array.isArray(realWordTokens) && realWordTokens.length > 0
      ? realWordTokens.join(' ')
      : query.trim().toLowerCase()
    if (!normalizedQuery) return []

    if (datamuseSuggestionCacheRef.current.has(normalizedQuery)) {
      return datamuseSuggestionCacheRef.current.get(normalizedQuery)
    }

    try {
      const response = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(normalizedQuery)}&max=8`)
      const data = await response.json()
      const suggestions = Array.isArray(data)
        ? data
            .map((item) => item?.word)
            .filter((word) => typeof word === 'string' && word.trim())
            .filter((word) => isSuggestionActionable(word))
        : []
      datamuseSuggestionCacheRef.current.set(normalizedQuery, suggestions)
      return suggestions
    } catch (error) {
      return []
    }
  }

  const mergeSuggestions = (localSuggestions, apiSuggestions) => {
    const merged = []
    const seen = new Set()

    ;[...(localSuggestions || []), ...(apiSuggestions || [])].forEach((item) => {
      if (typeof item !== 'string') return
      const trimmed = item.trim()
      if (!trimmed) return
      const key = trimmed.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      merged.push(trimmed)
    })

    return merged.slice(0, 8)
  }

  const findNodePath = (label) => {
    const target = String(label || '').trim().toLowerCase()
    if (!target) return null

    const visited = new Set()
    const search = (parentLabel, path) => {
      if (visited.has(parentLabel)) return null
      visited.add(parentLabel)

      if (parentLabel.toLowerCase() === target) {
        return path
      }

      const children = TOPIC_SUBDIVISIONS[parentLabel] || []
      for (const childLabel of children) {
        const result = search(childLabel, [...path, childLabel])
        if (result) return result
      }

      return null
    }

    return search('Everything', ['Everything'])
  }

  const isSuggestionActionable = (label) => {
    if (typeof label !== 'string' || !label.trim()) return false
    const searchTerm = label.trim().toLowerCase()
    const exactNodeExists = nodes.some((node) => typeof node.label === 'string' && node.label.toLowerCase() === searchTerm)
    if (exactNodeExists) return true
    return Boolean(findNodePath(searchTerm))
  }

  const generateRelatedIdeas = (query, currentSuggestions = [], activeWords = null) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setRelatedIdeas([])
      return
    }

    const lowerQuery = trimmedQuery.toLowerCase()
    const queryWords = getValidQueryWords(trimmedQuery, activeWords)
    if (queryWords.length === 0) {
      setRelatedIdeas([])
      return
    }
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matchesQuery = (label) => {
      const lowerLabel = label.toLowerCase()
      if (queryWords.length === 1) {
        const word = queryWords[0]
        const regex = new RegExp(`\\b${escapeRegex(word)}`, 'i')
        return regex.test(label) || lowerLabel.startsWith(word)
      }
      return queryWords.every((word) => {
        const regex = new RegExp(`\\b${escapeRegex(word)}`, 'i')
        return regex.test(label)
      })
    }
    const relatedSet = new Set()

    // Find the query in the taxonomy
    for (const [parent, children] of Object.entries(TOPIC_SUBDIVISIONS)) {
      if (parent.toLowerCase() === lowerQuery) {
        // If query is a parent, suggest its children
        children.forEach((child) => relatedSet.add(child))
        break
      }

      // If query is a child, find its parent and siblings
      if (children.some((child) => child.toLowerCase() === lowerQuery)) {
        // Add all siblings
        children.forEach((child) => {
          if (child.toLowerCase() !== lowerQuery) relatedSet.add(child)
        })
        // Add the parent
        relatedSet.add(parent)
        
        // Check if parent has a parent (grandparent)
        for (const [grandparent, siblingParents] of Object.entries(TOPIC_SUBDIVISIONS)) {
          if (siblingParents.includes(parent)) {
            relatedSet.add(grandparent)
            // Add aunt/uncle nodes
            siblingParents.forEach((sibling) => {
              if (sibling !== parent) relatedSet.add(sibling)
            })
            break
          }
        }
        break
      }
    }

    // Also add any custom nodes with keyword matching or connection
    // Use word boundary matching to avoid matching substrings
    nodes.forEach((node) => {
      if (typeof node.label !== 'string' || !node.label.trim()) return
      const hasOverlap = queryWords.every((keyword) => {
        const regex = new RegExp(`\\b${keyword}`, 'i')
        return regex.test(node.label) || node.label.toLowerCase().startsWith(keyword)
      })
      if (hasOverlap && !relatedSet.has(node.label)) {
        relatedSet.add(node.label)
      }
    })

    // Remove the query itself from related ideas
    for (const idea of Array.from(relatedSet)) {
      if (idea.toLowerCase() === lowerQuery) {
        relatedSet.delete(idea)
      }
    }

    // Convert to array and limit to 6
    let related = Array.from(relatedSet)

    // Fallback: if graph-based related ideas are empty, suggest substring matches
    if (related.length === 0) {
      const allLabels = new Set(Object.keys(TOPIC_SUBDIVISIONS))
      Object.values(TOPIC_SUBDIVISIONS).forEach((children) => {
        children.forEach((child) => allLabels.add(child))
      })

      // For multi-word queries, check if all words are present as whole words
      const matchesAllWords = (label) => {
        if (queryWords.length === 1) {
          // Check for word boundary match or starts with
          const word = queryWords[0]
          const regex = new RegExp(`\\b${word}`, 'i')
          return regex.test(label) || label.toLowerCase().startsWith(word)
        }
        // All query words must be present as whole words
        return queryWords.every(word => {
          const regex = new RegExp(`\\b${word}`, 'i')
          return regex.test(label)
        })
      }

      related = Array.from(allLabels)
        .filter((label) => typeof label === 'string')
        .filter(matchesAllWords)
        .filter((label) => label.toLowerCase() !== lowerQuery)
        .sort((a, b) => a.length - b.length || a.localeCompare(b))
    }

    // Final fallback: if still empty, use semantic keyword matching
    if (related.length === 0) {
      // Check TOPIC_KEYWORDS for semantic matches using word boundaries
      for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        const hasMatch = keywords.some((keyword) => {
          // For multi-word queries, require all words to prevent partial-query matches.
          if (queryWords.length > 1) {
            return queryWords.every(qWord => {
              if (qWord.length <= 5) return keyword === qWord
              if (qWord.length <= 8) return keyword.startsWith(qWord)
              // Use word boundary for longer queries
              const regex = new RegExp(`\\b${qWord}`, 'i')
              return regex.test(keyword) || keyword.startsWith(qWord)
            })
          }
          
          // Single-word query logic
          if (lowerQuery.length <= 5) {
            return keyword === lowerQuery
          }
          if (lowerQuery.length <= 8) {
            return keyword.startsWith(lowerQuery)
          }
          // Use word boundary for longer queries
          const regex = new RegExp(`\\b${lowerQuery}`, 'i')
          return regex.test(keyword) || keyword.startsWith(lowerQuery)
        })
        
        if (hasMatch) {
          related.push(topic)
          if (related.length >= 3) break
        }
      }
    }

    // Filter out topics already in search suggestions
    const suggestionSet = new Set(currentSuggestions.map(s => s.toLowerCase()))
    related = related.filter(idea => !suggestionSet.has(idea.toLowerCase()))

    // Any item that still matches the query belongs in the main matches section.
    const promotedMatches = related.filter((idea) => matchesQuery(idea))
    if (promotedMatches.length > 0) {
      const promotedSuggestions = mergeSuggestions(currentSuggestions, promotedMatches)
      setSearchSuggestions(promotedSuggestions)
      setHighlightedSuggestion(promotedSuggestions.length > 0 ? 0 : -1)
      const promotedSet = new Set(promotedMatches.map((item) => item.toLowerCase()))
      related = related.filter((idea) => !promotedSet.has(idea.toLowerCase()))
    }

    related = related.slice(0, 6)
    setRelatedIdeas(related)
  }

  const handleSearchInputChange = async (e) => {
    const value = e.target.value
    setSearchQuery(value)

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId

    if (searchDebounceTimeoutRef.current) {
      clearTimeout(searchDebounceTimeoutRef.current)
    }

    if (!value.trim()) {
      setHasValidSearchWords(false)
      setSearchSuggestions([])
      setRelatedIdeas([])
      setHighlightedSuggestion(-1)
      return
    }

    // Always show local query matches immediately, even before word validation.
    const localSuggestions = generateSearchSuggestions(value) || []
    setSearchSuggestions(localSuggestions)
    setHighlightedSuggestion(localSuggestions.length > 0 ? 0 : -1)

    // Suggested Topics should only appear after validated real-word input.
    setHasValidSearchWords(false)
    setRelatedIdeas([])

    searchDebounceTimeoutRef.current = setTimeout(async () => {
      const realWordTokens = await getRealWordTokens(value)
      const hasRealWords = realWordTokens.length > 0
      if (requestId !== searchRequestIdRef.current) return

      setHasValidSearchWords(hasRealWords)

      if (!hasRealWords) {
        setRelatedIdeas([])
        // Keep immediate local matches visible while typing incomplete words.
        setHighlightedSuggestion(localSuggestions.length > 0 ? 0 : -1)
        return
      }

      const validatedLocalSuggestions = generateSearchSuggestions(value, realWordTokens) || []

      const apiSuggestions = await fetchDatamuseSuggestions(value, realWordTokens)
      if (requestId !== searchRequestIdRef.current) return

      const suggestions = mergeSuggestions(validatedLocalSuggestions, apiSuggestions)
      setSearchSuggestions(suggestions)
      setHighlightedSuggestion(suggestions.length > 0 ? 0 : -1)
      generateRelatedIdeas(value, suggestions, realWordTokens)
    }, 200)
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion)
    setSearchSuggestions([])
    setRelatedIdeas([])
    setHighlightedSuggestion(-1)
    // Trigger search after a short delay to ensure query is updated
    setTimeout(() => {
      handleSearchWithQuery(suggestion)
    }, 0)
  }

  const handleSearchWithQuery = (query) => {
    if (!query.trim()) return
    const searchTerm = query.toLowerCase()

    // First check if the node exists in the current tree
    let matchingNode = nodes.find((node) =>
      node.label.toLowerCase() === searchTerm
    )

    if (matchingNode) {
      // Node exists, select it
      
      // Unhide the node, all its ancestors, and all siblings along the path
      const unhideNodeAndAncestors = (nodeId) => {
        setNodes((prevNodes) => {
          const nodesToUnhide = new Set()
          
          // Trace up the tree to find all ancestors and their siblings
          let currentId = nodeId
          while (currentId !== null) {
            nodesToUnhide.add(currentId)
            const currentNode = prevNodes.find(n => n.id === currentId)
            const parentId = currentNode?.parentId ?? null
            
            // Add all siblings of the current node
            if (parentId !== null) {
              const siblings = prevNodes.filter(n => n.parentId === parentId)
              siblings.forEach(sibling => nodesToUnhide.add(sibling.id))
            }
            
            currentId = parentId
          }
          
          // Update all nodes to unhide the necessary ones
          return prevNodes.map(node => 
            nodesToUnhide.has(node.id) ? { ...node, hidden: false } : node
          )
        })
      }
      
      unhideNodeAndAncestors(matchingNode.id)
      setSelectedId(matchingNode.id)
      setPanelOpen(true)
      setSearchQuery('')
      setSearchSuggestions([])
      setRelatedIdeas([])
      return
    }

    const path = findNodePath(searchTerm)

    if (!path) {
      setNotification({
        message: 'Node not found.',
        type: 'error'
      })
      return
    }

    // Build all nodes needed to show this search result
    let nodesToAdd = []
    let latestNodeId = Math.max(nextId.current, ...nodes.map(n => n.id)) + 1

    // Expand each level of the path
    for (let i = 1; i < path.length; i++) {
      const parentLabel = path[i - 1]
      const childLabel = path[i]
      
      // Find the parent node in existing nodes
      const parentNode = nodes.find((n) => n.label === parentLabel) || 
                         nodesToAdd.find((n) => n.label === parentLabel)
      
      if (!parentNode) continue

      // Check if this child already exists
      const childExists = nodes.some((n) => n.label === childLabel && n.parentId === parentNode.id) ||
                          nodesToAdd.some((n) => n.label === childLabel && n.parentId === parentNode.id)
      
      if (!childExists) {
        // Get all siblings from the knowledge base
        const siblings = TOPIC_SUBDIVISIONS[parentLabel] || []
        
        // Add siblings if not already added
        for (const siblingLabel of siblings) {
          const alreadyExists = nodes.some((n) => n.label === siblingLabel && n.parentId === parentNode.id) ||
                                nodesToAdd.some((n) => n.label === siblingLabel && n.parentId === parentNode.id)
          
          if (!alreadyExists) {
            nodesToAdd.push({
              id: latestNodeId++,
              label: siblingLabel,
              parentId: parentNode.id,
              hidden: false,
            })
          }
        }
      }
    }

    // Add all new nodes to the tree
    if (nodesToAdd.length > 0) {
      setNodes((prev) => [...prev, ...nodesToAdd])
    }

    // Look up the node ID from our new nodes or existing nodes
    const targetNode = nodesToAdd.find((n) => n.label.toLowerCase() === searchTerm) ||
                       nodes.find((n) => n.label.toLowerCase() === searchTerm)
    
    if (targetNode) {
      // Unhide the target node, all its ancestors, and all siblings along the path
      setTimeout(() => {
        setNodes((prevNodes) => {
          const nodesToUnhide = new Set()
          
          // Trace up the tree to find all ancestors and their siblings
          let currentId = targetNode.id
          while (currentId !== null) {
            nodesToUnhide.add(currentId)
            const currentNode = prevNodes.find(n => n.id === currentId)
            const parentId = currentNode?.parentId ?? null
            
            // Add all siblings of the current node
            if (parentId !== null) {
              const siblings = prevNodes.filter(n => n.parentId === parentId)
              siblings.forEach(sibling => nodesToUnhide.add(sibling.id))
            }
            
            currentId = parentId
          }
          
          // Update all nodes to unhide the necessary ones
          return prevNodes.map(node => 
            nodesToUnhide.has(node.id) ? { ...node, hidden: false } : node
          )
        })
      }, 0)
      
      setSelectedId(targetNode.id)
      setPanelOpen(true)
    }

    setSearchQuery('')
    setSearchSuggestions([])
  }

  // Drag handlers
    const clampPanOffset = (offset) => {
      // Allow wider horizontal panning for large trees while retaining reasonable limits
      const MAX_PAN_X = Math.max(2000, Math.ceil(mapWidth));
      const MAX_PAN_Y = 2000;
      return {
        x: Math.max(-MAX_PAN_X, Math.min(MAX_PAN_X, offset.x)),
        y: Math.max(-MAX_PAN_Y, Math.min(MAX_PAN_Y, offset.y)),
      };
    };

  // Mouse drag handlers
  const handleMapMouseDown = (e) => {
    if (e.button === 0) {
      e.preventDefault()
      didDragRef.current = false
      suppressClickRef.current = false
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      setDragButton(0)
      setDragOffset({ x: 0, y: 0 })
    }
  }
  const handleMapMouseMove = (e) => {
    if (dragStart) {
      const deltaX = dragStart.x - e.clientX
      const deltaY = dragStart.y - e.clientY
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        didDragRef.current = true
      }
      const clampedPreviewPan = clampPanOffset({
        x: basePanOffset.x + deltaX,
        y: basePanOffset.y + deltaY,
      })
      setDragOffset({
        x: clampedPreviewPan.x - basePanOffset.x,
        y: clampedPreviewPan.y - basePanOffset.y,
      })
    }
  }
  const handleMapMouseUp = (e) => {
    if (dragButton === 0 && dragStart) {
      setBasePanOffset((prev) => clampPanOffset({ x: prev.x + dragOffset.x, y: prev.y + dragOffset.y }))
    }
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    setDragStart(null)
    setDragButton(null)
    suppressClickRef.current = didDragRef.current
    didDragRef.current = false
  }
  const handleMapMouseLeave = () => {
    if (dragStart) {
      setBasePanOffset((prev) => clampPanOffset({ x: prev.x + dragOffset.x, y: prev.y + dragOffset.y }))
      setDragOffset({ x: 0, y: 0 })
    }
    setIsDragging(false)
    setDragStart(null)
    setDragButton(null)
    suppressClickRef.current = didDragRef.current
    didDragRef.current = false
  }

  // Touch drag handlers for mobile
  const handleMapTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      e.preventDefault()
      didDragRef.current = false
      suppressClickRef.current = false
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      setDragButton('touch')
      setDragOffset({ x: 0, y: 0 })
    }
  }
  const handleMapTouchMove = (e) => {
    if (dragStart && e.touches && e.touches.length === 1) {
      const deltaX = dragStart.x - e.touches[0].clientX
      const deltaY = dragStart.y - e.touches[0].clientY
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        didDragRef.current = true
      }
      const clampedPreviewPan = clampPanOffset({
        x: basePanOffset.x + deltaX,
        y: basePanOffset.y + deltaY,
      })
      setDragOffset({
        x: clampedPreviewPan.x - basePanOffset.x,
        y: clampedPreviewPan.y - basePanOffset.y,
      })
    }
  }
  const handleMapTouchEnd = (e) => {
    if (dragButton === 'touch' && dragStart) {
      setBasePanOffset((prev) => clampPanOffset({ x: prev.x + dragOffset.x, y: prev.y + dragOffset.y }))
      setRecenterKey((k) => k + 1);
    }
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    setDragStart(null)
    setDragButton(null)
    suppressClickRef.current = didDragRef.current
    didDragRef.current = false
  }
  const handleMapTouchCancel = () => {
    if (dragStart) {
      setBasePanOffset((prev) => clampPanOffset({ x: prev.x + dragOffset.x, y: prev.y + dragOffset.y }))
      setDragOffset({ x: 0, y: 0 })
    }
    setIsDragging(false)
    setDragStart(null)
    setDragButton(null)
    suppressClickRef.current = didDragRef.current
    didDragRef.current = false
  }

  return (
    <div className={`app-shell${isFullscreenMode ? ' fullscreen-mode' : ''}`} style={{ '--header-height': `${effectiveHeaderHeight}px` }}>
      {!isFullscreenMode && (
      <header className="app-header" ref={headerRef}>
        <div className="title-block">
          <div className="title-stack" aria-label="Everything">
            <h1 className="title">
              <span className="cool-e">E</span>verything
            </h1>
            <p className="title-sub title-grid" aria-hidden="true">
              <span className="title-left title-bottom">Knowledge</span>
              <span className="title-right title-bottom">Mapped</span>
            </p>
          </div>
          {/* ...existing code for search bar and create node hint goes here... */}
            {(searchSuggestions.length > 0 || relatedIdeas.length > 0) && (
              <div className="search-suggestions" ref={searchSuggestionsRef}>
                {searchSuggestions.map((suggestion, idx) => (
                  <button
                    key={suggestion}
                    data-suggestion-index={idx}
                    className={
                      "suggestion-item" +
                      (idx === highlightedSuggestion ? " highlighted" : "")
                    }
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setHighlightedSuggestion(idx)}
                    onMouseLeave={() => setHighlightedSuggestion(-1)}
                  >
                    {suggestion}
                  </button>
                ))}
                {hasValidSearchWords && relatedIdeas.length > 0 && (
                  <div className="related-ideas">
                    <div className="related-ideas-title">Suggested Topics</div>
                    {relatedIdeas.map((idea, idx) => {
                      const highlightIdx = searchSuggestions.length + idx;
                      return (
                        <button
                          key={idea}
                          data-suggestion-index={highlightIdx}
                          className={"suggestion-item related-idea-item" + (highlightIdx === highlightedSuggestion ? " highlighted" : "")}
                          type="button"
                          onClick={() => {
                            setSearchQuery(idea);
                            setRelatedIdeas([]);
                            setTimeout(() => {
                              handleSearchWithQuery(idea);
                            }, 0);
                          }}
                          onMouseEnter={() => setHighlightedSuggestion(highlightIdx)}
                          onMouseLeave={() => setHighlightedSuggestion(-1)}
                        >
                          {idea}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </form>
          </div>
        </div>
        <div className="top-left" ref={createModeButtonsRef}>
          <div className="top-button-group">
            <button
              className={`top-link ${createNodeMode === 'child' ? 'active' : ''}`}
              type="button"
              title="Click to enable, then click a node to create a child"
              onClick={() => toggleCreateNodeMode('child')}
            >
              Add Child
            </button>
          </div>
          <div className="top-button-group">
            <button
              className={`top-link ${createNodeMode === 'sibling' ? 'active' : ''}`}
              type="button"
              title="Click to enable, then click a node to create a sibling"
              onClick={() => toggleCreateNodeMode('sibling')}
            >
              Add Sibling
            </button>
          </div>
        </div>
        <div className="top-right">
          <div className="top-button-group">
            <button 
              className="top-link" 
              type="button"
              onClick={() => window.open('/help-diagram.html', '_blank')}
            >
              Help
            </button>
          </div>

          <div className="top-button-group">
            <button 
              className="top-link" 
              type="button"
              onClick={() => setOpenTooltip(openTooltip === 'settings' ? null : 'settings')}
            >
              Settings
            </button>
            {openTooltip === 'settings' && (
              <div className="tooltip settings-tooltip">
                <h3>Settings</h3>
                <label className="setting-item">
                  <input 
                    type="checkbox" 
                    checked={enableAnimations}
                    onChange={(e) => setEnableAnimations(e.target.checked)}
                  />
                  Enable animations
                </label>
                <label className="setting-item">
                  <input 
                    type="checkbox" 
                    checked={smoothPanning}
                    onChange={(e) => setSmoothPanning(e.target.checked)}
                  />
                  Smooth panning
                </label>
                <label className="setting-item">
                  <input 
                    type="checkbox" 
                    checked={autoExpand}
                    onChange={(e) => setAutoExpand(e.target.checked)}
                  />
                  Auto-expand on search
                </label>
                <div className="setting-item setting-item-row" role="group" aria-label="Node size controls">
                  <span>Node size</span>
                  <div className="node-size-controls">
                    <button
                      type="button"
                      className="node-size-button"
                      onClick={() => adjustNodeSize(-NODE_SIZE_STEP)}
                      disabled={nodeSizeScale <= NODE_SIZE_MIN}
                      aria-label="Decrease node size"
                    >
                      -
                    </button>
                    <span className="node-size-value">{nodeSizePercent}%</span>
                    <button
                      type="button"
                      className="node-size-button"
                      onClick={() => adjustNodeSize(NODE_SIZE_STEP)}
                      disabled={nodeSizeScale >= NODE_SIZE_MAX}
                      aria-label="Increase node size"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="node-size-reset"
                      onClick={() => setNodeSizeScale(1)}
                      disabled={Math.abs(nodeSizeScale - 1) < 0.01}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="setting-item setting-item-row" role="group" aria-label="Fullscreen mode controls">
                  <span>Fullscreen mode</span>
                  <button
                    type="button"
                    className="node-size-reset"
                    onClick={toggleFullscreenMode}
                  >
                    {isFullscreenMode ? 'Exit' : 'Enter'}
                  </button>
                </div>

              </div>
              )        
          }
        }
export default App;
                      <div className="storage-section">
                        <div className="storage-header">
                          <span className="storage-label">Storage Usage</span>
                          <span className="storage-amount">{storageUsage.usedGB} / {storageUsage.limitGB} GB</span>
                        </div>
                        <div className="storage-bar">
                          <div 
                            className="storage-bar-fill storage-bar-files" 
                            style={{ width: `${(storageUsage.fileStorage / storageUsage.limit) * 100}%` }}
                            title={`Files: ${storageUsage.fileStorageGB} GB`}
                          />
                          <div 
                            className="storage-bar-fill storage-bar-notes" 
                            style={{ width: `${(storageUsage.mapStorage / storageUsage.limit) * 100}%` }}
                            title={`Notes/Nodes: ${storageUsage.mapStorageGB} GB`}
                          />
                        </div>
                        <div className="storage-legend">
                          <div className="storage-legend-item">
                            <span className="storage-legend-color storage-legend-files"></span>
                            <span className="storage-legend-text">Files ({storageUsage.fileStorageGB} GB)</span>
                          </div>
                          <div className="storage-legend-item">
                            <span className="storage-legend-color storage-legend-notes"></span>
                            <span className="storage-legend-text">Notes ({storageUsage.mapStorageGB} GB)</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <button 
                      className="profile-action profile-action-secondary" 
                      type="button"
                      onClick={() => alert('Storage upgrade coming soon!')}
                    >
                      Upgrade Storage
                    </button>
                    
                    <button 
                      className="profile-action" 
                      type="button"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <h3>{isSignUp ? 'Sign Up' : 'Sign In'}</h3>
                    <div className="auth-form">
                      <input
                        type="email"
                        placeholder="Email"
                        value={loginForm.email}
                        onChange={(e) => {
                          setLoginForm({ ...loginForm, email: e.target.value })
                          if (authError) setAuthError('')
                        }}
                        className="auth-input"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={loginForm.password}
                        onChange={(e) => {
                          setLoginForm({ ...loginForm, password: e.target.value })
                          if (authError) setAuthError('')
                        }}
                        className="auth-input"
                      />
                      {isSignUp && (
                        <div className="auth-password-requirements" aria-live="polite">
                          <p className="auth-password-title">Password requirements:</p>
                          <ul>
                            {passwordRuleChecks.map((rule) => (
                              <li key={rule.id} className={rule.met ? 'met' : 'unmet'}>
                                <span className="requirement-icon" aria-hidden="true">{rule.met ? '✓' : '✗'}</span>
                                <span>{rule.label}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {authError && (
                        <div className="auth-error" role="alert">
                          {authError}
                        </div>
                      )}
                      <button 
                        className="profile-action" 
                        type="button"
                        onClick={handleLogin}
                      >
                        {isSignUp ? 'Create Account' : 'Sign In'}
                      </button>
                      <button 
                        className="profile-action" 
                        type="button"
                        onClick={() => {
                          setIsSignUp(!isSignUp)
                          setAuthError('')
                        }}
                        style={{ background: 'transparent', opacity: 0.7 }}
                      >
                        {isSignUp ? 'Already have account?' : 'Need account?'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
      {showCreateNodeHint && createNodeMode && (
        <div
          className="create-node-hint"
          role="status"
          aria-live="polite"
          style={createNodeHintPosition ? {
            top: `${createNodeHintPosition.top}px`,
            left: `${createNodeHintPosition.left}px`,
          } : undefined}
        >
          {createNodeMode === 'child'
            ? 'Click the node you want to add a child to'
            : 'Click the node you want to add a sibling to'}
        </div>
      )}

      // ...existing code...
      <main className="app-main">
        <section className="map-panel" ref={mapPanelRef}>
          <div
            className="map-canvas"
            style={{ 
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            ref={canvasRef}
            onMouseDown={handleMapMouseDown}
            onMouseMove={handleMapMouseMove}
            onMouseUp={handleMapMouseUp}
            onMouseLeave={handleMapMouseLeave}
            onTouchStart={handleMapTouchStart}
            onTouchMove={handleMapTouchMove}
            onTouchEnd={handleMapTouchEnd}
            onTouchCancel={handleMapTouchCancel}
          >
            <div
              className="map-content"
              style={{ width: mapWidth, height: mapHeight }}
            >
              <svg
                className="map-links"
                width={mapWidth}
                height={mapHeight}
                viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                aria-hidden="true"
              >
                {layout.edges.map((edge) => {
                  // Hide lines when either connected node is hidden or above the header (but not horizontally off-screen)
                  if (!nodeIdsForEdges.has(edge.from) || !nodeIdsForEdges.has(edge.to)) {
                    return null;
                  }
                  // Skip edges involving the hidden root node if root is above header
                  if (isRootAboveHeader && (edge.from === rootNode.id || edge.to === rootNode.id)) {
                    return null;
                  }
                  const from = layout.positions.get(edge.from);
                  const to = layout.positions.get(edge.to);
                  if (!from || !to) return null;
                  const x1 = from.x + offsetX + renderOffsetX + nodeWidth / 2;
                  const y1 = from.y + offsetY + renderOffsetY + nodeHeight;
                  const x2 = to.x + offsetX + renderOffsetX + nodeWidth / 2;
                  const y2 = to.y + offsetY + renderOffsetY;
                  const dy = y2 - y1;
                  const d = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.35}, ${x2} ${y2 - dy * 0.35}, ${x2} ${y2}`;
                  return <path key={`${edge.from}-${edge.to}`} d={d} />;
                })}
              </svg>

              <div
                className="map-nodes"
                style={{ width: mapWidth, height: mapHeight }}
              >
                {renderableNodes.map((node) => {
                  const pos = layout.positions.get(node.id)
                  if (!pos) return null
                  const finalX = pos.x + offsetX + renderOffsetX
                  const finalY = pos.y + offsetY + renderOffsetY
                  const isRoot = node.parentId == null
                  return (
                    <div key={node.id}>
                      <div
                        className={`node-wrap${isRoot ? ' root-node' : ''}${transitionsEnabled ? '' : ' no-transition'}`}
                        style={{
                          left: finalX,
                          top: finalY,
                          width: nodeWidth,
                          height: nodeHeight,
                          transform: animatingIds.has(node.id) ? 'scale(0.8)' : 'scale(1)',
                          opacity: animatingIds.has(node.id) ? 0 : 1,
                          transition: isDragging || !smoothPanning ? 'none' : undefined,
                        }}
                        onMouseDown={(e) => {
                          if (e.button === 0) e.stopPropagation() // Only stop propagation for left-click
                        }}
                      >
                        <button
                          type="button"
                          className="node-card"
                          style={{
                            width: nodeWidth,
                            height: nodeHeight,
                            color: selectedId === node.id && panelOpen ? '#1d6fdc' : 'inherit',
                            backgroundColor: focusedElement?.nodeId === node.id && focusedElement?.type === 'node' ? 'rgba(29, 111, 220, 0.1)' : '#ffffff',
                            outline: focusedElement?.nodeId === node.id && focusedElement?.type === 'node' ? '2px solid #1d6fdc' : 'none',
                          }}
                          onMouseDown={(e) => {
                            if (e.button === 0) e.stopPropagation() // Only stop propagation for left-click
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            
                            // Handle button-based node creation for mobile users
                            if (createNodeMode === 'child') {
                              addCustomChild(node.id)
                              setCreateNodeMode(null)
                              setShowCreateNodeHint(false)
                              return
                            }
                            if (createNodeMode === 'sibling') {
                              addCustomSibling(node.id)
                              setCreateNodeMode(null)
                              setShowCreateNodeHint(false)
                              return
                            }
                            
                            // Allow deselection to always work, but suppress selection after drag
                            const shouldSuppress = suppressClickRef.current && selectedId !== node.id
                            suppressClickRef.current = false
                            if (shouldSuppress) {
                              return
                            }
                            // Toggle selection: if already selected, deselect; otherwise select and open panel
                            if (node.parentId == null) {
                              debugLog('Root node clicked, recentering. Node:', node);
                              setPanelOpen(true)
                              setPanelExpanded(false)
                              setDragStart(null)
                              setDragButton(null)
                              setDragOffset({ x: 0, y: 0 })
                              setBasePanOffset({ x: 0, y: 0 })
                              setRecenterKey((k) => k + 1)
                              setSelectedId(node.id)
                              setFocusedElement(null)
                              prevSelectedIdRef.current = null
                              // ...existing code...
                            } else if (selectedId === node.id) {
                              debugLog('Node deselected:', node);
                              setFocusedElement(null)
                              setSelectedId(null)
                              setPanelOpen(false)
                              setPanelExpanded(false)
                            } else {
                              debugLog('Node selected:', node);
                              setFocusedElement(null)
                              setPanelOpen(true)
                              setPanelExpanded(false)
                              setIsDragging(false)
                              setDragStart(null)
                              setDragButton(null)
                              setDragOffset({ x: 0, y: 0 })
                              setBasePanOffset({ x: 0, y: 0 })
                              setRecenterKey((k) => k + 1)
                              setSelectedId(node.id)
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (node.isCustom && isAuthenticated) {
                              setEditingNodeId(node.id)
                            }
                          }}
                        >
                          {editingNodeId === node.id ? (
                            <input
                              ref={(el) => {
                                editInputRef.current = el
                                if (el) {
                                  el.focus()
                                  el.select()
                                }
                              }}
                              type="text"
                              defaultValue={node.label}
                              style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                fontSize: 'inherit',
                                fontWeight: 'inherit',
                                fontFamily: 'inherit',
                                color: 'inherit',
                                textAlign: 'center',
                                padding: 0,
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  updateNodeLabel(node.id, e.target.value)
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  setEditingNodeId(null)
                                }
                                e.stopPropagation()
                              }}
                              onBlur={(e) => {
                                updateNodeLabel(node.id, e.target.value)
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: getNodeFontSize(node.label) }}>{node.label}</span>
                          )}
                        </button>
                        {(hasKnownSubdivisions(node.label) || nodes.some((n) => n.parentId === node.id && n.isCustom)) ? (
                        <span
                          className="node-dots"
                          role="button"
                          tabIndex={0}
                          style={{
                            backgroundColor: focusedElement?.nodeId === node.id && focusedElement?.type === 'dots' ? 'rgba(29, 111, 220, 0.15)' : undefined,
                            outline: focusedElement?.nodeId === node.id && focusedElement?.type === 'dots' ? '2px solid #1d6fdc' : 'none',
                            borderRadius: focusedElement?.nodeId === node.id && focusedElement?.type === 'dots' ? '8px' : undefined,
                          }}
                          onMouseDown={(event) => {
                            if (event.button === 0) event.stopPropagation() // Only stop propagation for left-click
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            event.preventDefault()
                            addChildren(node.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              addChildren(node.id)
                            }
                          }}
                          aria-label="Add child nodes"
                        >
                          <svg
                            className="dots-icon"
                            width="36"
                            height="12"
                            viewBox="0 0 36 12"
                            aria-hidden="true"
                          >
                            <circle cx="6" cy="6" r="4" />
                            <circle cx="18" cy="6" r="4" />
                            <circle cx="30" cy="6" r="4" />
                          </svg>
                        </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
        {selectedNode && panelOpen ? (
          <aside className={`side-panel${panelExpanded ? ' expanded' : ''}`}>
            <div className="panel-card">
              <div className="panel-header">
                {windowSize.width >= 768 && (
                  <button
                    className="panel-expand"
                    type="button"
                    onClick={() => setPanelExpanded(!panelExpanded)}
                    title={panelExpanded ? 'Collapse panel' : 'Expand panel'}
                  >
                    {panelExpanded ? '→' : '←'}
                  </button>
                )}
                {editingSidebarNodeId === selectedNode.id ? (
                  <input
                    key={`editing-${selectedNode.id}`}
                    ref={(el) => {
                      if (el) {
                        el.focus()
                        el.select()
                      }
                    }}
                    type="text"
                    defaultValue={selectedNode.label}
                    className="panel-title-input"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        updateNodeLabel(selectedNode.id, e.target.value)
                        setEditingSidebarNodeId(null)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditingSidebarNodeId(null)
                      }
                    }}
                    onBlur={(e) => {
                      updateNodeLabel(selectedNode.id, e.target.value)
                      setEditingSidebarNodeId(null)
                    }}
                  />
                ) : (
                  <h2
                    className={selectedNode.isCustom && isAuthenticated ? 'editable' : ''}
                    onClick={(e) => {
                      if (selectedNode.isCustom && isAuthenticated) {
                        e.stopPropagation()
                        setEditingSidebarNodeId(selectedNode.id)
                      }
                    }}
                    title={selectedNode.isCustom && isAuthenticated ? 'Click to edit title' : ''}
                  >
                    {selectedNode.label}
                  </h2>
                )}
                <button
                  className="panel-close"
                  type="button"
                  onClick={() => {
                    setPanelOpen(false)
                    setSelectedId(null)
                    setPanelExpanded(false)
                  }}
                >
                  X
                </button>
              </div>
              {selectedNode.isCustom && isAuthenticated ? (
                <div className="panel-summary-section">
                  {editingSummaryId === selectedNode.id ? (
                    <div>
                      <textarea
                        className="summary-textarea"
                        value={selectedNode.summary || ''}
                        onChange={(e) => updateNodeSummary(selectedNode.id, e.target.value)}
                        placeholder="Add a summary..."
                        rows={3}
                      />
                      <button
                        className="summary-save-button"
                        type="button"
                        onClick={() => setEditingSummaryId(null)}
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <p 
                      className="panel-summary editable"
                      onClick={() => setEditingSummaryId(selectedNode.id)}
                      title="Click to edit summary"
                    >
                      {selectedNode.summary || 'Click to add a summary...'}
                    </p>
                  )}
                </div>
              ) : (
                generateSummary(selectedNode.label) && (
                  <p className="panel-summary">{generateSummary(selectedNode.label)}</p>
                )
              )}
              <div className="panel-notes">
                <div className="panel-notes-header">
                  <p className="panel-label">Notes</p>
                  {isAuthenticated ? (
                    <div className="panel-notes-actions">
                      <button
                        className="note-add-button"
                        type="button"
                        onClick={() => addNoteToNode(selectedNode.id)}
                        aria-label="Add note"
                        title="Add note"
                      >
                        +
                      </button>
                      <button
                        className="grid-add-button"
                        type="button"
                        onClick={() => addGridToNode(selectedNode.id)}
                        aria-label="Add grid"
                        title="Add grid"
                      >
                        ⊞
                      </button>
                    </div>
                  ) : null}
                </div>
                {selectedNode.notes && selectedNode.notes.length > 0 ? (
                  <div className="notes-list">
                    {selectedNode.notes.map((note) => (
                      note.type === 'grid' ? (
                        <div
                          key={note.id}
                          className="grid-item"
                          style={{ marginLeft: `${(Number.isFinite(note.level) ? note.level : 0) * 16}px` }}
                          onKeyDown={(event) => handleGridKeyDown(event, selectedNode.id, note.id, note)}
                          tabIndex={0}
                        >
                          <div className="grid-container">
                            <div className="grid-wrapper">
                              <table className="note-grid">
                                <tbody>
                                  {note.data.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                      {row.map((cell, colIdx) => (
                                        <td key={colIdx}>
                                          <input
                                            type="text"
                                            className="grid-cell-input"
                                            value={cell}
                                            onChange={(event) =>
                                              updateGridCell(selectedNode.id, note.id, rowIdx, colIdx, event.target.value)
                                            }
                                            placeholder=""
                                          />
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {isAuthenticated ? (
                              <div className="grid-controls">
                                <div className="grid-size-controls">
                                  <div className="grid-control-group">
                                    <span className="grid-control-label">Rows:</span>
                                    <button
                                      type="button"
                                      className="grid-control-button"
                                      onClick={() => removeGridRow(selectedNode.id, note.id)}
                                      disabled={note.rows <= 1}
                                      aria-label="Remove row"
                                    >
                                      −
                                    </button>
                                    <span className="grid-size-display">{note.rows}</span>
                                    <button
                                      type="button"
                                      className="grid-control-button"
                                      onClick={() => addGridRow(selectedNode.id, note.id)}
                                      aria-label="Add row"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <div className="grid-control-group">
                                    <span className="grid-control-label">Cols:</span>
                                    <button
                                      type="button"
                                      className="grid-control-button"
                                      onClick={() => removeGridColumn(selectedNode.id, note.id)}
                                      disabled={note.cols <= 1}
                                      aria-label="Remove column"
                                    >
                                      −
                                    </button>
                                    <span className="grid-size-display">{note.cols}</span>
                                    <button
                                      type="button"
                                      className="grid-control-button"
                                      onClick={() => addGridColumn(selectedNode.id, note.id)}
                                      aria-label="Add column"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="grid-delete-button"
                                  onClick={() => removeNoteFromNode(selectedNode.id, note.id)}
                                  aria-label="Delete grid"
                                  title="Delete grid"
                                >
                                  ×
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div
                          key={note.id}
                          className="note-item"
                          style={{ marginLeft: `${(Number.isFinite(note.level) ? note.level : 0) * 16}px` }}
                        >
                          <span className="note-bullet" aria-hidden="true">•</span>
                          <input
                            ref={(element) => {
                              if (element) {
                                noteInputRefs.current[note.id] = element
                              } else {
                                delete noteInputRefs.current[note.id]
                              }
                            }}
                            className="note-input personal-note"
                            value={note.text}
                            onChange={(event) =>
                              updateNoteText(selectedNode.id, note.id, event.target.value)
                            }
                            onKeyDown={(event) => handleNoteKeyDown(event, selectedNode.id, note)}
                            placeholder="Add a bullet point..."
                          />
                          {isAuthenticated ? (
                            <button
                              type="button"
                              className="note-delete-button"
                              onClick={() => removeNoteFromNode(selectedNode.id, note.id)}
                              aria-label="Delete note"
                              title="Delete note"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <p className="note-empty">
                    {isAuthenticated ? 'No notes yet.' : 'Sign in to add personal notes.'}
                  </p>
                )}
              </div>
              <div className="panel-files">
                <div className="panel-files-header">
                  <p className="panel-label">Files & Documents</p>
                  {isAuthenticated ? (
                    <label
                      className="file-upload-button"
                      title="Upload a file"
                      aria-label="Upload a file"
                    >
                      <input
                        type="file"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(selectedNode.id, file)
                            e.target.value = ''
                          }
                        }}
                        disabled={uploadingNodeId === selectedNode.id}
                      />
                      <svg
                        className="file-upload-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.82l8.49-8.48"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </label>
                  ) : null}
                </div>
                {nodeFiles[selectedNode.id] && nodeFiles[selectedNode.id].length > 0 ? (
                  <div className="files-list">
                    {nodeFiles[selectedNode.id].map((file) => (
                      <div key={file.id} className="file-item">
                        <a
                          href={`${fileDownloadBaseUrl}${file.downloadUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="file-link"
                          title={file.originalFilename}
                        >
                          📄 {file.originalFilename}
                        </a>
                        <button
                          className="file-delete-btn"
                          onClick={() => handleFileDelete(selectedNode.id, file.id)}
                          type="button"
                          title="Delete file"
                          aria-label="Delete file"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="file-empty">
                    {isAuthenticated ? 'No files yet.' : 'Sign in to add files.'}
                  </p>
                )}
              </div>
              {selectedNode.isCustom && isAuthenticated ? (
                <div className="panel-delete-section">
                  <button
                    className="delete-node-button"
                    type="button"
                    onClick={() => deleteCustomNode(selectedNode.id)}
                    title="Delete this custom node"
                  >
                    Delete node
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={cancelDelete}>✕</button>
            </div>
            <div className="modal-body">
              <p>{deleteConfirmation.message}</p>
            </div>
            <div className="modal-footer">
              <button
                ref={deleteCancelButtonRef}
                className="modal-button modal-button-cancel"
                onMouseEnter={() => setDeleteModalChoice('cancel')}
                onFocus={() => setDeleteModalChoice('cancel')}
                style={{ outline: deleteModalChoice === 'cancel' ? '2px solid #1d6fdc' : 'none' }}
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                ref={deleteConfirmButtonRef}
                className="modal-button modal-button-delete"
                onMouseEnter={() => setDeleteModalChoice('delete')}
                onFocus={() => setDeleteModalChoice('delete')}
                style={{ outline: deleteModalChoice === 'delete' ? '2px solid #1d6fdc' : 'none' }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

export default App;
