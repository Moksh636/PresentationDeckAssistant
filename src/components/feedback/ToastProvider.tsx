import { useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { createId } from '../../utils/ids'
import { ToastContext, type ToastContextValue, type ToastTone } from './toastContext'

interface Toast {
  id: string
  tone: ToastTone
  message: string
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast: (message, tone = 'info') => {
        const id = createId('toast')

        setToasts((current) => [...current, { id, message, tone }].slice(-4))
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id))
        }, 3600)
      },
    }),
    [],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
