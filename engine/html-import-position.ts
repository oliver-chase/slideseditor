import type { SlideComponent } from './types'
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, IMPORT_AUTO_CANVAS_SCALE_MAX } from './html-import-shared'
import type { ContentBounds, MeasuredNodeRect, RenderSnapshot } from './html-import-shared'
import { measureNodeRect } from './html-import-render'
import { isPxLike, parseLength } from './html-import-values'

export function parseStylePx(
  styleMap: Record<string, string>,
  key: string,
  nodeLabel: string,
  warnings: string[],
): number | undefined {
  const raw = styleMap[key]
  if (raw === undefined) return undefined
  if (!raw.trim() || raw.trim().toLowerCase() === 'auto') return undefined

  const parsed = parseLength(raw)
  if (!parsed) {
    warnings.push('Node "' + nodeLabel + '" has non-numeric ' + key + ' value "' + raw + '"; ignored.')
    return undefined
  }

  if (!isPxLike(parsed)) {
    warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "' + parsed.unit + '"; ignored.')
    return undefined
  }

  return parsed.value
}

export function parseStylePositionPx(
  styleMap: Record<string, string>,
  key: 'left' | 'top',
  nodeLabel: string,
  warnings: string[],
  axisSize: number,
): number | undefined {
  const raw = styleMap[key]
  if (raw === undefined) return undefined
  if (!raw.trim() || raw.trim().toLowerCase() === 'auto') return undefined

  const parsed = parseLength(raw)
  if (!parsed) {
    warnings.push('Node "' + nodeLabel + '" has non-numeric ' + key + ' value "' + raw + '"; ignored.')
    return undefined
  }

  if (isPxLike(parsed)) return parsed.value

  if (parsed.unit === '%') {
    warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "%"; approximated from the canvas size.')
    return axisSize > 0 ? (axisSize * parsed.value) / 100 : undefined
  }

  warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "' + parsed.unit + '"; ignored.')
  return undefined
}

function parseStyleOffsetPx(
  styleMap: Record<string, string>,
  key: 'margin-left' | 'margin-top',
  nodeLabel: string,
  warnings: string[],
  axisSize: number,
): number | undefined {
  const raw = styleMap[key]
  if (raw === undefined) return undefined
  if (!raw.trim() || raw.trim().toLowerCase() === 'auto') return undefined

  const parsed = parseLength(raw)
  if (!parsed) {
    warnings.push('Node "' + nodeLabel + '" has non-numeric ' + key + ' value "' + raw + '"; ignored.')
    return undefined
  }

  if (isPxLike(parsed)) return parsed.value

  if (parsed.unit === '%') {
    warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "%"; approximated from canvas axis.')
    return axisSize > 0 ? (axisSize * parsed.value) / 100 : undefined
  }

  warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "' + parsed.unit + '"; ignored.')
  return undefined
}

function parseComputedPositionPx(
  rawValue: string | undefined,
  key: 'left' | 'top',
  nodeLabel: string,
  warnings: string[],
  axisSize: number,
): number | undefined {
  if (!rawValue) return undefined
  const normalized = rawValue.trim().toLowerCase()
  if (!normalized || normalized === 'auto') return undefined

  const parsed = parseLength(normalized)
  if (!parsed) {
    warnings.push('Node "' + nodeLabel + '" has non-numeric computed ' + key + ' value "' + rawValue + '"; ignored.')
    return undefined
  }

  if (isPxLike(parsed)) return parsed.value

  if (parsed.unit === '%') {
    warnings.push('Node "' + nodeLabel + '" uses unsupported computed ' + key + ' unit "%"; approximated from the canvas size.')
    return axisSize > 0 ? (axisSize * parsed.value) / 100 : undefined
  }

  warnings.push('Node "' + nodeLabel + '" uses unsupported computed ' + key + ' unit "' + parsed.unit + '"; ignored.')
  return undefined
}

