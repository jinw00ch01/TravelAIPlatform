import React, { createContext, useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';

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

  // 인증 상태 확인 함수
  const checkAuth = async () => {
    try {
      const result = await getCurrentUser();
      if (result.success && result.user) {
        setAuthState({
          isAuthenticated: true,
          user: result.user,
          isLoading: false,
        });
        return result;
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
        return result;
      }
    } catch (error) {
      console.error('인증 상태 확인 중 오류:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
      return { success: false, error };
    }
  };

  // 초기 인증 상태 확인
  useEffect(() => {
    checkAuth();
  }, []);

  // Auth 이벤트 리스너 설정 (별도의 useEffect로 분리)
  useEffect(() => {
    const authListener = ({ payload }) => {
      console.log('Auth 이벤트 감지:', payload.event);
      
      switch (payload.event) {
        case 'signIn':
          // 로그인 이벤트 처리
          checkAuth();
          break;
        case 'signOut':
          // 로그아웃 이벤트 처리
          setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
          });
          break;
        case 'tokenRefresh':
          // 토큰 갱신 이벤트 처리
          checkAuth();
          break;
        default:
          break;
      }
    };

    // Hub 리스너 등록 및 해제 함수 저장
    const unsubscribe = Hub.listen('auth', authListener);

    return () => {
      // Amplify v6에서는 리스너 제거를 위해 Hub.listen이 반환한 함수를 호출
      unsubscribe();
    };
  }, []);

  // 컨텍스트 값
  const contextValue = {
    ...authState,
    signIn: async (email, password) => {
      const result = await signIn(email, password);
      if (result.success) {
        // 로그인 성공 시 즉시 상태 업데이트
        try {
          const userResult = await getCurrentUser();
          if (userResult.success && userResult.user) {
            setAuthState({
              isAuthenticated: true,
              user: userResult.user,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error('로그인 후 사용자 정보 가져오기 실패:', error);
        }
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