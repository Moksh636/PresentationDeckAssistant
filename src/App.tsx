import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/feedback/ToastProvider'
import { AppShell } from './components/layout/AppShell'
import { ProtectedLayout } from './components/auth/ProtectedLayout'
import { RootRedirect } from './components/auth/RootRedirect'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { BuildPresentationPage } from './pages/BuildPresentationPage'
import { DashboardPage } from './pages/DashboardPage'
import { EditPresentationPage } from './pages/EditPresentationPage'
import { AuthPage } from './pages/AuthPage'

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route element={<ProtectedLayout />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/build" element={<BuildPresentationPage />} />
                <Route path="/edit" element={<EditPresentationPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </WorkspaceProvider>
    </AuthProvider>
  )
}

export default App