export function parseAttrPx(
  rawValue: string | null,
  attrName: string,
  nodeLabel: string,
  warnings: string[],
): number | undefined {
  const parsed = parseLength(rawValue)
  if (!parsed) return undefined

  if (!isPxLike(parsed)) {
    warnings.push('Node "' + nodeLabel + '" uses unsupported ' + attrName + ' unit "' + parsed.unit + '"; ignored.')
    return undefined
  }

  return parsed.value
}

export function parseCanvasPx(
  rawValue: string | undefined,
  axisLabel: 'width' | 'height',
  warnings: string[],
): number | undefined {
  const parsed = parseLength(rawValue)
  if (!parsed) return undefined

  if (!isPxLike(parsed)) {
    warnings.push('Slide root uses unsupported canvas ' + axisLabel + ' unit "' + parsed.unit + '"; defaulted to ' + (axisLabel === 'width' ? DEFAULT_CANVAS_WIDTH : DEFAULT_CANVAS_HEIGHT) + '.')
    return undefined
  }

  if (parsed.value <= 0) {
    warnings.push('Slide root has non-positive canvas ' + axisLabel + '; defaulted to ' + (axisLabel === 'width' ? DEFAULT_CANVAS_WIDTH : DEFAULT_CANVAS_HEIGHT) + '.')
    return undefined
  }

  return parsed.value
}

export function canonicalCanvasValue(rectValue: number | undefined, fallback: number, warnings: string[], axis: 'width' | 'height', fileLabel: string): number {
  if (typeof rectValue !== 'number' || !Number.isFinite(rectValue) || rectValue <= 0) {
    warnings.push('Could not resolve ' + fileLabel + ' canvas ' + axis + '; defaulted to ' + fallback + '.')
    return fallback
  }
  return rectValue
}

function parseTransformOffsets(
  transformRaw: string | undefined,
  nodeLabel: string,
  warnings: string[],
): { x: number; y: number } {
  if (!transformRaw || transformRaw === 'none') return { x: 0, y: 0 }

  const normalized = transformRaw.trim().toLowerCase()

  const unsupportedTransformTokens = ['matrix(', 'scale(', 'rotate(', 'skew(', 'perspective(']
  if (unsupportedTransformTokens.some(token => normalized.includes(token))) {
    warnings.push('Node "' + nodeLabel + '" uses unsupported transform "' + transformRaw + '"; ignored.')
    return { x: 0, y: 0 }
  }

  const translateMatch = normalized.match(/^translate\(([^,]+),\s*([^)]+)\)$/)
  if (translateMatch) {
    const xLength = parseLength(translateMatch[1])
    const yLength = parseLength(translateMatch[2])
    if (!xLength || !yLength || !isPxLike(xLength) || !isPxLike(yLength)) {
      warnings.push('Node "' + nodeLabel + '" uses unsupported translate values in transform "' + transformRaw + '"; ignored.')
      return { x: 0, y: 0 }
    }
    return { x: xLength.value, y: yLength.value }
  }

  const translateXMatch = normalized.match(/translatex\(([^)]+)\)/)
  const translateYMatch = normalized.match(/translatey\(([^)]+)\)/)
  if (translateXMatch || translateYMatch) {
    const xLength = parseLength(translateXMatch?.[1])
    const yLength = parseLength(translateYMatch?.[1])

    if ((xLength && !isPxLike(xLength)) || (yLength && !isPxLike(yLength))) {
      warnings.push('Node "' + nodeLabel + '" uses unsupported translate unit in transform "' + transformRaw + '"; ignored.')
      return { x: 0, y: 0 }
    }

    return {
      x: xLength?.value ?? 0,
      y: yLength?.value ?? 0,
    }
  }

  warnings.push('Node "' + nodeLabel + '" uses unsupported transform "' + transformRaw + '"; ignored.')
  return { x: 0, y: 0 }
}

export function asCanonicalDimension(value: number | undefined, fallback = 0): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  const rounded = Number(value.toFixed(3))
  const nearestInteger = Math.round(rounded)
  if (Math.abs(rounded - nearestInteger) <= 0.5) return nearestInteger
  return rounded
}

