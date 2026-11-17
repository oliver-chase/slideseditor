import { createSlideDocument } from './document'
import type { SlideCanvas, SlideComponent, SlideImportResult } from './types'
import { CANVAS_AUTO_SCALE_RATIO_THRESHOLD, DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, IMPORT_ROOT_MARKER_ATTR, IMPORT_ROOT_MARKER_VALUE, IMPORT_ROOT_NODE_ID } from './html-import-shared'
import type { ContentBounds, DeclaredCanvas, InlinedStyleChunk, NodeBuildContext, NodeSelection, RenderSnapshot } from './html-import-shared'
import { inlineExternalStylesheets, parseRuleDeclarations } from './html-import-css'
import { buildRenderSnapshot, measureNodeRect, normalizeImportedHtmlMarkup, readComputedStyleSafe } from './html-import-render'
import { extractStyle, normalizeBackgroundFill, parseLength, resolveComputedBackground } from './html-import-values'
import { canonicalCanvasValue, clampAutoImportCanvasAxis, measureContentBounds, normalizeCanvasToContentBounds, parseCanvasPx } from './html-import-position'
import { buildSanitizedContentNode, getCanvasRoot, sanitizeMarkup, getNodeLabel, shouldImportFlowNode, shouldImportNode } from './html-import-markup'
import { extractPseudoLayers } from './html-import-pseudo'
import { buildRasterizedSlide, rasterizeSvgComponents } from './html-import-raster'
import { buildNodeComponents, planNestedTextSplit } from './html-import-nodes'

function finishImport(canvas: SlideCanvas, components: SlideComponent[], warnings: string[]): SlideImportResult {
  const uniqueWarnings = Array.from(new Set(warnings))
  return {
    document: createSlideDocument({ canvas, components, warnings: uniqueWarnings }),
    canvas,
    components,
    warnings: uniqueWarnings,
  }
}

// One locked layer that stands in for the whole slide when the full import cannot run.
// `root` is null only on the emergency path, where the slide could not even be parsed.
function buildFallbackImportResult(
  root: HTMLElement | null,
  html: string | null,
  reason: string,
  warnings: string[],
): SlideImportResult {
  const emergency = html !== null
  const rootStyle = root ? parseRuleDeclarations(root.getAttribute('style') || '') : {}
  const attrWidth = !emergency && root ? root.getAttribute('width') ?? undefined : undefined
  const attrHeight = !emergency && root ? root.getAttribute('height') ?? undefined : undefined
  const canvas = {
    width: parseCanvasPx(rootStyle.width ?? attrWidth, 'width', warnings) || DEFAULT_CANVAS_WIDTH,
    height: parseCanvasPx(rootStyle.height ?? attrHeight, 'height', warnings) || DEFAULT_CANVAS_HEIGHT,
  }
  const sanitizedRoot = root ? buildSanitizedContentNode(root) : null
  const content = sanitizedRoot?.innerHTML.trim() || sanitizedRoot?.outerHTML.trim() || (html ? sanitizeMarkup(html.trim()) : '')
  const label = root ? getNodeLabel(root) : 'html-root'
  const components: SlideComponent[] = [{
    id: 'import-001',
    type: 'panel',
    sourceLabel: `${label} (fallback)`,
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    content,
    style: extractStyle(rootStyle, root ? readComputedStyleSafe(root) : null, warnings, emergency ? 'fallback-root' : label),
    locked: true,
    visible: true,
  }]
  warnings.push(
    emergency
      ? `Import parser fallback engaged (${reason}); loaded simplified locked layer.`
      : `High-fidelity import mode failed (${reason}); loaded simplified fallback layer.`,
  )
  return finishImport(canvas, components, warnings)
}

function warnAboutUnsupportedContent(root: HTMLElement, styleSourceText: string, warnings: string[]): void {
  if (styleSourceText.includes('@keyframes') || /\banimation\s*:/.test(styleSourceText)) {
    warnings.push('Detected CSS animations; animation effects are not imported and static styles are used.')
  }
  if (root.querySelector('canvas')) {
    warnings.push('Detected canvas elements; canvas pixel content is not extracted into editable layers.')
  }
  if (root.querySelector('video')) {
    warnings.push('Detected video elements; video playback layers are not imported as editable slide components.')
  }
}

