// Strip the hidden disambiguation suffix (e.g. 'Flavor|food' -> 'Flavor')
export const stripLabelSuffix = (label) => {
  const pipeIdx = label.indexOf('|')
  return pipeIdx === -1 ? label : label.slice(0, pipeIdx)
}

// Renames a node, keeping the summary of its old label and marking it custom.
// A built-in node renamed is excluded from its parent's built-in children, as
// deleting it would, so it is not stored again beside the renamed one.
export const renameNode = (nodes, nodeId, newLabel, builtInSummary) => {
  const node = nodes.find((n) => n.id === nodeId)
  const excludeFrom = node && !node.isCustom && node.label !== newLabel ? node.parentId : null
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, label: newLabel, summary: n.summary || builtInSummary(n.label) || undefined, isCustom: true }
    if (excludeFrom != null && n.id === excludeFrom && !(n.excludedChildLabels || []).includes(node.label)) {
      return { ...n, excludedChildLabels: [...(n.excludedChildLabels || []), node.label] }
    }
    return n
  })
}
