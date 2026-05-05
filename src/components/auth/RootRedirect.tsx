import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export function RootRedirect() {
  const auth = useAuth()

  if (auth.isLoading) {
    return <AuthLoadingScreen />
  }

  if (auth.canAccessApp) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/auth" replace />
}
