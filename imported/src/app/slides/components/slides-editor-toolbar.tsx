import type { Dispatch, SetStateAction } from 'react'
import CustomPicker from '@/components/shared/CustomPicker'
import type { SlideComponent, SlideLayoutConstraint } from '@/components/slides/types'
import type { CanvasEditorNotice } from '@/app/slides/page-model'

type SelectedBounds = {
  x: number
  y: number
  width: number
  height: number
}

type SelectedStyle = SlideComponent['style']

interface SlidesEditorToolbarProps {
  selectedBounds: SelectedBounds | null
  selectedStyle: SelectedStyle | null
  selectedComponentIds: string[]
  autoSizeEnabledForSelection: boolean
  autoSizeMixedSelection: boolean
  autoSizeEligibleSelection: SlideComponent[]
  defaultTextColor: string
  defaultBackgroundColor: string
  minComponentWidth: number
  minComponentHeight: number
  minFontSize: number
  historyPastLength: number
  historyFutureLength: number
  layoutConstraintDraft: SlideLayoutConstraint
  setLayoutConstraintDraft: Dispatch<SetStateAction<SlideLayoutConstraint>>
  editorNotice: CanvasEditorNotice | null
  applyBoundsToSelection: (bounds: Partial<SelectedBounds>) => void
  applyStyleToSelection: (style: Partial<SelectedStyle>) => void
  handleUndo: () => void
  handleRedo: () => void
  alignSelection: (alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void
  distributeSelection: (axis: 'horizontal' | 'vertical') => void
  reorderSelection: (direction: 'backward' | 'forward' | 'back' | 'front') => void
  groupSelection: () => void
  ungroupSelection: () => void
  handleSetSelectionLocked: (locked: boolean) => Promise<unknown> | unknown
  duplicateSelection: () => void
  deleteSelection: () => void
  applyLayoutConstraintSelection: (constraint: SlideLayoutConstraint) => void
}

export function SlidesEditorToolbar({
  selectedBounds,
  selectedStyle,
  selectedComponentIds,
  autoSizeEnabledForSelection,
  autoSizeMixedSelection,
  autoSizeEligibleSelection,
  defaultTextColor,
  defaultBackgroundColor,
  minComponentWidth,
  minComponentHeight,
  minFontSize,
  historyPastLength,
  historyFutureLength,
  layoutConstraintDraft,
  setLayoutConstraintDraft,
  editorNotice,
  applyBoundsToSelection,
  applyStyleToSelection,
  handleUndo,
  handleRedo,
  alignSelection,
  distributeSelection,
  reorderSelection,
  groupSelection,
  ungroupSelection,
  handleSetSelectionLocked,
  duplicateSelection,
  deleteSelection,
  applyLayoutConstraintSelection,
}: SlidesEditorToolbarProps) {
  return (
    <>
      <section className="slides-editor-toolbar" aria-label="Layer editing controls">
        <div className="slides-editor-groups">
          <div className="slides-editor-group">
            <h4>Position</h4>
            <div className="slides-editor-toolbar-row slides-editor-toolbar-row--inputs">
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-x">
                <span>X</span>
                <input id="slides-style-x" type="number" step={1} value={selectedBounds?.x ?? 0} onChange={(event) => applyBoundsToSelection({ x: Number(event.target.value) })} disabled={!selectedBounds} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-y">
                <span>Y</span>
                <input id="slides-style-y" type="number" step={1} value={selectedBounds?.y ?? 0} onChange={(event) => applyBoundsToSelection({ y: Number(event.target.value) })} disabled={!selectedBounds} />
              </label>
            </div>
          </div>

          <div className="slides-editor-group">
            <h4>Size</h4>
            <div className="slides-editor-toolbar-row slides-editor-toolbar-row--inputs">
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-width">
                <span>Width</span>
                <input id="slides-style-width" type="number" min={minComponentWidth} step={1} value={selectedBounds?.width ?? minComponentWidth} onChange={(event) => applyBoundsToSelection({ width: Number(event.target.value) })} disabled={!selectedBounds} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-height">
                <span>Height</span>
                <input id="slides-style-height" type="number" min={minComponentHeight} step={1} value={selectedBounds?.height ?? minComponentHeight} onChange={(event) => applyBoundsToSelection({ height: Number(event.target.value) })} disabled={!selectedBounds || selectedStyle?.textAutoSize === true} />
              </label>
            </div>
          </div>

          <div className="slides-editor-group">
            <h4>Typography</h4>
            <div className="slides-editor-toolbar-row slides-editor-toolbar-row--inputs">
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-font-size">
                <span>Font size</span>
                <input id="slides-style-font-size" type="number" min={minFontSize} step={1} value={selectedStyle?.fontSize ?? minFontSize} onChange={(event) => applyStyleToSelection({ fontSize: Number.isFinite(Number(event.target.value)) ? Math.max(minFontSize, Number(event.target.value)) : minFontSize })} disabled={selectedComponentIds.length === 0} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-font-weight">
                <span>Weight</span>
                <CustomPicker
                  options={[
                    { value: '400', label: '400' },
                    { value: '500', label: '500' },
                    { value: '600', label: '600' },
                    { value: '700', label: '700' },
                  ]}
                  selected={String(selectedStyle?.fontWeight ?? 400)}
                  onChange={(value) => applyStyleToSelection({ fontWeight: Number(Array.isArray(value) ? value[0] : value) })}
                  disabled={selectedComponentIds.length === 0}
                  searchable={false}
                  showUnassigned={false}
                  triggerClassName="slides-select"
                />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-align">
                <span>Text align</span>
                <CustomPicker
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                    { value: 'justify', label: 'Justify' },
                  ]}
                  selected={selectedStyle?.textAlign ?? 'left'}
                  onChange={(value) => applyStyleToSelection({ textAlign: (Array.isArray(value) ? value[0] : value) as SlideComponent['style']['textAlign'] })}
                  disabled={selectedComponentIds.length === 0}
                  searchable={false}
                  showUnassigned={false}
                  triggerClassName="slides-select"
                />
              </label>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => applyStyleToSelection({ fontStyle: selectedStyle?.fontStyle === 'italic' ? 'normal' : 'italic' })} disabled={selectedComponentIds.length === 0}>
                {selectedStyle?.fontStyle === 'italic' ? 'Remove Italic' : 'Italic'}
              </button>
            </div>
          </div>

          <div className="slides-editor-group">
            <h4>Appearance</h4>
            <div className="slides-editor-toolbar-row slides-editor-toolbar-row--inputs">
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-color">
                <span>Text color</span>
                <input id="slides-style-color" type="color" value={selectedStyle?.color ?? defaultTextColor} onChange={(event) => applyStyleToSelection({ color: event.target.value })} disabled={selectedComponentIds.length === 0} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-style-background">
                <span>Background</span>
                <input id="slides-style-background" type="color" value={selectedStyle?.backgroundColor ?? defaultBackgroundColor} onChange={(event) => applyStyleToSelection({ backgroundColor: event.target.value })} disabled={selectedComponentIds.length === 0} />
              </label>
              <label className="module-field-control slides-editor-field slides-editor-field--checkbox" htmlFor="slides-style-text-auto-size">
                <span>Text Auto Size</span>
                <input id="slides-style-text-auto-size" type="checkbox" checked={autoSizeEnabledForSelection} aria-label="Text Auto Size" title={autoSizeMixedSelection ? 'Mixed selection: enabling will normalize selected text layers.' : ''} onChange={(event) => applyStyleToSelection({ textAutoSize: event.target.checked })} disabled={autoSizeEligibleSelection.length === 0} />
              </label>
            </div>
          </div>

          <div className="slides-editor-group">
            <h4>Arrange</h4>
            <div className="slides-editor-toolbar-row">
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => handleUndo()} disabled={historyPastLength === 0}>Undo</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => handleRedo()} disabled={historyFutureLength === 0}>Redo</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => alignSelection('left')} disabled={selectedComponentIds.length < 2}>Align Left</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => alignSelection('center-x')} disabled={selectedComponentIds.length < 2}>Align Center</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => alignSelection('right')} disabled={selectedComponentIds.length < 2}>Align Right</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => alignSelection('top')} disabled={selectedComponentIds.length < 2}>Align Top</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => alignSelection('center-y')} disabled={selectedComponentIds.length < 2}>Align Middle</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => alignSelection('bottom')} disabled={selectedComponentIds.length < 2}>Align Bottom</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => distributeSelection('horizontal')} disabled={selectedComponentIds.length < 2}>Distribute H</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => distributeSelection('vertical')} disabled={selectedComponentIds.length < 2}>Distribute V</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => reorderSelection('backward')} disabled={selectedComponentIds.length === 0}>Send Back</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => reorderSelection('forward')} disabled={selectedComponentIds.length === 0}>Bring Forward</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => reorderSelection('back')} disabled={selectedComponentIds.length === 0}>Send to Back</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => reorderSelection('front')} disabled={selectedComponentIds.length === 0}>Bring to Front</button>
            </div>
          </div>

          <div className="slides-editor-group slides-editor-group-actions">
            <h4>Object actions</h4>
            <div className="slides-editor-toolbar-row">
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => groupSelection()} disabled={selectedComponentIds.length < 2}>Group</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => ungroupSelection()} disabled={selectedComponentIds.length === 0}>Ungroup</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => { void handleSetSelectionLocked(true) }} disabled={selectedComponentIds.length === 0}>Lock</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => { void handleSetSelectionLocked(false) }} disabled={selectedComponentIds.length === 0}>Unlock</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => duplicateSelection()} disabled={selectedComponentIds.length === 0}>Duplicate</button>
              <span className="slides-danger-divider" aria-hidden="true" />
              <button type="button" className="btn btn-sm btn-danger btn--compact" onClick={() => deleteSelection()} disabled={selectedComponentIds.length === 0}>Delete</button>
            </div>
          </div>
        </div>

        <div className="slides-editor-toolbar-row slides-editor-toolbar-row--inputs">
          <label className="module-field-control slides-editor-field" htmlFor="slides-layout-constraint-type">
            <span>Layout</span>
            <CustomPicker
              options={[
                { value: 'stack', label: 'Stack' },
                { value: 'row', label: 'Row' },
                { value: 'grid', label: 'Grid' },
                { value: 'pinned', label: 'Pinned' },
              ]}
              selected={layoutConstraintDraft.type}
              onChange={(value) => setLayoutConstraintDraft((draft) => ({ ...draft, type: (Array.isArray(value) ? value[0] : value) as SlideLayoutConstraint['type'] }))}
              disabled={selectedComponentIds.length === 0}
              searchable={false}
              showUnassigned={false}
              triggerClassName="slides-select"
            />
          </label>
          <input id="slides-layout-constraint-alignment" type="hidden" value={layoutConstraintDraft.alignment ?? 'left'} readOnly />
          <div className="slides-inline-actions" role="group" aria-label="Layout alignment">
            {[
              { value: 'left', label: 'Align Layout Left' },
              { value: 'center', label: 'Align Layout Center' },
              { value: 'right', label: 'Align Layout Right' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={'btn btn-sm btn-ghost btn--compact' + ((layoutConstraintDraft.alignment ?? 'left') === option.value ? ' active' : '')}
                aria-label={option.label}
                aria-pressed={(layoutConstraintDraft.alignment ?? 'left') === option.value}
                onClick={() => setLayoutConstraintDraft((draft) => ({ ...draft, alignment: option.value as SlideLayoutConstraint['alignment'] }))}
                disabled={selectedComponentIds.length === 0 || layoutConstraintDraft.type === 'pinned'}
              >
                {option.value}
              </button>
            ))}
          </div>
          <label className="module-field-control slides-editor-field" htmlFor="slides-layout-constraint-gap">
            <span>Gap</span>
            <input
              id="slides-layout-constraint-gap"
              type="number"
              min={0}
              step={1}
              value={layoutConstraintDraft.gap ?? 16}
              onChange={(event) => setLayoutConstraintDraft((draft) => ({ ...draft, gap: Number(event.target.value) }))}
              disabled={selectedComponentIds.length === 0 || layoutConstraintDraft.type === 'pinned'}
            />
          </label>
          <label className="module-field-control slides-editor-field" htmlFor="slides-layout-constraint-columns">
            <span>Columns</span>
            <input
              id="slides-layout-constraint-columns"
              type="number"
              min={1}
              step={1}
              value={layoutConstraintDraft.columns ?? 2}
              onChange={(event) => setLayoutConstraintDraft((draft) => ({ ...draft, columns: Number(event.target.value) }))}
              disabled={selectedComponentIds.length === 0 || layoutConstraintDraft.type !== 'grid'}
            />
          </label>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn--compact"
            onClick={() => applyLayoutConstraintSelection(layoutConstraintDraft)}
            disabled={selectedComponentIds.length === 0}
          >
            Apply Layout
          </button>
        </div>
      </section>

      <details className="slides-shortcuts">
        <summary>Keyboard Shortcuts</summary>
        <ul id="slides-canvas-shortcuts-help">
          <li>Tab to focus a layer, Enter to start inline text editing, Escape to exit editing/selection.</li>
          <li>Arrow keys nudge selected layers by 1px. Use Shift+Arrow for 10px.</li>
          <li>Alt+Arrow resizes selected layers by 1px. Use Alt+Shift+Arrow for 10px.</li>
          <li>Shift+click toggles multi-select. Ctrl/Cmd+A selects all visible layers.</li>
          <li>PageUp/PageDown cycles layer selection.</li>
          <li>Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl/Cmd+Y redo.</li>
          <li>Ctrl/Cmd+[, Ctrl/Cmd+] move selected layers back/forward in stack order.</li>
          <li>Ctrl/Cmd+D duplicates selected layers. Delete/Backspace removes selected layers.</li>
        </ul>
      </details>

      {editorNotice && (
        <p className={'slides-editor-notice' + (editorNotice.tone === 'error' ? ' is-error' : '')} role={editorNotice.tone === 'error' ? 'alert' : 'status'}>
          {editorNotice.text}
        </p>
      )}
    </>
  )
}
