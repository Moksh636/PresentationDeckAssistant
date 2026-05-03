import type { EditorSidePanelMode } from './EditorSidePanel'

const railItems: Array<{
  mode: EditorSidePanelMode
  title: string
  letter: string
}> = [
  { mode: 'templates', title: 'Templates', letter: 'T' },
  { mode: 'blocks', title: 'Blocks', letter: 'B' },
  { mode: 'media', title: 'Media', letter: 'M' },
  { mode: 'uploads', title: 'Uploads', letter: 'U' },
  { mode: 'assistant', title: 'AI assistant', letter: 'A' },
  { mode: 'comments', title: 'Comments', letter: 'C' },
]

interface EditorUtilityRailProps {
  activeMode?: EditorSidePanelMode
  commentCount?: number
  onToggle: (mode: EditorSidePanelMode) => void
}

export function EditorUtilityRail({ activeMode, commentCount = 0, onToggle }: EditorUtilityRailProps) {
  return (
    <aside className="editor-utility-rail" aria-label="Tools">
      {railItems.map((item) => {
        const isActive = activeMode === item.mode
        const showBadge = item.mode === 'comments' && commentCount > 0

        return (
          <button
            key={item.mode}
            type="button"
            className={`editor-utility-rail__btn ${isActive ? 'is-active' : ''}`}
            title={item.title}
            aria-pressed={isActive}
            onClick={() => onToggle(item.mode)}
          >
            <span className="editor-utility-rail__glyph" aria-hidden>
              {item.letter}
            </span>
            {showBadge ? (
              <span className="editor-utility-rail__badge">{commentCount > 99 ? '99+' : commentCount}</span>
            ) : null}
          </button>
        )
      })}
    </aside>
  )
}
