import type { SlideRecord } from './persistence-types'
import type {
  SlideCanvas,
  SlideComponent,
  SlideDeck,
  Slide,
  SlideDocument,
  SlideImportResult,
  SlideLayoutConstraint,
  SlideTheme,
} from './types'

function cloneComponent(component: SlideComponent): SlideComponent {
  return {
    ...component,
    style: { ...component.style },
    ...(component.groupId ? { groupId: component.groupId } : {}),
    ...(component.groupName ? { groupName: component.groupName } : {}),
    ...(component.layoutConstraint ? { layoutConstraint: { ...component.layoutConstraint } } : {}),
  }
}

function cloneTheme(theme: SlideTheme | undefined): SlideTheme | undefined {
  if (!theme) return undefined
  return {
    fonts: { ...theme.fonts },
    colors: { ...theme.colors },
    spacingScale: { ...theme.spacingScale },
  }
}

function cloneCanvas(canvas: SlideCanvas): SlideCanvas {
  return { ...canvas }
}

function cloneSlide(slide: Slide): Slide {
  return {
    ...slide,
    elements: Array.isArray(slide.elements) ? slide.elements.map(cloneComponent) : [],
    ...(slide.background?.fill ? { background: { fill: slide.background.fill } } : {}),
  }
}

function buildSlideFromCanvas(input: {
  id: string
  canvas: SlideCanvas
  components: SlideComponent[]
}): Slide {
  const canvas = cloneCanvas(input.canvas)
  return {
    id: input.id,
    elements: input.components.map(cloneComponent),
    ...(canvas.background ? { background: { fill: canvas.background } } : {}),
  }
}

function getComponentHeight(component: SlideComponent): number {
  return typeof component.height === 'number' ? component.height : 0
}

function clampComponentToCanvas(component: SlideComponent, canvas: SlideCanvas, x: number, y: number): { x: number; y: number } {
  const height = getComponentHeight(component)
  const maxX = Math.max(0, canvas.width - component.width)
  const maxY = Math.max(0, canvas.height - height)
  return {
    x: Math.min(maxX, Math.max(0, Math.round(x))),
    y: Math.min(maxY, Math.max(0, Math.round(y))),
  }
}

function inferPinnedConstraint(component: SlideComponent, canvas: SlideCanvas, base: SlideLayoutConstraint): SlideLayoutConstraint {
  const horizontalCenter = component.x + (component.width / 2)
  const verticalCenter = component.y + (getComponentHeight(component) / 2)
  const anchorX =
    horizontalCenter <= canvas.width * 0.33
      ? 'left'
      : horizontalCenter >= canvas.width * 0.67
        ? 'right'
        : 'center'
  const anchorY =
    verticalCenter <= canvas.height * 0.33
      ? 'top'
      : verticalCenter >= canvas.height * 0.67
        ? 'bottom'
        : 'center'
  const offsetX =
    anchorX === 'left'
      ? component.x
      : anchorX === 'right'
        ? canvas.width - (component.x + component.width)
        : horizontalCenter - (canvas.width / 2)
  const offsetY =
    anchorY === 'top'
      ? component.y
      : anchorY === 'bottom'
        ? canvas.height - (component.y + getComponentHeight(component))
        : verticalCenter - (canvas.height / 2)

  return {
    ...base,
    anchorX,
    anchorY,
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
  }
}

function reflowPinnedComponent(component: SlideComponent, canvas: SlideCanvas): SlideComponent {
  const constraint = component.layoutConstraint
  if (!constraint || constraint.type !== 'pinned') return component
  const width = component.width
  const height = getComponentHeight(component)
  const nextX =
    constraint.anchorX === 'right'
      ? canvas.width - width - (constraint.offsetX ?? 0)
      : constraint.anchorX === 'center'
        ? Math.round((canvas.width / 2) + (constraint.offsetX ?? 0) - (width / 2))
        : constraint.offsetX ?? component.x
  const nextY =
    constraint.anchorY === 'bottom'
      ? canvas.height - height - (constraint.offsetY ?? 0)
      : constraint.anchorY === 'center'
        ? Math.round((canvas.height / 2) + (constraint.offsetY ?? 0) - (height / 2))
        : constraint.offsetY ?? component.y
  const nextCoordinates = clampComponentToCanvas(component, canvas, nextX, nextY)
  return {
    ...component,
    x: nextCoordinates.x,
    y: nextCoordinates.y,
  }
}

