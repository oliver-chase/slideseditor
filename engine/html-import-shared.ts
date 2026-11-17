import type { SlideComponent } from './types'

export const DEFAULT_CANVAS_WIDTH = 1920

export const DEFAULT_CANVAS_HEIGHT = 1080

export const CANVAS_TARGET_ASPECT_RATIO = DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT

export const CANVAS_AUTO_SCALE_RATIO_THRESHOLD = 1.4

export const MIN_FLOW_NODE_SIZE = 12

export const IMPORT_AUTO_CANVAS_SCALE_MAX = 2.5

export const IMPORT_ROOT_MARKER_ATTR = 'data-import-root-id'

export const IMPORT_ROOT_MARKER_VALUE = 'import-root'

export const IMPORT_ROOT_NODE_ID = 'import-node-root'

export const FLOW_TEXT_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'blockquote',
  'figcaption',
  'button',
  'label',
  'a',
  'dt',
  'dd',
])

export const FLOW_MEDIA_TAGS = new Set(['img', 'picture', 'svg', 'canvas', 'video'])

export const CSS_IMPORT_MAX_RECURSION_DEPTH = 3

// A remote stylesheet larger than this is ignored, so a slide cannot make the import download a large file.
export const REMOTE_STYLESHEET_MAX_BYTES = 1_000_000

export const IMPORT_STYLE_PROPERTIES = [
  'color',
  'background-color',
  'background-image',
  'background',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'line-height',
  'text-align',
  'letter-spacing',
  'text-transform',
  'display',
  'align-items',
  'justify-content',
  'gap',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'box-shadow',
  'margin-left',
  'margin-top',
] as const

export interface ParsedLength {
  raw: string
  value: number
  unit: string
}

export interface MeasuredNodeRect {
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface ContentBounds {
  minX: number
  minY: number
  maxRight: number
  maxBottom: number
  width: number
  height: number
}

export interface RenderSnapshot {
  root: HTMLElement | null
  nodesById: Map<string, HTMLElement>
  dispose: () => void
}

export interface InlinedStyleChunk {
  cssText: string
  source: 'inline' | 'external'
  order: number
  linkHref?: string
}

export interface CssImportResult {
  cssText: string
  importedCount: number
  unresolvedCount: number
}

export interface PseudoLayerDescriptor {
  hostId: string
  pseudo: 'before' | 'after'
  styleMap: Record<string, string>
  hostLabel: string
  order: number
}

export interface RasterCandidates {
  allEls: HTMLElement[]
  gradientTextEls: HTMLElement[]
  gradientSet: Set<HTMLElement>
}

export interface DeclaredCanvas {
  explicitWidth: number | undefined
  explicitHeight: number | undefined
  computedWidth: number | undefined
  computedHeight: number | undefined
  measuredRootRect: MeasuredNodeRect
  rootStyle: Record<string, string>
  computedRootStyle: CSSStyleDeclaration | null
}

type ImportMode = 'absolute' | 'flow' | 'fallback' | 'root-fallback'

export interface NodeSelection {
  absoluteNodes: HTMLElement[]
  flowNodes: HTMLElement[]
  nodes: HTMLElement[]
  importMode: ImportMode
}

export interface NodeBuildContext {
  renderSnapshot: RenderSnapshot
  root: HTMLElement
  canvas: { width: number; height: number }
  importMode: ImportMode
  strippedIdsByContainer: Map<string, Set<string>>
  pseudoByHost: Map<string, SlideComponent[]>
  warnings: string[]
}
