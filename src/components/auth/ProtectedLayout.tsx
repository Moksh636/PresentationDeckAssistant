import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export function ProtectedLayout() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return <AuthLoadingScreen />
  }

  if (!auth.canAccessApp) {
    return <Navigate to="/auth" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <Outlet />
}
