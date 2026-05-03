import type { ReactNode } from 'react'

export type EditorSidePanelMode =
  | 'comments'
  | 'assistant'
  | 'templates'
  | 'blocks'
  | 'media'
  | 'uploads'

const panelTitles: Record<
  EditorSidePanelMode,
  { label: string; heading: string }
> = {
  assistant: { label: 'AI copilot', heading: 'AI Assistant' },
  comments: { label: 'Comments', heading: 'Slide feedback' },
  templates: { label: 'Templates', heading: 'Slide templates' },
  blocks: { label: 'Blocks', heading: 'Content blocks' },
  media: { label: 'Media', heading: 'Stock media' },
  uploads: { label: 'Uploads', heading: 'Your uploads' },
}

interface EditorSidePanelProps {
  mode: EditorSidePanelMode
  commentCount: number
  onClose: () => void
  children: ReactNode
}

export function EditorSidePanel({
  mode,
  commentCount,
  onClose,
  children,
}: EditorSidePanelProps) {
  const titles = panelTitles[mode]

  return (
    <aside className={`editor-side-panel editor-side-panel--${mode}`}>
      <div className="editor-side-panel__header">
        <div>
          <span className="section-label">{titles.label}</span>
          <h3>{titles.heading}</h3>
        </div>

        <div className="editor-side-panel__header-actions">
          {mode === 'comments' && commentCount > 0 ? <span>{commentCount}</span> : null}
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="editor-side-panel__body">{children}</div>
    </aside>
  )
}
