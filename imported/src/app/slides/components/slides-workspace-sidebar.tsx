import { ModuleSidebarHeader } from '@/components/shared/ModuleSidebarHeader'
import type { MouseEvent } from 'react'

type WorkspaceTab = 'import' | 'my-slides' | 'templates'

interface SlidesWorkspaceSidebarProps {
  sidebarOpen: boolean
  title: string
  workspaceTab: WorkspaceTab
  onBackClick: (event: MouseEvent<HTMLAnchorElement>) => void
  onCloseSidebar: () => void
  onWorkspaceTabChange: (tab: WorkspaceTab) => void
}

const SIDEBAR_ITEMS: Array<{ tab: WorkspaceTab; label: string }> = [
  { tab: 'import', label: 'Workspace' },
  { tab: 'my-slides', label: 'My Slides' },
  { tab: 'templates', label: 'Template Library' },
]

export function SlidesWorkspaceSidebar({
  sidebarOpen,
  title,
  workspaceTab,
  onBackClick,
  onCloseSidebar,
  onWorkspaceTabChange,
}: SlidesWorkspaceSidebarProps) {
  return (
    <>
      <div
        className={'sidebar-backdrop' + (sidebarOpen ? ' open' : '')}
        onClick={onCloseSidebar}
        aria-hidden="true"
      />

      <nav className={'app-sidebar' + (sidebarOpen ? ' open' : '')} id="sidebar" aria-label="Slide editor navigation">
        <ModuleSidebarHeader title={title} onBackClick={onBackClick} />

        <div className="app-sidebar-section">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.tab}
              type="button"
              className={'app-sidebar-item' + (workspaceTab === item.tab ? ' active' : '')}
              aria-current={workspaceTab === item.tab ? 'page' : undefined}
              onClick={() => {
                onWorkspaceTabChange(item.tab)
                onCloseSidebar()
              }}
            >
              <span className="app-sidebar-item-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
