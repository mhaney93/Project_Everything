import { useEffect, useMemo, useRef, useState } from 'react';
import TOPIC_SUBDIVISIONS from './TOPIC_SUBDIVISIONS';

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
        const regex = new RegExp(`\b${query.toLowerCase()}`, 'i')
        return regex.test(cat) || cat.toLowerCase().startsWith(query.toLowerCase())
      })
  } catch (error) {
    console.error('Failed to fetch Wikipedia suggestions:', error)
    return []
  }
}

function App() {
  // ...existing code...
  return (
    <>
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
              <form className="search-bar" onSubmit={e => { e.preventDefault(); handleSearchWithQuery(searchQuery); }}>
                {/* ...search input and handlers here... */}
                {/* Suggestions dropdown */}
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
                      />
                    ))}
                  </div>
                )}
              </form>
            </div>
          </header>
        )}
        {/* ...rest of JSX... */}
      </div>
    </>
  );
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

const handleShortcut = async (event) => {
  // ...existing shortcut logic...
};
useEffect(() => {
  window.addEventListener('keydown', handleShortcut);
  return () => {
    window.removeEventListener('keydown', handleShortcut);
  };
}, [
  selectedId,
  focusedElement,
  nodes,
  layout.positions,
  hasKnownSubdivisions,
  addChildren,
  addCustomChild,
  addCustomSibling,
  deleteCustomNode,
  isAuthenticated,
  deleteConfirmation,
  deleteModalChoice,
  isFullscreenMode
]);
  useEffect(() => {
    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [
    selectedId,
    focusedElement,
    nodes,
    layout.positions,
    hasKnownSubdivisions,
    addChildren,
    addCustomChild,
    addCustomSibling,
    deleteCustomNode,
    isAuthenticated,
    deleteConfirmation,
    deleteModalChoice,
    isFullscreenMode
  ]);
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
    <>
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
              <form className="search-bar" onSubmit={e => { e.preventDefault(); handleSearchWithQuery(searchQuery); }}>
                {/* ...search input and handlers here... */}
                {/* Suggestions dropdown */}
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </form> {/* Close search form */}
            </div> {/* Close title-block */}
          </header>
        )}
      {/* Close conditional header block here */}
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
            )}
          </div>
        </div>
    {/* Main map and panels */}
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
                // ...existing code for rendering edges...
              })}
            </svg>
            {/* ...existing code for rendering nodes, panels, modals, etc... */}
          </div>
        </div>
      </section>
      {/* ...side panel, modals, etc... */}
    </main>
  </div>
  </>
  );
}

export default App;