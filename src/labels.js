// Strip the hidden disambiguation suffix (e.g. 'Flavor|food' -> 'Flavor')
export const stripLabelSuffix = (label) => {
  const pipeIdx = label.indexOf('|')
  return pipeIdx === -1 ? label : label.slice(0, pipeIdx)
}
