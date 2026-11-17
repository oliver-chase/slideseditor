import type { SlideComponent } from './types'
import { IMPORT_ROOT_NODE_ID } from './html-import-shared'
import type { MeasuredNodeRect, PseudoLayerDescriptor, RenderSnapshot } from './html-import-shared'
import { getCssImportUrl, parseRuleDeclarations, stripWrappingQuotes } from './html-import-css'
import { measureNodeRect } from './html-import-render'
import { extractStyle, parseRuleValueExists } from './html-import-values'
import { asCanonicalDimension, asCanonicalDimensionOptional, parseStylePositionPx, parseStylePx } from './html-import-position'
import { escapeAttribute, getNodeLabel } from './html-import-markup'
import { escapeHtmlText } from './html-import-raster'

function parsePseudoLayerDescriptors(styleText: string, root: HTMLElement): PseudoLayerDescriptor[] {
  const descriptors: PseudoLayerDescriptor[] = []
  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  let order = 0

  while ((match = ruleRegex.exec(styleText)) !== null) {
    const selectorList = match[1]?.trim() || ''
    const declarationText = match[2] || ''
    const styleMap = parseRuleDeclarations(declarationText)
    if (Object.keys(styleMap).length === 0) {
      order += 1
      continue
    }

    const selectors = selectorList.split(',').map((selector) => selector.trim()).filter(Boolean)
    for (const selector of selectors) {
      const pseudoMatch = selector.match(/^(.+?)(::before|::after|:before|:after)\s*$/i)
      if (!pseudoMatch) continue

      const pseudo = pseudoMatch[2]?.toLowerCase().includes('before') ? 'before' : 'after'
      const hostSelector = pseudoMatch[1]?.trim()
      if (!hostSelector) continue

      let hostNodes: HTMLElement[] = []
      try {
        hostNodes = Array.from(root.querySelectorAll(hostSelector) as NodeListOf<HTMLElement>)
        if (root.matches(hostSelector)) {
          hostNodes = [root, ...hostNodes]
        }
      } catch {
        continue
      }

      for (const hostNode of Array.from(hostNodes)) {
        const hostId = hostNode.getAttribute('data-import-node-id')
        if (!hostId) continue
        descriptors.push({
          hostId,
          pseudo,
          hostLabel: getNodeLabel(hostNode),
          styleMap,
          order,
        })
      }
    }

    order += 1
  }

  return descriptors
}

