import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
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

// Components
import DriverTracking from './components/dashboard/transport/DriverTracking';
import NotificationRegistration from './components/NotificationRegistration';

import { PushNotifications } from '@capacitor/push-notifications';
import SplashScreen from './components/SplashScreen';

// Protected Route Wrapper
const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) return <SplashScreen />;

  if (!user) {
    if (Capacitor.isNativePlatform()) toast.error("Debug: ProtectedRoute - No User");
    return <Navigate to="/login" />;
  }

  // Create checks
  if (role) {
    if (Array.isArray(role)) {
      if (!role.includes(user.role)) {
        if (Capacitor.isNativePlatform()) toast.error(`Debug: Role Mismatch (Array). User:${user.role} Req:${role.join(',')}`);
        return <Navigate to="/login" />;
      }
    } else {
      if (user.role !== role) {
        if (Capacitor.isNativePlatform()) toast.error(`Debug: Role Mismatch. User:${user.role} Req:${role}`);
        return <Navigate to="/login" />;
      }
    }
  }

  return children;
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
    const setupNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Request permission
          const result = await PushNotifications.requestPermissions();
          if (result.receive === 'granted') {
            await PushNotifications.register();

            // Create High Importance Channel for "WhatsApp-style" heads-up notifications
            await PushNotifications.createChannel({
              id: 'school_notifications',
              name: 'School Notifications',
              importance: 5, // HIGH
              visibility: 1, // PUBLIC
              vibration: true,
            });
          }

          // Listeners
          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            toast.success(notification.title || 'New Notification');
          });

          PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            // Navigate to specific page logic here
            console.log('Push action:', notification);
          });

        } catch (err) {
          console.log('Push Notification setup failed', err);
        }
      }
    };

    setupStatusBar();
    setupNotifications();
  }, []);

  return (
    <AuthProvider>
      <NotificationProvider>
        <NotificationRegistration />
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Toaster position="top-center" />
            <Routes>
              <Route path="/" element={<Navigate to="/welcome" />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/download" element={<DownloadApp />} />
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
