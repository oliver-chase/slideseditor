import type { SlideComponent } from './types'
import type { NodeBuildContext, NodeSelection, RenderSnapshot } from './html-import-shared'
import { parseRuleDeclarations } from './html-import-css'
import { measureNodeRect, readComputedStyleSafe } from './html-import-render'
import { extractStyle } from './html-import-values'
import { asCanonicalDimension, asCanonicalDimensionOptional, parseAttrPx, parseStylePx, resolveNodePosition } from './html-import-position'
import { buildSanitizedContentNode, collectNestedTextLeaves, getNodeLabel, inferType, resolveSvgImageFallback } from './html-import-markup'

// In absolute mode, split text nested inside a positioned container into its own
// text-box layers, each with its own font, size and color, so the container does not become one
// uniform text blob. The container is then imported as a background or shape layer with the
// extracted text removed.
export function planNestedTextSplit(
  selection: NodeSelection,
  allNodes: HTMLElement[],
  renderSnapshot: RenderSnapshot,
  root: HTMLElement,
  warnings: string[],
): { nodesForBuild: HTMLElement[]; strippedIdsByContainer: Map<string, Set<string>> } {
  const { absoluteNodes, nodes } = selection
  const strippedIdsByContainer = new Map<string, Set<string>>()
  let nodesForBuild = nodes
  const absoluteIdSet = new Set(absoluteNodes.map((entry) => entry.getAttribute('data-import-node-id') || ''))
  const extraNodes: HTMLElement[] = []
  const seenExtra = new Set<string>()
  for (const container of absoluteNodes) {
    const containerId = container.getAttribute('data-import-node-id') || ''
    const leaves = collectNestedTextLeaves(container, absoluteIdSet, renderSnapshot, root)
    const stripSet = new Set<string>()
    for (const leaf of leaves) {
      const leafId = leaf.getAttribute('data-import-node-id') || ''
      if (!leafId || seenExtra.has(leafId)) continue
      seenExtra.add(leafId)
      stripSet.add(leafId)
      extraNodes.push(leaf)
    }
    // Strip nested positioned descendants: each becomes its own component, so
    // leaving it inside this container's content would render its text twice.
    for (const descendant of Array.from(container.querySelectorAll<HTMLElement>('[data-import-node-id]'))) {
      const descId = descendant.getAttribute('data-import-node-id') || ''
      if (descId && descId !== containerId && absoluteIdSet.has(descId)) stripSet.add(descId)
    }
    if (stripSet.size > 0) strippedIdsByContainer.set(containerId, stripSet)
  }
  if (extraNodes.length > 0) {
    const orderIndex = new Map(allNodes.map((entry, i) => [entry, i] as const))
    nodesForBuild = [...absoluteNodes, ...extraNodes].sort(
      (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
    )
    warnings.push(
      'Split ' + extraNodes.length + ' nested text element' + (extraNodes.length === 1 ? '' : 's') + ' into separate editable text layers.',
    )
  }
  return { nodesForBuild, strippedIdsByContainer }
}

// Turn one imported node into its component, preceded by any pseudo-element layers it hosts.
export function buildNodeComponents(node: HTMLElement, index: number, ctx: NodeBuildContext): SlideComponent[] {
  const { renderSnapshot, root, canvas, importMode, warnings } = ctx
  const styleMap = parseRuleDeclarations(node.getAttribute('style') || '')
  const nodeLabel = getNodeLabel(node)
  const nodeId = node.getAttribute('data-import-node-id') || ''
  const renderNode = renderSnapshot.nodesById.get(nodeId) || node
  const renderRoot = renderSnapshot.root || root
  const computedStyle = readComputedStyleSafe(renderNode)
  const measured = measureNodeRect(renderNode, renderRoot)
  const sanitizedNode = buildSanitizedContentNode(renderNode)
  const stripSet = ctx.strippedIdsByContainer.get(nodeId)
  if (stripSet) {
    for (const stripId of stripSet) {
      sanitizedNode.querySelectorAll('[data-import-node-id="' + stripId + '"]').forEach((el) => el.remove())
    }
  }
  const isSvg = node.tagName.toLowerCase() === 'svg'
  const content = isSvg
    ? resolveSvgImageFallback(sanitizedNode, nodeLabel, warnings)
    : stripSet
      ? sanitizedNode.innerHTML.trim()
      : (sanitizedNode.innerHTML.trim() || sanitizedNode.outerHTML.trim())

  const position = resolveNodePosition(renderNode, renderRoot, styleMap, computedStyle, measured, canvas, nodeLabel, warnings)
  const baseWidth = measured.width
    ?? parseStylePx(styleMap, 'width', nodeLabel, warnings)
    ?? parseAttrPx(node.getAttribute('width'), 'width', nodeLabel, warnings)
    ?? 320
  const baseHeight = measured.height
    ?? parseStylePx(styleMap, 'height', nodeLabel, warnings)
    ?? parseAttrPx(node.getAttribute('height'), 'height', nodeLabel, warnings)

  const extractedStyle = extractStyle(styleMap, computedStyle, warnings, nodeLabel)
  const fallbackLocked = importMode === 'fallback' || importMode === 'root-fallback'
  const components: SlideComponent[] = []
  // A ::before layer is drawn below its host and an ::after layer above it.
  const pseudoForHost = (ctx.pseudoByHost.get(nodeId) || []).map((entry, pseudoIndex) => ({
    ...entry,
    id: `import-${String(index + 1).padStart(3, '0')}-${pseudoIndex + 1}-${entry.sourceLabel?.replace(/[^a-z0-9-]/gi, '-') || 'pseudo'}`,
  }))
  const isAfter = (entry: SlideComponent) => (entry.sourceLabel || '').includes('::after')
  components.push(...pseudoForHost.filter((entry) => !isAfter(entry)))
  components.push({
    id: 'import-' + String(index + 1).padStart(3, '0'),
    type: inferType(node),
    sourceLabel: fallbackLocked ? `${nodeLabel} (fallback)` : nodeLabel,
    x: asCanonicalDimension(position.x),
    y: asCanonicalDimension(position.y),
    width: asCanonicalDimension(baseWidth),
    height: asCanonicalDimensionOptional(baseHeight),
    content,
    style: extractedStyle,
    locked: fallbackLocked,
    visible: true,
  })
  components.push(...pseudoForHost.filter(isAfter))
  return components
}