export function applyLayoutConstraintToComponents(input: {
  canvas: SlideCanvas
  components: SlideComponent[]
  selectedIds: string[]
  constraint: SlideLayoutConstraint
}): SlideComponent[] {
  const selectedIdSet = new Set(input.selectedIds)
  const selected = input.components.filter((component) => selectedIdSet.has(component.id) && !component.locked)
  if (selected.length === 0) return input.components.map(cloneComponent)

  const baseConstraint: SlideLayoutConstraint = {
    ...input.constraint,
    gap: Math.max(0, Math.round(input.constraint.gap ?? 16)),
    columns: Math.max(1, Math.round(input.constraint.columns ?? 2)),
  }

  const nextById = new Map<string, SlideComponent>()
  selected.forEach((component) => {
    nextById.set(component.id, {
      ...cloneComponent(component),
      layoutConstraint:
        baseConstraint.type === 'pinned'
          ? inferPinnedConstraint(component, input.canvas, baseConstraint)
          : { ...baseConstraint },
    })
  })

  if (baseConstraint.type === 'stack' || baseConstraint.type === 'row' || baseConstraint.type === 'grid') {
    const minX = Math.min(...selected.map((component) => component.x))
    const minY = Math.min(...selected.map((component) => component.y))
    const maxWidth = Math.max(...selected.map((component) => component.width))
    const maxHeight = Math.max(...selected.map((component) => getComponentHeight(component)))
    const gap = baseConstraint.gap ?? 16

    if (baseConstraint.type === 'stack') {
      let cursorY = minY
      selected
        .slice()
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .forEach((component) => {
          const next = nextById.get(component.id)
          if (!next) return
          const nextX =
            baseConstraint.alignment === 'right'
              ? minX + maxWidth - component.width
              : baseConstraint.alignment === 'center'
                ? minX + ((maxWidth - component.width) / 2)
                : minX
          const nextCoordinates = clampComponentToCanvas(next, input.canvas, nextX, cursorY)
          next.x = nextCoordinates.x
          next.y = nextCoordinates.y
          cursorY += getComponentHeight(component) + gap
        })
    }

    if (baseConstraint.type === 'row') {
      let cursorX = minX
      selected
        .slice()
        .sort((a, b) => a.x - b.x || a.y - b.y)
        .forEach((component) => {
          const next = nextById.get(component.id)
          if (!next) return
          const nextY =
            baseConstraint.alignment === 'right'
              ? minY + maxHeight - getComponentHeight(component)
              : baseConstraint.alignment === 'center'
                ? minY + ((maxHeight - getComponentHeight(component)) / 2)
                : minY
          const nextCoordinates = clampComponentToCanvas(next, input.canvas, cursorX, nextY)
          next.x = nextCoordinates.x
          next.y = nextCoordinates.y
          cursorX += component.width + gap
        })
    }

    if (baseConstraint.type === 'grid') {
      const columns = Math.max(1, baseConstraint.columns ?? 2)
      selected
        .slice()
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .forEach((component, index) => {
          const next = nextById.get(component.id)
          if (!next) return
          const column = index % columns
          const row = Math.floor(index / columns)
          const nextX = minX + (column * (maxWidth + gap))
          const nextY = minY + (row * (maxHeight + gap))
          const nextCoordinates = clampComponentToCanvas(next, input.canvas, nextX, nextY)
          next.x = nextCoordinates.x
          next.y = nextCoordinates.y
        })
    }
  }

  return input.components.map((component) => {
    const next = nextById.get(component.id)
    return next ? next : cloneComponent(component)
  })
}

export function adaptComponentsToResponsiveCanvas(input: {
  previousCanvas: SlideCanvas
  nextCanvas: SlideCanvas
  components: SlideComponent[]
}): SlideComponent[] {
  return adaptComponentsToResponsiveCanvasWithWarnings(input).components
}

