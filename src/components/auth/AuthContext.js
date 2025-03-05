import React, { createContext, useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import {
  getCurrentUser,
  signIn,
  signUp,
  confirmSignUp,
  signOut,
  forgotPassword,
  forgotPasswordSubmit,
  federatedSignIn,
  getJwtToken
} from '../../utils/auth';
import { Hub } from 'aws-amplify/utils';

// 인증 컨텍스트 생성
const AuthContext = createContext(null);

// 인증 컨텍스트 제공자 컴포넌트
export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  // 초기 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await getCurrentUser();
        if (result.success) {
          setAuthState({
            isAuthenticated: true,
            user: result.user,
            isLoading: false,
          });
        } else {
          // 인증되지 않은 사용자는 정상적인 상황으로 처리
          setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('인증 상태 확인 오류:', error);
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
    };

    checkAuth();

    // Amplify 인증 이벤트 리스너 설정
    const hubListener = (data) => {
      const { payload } = data;
      if (payload.event === 'signIn') {
        checkAuth();
      } else if (payload.event === 'signOut') {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
    };

    Hub.listen('auth', hubListener);

    return () => {
      Hub.remove('auth', hubListener);
    };
  }, []);

  // 컨텍스트 값
  const contextValue = {
    ...authState,
    signIn: async (email, password) => {
      const result = await signIn(email, password);
      if (result.success) {
        await checkAuth();
      }
      return result;
    },
    signUp: async (email, password, name) => {
      return await signUp(email, password, name);
    },
    confirmSignUp: async (email, code) => {
      return await confirmSignUp(email, code);
    },
    signOut: async () => {
      const result = await signOut();
      if (result.success) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
      return result;
    },
    forgotPassword: async (email) => {
      return await forgotPassword(email);
    },
    forgotPasswordSubmit: async (email, code, newPassword) => {
      return await forgotPasswordSubmit(email, code, newPassword);
    },
    federatedSignIn: async (provider) => {
      return await federatedSignIn(provider);
    },
    getJwtToken: async () => {
      return await getJwtToken();
    }
  };

  // 인증 상태 확인 함수
  const checkAuth = async () => {
    const result = await getCurrentUser();
    if (result.success) {
      setAuthState({
        isAuthenticated: true,
        user: result.user,
        isLoading: false,
      });
    }
    return result;
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// 인증 컨텍스트 사용 훅
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내에서 사용해야 합니다.');
  }
  return context;
};

// 인증 필요한 컴포넌트 HOC
export const withAuth = (Component) => {
  const WithAuth = (props) => {
    const { isAuthenticated, isLoading } = useAuth();
    
    if (isLoading) {
      return <div>로딩 중...</div>;
    }
    
    if (!isAuthenticated) {
      return <Navigate to="/signin" />;
    }
    
    return <Component {...props} />;
  };
  
  return WithAuth;
};