type OwnerSection =
  | 'knowledge-library'
  | 'folder-organizer'
  | 'team-roles'
  | 'brand-kit'
  | 'messaging'
  | 'case-studies'
  | 'products'
  | 'activity-settings'

type OwnerModule = {
  id: OwnerSection
  title: string
  description: string
}

export function OwnerConsoleHome({
  modules,
  onSelectModule,
}: {
  modules: OwnerModule[]
  onSelectModule: (section: OwnerSection) => void
}) {
  return (
    <div className="owner-module-grid">
      {modules.map((module) => (
        <button key={module.id} type="button" className="owner-module-card" onClick={() => onSelectModule(module.id)}>
          <strong>{module.title}</strong>
          <p className="muted-copy">{module.description}</p>
        </button>
      ))}
    </div>
  )
}