export function adaptComponentsToResponsiveCanvasWithWarnings(input: {
  previousCanvas: SlideCanvas
  nextCanvas: SlideCanvas
  components: SlideComponent[]
}): { components: SlideComponent[]; warnings: string[] } {
  const widthRatio = input.nextCanvas.width / Math.max(1, input.previousCanvas.width)
  const heightRatio = input.nextCanvas.height / Math.max(1, input.previousCanvas.height)
  const warnings: string[] = []
  const baseComponents = input.components.map((component) => {
    const next = cloneComponent(component)
    if (component.layoutConstraint?.type === 'pinned') {
      return reflowPinnedComponent(next, input.nextCanvas)
    }
    next.x = Math.round(component.x * widthRatio)
    next.y = Math.round(component.y * heightRatio)
    next.width = Math.max(1, Math.round(component.width * widthRatio))
    if (typeof component.height === 'number') {
      next.height = Math.max(1, Math.round(component.height * heightRatio))
    }
    const clamped = clampComponentToCanvas(next, input.nextCanvas, next.x, next.y)
    const hasConstraint = Boolean(component.layoutConstraint)
    const movedByClamp = clamped.x !== next.x || clamped.y !== next.y
    if (!hasConstraint && movedByClamp) {
      warnings.push(
        `Manual intervention may be required for unconstrained layer "${component.id}" after responsive reflow.`,
      )
    }
    next.x = clamped.x
    next.y = clamped.y
    return next
  })

  const constraintGroups = new Map<string, { constraint: SlideLayoutConstraint; ids: string[] }>()
  for (const component of baseComponents) {
    const constraint = component.layoutConstraint
    if (!constraint || constraint.type === 'pinned') continue
    const bucketKey = component.groupId
      ? `group:${component.groupId}`
      : `constraint:${constraint.type}:${constraint.alignment || 'left'}:${constraint.columns || 1}:${constraint.gap || 16}`
    const existing = constraintGroups.get(bucketKey)
    if (existing) {
      existing.ids.push(component.id)
    } else {
      constraintGroups.set(bucketKey, { constraint: { ...constraint }, ids: [component.id] })
    }
  }

  let adapted = baseComponents
  for (const group of constraintGroups.values()) {
    adapted = applyLayoutConstraintToComponents({
      canvas: input.nextCanvas,
      components: adapted,
      selectedIds: group.ids,
      constraint: group.constraint,
    })
  }

  const components = adapted.map((component) => {
    const clamped = clampComponentToCanvas(component, input.nextCanvas, component.x, component.y)
    return {
      ...component,
      x: clamped.x,
      y: clamped.y,
    }
  })
  return { components, warnings: Array.from(new Set(warnings)) }
}

export function getSlideDocumentActiveSlide(document: SlideDocument, slideId?: string | null): Slide | null {
  if (!Array.isArray(document.deck.slides) || document.deck.slides.length === 0) return null
  if (slideId) {
    const matched = document.deck.slides.find((slide) => slide.id === slideId)
    if (matched) return matched
  }
  return document.deck.slides[0] || null
}

function createSlideDeck(input: {
  id?: string
  canvas: SlideCanvas
  components: SlideComponent[]
}): SlideDeck {
  const canvas = cloneCanvas(input.canvas)
  const slideId = input.id || 'slide-1'
  return {
    id: input.id || 'deck-1',
    width: canvas.width,
    height: canvas.height,
    slides: [buildSlideFromCanvas({ id: slideId, canvas, components: input.components })],
  }
}

export function createSlideDocument(input: {
  id?: string
  canvas: SlideCanvas
  components: SlideComponent[]
  warnings?: string[]
  theme?: SlideTheme
}): SlideDocument {
  const deck = createSlideDeck(input)
  return {
    version: 1,
    deck,
    warnings: Array.isArray(input.warnings) ? [...input.warnings] : [],
    ...(input.theme ? { theme: cloneTheme(input.theme) } : {}),
  }
}

export function slideDocumentToImportResult(document: SlideDocument, slideId?: string | null): SlideImportResult {
  const slide = getSlideDocumentActiveSlide(document, slideId)
  return {
    document,
    canvas: {
      width: document.deck.width,
      height: document.deck.height,
      ...(slide?.background?.fill ? { background: slide.background.fill } : {}),
    },
    components: Array.isArray(slide?.elements) ? slide.elements.map(cloneComponent) : [],
    warnings: Array.isArray(document.warnings) ? [...document.warnings] : [],
  }
}

export function ensureSlideDocument(input: {
  document?: SlideDocument | null
  canvas: SlideCanvas
  components: SlideComponent[]
  warnings?: string[]
  slideId?: string
  theme?: SlideTheme
}): SlideDocument {
  if (input.document) return input.document
  return createSlideDocument({
    id: input.slideId,
    canvas: input.canvas,
    components: input.components,
    warnings: input.warnings,
    theme: input.theme,
  })
}

