/**
 * AWS Cognito 인증 관련 유틸리티 함수
 */

import { 
  signUp as signUpAuth, 
  confirmSignUp as confirmSignUpAuth, 
  signIn as signInAuth, 
  signOut as signOutAuth, 
  getCurrentUser as getCurrentUserAuth, 
  fetchAuthSession, 
  resetPassword, 
  confirmResetPassword, 
  updateUserAttributes as updateUserAttributesAuth,
  signInWithRedirect
} from 'aws-amplify/auth';
import { Amplify } from 'aws-amplify';
import { Hub } from 'aws-amplify/utils';
import CryptoJS from 'crypto-js';

// CryptoJS 라이브러리 로딩 확인
console.log('CryptoJS 로드 확인:', CryptoJS ? '로드됨' : '미로드');
console.log('HmacSHA256 존재 확인:', CryptoJS.HmacSHA256 ? '존재' : '없음');

// 환경 변수 확인
console.log('환경 변수 확인 (시작)');
console.log('REACT_APP_USER_POOL_ID:', process.env.REACT_APP_USER_POOL_ID);
console.log('REACT_APP_USER_POOL_CLIENT_ID:', process.env.REACT_APP_USER_POOL_CLIENT_ID);
console.log('REACT_APP_CLIENT_SECRET 존재 여부:', process.env.REACT_APP_CLIENT_SECRET ? '존재' : '없음');
console.log('REACT_APP_SECRET_HASH 값:', process.env.REACT_APP_SECRET_HASH);
console.log('환경 변수 확인 (끝)');

// 전역 변수로 클라이언트 시크릿 저장
const CLIENT_SECRET = process.env.REACT_APP_CLIENT_SECRET;
const CLIENT_ID = process.env.REACT_APP_USER_POOL_CLIENT_ID;
const SECRET_HASH = process.env.REACT_APP_SECRET_HASH;

// Cognito 설정
export const configureAuth = () => {
  // 환경 변수에서 Cognito 설정 가져오기
  const userPoolId = process.env.REACT_APP_USER_POOL_ID;
  const userPoolClientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
  const region = process.env.REACT_APP_REGION || 'ap-northeast-2';
  const oauthDomain = process.env.REACT_APP_OAUTH_DOMAIN;
  
  // 리디렉션 URL 파싱 (쉼표로 구분된 URL 목록을 배열로 변환)
  const redirectSignInRaw = process.env.REACT_APP_REDIRECT_SIGN_IN || '';
  const redirectSignOutRaw = process.env.REACT_APP_REDIRECT_SIGN_OUT || '';
  
  const redirectSignIn = redirectSignInRaw.split(',').map(url => url.trim());
  const redirectSignOut = redirectSignOutRaw.split(',').map(url => url.trim());
  
  console.log('Amplify 설정 업데이트 - SPA 모드');
  console.log('사용자 풀 ID:', userPoolId);
  console.log('앱 클라이언트 ID:', userPoolClientId);
  console.log('리디렉션 URL (로그인):', redirectSignIn);
  console.log('리디렉션 URL (로그아웃):', redirectSignOut);
  console.log('OAuth 도메인:', oauthDomain);
  
  // OAuth 도메인이 프로토콜을 포함하고 있는지 확인
  if (oauthDomain && oauthDomain.startsWith('https://')) {
    console.warn('경고: OAuth 도메인에 https:// 접두사가 포함되어 있습니다. 접두사를 제거하세요.');
  }
  
  // Amplify v6 설정
  const config = {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        region,
        identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID,
        loginWith: {
          email: true,
          phone: false,
          username: false,
          oauth: {
            domain: oauthDomain,
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: redirectSignIn,
            redirectSignOut: redirectSignOut,
            responseType: 'code'
          }
        }
      }
    }
  };
  
  console.log('Amplify 설정 적용:', JSON.stringify(config, null, 2));
  Amplify.configure(config);
  
  // 디버깅: Hub 이벤트 리스너 설정
  Hub.listen('auth', (data) => {
    console.log('글로벌 Auth 이벤트:', data.payload.event);
    
    // 오류 이벤트인 경우 상세 로깅
    if (data.payload.event.includes('failure')) {
      console.error('Auth 오류 발생:', data.payload.event);
      console.error('오류 상세 정보:', data.payload.data);
    }
  });
  
  return config;
};

// SECRET_HASH 계산 함수
export const calculateSecretHash = (username, clientId, clientSecret) => {
  console.log('calculateSecretHash 호출됨');
  const message = username + clientId;
  try {
    const hmac = CryptoJS.HmacSHA256(message, clientSecret);
    const base64 = CryptoJS.enc.Base64.stringify(hmac);
    return base64;
  } catch (error) {
    console.error('SECRET_HASH 계산 중 오류 발생:', error);
    return null;
  }
};

