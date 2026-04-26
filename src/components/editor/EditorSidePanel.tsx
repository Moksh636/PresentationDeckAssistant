import type { ReactNode } from 'react'

export type EditorSidePanelMode = 'comments' | 'assistant'

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
  return (
    <aside className={`editor-side-panel editor-side-panel--${mode}`}>
      <div className="editor-side-panel__header">
        <div>
          <span className="section-label">{mode === 'assistant' ? 'AI copilot' : 'Comments'}</span>
          <h3>{mode === 'assistant' ? 'AI Assistant' : 'Slide feedback'}</h3>
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
