import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from './components/auth/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Dashboard from './pages/Dashboard';
import PlanTravel from './pages/PlanTravel';
import ViewItinerary from './pages/ViewItinerary';
import ItineraryManager from './pages/ItineraryManager';
import Cart from './components/Cart';
import MyPage from './pages/MyPage';
import ProtectedRoute from './components/ProtectedRoute';
import { Amplify } from 'aws-amplify';
import { configureAuth } from './utils/auth';

// 인증 컴포넌트
import SignIn from './components/auth/SignIn';
import SignUp from './components/auth/SignUp';
import ResetPassword from './components/auth/ResetPassword';
import AuthCallback from './components/auth/AuthCallback';
import TravelPlanner from './pages/TravelPlanner';

const queryClient = new QueryClient();

// Amplify 설정
Amplify.configure(configureAuth());

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Navigate to="/plan" replace />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/plan" element={<ProtectedRoute><PlanTravel /></ProtectedRoute>} />
                <Route path="/planner" element={<ProtectedRoute><TravelPlanner /></ProtectedRoute>} />
                <Route path="/itinerary" element={<ProtectedRoute><ItineraryManager /></ProtectedRoute>} />
                <Route path="/itinerary/:id" element={<ProtectedRoute><ViewItinerary /></ProtectedRoute>} />
                <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
                <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/plan" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;