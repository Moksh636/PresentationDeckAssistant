import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const location = useLocation()
  const isEditorRoute = location.pathname.startsWith('/edit')

  return (
    <div className={`app-shell ${isEditorRoute ? 'app-shell--editor' : ''}`}>
      <Sidebar variant={isEditorRoute ? 'compact' : 'full'} />
      <main className={`content-shell ${isEditorRoute ? 'content-shell--editor' : ''}`}>
        <Outlet />
      </main>
    </div>
  )
}