// 회원가입
export const signUp = async (email, password, name, birthdate, phoneNumber) => {
  try {
    console.log('회원가입 시작 - 파라미터 준비');
    
    // 회원가입 파라미터 생성
    const params = {
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name,
          birthdate: birthdate, // 사용자가 입력한 생년월일
          phone_number: phoneNumber // 사용자가 입력한 전화번호
        }
      }
    };
    
    console.log('signUp 요청 파라미터:', JSON.stringify(params, (key, val) => 
      key === 'password' ? '***' : val
    ));
    
    // 회원가입 요청
    const result = await signUpAuth(params);
    console.log('회원가입 성공:', result);
    
    return {
      success: true,
      userConfirmed: result.userConfirmed,
      userSub: result.userSub
    };
  } catch (error) {
    console.error('회원가입 오류:', error);
    
    return {
      success: false,
      message: error.message
    };
  }
};

// 회원가입 확인
export const confirmSignUp = async (email, code) => {
  try {
    await confirmSignUpAuth({
      username: email,
      confirmationCode: code
    });

    return { success: true };
  } catch (error) {
    console.error('회원가입 확인 오류:', error);
    return {
      success: false,
      message: error.message,
      code: error.code || 'UnknownError'
    };
  }
};

// 로그인
export const signIn = async (email, password) => {
  try {
    console.log('로그인 시도:', email);
    
    // Amplify signIn 호출
    const signInParams = {
      username: email,
      password
    };
    
    console.log('signIn 파라미터:', JSON.stringify(signInParams, (key, val) => 
      key === 'password' ? '***' : val
    ));
    
    const result = await signInAuth(signInParams);
    console.log('로그인 성공:', result.isSignedIn);
    
    return { success: true, isSignedIn: result.isSignedIn };
  } catch (error) {
    console.error('로그인 오류:', error);
    
    // SECRET_HASH 관련 오류인 경우
    if (error.message && error.message.includes('SECRET_HASH')) {
      console.error('로그인 SECRET_HASH 오류');
      
      // 대안 방법으로 로그인 시도
      try {
        console.log('대안 방법으로 로그인 시도...');
        const response = await fetch('https://cognito-idp.ap-northeast-2.amazonaws.com/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
          },
          body: JSON.stringify({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password,
              SECRET_HASH: calculateSecretHash(
                email, 
                process.env.REACT_APP_USER_POOL_CLIENT_ID, 
                process.env.REACT_APP_CLIENT_SECRET
              )
            }
          })
        });
        
        const data = await response.json();
        console.log('대안 로그인 응답:', data);
        
        if (data.AuthenticationResult) {
          // 세션 저장 로직 추가
          localStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
          localStorage.setItem('idToken', data.AuthenticationResult.IdToken);
          localStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);
          
          return { success: true, isSignedIn: true };
        } else {
          throw new Error('인증 결과가 없습니다');
        }
      } catch (altError) {
        console.error('대안 로그인 실패:', altError);
        return { 
          success: false, 
          message: '로그인 중 오류가 발생했습니다: ' + error.message
        };
      }
    }
    
    // 일반적인 오류 처리
    return { 
      success: false, 
      message: error.message
    };
  }
};

// 소셜 로그인
export const federatedSignIn = async (provider) => {
  try {
    // provider 값을 문자열 타입으로 명시적 변환
    const providerName = String(provider);
    
    console.log(`소셜 로그인 시도: ${providerName}`);
    
    // 현재 URL과 환경 변수 확인
    const currentOrigin = window.location.origin;
    console.log('현재 접속 URL:', currentOrigin);
    console.log('환경 변수의 리디렉션 URL:', process.env.REACT_APP_REDIRECT_SIGN_IN);
    
    // 리디렉션 방식으로 소셜 로그인 시도 - 환경 변수에 설정된 URL 사용
    // Amplify는 자동으로 config에 지정된 redirectSignIn 배열에서 적절한 URL을 선택합니다
    await signInWithRedirect({
      provider: providerName
    });
    
    // 리디렉션되기 때문에 이 코드는 실행되지 않음
    return { success: true };
  } catch (error) {
    console.error('소셜 로그인 오류:', error);
    
    // 친숙한 오류 메시지로 변환
    let errorMessage = error.message;
    if (error.message && error.message.includes('InvalidOriginException')) {
      errorMessage = '리디렉션 URL 불일치 오류: 현재 사용 중인 URL(origin)이 Cognito에 등록되지 않았습니다. AWS Cognito 콘솔에서 앱 클라이언트 설정의 콜백 URL에 ' + 
                    window.location.origin + '/auth/callback 를 추가하세요.';
    }
    
    return { success: false, error: errorMessage };
  }
};

