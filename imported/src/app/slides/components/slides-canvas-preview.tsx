import type { KeyboardEvent, MutableRefObject, PointerEvent } from 'react'
import type { SlideCanvas, SlideComponent } from '@/components/slides/types'
import {
  buildCanvasComponentStyle,
  sanitizeHtmlContent,
} from '@/app/slides/page-model'
import {
  buildCanvasGuideStyle,
  buildCanvasStageStyle,
  buildScaledCanvasStyle,
} from '@/app/slides/helpers/canvas-style'

type CanvasPreviewResult = {
  canvas: SlideCanvas
  components: SlideComponent[]
}

interface SlidesCanvasPreviewProps {
  result: CanvasPreviewResult
  canvasScale: number
  canvasDimensions: {
    width: number
    height: number
  }
  canvasHostRef: MutableRefObject<HTMLDivElement | null>
  canvasContentRefs: MutableRefObject<Record<string, HTMLDivElement | null>>
  canvasSnapGuides: {
    x: number | null
    y: number | null
  }
  editableComponentTypes: Set<SlideComponent['type']>
  selectedComponentIds: string[]
  selectedComponentsCount: number
  primarySelectedComponentId: string | null
  editingComponentId: string | null
  draggingComponentId: string | null
  resizingComponentId: string | null
  handleCanvasKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  handleCanvasLayerSelect: (componentId: string, options?: { multi?: boolean }) => void
  beginInlineEditMode: (componentId: string) => void
  handleCanvasPointerDown: (component: SlideComponent, event: PointerEvent<HTMLElement>) => void
  handleCanvasPointerMove: (event: PointerEvent<HTMLElement>) => void
  handleCanvasResizeMove: (event: PointerEvent<HTMLElement>) => void
  handleCanvasPointerRelease: (event: PointerEvent<HTMLElement>) => void
  handleResizePointerDown: (component: SlideComponent, event: PointerEvent<HTMLButtonElement>) => void
  handleCanvasContentKeyDown: (component: SlideComponent, event: KeyboardEvent<HTMLDivElement>) => void
  handleCanvasComponentBlur: (component: SlideComponent, event: React.FocusEvent<HTMLDivElement>) => void
}

