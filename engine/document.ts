import type {
  SlideCanvas,
  SlideComponent,
  SlideDeck,
  Slide,
  SlideDocument,
} from './types'

function cloneComponent(component: SlideComponent): SlideComponent {
  return {
    ...component,
    style: { ...component.style },
  }
}

function cloneCanvas(canvas: SlideCanvas): SlideCanvas {
  return { ...canvas }
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

export function adaptComponentsToResponsiveCanvasWithWarnings(input: {
  previousCanvas: SlideCanvas
  nextCanvas: SlideCanvas
  components: SlideComponent[]
}): { components: SlideComponent[]; warnings: string[] } {
  const widthRatio = input.nextCanvas.width / Math.max(1, input.previousCanvas.width)
  const heightRatio = input.nextCanvas.height / Math.max(1, input.previousCanvas.height)
  const warnings: string[] = []
  const components = input.components.map((component) => {
    const next = cloneComponent(component)
    next.x = Math.round(component.x * widthRatio)
    next.y = Math.round(component.y * heightRatio)
    next.width = Math.max(1, Math.round(component.width * widthRatio))
    if (typeof component.height === 'number') {
      next.height = Math.max(1, Math.round(component.height * heightRatio))
    }
    const clamped = clampComponentToCanvas(next, input.nextCanvas, next.x, next.y)
    if (clamped.x !== next.x || clamped.y !== next.y) {
      warnings.push(
        `Manual intervention may be required for unconstrained layer "${component.id}" after responsive reflow.`,
      )
    }
    next.x = clamped.x
    next.y = clamped.y
    return next
  })
  return { components, warnings: Array.from(new Set(warnings)) }
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
}): SlideDocument {
  const deck = createSlideDeck(input)
  return {
    version: 1,
    deck,
    warnings: Array.isArray(input.warnings) ? [...input.warnings] : [],
  }
}