function readDeclaredCanvas(root: HTMLElement, renderSnapshot: RenderSnapshot, warnings: string[]): DeclaredCanvas {
  const rootStyle = parseRuleDeclarations(root.getAttribute('style') || '')
  const measuredRootRect = renderSnapshot.root ? measureNodeRect(renderSnapshot.root, renderSnapshot.root) : {}
  const explicitWidth = parseCanvasPx(rootStyle.width ?? root.getAttribute('width') ?? undefined, 'width', warnings)
  const explicitHeight = parseCanvasPx(rootStyle.height ?? root.getAttribute('height') ?? undefined, 'height', warnings)
  const computedRootStyle = readComputedStyleSafe(renderSnapshot.root || root)
  return {
    explicitWidth,
    explicitHeight,
    computedWidth: parseLength(computedRootStyle?.width || '')?.value,
    computedHeight: parseLength(computedRootStyle?.height || '')?.value,
    measuredRootRect,
    rootStyle,
    computedRootStyle,
  }
}

function resolveCanvasBackground(
  doc: Document,
  renderSnapshot: RenderSnapshot,
  declared: DeclaredCanvas,
): string | undefined {
  const sourceBodyStyle = doc.body ? parseRuleDeclarations(doc.body.getAttribute('style') || '') : {}
  const sourceHtmlStyle = doc.documentElement ? parseRuleDeclarations(doc.documentElement.getAttribute('style') || '') : {}
  const renderBody = renderSnapshot.root?.ownerDocument?.body
  const renderHtml = renderSnapshot.root?.ownerDocument?.documentElement
  const computedBodyStyle = renderBody ? readComputedStyleSafe(renderBody) : null
  const computedHtmlStyle = renderHtml ? readComputedStyleSafe(renderHtml) : null
  const rootBackground = resolveComputedBackground(declared.computedRootStyle, declared.rootStyle)
  const bodyBackground = resolveComputedBackground(computedBodyStyle, sourceBodyStyle)
  const htmlBackground = resolveComputedBackground(computedHtmlStyle, sourceHtmlStyle)
  return normalizeBackgroundFill(
    rootBackground.backgroundFill ||
    rootBackground.backgroundColor ||
    bodyBackground.backgroundFill ||
    bodyBackground.backgroundColor ||
    htmlBackground.backgroundFill ||
    htmlBackground.backgroundColor,
  )
}

