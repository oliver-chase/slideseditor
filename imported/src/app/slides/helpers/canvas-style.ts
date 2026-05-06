import type { CSSProperties } from 'react'

export interface SlidesCanvasGeometry {
  width: number
  height: number
  background?: string | null
}

// Intentional dynamic geometry: canvas and preview dimensions scale with live editor state.
export function buildCanvasStageStyle(canvasHeight: number, canvasScale: number): CSSProperties {
  return {
    height: `${Math.max(1, canvasHeight * canvasScale)}px`,
  }
}

export function buildScaledCanvasStyle(canvas: SlidesCanvasGeometry, canvasScale: number): CSSProperties {
  return {
    width: `${canvas.width}px`,
    height: `${canvas.height}px`,
    background: canvas.background || 'var(--color-bg-card)',
    transform: `scale(${canvasScale})`,
  }
}

export function buildCanvasGuideStyle(axis: 'x' | 'y', guide: number): CSSProperties {
  if (axis === 'x') return { left: `${guide}px` }
  return { top: `${guide}px` }
}

export function buildTemplatePreviewStageStyle(canvas: SlidesCanvasGeometry, scale: number): CSSProperties {
  return {
    width: `${canvas.width}px`,
    height: `${canvas.height}px`,
    background: canvas.background || 'var(--color-bg-card)',
    transform: `scale(${scale})`,
  }
}
