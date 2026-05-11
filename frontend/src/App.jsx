import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import LandingPagesPage from "./pages/LandingPagesPage";
import LandingPageFormPage from "./pages/LandingPageFormPage";
import PreviewPage from "./pages/PreviewPage";
import LeadsPage from "./pages/LeadsPage";
import UsersPage from "./pages/UsersPage";
import GoogleAccountPage from "./pages/GoogleAccountPage";
import SEODashboardPage from "./pages/SEODashboardPage";
import PublicLandingPage from "./pages/PublicLandingPage";
import LinkedInPage from "./pages/LinkedInPage";
import FacebookPage from "./pages/FacebookPage";
import YouTubePage from "./pages/YouTubePage";
import SocialHubPage from "./pages/SocialHubPage";

import "./App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes with layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/dashboard" replace />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/landing-pages"
            element={
              <ProtectedRoute>
                <Layout>
                  <LandingPagesPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/landing-pages/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <LandingPageFormPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/landing-pages/:id/edit"
            element={
              <ProtectedRoute>
                <Layout>
                  <LandingPageFormPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/landing-pages/:id/preview"
            element={
              <ProtectedRoute>
                <PreviewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leads"
            element={
              <ProtectedRoute>
                <Layout>
                  <LeadsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Layout>
                  <UsersPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/google-account"
            element={
              <ProtectedRoute>
                <Layout>
                  <GoogleAccountPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/seo-dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <SEODashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/linkedin"
            element={
              <ProtectedRoute>
                <Layout>
                  <LinkedInPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/facebook"
            element={
              <ProtectedRoute>
                <Layout>
                  <FacebookPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* WhatsApp route removed */}
          <Route
            path="/youtube"
            element={
              <ProtectedRoute>
                <Layout>
                  <YouTubePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* Chatbot removed */}
          <Route
            path="/social-hub"
            element={
              <ProtectedRoute>
                <Layout>
                  <SocialHubPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* Public landing page route - no authentication required */}
          <Route path="/p/:slug" element={<PublicLandingPage />} />

          {/* 404 catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
