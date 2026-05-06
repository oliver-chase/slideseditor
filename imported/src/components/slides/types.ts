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

export type SlideThemeRole = 'heading' | 'body' | 'accent' | 'surface'
export type SlideLayoutConstraintType = 'stack' | 'row' | 'grid' | 'pinned'
export type SlideLayoutConstraintAlignment = 'left' | 'center' | 'right'

export interface SlideLayoutConstraint {
  type: SlideLayoutConstraintType
  alignment?: SlideLayoutConstraintAlignment
  gap?: number
  columns?: number
  anchorX?: 'left' | 'center' | 'right'
  anchorY?: 'top' | 'center' | 'bottom'
  offsetX?: number
  offsetY?: number
}

export interface SlideTheme {
  fonts: { heading: string; body: string }
  colors: { primary: string; secondary: string; background: string; accent: string }
  spacingScale: Record<string, number>
}

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
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  textAutoSize?: boolean
}

export interface SlideComponent {
  id: string
  type: SlideComponentType
  sourceLabel?: string
  groupId?: string
  groupName?: string
  x: number
  y: number
  width: number
  height?: number
  content: string
  style: SlideComponentStyle
  layoutConstraint?: SlideLayoutConstraint
  themeRole?: SlideThemeRole
  themeLinked?: boolean
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
  theme?: SlideTheme
}

export interface SlideImportResult {
  document: SlideDocument
  canvas: SlideCanvas
  components: SlideComponent[]
  warnings: string[]
}