export function asCanonicalDimensionOptional(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value)) return undefined
  const rounded = Number(value.toFixed(3))
  const nearestInteger = Math.round(rounded)
  if (Math.abs(rounded - nearestInteger) <= 0.5) return nearestInteger
  return rounded
}

function getComponentContentBounds(components: SlideComponent[]): ContentBounds | null {
  if (components.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxRight = 0
  let maxBottom = 0

  for (const component of components) {
    const width = Number.isFinite(component.width) ? component.width : 0
    const height = Number.isFinite(component.height || 0) ? (component.height || 0) : 0
    minX = Math.min(minX, component.x)
    minY = Math.min(minY, component.y)
    maxRight = Math.max(maxRight, component.x + Math.max(0, width))
    maxBottom = Math.max(maxBottom, component.y + Math.max(0, height))
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null
  const width = Math.max(1, maxRight - minX)
  const height = Math.max(1, maxBottom - minY)
  return { minX, minY, maxRight, maxBottom, width, height }
}

export function normalizeCanvasToContentBounds(
  components: SlideComponent[],
  canvas: { width: number; height: number; background?: string },
  warnings: string[],
): { components: SlideComponent[]; canvas: { width: number; height: number; background?: string } } {
  const bounds = getComponentContentBounds(components)
  if (!bounds) return { components, canvas }

  const oversizedCanvas = canvas.width > 4096 || canvas.height > 4096
  if (!oversizedCanvas) return { components, canvas }

  const shifted = components.map((component) => ({
    ...component,
    x: asCanonicalDimension(component.x - bounds.minX),
    y: asCanonicalDimension(component.y - bounds.minY),
  }))
  const normalizedCanvas = {
    ...canvas,
    width: asCanonicalDimension(Math.max(1, bounds.width)),
    height: asCanonicalDimension(Math.max(1, bounds.height)),
  }
  warnings.push(
    `Normalized oversized canvas to content bounds ${normalizedCanvas.width}x${normalizedCanvas.height} for import usability.`,
  )
  return { components: shifted, canvas: normalizedCanvas }
}

export function measureContentBounds(
  nodes: HTMLElement[],
  snapshot: RenderSnapshot,
  root: HTMLElement,
): { width?: number; height?: number } {
  let maxRight = 0
  let maxBottom = 0

  for (const node of nodes) {
    const nodeId = node.getAttribute('data-import-node-id') || ''
    const renderNode = snapshot.nodesById.get(nodeId) || node
    const renderRoot = snapshot.root || root
    const measured = measureNodeRect(renderNode, renderRoot)
    if (measured.width === undefined || measured.height === undefined) continue
    const x = measured.x || 0
    const y = measured.y || 0
    maxRight = Math.max(maxRight, x + measured.width)
    maxBottom = Math.max(maxBottom, y + measured.height)
  }

  return {
    width: maxRight > 0 ? maxRight : undefined,
    height: maxBottom > 0 ? maxBottom : undefined,
  }
}

export function clampAutoImportCanvasAxis(axisValue: number, label: 'width' | 'height', warnings: string[]): number {
  const defaultAxis = label === 'width' ? DEFAULT_CANVAS_WIDTH : DEFAULT_CANVAS_HEIGHT
  const maxAxis = Math.round(defaultAxis * IMPORT_AUTO_CANVAS_SCALE_MAX)
  if (axisValue <= maxAxis) return axisValue

  warnings.push(
    `Source ${label} ${axisValue}px exceeds auto-import safety cap ${maxAxis}px; clamped to avoid compressed output.`,
  )
  return maxAxis
}

// Pick the x and y of a node from the first source that has one: its measured box
// (when nested), its own left/top, its margins, computed style, then the measured box.
export function resolveNodePosition(
  renderNode: HTMLElement,
  renderRoot: HTMLElement,
  styleMap: Record<string, string>,
  computedStyle: CSSStyleDeclaration | null,
  measured: MeasuredNodeRect,
  canvas: { width: number; height: number },
  nodeLabel: string,
  warnings: string[],
): { x: number; y: number } {
  const explicitLeft = parseStylePositionPx(styleMap, 'left', nodeLabel, warnings, canvas.width)
  const explicitTop = parseStylePositionPx(styleMap, 'top', nodeLabel, warnings, canvas.height)
  const explicitMarginLeft = parseStyleOffsetPx(styleMap, 'margin-left', nodeLabel, warnings, canvas.width)
  const explicitMarginTop = parseStyleOffsetPx(styleMap, 'margin-top', nodeLabel, warnings, canvas.height)
  const computedLeft = parseComputedPositionPx(computedStyle?.left, 'left', nodeLabel, warnings, canvas.width)
  const computedTop = parseComputedPositionPx(computedStyle?.top, 'top', nodeLabel, warnings, canvas.height)
  const computedMarginLeft = parseStyleOffsetPx({ 'margin-left': computedStyle?.marginLeft || '' }, 'margin-left', nodeLabel, warnings, canvas.width)
  const computedMarginTop = parseStyleOffsetPx({ 'margin-top': computedStyle?.marginTop || '' }, 'margin-top', nodeLabel, warnings, canvas.height)
  const transformOffsets = parseTransformOffsets(styleMap.transform, nodeLabel, warnings)
  const layoutX = Number.isFinite(renderNode.offsetLeft) ? renderNode.offsetLeft : undefined
  const layoutY = Number.isFinite(renderNode.offsetTop) ? renderNode.offsetTop : undefined
  const measuredX = typeof measured.x === 'number' && Number.isFinite(measured.x) ? measured.x : undefined
  const measuredY = typeof measured.y === 'number' && Number.isFinite(measured.y) ? measured.y : undefined
  const measuredOrLayoutX = measuredX !== undefined
    ? ((measuredX === 0 && layoutX !== undefined && layoutX > 0) ? layoutX : measuredX)
    : layoutX
  const measuredOrLayoutY = measuredY !== undefined
    ? ((measuredY === 0 && layoutY !== undefined && layoutY > 0) ? layoutY : measuredY)
    : layoutY
  const hasNestedRenderParent = Boolean(
    renderRoot &&
    renderNode.parentElement &&
    renderNode.parentElement !== renderRoot &&
    renderRoot.contains(renderNode.parentElement),
  )
  // An element in normal flow sits where layout put it, and its margin is not a position. Only a
  // positioned element at the top level takes its declared left and top first.
  const isPositioned = /^(absolute|fixed)$/i.test(computedStyle?.position || '')
  const preferMeasured = hasNestedRenderParent || !isPositioned
  const preferredMeasuredX = preferMeasured ? measuredOrLayoutX : undefined
  const preferredMeasuredY = preferMeasured ? measuredOrLayoutY : undefined
  const baseX = preferredMeasuredX ?? explicitLeft ?? explicitMarginLeft ?? computedLeft ?? computedMarginLeft ?? measuredOrLayoutX ?? 0
  const baseY = preferredMeasuredY ?? explicitTop ?? explicitMarginTop ?? computedTop ?? computedMarginTop ?? measuredOrLayoutY ?? 0
  const baseXUsesMeasuredRect = preferredMeasuredX !== undefined || (
    explicitLeft === undefined &&
    explicitMarginLeft === undefined &&
    computedLeft === undefined &&
    computedMarginLeft === undefined &&
    measuredOrLayoutX !== undefined
  )
  const baseYUsesMeasuredRect = preferredMeasuredY !== undefined || (
    explicitTop === undefined &&
    explicitMarginTop === undefined &&
    computedTop === undefined &&
    computedMarginTop === undefined &&
    measuredOrLayoutY !== undefined
  )
  const transformX = baseXUsesMeasuredRect && measuredX !== undefined ? 0 : transformOffsets.x
  const transformY = baseYUsesMeasuredRect && measuredY !== undefined ? 0 : transformOffsets.y
  return { x: baseX + transformX, y: baseY + transformY }
}
