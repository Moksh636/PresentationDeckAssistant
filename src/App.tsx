import { Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/feedback/ToastProvider'
import { AppShell } from './components/layout/AppShell'
import { CatchAllRedirect } from './components/auth/CatchAllRedirect'
import { GuestOnlyLayout } from './components/auth/GuestOnlyLayout'
import { MembershipGate } from './components/auth/MembershipGate'
import { OwnerConsoleGuard } from './components/auth/OwnerConsoleGuard'
import { OwnerOnboardingGate } from './components/auth/OwnerOnboardingGate'
import { ProtectedLayout } from './components/auth/ProtectedLayout'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { BuildPresentationPage } from './pages/BuildPresentationPage'
import { CompanyBrainPage } from './pages/CompanyBrainPage'
import { DashboardPage } from './pages/DashboardPage'
import { EditPresentationPage } from './pages/EditPresentationPage'
import { AuthPage } from './pages/AuthPage'
import { JoinCompanyScreen } from './pages/JoinCompanyScreen'
import { LandingPage } from './pages/LandingPage'
import { OwnerDashboardPage } from './pages/OwnerDashboardPage'
import { SignupPage } from './pages/SignupPage'
import { OnboardingCompanyPage } from './pages/onboarding/OnboardingCompanyPage'
import { OnboardingCompanyInfoPage } from './pages/onboarding/OnboardingCompanyInfoPage'
import { OnboardingCompanyKnowledgePage } from './pages/onboarding/OnboardingCompanyKnowledgePage'
import { OnboardingReviewPage } from './pages/onboarding/OnboardingReviewPage'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <WorkspaceProvider>
          <Routes>
            <Route element={<GuestOnlyLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            <Route element={<ProtectedLayout />}>
              <Route path="/join-company" element={<JoinCompanyScreen />} />

              <Route element={<MembershipGate />}>
                <Route element={<OwnerOnboardingGate />}>
                  <Route path="/onboarding/company" element={<OnboardingCompanyPage />} />
                  <Route path="/onboarding/company-info" element={<OnboardingCompanyInfoPage />} />
                  <Route path="/onboarding/company-knowledge" element={<OnboardingCompanyKnowledgePage />} />
                  <Route path="/onboarding/review" element={<OnboardingReviewPage />} />
                </Route>

                <Route element={<AppShell />}>
                  <Route element={<OwnerConsoleGuard />}>
                    <Route path="/owner" element={<OwnerDashboardPage />} />
                  </Route>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/company" element={<CompanyBrainPage />} />
                  <Route path="/build" element={<BuildPresentationPage />} />
                  <Route path="/edit" element={<EditPresentationPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<CatchAllRedirect />} />
          </Routes>
        </WorkspaceProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
