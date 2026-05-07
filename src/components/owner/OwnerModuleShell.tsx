import type { ReactNode } from 'react'

export function OwnerModuleShell({
  moduleTitle,
  onBack,
  children,
}: {
  moduleTitle?: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="owner-module-layout">
      <div className="owner-module-layout__top">
        <p className="muted-copy">Owner Console / {moduleTitle ?? 'Module'}</p>
        <button type="button" className="ghost-button" onClick={onBack}>
          Back to Owner Home
        </button>
      </div>
      {children}
    </div>
  )
}