// Prefer absolutely positioned elements, then flow-layout elements, then top-level children, then the root.
function selectImportNodes(allNodes: HTMLElement[], renderSnapshot: RenderSnapshot, root: HTMLElement): NodeSelection {
  const renderRoot = renderSnapshot.root || root
  const renderNodeOf = (node: HTMLElement) => renderSnapshot.nodesById.get(node.getAttribute('data-import-node-id') || '') || node
  const absoluteNodes = allNodes.filter((node) => shouldImportNode(node, readComputedStyleSafe(renderNodeOf(node))))
  const fallbackNodes = Array.from(root.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
  if (absoluteNodes.length > 0) return { absoluteNodes, flowNodes: [], nodes: absoluteNodes, importMode: 'absolute' }
  const flowCandidates = allNodes.filter((node) => {
    const renderNode = renderNodeOf(node)
    return shouldImportFlowNode(node, readComputedStyleSafe(renderNode), measureNodeRect(renderNode, renderRoot))
  })
  // Each layer holds its whole content, so an element inside another imported element would repeat its text.
  const flowNodes = flowCandidates.filter((node) => !flowCandidates.some((other) => other !== node && other.contains(node)))
  if (flowNodes.length > 0) return { absoluteNodes, flowNodes, nodes: flowNodes, importMode: 'flow' }
  if (fallbackNodes.length > 0) return { absoluteNodes, flowNodes, nodes: fallbackNodes, importMode: 'fallback' }
  return { absoluteNodes, flowNodes, nodes: [root], importMode: 'root-fallback' }
}

function resolveSourceCanvasSize(
  declared: DeclaredCanvas,
  contentBounds: ContentBounds,
  warnings: string[],
): { width: number; height: number } {
  const hasDeclaredWidth = declared.explicitWidth !== undefined || typeof declared.computedWidth === 'number'
  const hasDeclaredHeight = declared.explicitHeight !== undefined || typeof declared.computedHeight === 'number'

  let width = declared.explicitWidth
    ?? (typeof declared.computedWidth === 'number' ? canonicalCanvasValue(declared.computedWidth, DEFAULT_CANVAS_WIDTH, warnings, 'width', 'computed style') : undefined)
    ?? canonicalCanvasValue(declared.measuredRootRect.width, DEFAULT_CANVAS_WIDTH, warnings, 'width', 'measured root')
  let height = declared.explicitHeight
    ?? (typeof declared.computedHeight === 'number' ? canonicalCanvasValue(declared.computedHeight, DEFAULT_CANVAS_HEIGHT, warnings, 'height', 'computed style') : undefined)
    ?? canonicalCanvasValue(declared.measuredRootRect.height, DEFAULT_CANVAS_HEIGHT, warnings, 'height', 'measured root')

  width = clampAutoImportCanvasAxis(width, 'width', warnings)
  height = clampAutoImportCanvasAxis(height, 'height', warnings)

  if (!hasDeclaredWidth && contentBounds.width && width > contentBounds.width * CANVAS_AUTO_SCALE_RATIO_THRESHOLD) {
    width = Math.max(contentBounds.width, DEFAULT_CANVAS_WIDTH)
    warnings.push(
      'Detected oversized root width during import; normalized canvas width using layer bounds to avoid compressed output.',
    )
  }
  if (!hasDeclaredHeight && contentBounds.height && height > contentBounds.height * CANVAS_AUTO_SCALE_RATIO_THRESHOLD) {
    height = Math.max(contentBounds.height, DEFAULT_CANVAS_HEIGHT)
    warnings.push(
      'Detected oversized root height during import; normalized canvas height using layer bounds to avoid compressed output.',
    )
  }
  return { width, height }
}

function warnAboutImportMode(selection: NodeSelection, size: { width: number; height: number }, warnings: string[]): void {
  const { absoluteNodes, flowNodes, nodes, importMode } = selection
  if (absoluteNodes.length === 0) {
    if (flowNodes.length > 0) {
      warnings.push('No absolutely positioned elements found; imported flow-layout nodes using computed bounds.')
    } else {
      warnings.push('No absolutely positioned elements found; imported top-level nodes as fallback.')
    }
  }
  if (size.width !== DEFAULT_CANVAS_WIDTH || size.height !== DEFAULT_CANVAS_HEIGHT) {
    warnings.push(
      'Detected source canvas ' + size.width + 'x' + size.height + ' (canonical coordinates preserved).',
    )
  }
  if (importMode === 'fallback' && nodes.length > 0) {
    warnings.push(`Imported ${nodes.length} fallback node${nodes.length === 1 ? '' : 's'} as locked layers for visual fidelity.`)
  }
  if (importMode === 'root-fallback') {
    warnings.push('No importable child layers were detected; imported the slide root as a locked fallback layer.')
  }
}

export async function convertHtmlToSlideComponents(html: string): Promise<SlideImportResult> {
  const warnings: string[] = []

  let doc: Document
  let root: HTMLElement | null = null
  try {
    const normalizedHtml = normalizeImportedHtmlMarkup(html, warnings)
    doc = new DOMParser().parseFromString(normalizedHtml, 'text/html')
    root = getCanvasRoot(doc)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'normalize_or_parse_failed')
    return buildEmergencyFallback(html, message, warnings)
  }
  if (!root) return buildEmergencyFallback(html, 'slide_root_not_detected', warnings)

  root.setAttribute(IMPORT_ROOT_MARKER_ATTR, IMPORT_ROOT_MARKER_VALUE)
  root.setAttribute('data-import-node-id', IMPORT_ROOT_NODE_ID)
  const allNodes = Array.from(root.querySelectorAll<HTMLElement>('*'))
  for (let index = 0; index < allNodes.length; index += 1) {
    allNodes[index].setAttribute('data-import-node-id', `import-node-${index + 1}`)
  }

  let inlinedStyleChunks: InlinedStyleChunk[] = []
  try {
    inlinedStyleChunks = await inlineExternalStylesheets(doc, warnings)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'stylesheet_inline_failed')
    warnings.push(`Stylesheet inlining failed (${message}); continuing with available styles.`)
  }
  const styleSources = inlinedStyleChunks.map(({ cssText }) => cssText).join('\n')
  warnAboutUnsupportedContent(root, styleSources.toLowerCase(), warnings)

  let renderSnapshot: RenderSnapshot
  try {
    renderSnapshot = await buildRenderSnapshot(doc, root, inlinedStyleChunks)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'render_snapshot_failed')
    return buildFallbackImportResult(root, null, message, warnings)
  }

  try {
    const declared = readDeclaredCanvas(root, renderSnapshot, warnings)
    const canvasBackground = resolveCanvasBackground(doc, renderSnapshot, declared)
    const selection = selectImportNodes(allNodes, renderSnapshot, root)
    const contentBounds = measureContentBounds(selection.nodes, renderSnapshot, root)
    const size = resolveSourceCanvasSize(declared, contentBounds, warnings)
    warnAboutImportMode(selection, size, warnings)

    // For visually-rich designed graphics (gradients, gradient text, stacked cards),
    // flatten non-text visuals into one artwork picture + gradient-text images +
    // editable text boxes, because native shapes and text overlap and break on those slides.
    // Returns null for simple text-on-solid slides, which use the native path.
    const rasterComponents = await buildRasterizedSlide(renderSnapshot, root, size.width, size.height, warnings)
    const components: SlideComponent[] = rasterComponents ? rasterComponents.slice() : []

    let nodesForBuild: HTMLElement[] = []
    let strippedIdsByContainer = new Map<string, Set<string>>()
    if (!rasterComponents) {
      nodesForBuild = selection.nodes
      if (selection.importMode === 'absolute') {
        ;({ nodesForBuild, strippedIdsByContainer } = planNestedTextSplit(selection, allNodes, renderSnapshot, root, warnings))
      }
    }

    // Pseudo-element layers matter only on the native path, where they are emitted with their host. The
    // rasterized artwork already draws them.
    const pseudoByHost = rasterComponents
      ? new Map<string, SlideComponent[]>()
      : extractPseudoLayers(styleSources, renderSnapshot, root, warnings, new Set(nodesForBuild.map((node) => node.getAttribute('data-import-node-id') || '')))
    const ctx: NodeBuildContext = {
      renderSnapshot, root, canvas: size, importMode: selection.importMode, strippedIdsByContainer, pseudoByHost, warnings,
    }
    nodesForBuild.forEach((node, index) => components.push(...buildNodeComponents(node, index, ctx)))

    let canvas: SlideCanvas = {
      width: size.width,
      height: size.height,
      ...(canvasBackground ? { background: canvasBackground } : {}),
    }
    await rasterizeSvgComponents(components, warnings)
    const normalized = normalizeCanvasToContentBounds(components, canvas, warnings)
    canvas = normalized.canvas
    return finishImport(canvas, normalized.components, warnings)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'import_parse_failed')
    return buildFallbackImportResult(root, null, message, warnings)
  } finally {
    renderSnapshot.dispose()
  }
}

// The slide could not be parsed or has no root: rebuild a root from the raw markup.
function buildEmergencyFallback(html: string, reason: string, warnings: string[]): SlideImportResult {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = getCanvasRoot(doc) || doc.body
  return buildFallbackImportResult(root, html, reason, warnings)
}