function buildPseudoContent(styleMap: Record<string, string>, pseudoNodeLabel: string, warnings: string[]): string {
  const rawContent = styleMap.content || ''
  if (!rawContent || rawContent.toLowerCase() === 'none') return ''

  const isUrlImage = rawContent.startsWith('url(') && rawContent.endsWith(')')
  if (isUrlImage) {
    const parsedUrl = getCssImportUrl(rawContent)
    if (!parsedUrl) {
      warnings.push('Pseudo-element "' + pseudoNodeLabel + '" content URL "' + rawContent + '" could not be parsed; ignored.')
      return ''
    }
    warnings.push('Pseudo-element "' + pseudoNodeLabel + '" content URL converted to image fallback.')
    return `<img alt="${escapeAttribute(pseudoNodeLabel)}" src="${escapeAttribute(parsedUrl)}" />`
  }

  if (/^(attr|counters?)\(/i.test(rawContent)) {
    warnings.push('Pseudo-element "' + pseudoNodeLabel + '" content "' + rawContent + '" is not supported; ignored.')
    return ''
  }

  return escapeHtmlText(decodeCssEscapes(stripWrappingQuotes(rawContent)))
}

// "\e900" and "\201C " are CSS escapes for one character each; a backslash before any other character yields that character.
function decodeCssEscapes(text: string): string {
  return text.replace(/\\([0-9a-fA-F]{1,6})\s?|\\([\s\S])/g, (_match, hex: string | undefined, literal: string | undefined) => {
    if (literal !== undefined) return literal
    const codePoint = Number.parseInt(hex as string, 16)
    return codePoint === 0 || codePoint > 0x10ffff ? '\ufffd' : String.fromCodePoint(codePoint)
  })
}

function computePseudoOffset(
  styleMap: Record<string, string>,
  axis: 'x' | 'y',
  hostRect: MeasuredNodeRect,
  nodeLabel: string,
  warnings: string[],
): number {
  const key = axis === 'x' ? 'left' : 'top'
  const axisSize = axis === 'x' ? (hostRect.width || 0) : (hostRect.height || 0)
  const parsed = parseStylePositionPx(styleMap, key, nodeLabel, warnings, axisSize)
  if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed
  return 0
}

function shouldImportPseudoLayer(styleMap: Record<string, string>, width: number | undefined, height: number | undefined): boolean {
  if (styleMap.content && styleMap.content.toLowerCase() !== 'none') return true
  if (parseRuleValueExists(styleMap, 'background') || parseRuleValueExists(styleMap, 'background-color') || parseRuleValueExists(styleMap, 'background-image')) return true
  if (parseRuleValueExists(styleMap, 'border') || parseRuleValueExists(styleMap, 'border-color') || parseRuleValueExists(styleMap, 'box-shadow')) return true
  return typeof width === 'number' || typeof height === 'number'
}

function extractPseudoComponents(
  descriptors: PseudoLayerDescriptor[],
  renderSnapshot: RenderSnapshot,
  root: HTMLElement,
  renderRoot: HTMLElement,
  warnings: string[],
): Map<string, SlideComponent[]> {
  const pseudoByHost = new Map<string, SlideComponent[]>()
  const mergedStyles = new Map<string, { pseudo: 'before' | 'after'; order: number; styleMap: Record<string, string> }>()

  for (const descriptor of descriptors) {
    const hostPseudoKey = descriptor.hostId + '|' + descriptor.pseudo
    const existing = mergedStyles.get(hostPseudoKey)
    mergedStyles.set(hostPseudoKey, {
      pseudo: descriptor.pseudo,
      order: descriptor.order,
      styleMap: {
        ...(existing?.styleMap || {}),
        ...descriptor.styleMap,
      },
    })
  }

  for (const [hostPseudoKey, { pseudo, order, styleMap }] of mergedStyles.entries()) {
    const [hostId] = hostPseudoKey.split('|')
    if (hostId === IMPORT_ROOT_NODE_ID) {
      warnings.push('Skipped root pseudo-element decorative overlay during import.')
      continue
    }
    const hostNode = root.querySelector<HTMLElement>(`[data-import-node-id="${hostId}"]`)
    if (!hostNode) continue

    const renderNode = renderSnapshot.nodesById.get(hostId) || hostNode
    const measuredHost = measureNodeRect(renderNode, renderRoot)
    const hostLabel = getNodeLabel(hostNode)

    const pseudoLabel = hostLabel + '::' + pseudo
    const pseudoContent = buildPseudoContent(styleMap, pseudoLabel, warnings)
    const pseudoWidth = parseStylePx(styleMap, 'width', pseudoLabel, warnings)
    const pseudoHeight = parseStylePx(styleMap, 'height', pseudoLabel, warnings)
    if (!shouldImportPseudoLayer(styleMap, pseudoWidth, pseudoHeight)) continue

    const hostX = typeof measuredHost.x === 'number' && Number.isFinite(measuredHost.x) ? measuredHost.x : 0
    const hostY = typeof measuredHost.y === 'number' && Number.isFinite(measuredHost.y) ? measuredHost.y : 0
    const pseudoX = hostX + computePseudoOffset(styleMap, 'x', measuredHost, pseudoLabel, warnings)
    const pseudoY = hostY + computePseudoOffset(styleMap, 'y', measuredHost, pseudoLabel, warnings)

    // The layer takes its own declarations and its own computed style, so it never copies the host's fill or border.
    const pseudoComputedStyle = renderNode.ownerDocument?.defaultView?.getComputedStyle(renderNode, '::' + pseudo) ?? null
    const extractedStyle = extractStyle(styleMap, pseudoComputedStyle, warnings, pseudoLabel)

    const pseudoComponent: SlideComponent = {
      id: `import-${hostId}-${pseudo}-${order}`,
      type: 'panel',
      sourceLabel: pseudoLabel,
      x: asCanonicalDimension(pseudoX),
      y: asCanonicalDimension(pseudoY),
      width: asCanonicalDimension(pseudoWidth ?? 16),
      height: asCanonicalDimensionOptional(pseudoHeight),
      content: pseudoContent || '\u00a0',
      style: extractedStyle,
      locked: false,
      visible: true,
    }
    pseudoByHost.set(hostId, [...(pseudoByHost.get(hostId) || []), pseudoComponent])
  }

  for (const [, components] of pseudoByHost) {
    components.sort((a, b) => {
      const aBefore = (a.sourceLabel || '').includes('::before')
      const bBefore = (b.sourceLabel || '').includes('::before')
      if (aBefore && !bBefore) return -1
      if (!aBefore && bBefore) return 1
      return 0
    })
  }

  return pseudoByHost
}

export function extractPseudoLayers(
  styleSources: string,
  renderSnapshot: RenderSnapshot,
  root: HTMLElement,
  warnings: string[],
  builtHostIds: Set<string>,
): Map<string, SlideComponent[]> {
  const pseudoDescriptors = parsePseudoLayerDescriptors(styleSources, root)
  const allByHost = extractPseudoComponents(pseudoDescriptors, renderSnapshot, root, renderSnapshot.root || root, warnings)
  // A layer is emitted only with its host, so layers of hosts that are not imported are left out and not counted.
  const pseudoByHost = new Map(Array.from(allByHost).filter(([hostId]) => builtHostIds.has(hostId)))
  const pseudoLayerCount = Array.from(pseudoByHost.values()).reduce((total, entries) => total + entries.length, 0)
  if (pseudoDescriptors.length > 0 && pseudoLayerCount === 0) {
    warnings.push('Pseudo-element selectors were detected but could not be resolved to rendered layers.')
  } else if (pseudoLayerCount > 0) {
    warnings.push(
      'Extracted ' + pseudoLayerCount + ' pseudo-element layer' + (pseudoLayerCount === 1 ? '' : 's') + ' from CSS.',
    )
  }
  return pseudoByHost
}