export function syncSlideDocument(input: {
  document?: SlideDocument | null
  canvas: SlideCanvas
  components: SlideComponent[]
  warnings?: string[]
  slideId?: string
  theme?: SlideTheme
}): SlideDocument {
  const version = Number.isFinite(input.document?.version) ? Number(input.document?.version) : 1
  const activeSlideId = input.slideId || input.document?.deck.slides[0]?.id || 'slide-1'
  const nextComponents =
    input.document && (input.document.deck.width !== input.canvas.width || input.document.deck.height !== input.canvas.height)
      ? input.components.map((component) => reflowPinnedComponent(component, input.canvas))
      : input.components
  const currentSlides = Array.isArray(input.document?.deck.slides)
    ? input.document?.deck.slides.map(cloneSlide)
    : []
  const nextSlide = buildSlideFromCanvas({
    id: activeSlideId,
    canvas: input.canvas,
    components: nextComponents,
  })
  let replaced = false
  const nextSlides = currentSlides.map((slide) => {
    if (slide.id !== activeSlideId) return slide
    replaced = true
    return nextSlide
  })
  if (!replaced) nextSlides.push(nextSlide)
  return {
    version,
    deck: {
      id: input.document?.deck.id || activeSlideId || 'deck-1',
      width: input.canvas.width,
      height: input.canvas.height,
      slides: nextSlides,
    },
    warnings: Array.isArray(input.warnings) ? [...input.warnings] : [],
    ...(input.theme || input.document?.theme ? { theme: cloneTheme(input.theme || input.document?.theme) } : {}),
  }
}

export function appendSlideToDocument(input: {
  document: SlideDocument
  slideId: string
  canvas: SlideCanvas
  components: SlideComponent[]
}): SlideDocument {
  return {
    version: input.document.version,
    deck: {
      ...input.document.deck,
      slides: [
        ...input.document.deck.slides.map(cloneSlide),
        buildSlideFromCanvas({
          id: input.slideId,
          canvas: input.canvas,
          components: input.components,
        }),
      ],
    },
    warnings: Array.isArray(input.document.warnings) ? [...input.document.warnings] : [],
    ...(input.document.theme ? { theme: cloneTheme(input.document.theme) } : {}),
  }
}

export function duplicateSlideInDocument(document: SlideDocument, sourceSlideId: string, nextSlideId: string): SlideDocument {
  const slides = document.deck.slides.map(cloneSlide)
  const sourceIndex = slides.findIndex((slide) => slide.id === sourceSlideId)
  if (sourceIndex < 0) return document
  const sourceSlide = slides[sourceIndex]
  const duplicate: Slide = {
    ...sourceSlide,
    id: nextSlideId,
    elements: sourceSlide.elements.map((component, index) => ({
      ...cloneComponent(component),
      id: `${component.id}-copy-${index + 1}`,
    })),
  }
  slides.splice(sourceIndex + 1, 0, duplicate)
  return {
    version: document.version,
    deck: {
      ...document.deck,
      slides,
    },
    warnings: Array.isArray(document.warnings) ? [...document.warnings] : [],
    ...(document.theme ? { theme: cloneTheme(document.theme) } : {}),
  }
}

export function deleteSlideFromDocument(document: SlideDocument, slideId: string): SlideDocument {
  const nextSlides = document.deck.slides.filter((slide) => slide.id !== slideId).map(cloneSlide)
  return {
    version: document.version,
    deck: {
      ...document.deck,
      slides: nextSlides.length > 0 ? nextSlides : [buildSlideFromCanvas({
        id: 'slide-1',
        canvas: {
          width: document.deck.width,
          height: document.deck.height,
        },
        components: [],
      })],
    },
    warnings: Array.isArray(document.warnings) ? [...document.warnings] : [],
    ...(document.theme ? { theme: cloneTheme(document.theme) } : {}),
  }
}

export function reorderSlideInDocument(document: SlideDocument, slideId: string, direction: 'up' | 'down'): SlideDocument {
  const slides = document.deck.slides.map(cloneSlide)
  const index = slides.findIndex((slide) => slide.id === slideId)
  if (index < 0) return document
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= slides.length) return document
  const [moved] = slides.splice(index, 1)
  slides.splice(targetIndex, 0, moved)
  return {
    version: document.version,
    deck: {
      ...document.deck,
      slides,
    },
    warnings: Array.isArray(document.warnings) ? [...document.warnings] : [],
    ...(document.theme ? { theme: cloneTheme(document.theme) } : {}),
  }
}

export function readSlideDocumentFromMetadata(metadata: Record<string, unknown> | null | undefined): SlideDocument | null {
  const raw = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).slide_document : null
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as SlideDocument
  if (!candidate.deck || !Array.isArray(candidate.deck.slides)) return null
  return candidate
}

export function slideRecordToImportResult(slide: SlideRecord): SlideImportResult {
  const persisted = readSlideDocumentFromMetadata(slide.metadata)
  const document = persisted || createSlideDocument({
    id: slide.id,
    canvas: slide.canvas,
    components: slide.components,
    warnings: Array.isArray(slide.metadata?.warnings) ? slide.metadata.warnings as string[] : [],
  })
  const activeDocumentSlideId = typeof slide.metadata?.active_document_slide_id === 'string'
    ? slide.metadata.active_document_slide_id
    : null
  return slideDocumentToImportResult(document, activeDocumentSlideId)
}
