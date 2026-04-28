import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/feedback/ToastProvider'
import { AppShell } from './components/layout/AppShell'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { BuildPresentationPage } from './pages/BuildPresentationPage'
import { DashboardPage } from './pages/DashboardPage'
import { EditPresentationPage } from './pages/EditPresentationPage'

function App() {
  return (
    <WorkspaceProvider>
      <ToastProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/build" element={<BuildPresentationPage />} />
            <Route path="/edit" element={<EditPresentationPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </WorkspaceProvider>
  )
}

export default App