// 로그아웃
export const signOut = async () => {
  try {
    await signOutAuth();
    return { success: true };
  } catch (error) {
    console.error('로그아웃 오류:', error);
    return { success: false, error: error.message };
  }
};

// 현재 사용자 가져오기
export const getCurrentUser = async () => {
  try {
    const user = await getCurrentUserAuth();
    const attributes = await fetchAuthSession();
    return {
      success: true,
      user: {
        id: user.userId,
        username: user.username,
        email: attributes.email,
        name: attributes.name,
        picture: attributes.picture
      }
    };
  } catch (error) {
    // UserUnAuthenticatedException은 정상적인 상황으로 처리
    if (error.name === 'UserUnAuthenticatedException') {
      console.log('사용자가 인증되지 않았습니다.');
      return { success: false, notAuthenticated: true };
    }
    console.error('현재 사용자 가져오기 오류:', error);
    return { success: false, error: error.message };
  }
};

// JWT 토큰 가져오기
export const getJwtToken = async () => {
  try {
    const user = await getCurrentUserAuth();
    const token = user.signInDetails?.tokens?.accessToken?.toString();
    return { success: true, token };
  } catch (error) {
    console.error('JWT 토큰 가져오기 오류:', error);
    return { success: false, error: error.message };
  }
};

// 비밀번호 재설정 요청
export const forgotPassword = async (email) => {
  try {
    await resetPassword({ username: email });
    return { success: true };
  } catch (error) {
    console.error('비밀번호 재설정 요청 오류:', error);
    return { success: false, error: error.message };
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
    return { success: false, error: error.message };
  }
};

// 사용자 속성 업데이트
export const updateUserAttributes = async (attributes) => {
  try {
    await updateUserAttributesAuth({ userAttributes: attributes });
    return { success: true };
  } catch (error) {
    console.error('사용자 속성 업데이트 오류:', error);
    return { success: false, error: error.message };
  }
};

// 인증 이벤트 리스너 설정
export const setupAuthListener = (callback) => {
  // Hub.listen은 리스너를 등록하고 구독 취소 함수를 반환합니다
  const unsubscribe = Hub.listen('auth', callback);
  return unsubscribe;
};

// 회원가입 - 대안 AWS SDK 사용 방법 (Amplify가 SECRET_HASH를 제대로 처리하지 못할 경우)
export const signUpAlternative = async (email, password, name) => {
  try {
    console.log('대안 회원가입 방법 시도 - AWS SDK 사용');
    
    // 현재 날짜를 YYYY-MM-DD 형식으로 변환 (birthdate 속성용)
    const today = new Date();
    const birthdate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // AWS SDK는 프론트엔드에 포함되어 있지 않으므로, AWS Cognito API를 직접 호출하는 방식을 구현합니다
    const clientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
    const clientSecret = process.env.REACT_APP_CLIENT_SECRET;
    const region = process.env.REACT_APP_REGION;
    
    // SECRET_HASH 계산
    const secretHash = calculateSecretHash(email, clientId, clientSecret);
    
    // 회원가입 요청 데이터 구성
    const signUpData = {
      ClientId: clientId,
      Username: email,
      Password: password,
      SecretHash: secretHash,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
        { Name: 'birthdate', Value: birthdate },
        { Name: 'phone_number', Value: '+821012345678' }
      ]
    };
    
    console.log('SignUp 요청 데이터:', JSON.stringify(signUpData, (key, value) => 
      key === 'Password' ? '***' : (key === 'SecretHash' ? value : value)
    ));
    
    // 직접 Cognito API를 호출하는 함수
    // 주의: 클라이언트 측에서 직접 Cognito API를 호출하는 것은 일반적으로 권장되지 않습니다.
    // 이 방법은 임시 해결책으로만 사용하세요.
    const response = await fetch(`https://cognito-idp.${region}.amazonaws.com`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp'
      },
      body: JSON.stringify(signUpData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '회원가입에 실패했습니다.');
    }
    
    const result = await response.json();
    
    return {
      success: true,
      userConfirmed: result.UserConfirmed,
      userSub: result.UserSub
    };
  } catch (error) {
    console.error('대안 회원가입 오류:', error);
    return {
      success: false,
      message: error.message
    };
  }
}; 