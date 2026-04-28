import { useEffect } from 'react'

export interface EditorContextMenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  destructive?: boolean
  onSelect: () => void
}

interface EditorContextMenuProps {
  x: number
  y: number
  items: EditorContextMenuItem[]
  onClose: () => void
}

function getMenuPosition(x: number, y: number) {
  if (typeof window === 'undefined') {
    return { left: x, top: y }
  }

  return {
    left: Math.min(x, window.innerWidth - 232),
    top: Math.min(y, window.innerHeight - 360),
  }
}

export function EditorContextMenu({ x, y, items, onClose }: EditorContextMenuProps) {
  const position = getMenuPosition(x, y)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof HTMLElement && target.closest('.editor-context-menu')) {
        return
      }

      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="editor-context-menu"
      style={{
        left: position.left,
        top: position.top,
      }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.destructive ? 'is-danger' : ''}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) {
              return
            }

            item.onSelect()
            onClose()
          }}
        >
          <span>{item.label}</span>
          {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
        </button>
      ))}
    </div>
  )
}
