import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { InstitutionProvider } from './context/InstitutionContext';
import { LoadingProvider, useLoading } from './context/LoadingContext';
import { setLoadingCallbacks } from './api/axios';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import SetupAdmin from './pages/SetupAdmin';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SchoolAdminDashboard from './pages/SchoolAdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StaffDashboard from './pages/StaffDashboard';
import Welcome from './pages/Welcome';
import DownloadApp from './pages/DownloadApp';
import DownloadDesktop from './components/DownloadDesktop';
import TemplatesDemo from './pages/TemplatesDemo';
import PrivacyPolicy from './pages/PrivacyPolicy';

// Components
import DriverTracking from './components/dashboard/transport/DriverTracking';
import NotificationRegistration from './components/NotificationRegistration';
import AppUpdateChecker from './components/AppUpdateChecker';
import OfflineBanner from './components/OfflineBanner';

import { Preferences } from '@capacitor/preferences';
import SplashScreen from './components/SplashScreen';

// Protected Route Wrapper
const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [user]);

  if (loading || isChecking) return <SplashScreen />;

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (role) {
    if (Array.isArray(role)) {
      if (!role.includes(user.role)) {
        return <Navigate to="/login" />;
      }
    } else {
      if (user.role !== role) {
        return <Navigate to="/login" />;
      }
    }
  }

  return children;
};
const RootRedirect = () => {
  const { user, loading } = useAuth();
  const [welcomeChecked, setWelcomeChecked] = React.useState(false);
  const [shouldShowWelcome, setShouldShowWelcome] = React.useState(true);

  React.useEffect(() => {
    const checkWelcome = async () => {
      if (loading) return;
      try {
        let shown = false;
        if (Capacitor.isNativePlatform()) {
          const { value } = await Preferences.get({ key: 'welcome_shown' });
          shown = value === 'true';
        } else {
          shown = localStorage.getItem('welcome_shown') === 'true';
        }
        setShouldShowWelcome(!shown);
      } catch (e) {
        console.warn('Welcome check failed', e);
      } finally {
        setWelcomeChecked(true);
      }
    };
    checkWelcome();
  }, [loading]);

  if (loading || !welcomeChecked) return <SplashScreen />;

  if (user) {
    switch (user.role) {
      case 'SUPER_ADMIN': return <Navigate to="/super-admin" />;
      case 'SCHOOL_ADMIN': return <Navigate to="/school-admin" />;
      case 'TEACHER': return <Navigate to="/teacher" />;
      case 'STUDENT': return <Navigate to="/student" />;
      case 'STAFF':
      case 'DRIVER': return <Navigate to="/staff" />;
      default: return <Navigate to="/login" />;
    }
  }

  if (shouldShowWelcome) {
    return <Navigate to="/welcome" />;
  }

  return <Navigate to="/login" />;
};

// Login Redirect Component (If already logged in, go to dashboard)
const LoginRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;

  if (user) {
    switch (user.role) {
      case 'SUPER_ADMIN': return <Navigate to="/super-admin" />;
      case 'SCHOOL_ADMIN': return <Navigate to="/school-admin" />;
      case 'TEACHER': return <Navigate to="/teacher" />;
      case 'STUDENT': return <Navigate to="/student" />;
      case 'STAFF':
      case 'DRIVER': return <Navigate to="/staff" />;
      default: return <Login />;
    }
  }
  return <Login />;
};

// Inner App Component to access LoadingContext
const AppContent = () => {
  const { startLoading, stopLoading } = useLoading();

  React.useEffect(() => {
    // Connect axios interceptors to loading context
    setLoadingCallbacks(startLoading, stopLoading);
  }, [startLoading, stopLoading]);

  React.useEffect(() => {
    // 1. Handle StatusBar
    const setupStatusBar = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setBackgroundColor({ color: '#ffffff' });
          await StatusBar.setStyle({ style: Style.Light });
        } catch (err) {
          console.log('StatusBar plugin issue:', err);
        }
      }
    };

    // 2. Setup Push Notifications
    setupStatusBar();
  }, []);

  return (
    <AuthProvider>
      <InstitutionProvider>
        <NotificationProvider>
          <NotificationRegistration />
          <AppUpdateChecker />
          <OfflineBanner />

          <Router>
            <div className="min-h-screen bg-gray-50">
              <Toaster position="top-center" />
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/login" element={<LoginRedirect />} />
                <Route path="/templates" element={<TemplatesDemo />} />
                <Route path="/download" element={<DownloadApp />} />
                <Route path="/download-desktop" element={<DownloadDesktop />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/setup-admin" element={<SetupAdmin />} />
                <Route path="/super-admin-login" element={<SuperAdminLogin />} />
                <Route
                  path="/super-admin"
                  element={
                    <ProtectedRoute role="SUPER_ADMIN">
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school-admin"
                  element={
                    <ProtectedRoute role="SCHOOL_ADMIN">
                      <SchoolAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher"
                  element={
                    <ProtectedRoute role="TEACHER">
                      <TeacherDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute role="STUDENT">
                      <StudentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute role={["STAFF", "DRIVER"]}>
                      <StaffDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/driver-tracking"
                  element={
                    <ProtectedRoute role={["SCHOOL_ADMIN", "DRIVER", "STAFF"]}>
                      <DriverTracking />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/login" />} />
              </Routes>
            </div>
          </Router>
        </NotificationProvider>
      </InstitutionProvider>
    </AuthProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <LoadingProvider>
        <AppContent />
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export default App;
