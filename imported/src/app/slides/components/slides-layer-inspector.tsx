import type { Dispatch, SetStateAction } from 'react'
import type { SlideComponent } from '@/components/slides/types'

interface SlidesLayerInspectorProps {
  components: SlideComponent[]
  selectedComponents: SlideComponent[]
  selectedComponentIds: string[]
  setSelectedComponentIds: Dispatch<SetStateAction<string[]>>
  setEditingComponentId: Dispatch<SetStateAction<string | null>>
}

export function SlidesLayerInspector({
  components,
  selectedComponents,
  selectedComponentIds,
  setSelectedComponentIds,
  setEditingComponentId,
}: SlidesLayerInspectorProps) {
  return (
    <details className="slides-layer-inspector" open>
      <summary>
        Layer Inspector · Total {components.length} · Selected {selectedComponents.length}
      </summary>
      <div className="slides-component-grid" role="table" aria-label="Parsed component summary">
        <div className="slides-component-grid-header" role="row">
          <span>Type</span>
          <span>X</span>
          <span>Y</span>
          <span>W</span>
          <span>H</span>
          <span>Source</span>
        </div>
        <div className="slides-component-grid-body">
          {components.map((component) => {
            const isSelected = selectedComponentIds.includes(component.id)
            return (
              <div
                key={component.id}
                className={`slides-component-grid-row${isSelected ? ' is-selected' : ''}`}
                role="row"
                tabIndex={0}
                onClick={(event) => {
                  setEditingComponentId(null)
                  setSelectedComponentIds((previous) => {
                    if (event.metaKey || event.ctrlKey) {
                      return previous.includes(component.id)
                        ? previous.filter((id) => id !== component.id)
                        : [...previous, component.id]
                    }
                    return [component.id]
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setEditingComponentId(null)
                  setSelectedComponentIds([component.id])
                }}
              >
                <span>{component.type}</span>
                <span>{component.x}</span>
                <span>{component.y}</span>
                <span>{component.width}</span>
                <span>{component.height ?? '-'}</span>
                <span>{component.sourceLabel || component.type}</span>
              </div>
            )
          })}
        </div>
      </div>
    </details>
  )
}
