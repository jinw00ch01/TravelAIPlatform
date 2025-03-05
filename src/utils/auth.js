/**
 * AWS Cognito 인증 관련 유틸리티 함수
 */

import { Amplify } from 'aws-amplify';
import { 
  signIn as signInAuth, 
  signUp as signUpAuth, 
  signOut as signOutAuth, 
  confirmSignUp as confirmSignUpAuth,
  getCurrentUser as getCurrentUserAuth,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
  updateUserAttributes as updateUserAttributesAuth,
  signInWithRedirect
} from 'aws-amplify/auth';

// Cognito 설정
export const configureAuth = () => {
  // 환경 변수에서 Cognito 설정 가져오기
  const userPoolId = process.env.REACT_APP_USER_POOL_ID;
  const userPoolWebClientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
  const region = process.env.REACT_APP_REGION || 'ap-northeast-2';
  
  // Amplify v6 설정 - 소셜 로그인 설정 포함
  return {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: userPoolWebClientId,
        region,
        loginWith: {
          oauth: {
            domain: process.env.REACT_APP_OAUTH_DOMAIN,
            scopes: ['email', 'profile', 'openid', 'aws.cognito.signin.user.admin'],
            redirectSignIn: [window.location.origin],
            redirectSignOut: [window.location.origin],
            responseType: 'code'
          }
        }
      }
    }
  };
};

// 회원가입
export const signUp = async (email, password, name) => {
  try {
    const { user } = await signUpAuth({
      username: email,
      password,
      attributes: {
        email,
        name
      }
    });
    return { success: true, user };
  } catch (error) {
    console.error('회원가입 오류:', error);
    return { success: false, error };
  }
};

// 회원가입 확인 (이메일 인증 코드 확인)
export const confirmSignUp = async (email, code) => {
  try {
    await confirmSignUpAuth({
      username: email,
      confirmationCode: code
    });
    return { success: true };
  } catch (error) {
    console.error('회원가입 확인 오류:', error);
    return { success: false, error };
  }
};

// 로그인
export const signIn = async (email, password) => {
  try {
    const user = await signInAuth({
      username: email,
      password
    });
    return { success: true, user };
  } catch (error) {
    console.error('로그인 오류:', error);
    return { success: false, error };
  }
};

// 소셜 로그인
export const federatedSignIn = async (provider) => {
  try {
    await signInWithRedirect({
      provider: provider
    });
    return { success: true };
  } catch (error) {
    console.error('소셜 로그인 오류:', error);
    return { success: false, error };
  }
};

// 로그아웃
export const signOut = async () => {
  try {
    await signOutAuth();
    return { success: true };
  } catch (error) {
    console.error('로그아웃 오류:', error);
    return { success: false, error };
  }
};

// 현재 인증된 사용자 가져오기
export const getCurrentUser = async () => {
  try {
    const user = await getCurrentUserAuth();
    return { success: true, user };
  } catch (error) {
    // UserUnAuthenticatedException은 정상적인 상황으로 처리
    if (error.name === 'UserUnAuthenticatedException') {
      return { success: false, error, notAuthenticated: true };
    }
    console.error('현재 사용자 가져오기 오류:', error);
    return { success: false, error };
  }
};

// JWT 토큰 가져오기
export const getJwtToken = async () => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens.idToken.toString();
    return { success: true, token };
  } catch (error) {
    console.error('JWT 토큰 가져오기 오류:', error);
    return { success: false, error };
  }
};

// 비밀번호 재설정 요청
export const forgotPassword = async (email) => {
  try {
    await resetPassword({
      username: email
    });
    return { success: true };
  } catch (error) {
    console.error('비밀번호 재설정 요청 오류:', error);
    return { success: false, error };
  }
};

// 비밀번호 재설정 확인
export const forgotPasswordSubmit = async (email, code, newPassword) => {
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword
    });
    return { success: true };
  } catch (error) {
    console.error('비밀번호 재설정 확인 오류:', error);
    return { success: false, error };
  }
};

// 사용자 속성 업데이트
export const updateUserAttributes = async (attributes) => {
  try {
    await updateUserAttributesAuth({
      userAttributes: attributes
    });
    return { success: true };
  } catch (error) {
    console.error('사용자 속성 업데이트 오류:', error);
    return { success: false, error };
  }
};

// 인증 상태 변경 리스너 설정
export const setupAuthListener = (callback) => {
  return getCurrentUserAuth()
    .then(user => callback({ isAuthenticated: true, user }))
    .catch(() => callback({ isAuthenticated: false, user: null }));
}; 