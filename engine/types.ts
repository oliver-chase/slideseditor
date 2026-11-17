export type SlideComponentType =
  | 'text'
  | 'heading'
  | 'subheading'
  | 'card'
  | 'row'
  | 'stat'
  | 'logo'
  | 'tag-line'
  | 'panel'

export interface SlideComponentStyle {
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  color?: string
  backgroundColor?: string
  backgroundFill?: string
  borderColor?: string
  borderWidth?: number
  borderStyle?: string
  borderRadius?: number
  boxShadow?: string
  fontStyle?: 'normal' | 'italic'
  lineHeight?: number
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
}

export interface SlideComponent {
  id: string
  type: SlideComponentType
  sourceLabel?: string
  x: number
  y: number
  width: number
  height?: number
  content: string
  style: SlideComponentStyle
  locked: boolean
  visible: boolean
}

export interface SlideCanvas {
  width: number
  height: number
  background?: string
}

export interface SlideBackground {
  fill?: string
}

export interface Slide {
  id: string
  elements: SlideComponent[]
  background?: SlideBackground
}

export interface SlideDeck {
  id: string
  width: number
  height: number
  slides: Slide[]
}

export interface SlideDocument {
  version: number
  deck: SlideDeck
  warnings: string[]
}

export interface SlideImportResult {
  document: SlideDocument
  canvas: SlideCanvas
  components: SlideComponent[]
  warnings: string[]
}
