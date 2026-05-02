import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

function clampMenuPosition(menuLeft: number, menuTop: number, menuWidth: number, menuHeight: number) {
  const pad = 8
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = Math.min(menuLeft, vw - menuWidth - pad)
  let top = Math.min(menuTop, vh - menuHeight - pad)

  left = Math.max(pad, left)
  top = Math.max(pad, top)

  return { left, top }
}

export function EditorContextMenu({ x, y, items, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const [offset, setOffset] = useState(() => clampMenuPosition(x, y, 220, 280))

  const recalculate = useCallback(() => {
    const el = menuRef.current

    if (!el) {
      setOffset(clampMenuPosition(x, y, 220, 280))

      return
    }

    const rect = el.getBoundingClientRect()

    setOffset(clampMenuPosition(x, y, rect.width, rect.height))
  }, [x, y])

  useLayoutEffect(() => {
    recalculate()
  }, [recalculate, items, x, y])

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
    window.addEventListener('resize', recalculate)
    window.addEventListener('scroll', recalculate, true)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', recalculate)
      window.removeEventListener('scroll', recalculate, true)
    }
  }, [onClose, recalculate])

  return createPortal(
    <div
      ref={menuRef}
      className="editor-context-menu anchored-popover"
      style={{
        left: offset.left,
        top: offset.top,
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
    </div>,
    document.body,
  )
}
