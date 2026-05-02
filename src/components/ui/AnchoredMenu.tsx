import type { RefObject } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface AnchoredMenuProps {
  isOpen: boolean
  triggerRef: RefObject<HTMLElement | null>
  /** Match trigger left edge (start) or right edge (end), e.g. Present menu */
  align?: 'start' | 'end'
  children: React.ReactNode
  /** Root element role */
  menuRole?: 'menu' | 'presentation'
  className?: string
}

/**
 * Renders menu content in a portal with fixed positioning anchored to `triggerRef`.
 * Parent code should ignore outside clicks via `.anchored-popover` (see EditPresentationPage).
 */
export function AnchoredMenu({
  isOpen,
  triggerRef,
  align = 'start',
  children,
  menuRole = 'menu',
  className,
}: AnchoredMenuProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number }>()

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const popover = popoverRef.current

    if (!trigger || !popover) {
      return
    }

    const triggerRect = trigger.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const edgePadding = 8
    const anchorGap = 6

    let left =
      align === 'end' ? triggerRect.right - popoverRect.width : triggerRect.left

    if (left < edgePadding) {
      left = edgePadding
    }

    if (left + popoverRect.width > viewportWidth - edgePadding) {
      left = Math.max(edgePadding, viewportWidth - popoverRect.width - edgePadding)
    }

    let top = triggerRect.bottom + anchorGap

    if (top + popoverRect.height > viewportHeight - edgePadding) {
      top = Math.max(edgePadding, triggerRect.top - popoverRect.height - anchorGap)
    }

    setPosition({ top, left })
  }, [align, triggerRef])

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }

    updatePosition()
  }, [isOpen, updatePosition])

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, updatePosition])

  if (!isOpen) {
    return null
  }

  const rootClass = ['anchored-popover', className].filter(Boolean).join(' ')

  return createPortal(
    <div
      ref={popoverRef}
      className={rootClass}
      role={menuRole}
      style={
        position
          ? { top: `${position.top}px`, left: `${position.left}px` }
          : { top: '-9999px', left: '-9999px' }
      }
    >
      {children}
    </div>,
    document.body,
  )
}