export function SlidesCanvasPreview({
  result,
  canvasScale,
  canvasDimensions,
  canvasHostRef,
  canvasContentRefs,
  canvasSnapGuides,
  editableComponentTypes,
  selectedComponentIds,
  selectedComponentsCount,
  primarySelectedComponentId,
  editingComponentId,
  draggingComponentId,
  resizingComponentId,
  handleCanvasKeyDown,
  handleCanvasLayerSelect,
  beginInlineEditMode,
  handleCanvasPointerDown,
  handleCanvasPointerMove,
  handleCanvasResizeMove,
  handleCanvasPointerRelease,
  handleResizePointerDown,
  handleCanvasContentKeyDown,
  handleCanvasComponentBlur,
}: SlidesCanvasPreviewProps) {
  return (
    <>
      <section className="slides-editor-header" aria-label="Editor summary">
        <h3 className="slides-summary">
          Editor · Canvas: {result.canvas.width} × {result.canvas.height} · Components: {result.components.length} · Selected: {selectedComponentIds.length}
        </h3>
        <p className="slides-summary-meta">
          Canvas: {result.canvas.width} × {result.canvas.height} · Components: {result.components.length} · Selected: {selectedComponentIds.length}
          {primarySelectedComponentId ? ` · Layer ID: ${primarySelectedComponentId}` : ' · Layer ID: none'}
        </p>
      </section>

      <section className="slides-canvas-preview" aria-labelledby="slides-canvas-heading">
        <div className="slides-canvas-meta">
          <h3 id="slides-canvas-heading">Canvas Preview</h3>
          <p>
            Scaled to viewport at {Math.round(canvasScale * 100)}% while preserving coordinate integrity.
            {primarySelectedComponentId
              ? selectedComponentsCount > 1
                ? ` ${selectedComponentsCount} layers selected.`
                : ` Selected layer: ${primarySelectedComponentId}.`
              : ' Select a layer and use arrow keys to nudge.'}
          </p>
        </div>

        <div className="slides-canvas-host" ref={canvasHostRef}>
          <div
            className="slides-canvas-stage"
            style={buildCanvasStageStyle(canvasDimensions.height, canvasScale)}
          >
            <div
              className="slides-canvas"
              data-slide-canvas="1"
              role="listbox"
              aria-multiselectable="true"
              aria-label="Slide canvas editor"
              aria-describedby="slides-canvas-shortcuts-help"
              tabIndex={0}
              onKeyDown={handleCanvasKeyDown}
              style={buildScaledCanvasStyle({
                width: canvasDimensions.width,
                height: canvasDimensions.height,
                background: result.canvas.background,
              }, canvasScale)}
            >
              {canvasSnapGuides.x !== null && (
                <div
                  className="slides-canvas-guide slides-canvas-guide--vertical"
                  style={buildCanvasGuideStyle('x', canvasSnapGuides.x)}
                  data-snap-guide-axis="x"
                />
              )}
              {canvasSnapGuides.y !== null && (
                <div
                  className="slides-canvas-guide slides-canvas-guide--horizontal"
                  style={buildCanvasGuideStyle('y', canvasSnapGuides.y)}
                  data-snap-guide-axis="y"
                />
              )}
              {result.components.filter((component) => component.visible !== false).map((component) => {
                const isEditable = editableComponentTypes.has(component.type)
                const sanitizedContent = sanitizeHtmlContent(component.content || '')
                const isSelected = selectedComponentIds.includes(component.id)
                const isEditing = editingComponentId === component.id

                return (
                  <article
                    key={component.id}
                    className={
                      'slides-canvas-component slides-canvas-component--' +
                      component.type +
                      (component.locked ? ' is-locked' : '') +
                      (draggingComponentId === component.id ? ' is-dragging' : '') +
                      (resizingComponentId === component.id ? ' is-resizing' : '') +
                      (isSelected ? ' is-selected' : '')
                    }
                    style={buildCanvasComponentStyle(component)}
                    data-component-id={component.id}
                    data-component-type={component.type}
                    data-component-x={String(component.x)}
                    data-component-y={String(component.y)}
                    data-component-width={String(component.width)}
                    data-component-height={typeof component.height === 'number' ? String(component.height) : ''}
                    data-component-auto-size={component.style.textAutoSize ? 'true' : 'false'}
                    data-component-locked={component.locked ? 'true' : 'false'}
                    data-component-selected={isSelected ? 'true' : 'false'}
                    data-component-dragging={draggingComponentId === component.id ? 'true' : 'false'}
                    data-component-resizing={resizingComponentId === component.id ? 'true' : 'false'}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={`${component.type} layer ${component.id}`}
                    tabIndex={0}
                    onClick={(event) => {
                      const target = event.target as HTMLElement
                      if (target.closest('[contenteditable="true"]')) return
                      handleCanvasLayerSelect(component.id, { multi: event.shiftKey })
                    }}
                    onDoubleClick={() => {
                      if (isEditable && !component.locked) beginInlineEditMode(component.id)
                    }}
                    onFocus={(event) => {
                      if (event.target !== event.currentTarget) return
                      handleCanvasLayerSelect(component.id)
                    }}
                    onPointerDown={(event) => handleCanvasPointerDown(component, event)}
                    onPointerMove={(event) => {
                      handleCanvasPointerMove(event)
                      handleCanvasResizeMove(event)
                    }}
                    onPointerUp={handleCanvasPointerRelease}
                    onPointerCancel={handleCanvasPointerRelease}
                  >
                    <div className="slides-canvas-component-type">{component.type}</div>
                    {isSelected && !component.locked && (
                      <button
                        type="button"
                        className="slides-canvas-resize-handle"
                        data-resize-handle="se"
                        aria-label={`Resize ${component.type} layer`}
                        onPointerDown={(event) => handleResizePointerDown(component, event)}
                      />
                    )}
                    <div
                      className={
                        'slides-canvas-component-content' +
                        (isEditable && !component.locked ? '' : ' is-readonly')
                      }
                      ref={(node) => {
                        canvasContentRefs.current[component.id] = node
                      }}
                      contentEditable={isEditable && !component.locked && isEditing}
                      suppressContentEditableWarning
                      onKeyDown={(event) => handleCanvasContentKeyDown(component, event)}
                      onBlur={(event) => handleCanvasComponentBlur(component, event)}
                      aria-label={`${component.type} content`}
                      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                    />
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
