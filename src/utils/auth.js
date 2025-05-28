/**
 * AWS Cognito 인증 관련 유틸리티 함수
 */

import { signUp as signUpAuth, confirmSignUp as confirmSignUpAuth, signIn as signInAuth, signOut as signOutAuth, getCurrentUser as getCurrentUserAuth, fetchAuthSession, resetPassword, confirmResetPassword, updateUserAttributes as updateUserAttributesAuth, decodeJWT } from 'aws-amplify/auth';
import { Amplify } from 'aws-amplify';
import { Hub } from 'aws-amplify/utils';
import CryptoJS from 'crypto-js';

// CryptoJS 라이브러리 로딩 확인
/*
console.log('CryptoJS 로드 확인:', CryptoJS ? '로드됨' : '미로드');
console.log('HmacSHA256 존재 확인:', CryptoJS.HmacSHA256 ? '존재' : '없음');

// 환경 변수 확인
console.log('환경 변수 확인 (시작)');
console.log('REACT_APP_USER_POOL_ID:', process.env.REACT_APP_USER_POOL_ID);
console.log('REACT_APP_USER_POOL_CLIENT_ID:', process.env.REACT_APP_USER_POOL_CLIENT_ID);
console.log('REACT_APP_CLIENT_SECRET 존재 여부:', process.env.REACT_APP_CLIENT_SECRET ? '존재' : '없음');
console.log('REACT_APP_SECRET_HASH 값:', process.env.REACT_APP_SECRET_HASH);
console.log('환경 변수 확인 (끝)');
*/
// 사용하지 않는 상수 제거 또는 주석 처리
// const CLIENT_SECRET = process.env.REACT_APP_CLIENT_SECRET;
// const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
// const SECRET_HASH = process.env.REACT_APP_SECRET_HASH;

// Cognito 설정
export const configureAuth = () => {
  // 환경 변수에서 Cognito 설정 가져오기
  const userPoolId = process.env.REACT_APP_USER_POOL_ID;
  const userPoolClientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
  const region = process.env.REACT_APP_REGION || 'ap-northeast-2';
  
  //console.log('Amplify 설정 업데이트 - SPA 모드');
  //console.log('사용자 풀 ID:', userPoolId);
  //console.log('앱 클라이언트 ID:', userPoolClientId);
  
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
            domain: process.env.REACT_APP_OAUTH_DOMAIN,
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: [process.env.REACT_APP_REDIRECT_SIGN_IN],
            redirectSignOut: [process.env.REACT_APP_REDIRECT_SIGN_OUT],
            responseType: 'code'
          }
        }
      }
    }
  };
  
  //console.log('Amplify 설정 적용:', JSON.stringify(config, null, 2));
  Amplify.configure(config);
  
  return config;
};

// SECRET_HASH 계산 함수
export const calculateSecretHash = (username, clientId, clientSecret) => {
  //console.log('calculateSecretHash 호출됨');
  const message = username + clientId;
  try {
    const hmac = CryptoJS.HmacSHA256(message, clientSecret);
    const base64 = CryptoJS.enc.Base64.stringify(hmac);
    return base64;
  } catch (error) {
    //console.error('SECRET_HASH 계산 중 오류 발생:', error);
    return null;
  }
};

// 회원가입
export const signUp = async (email, password, name, birthdate, phoneNumber) => {
  try {
    //console.log('회원가입 시작 - 파라미터 준비');
    
    // 회원가입 파라미터 생성
    const params = {
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name,
          birthdate: birthdate,
          phone_number: phoneNumber
        }
      }
    };
    

    //console.log('signUp 요청 파라미터:', JSON.stringify(params, (key, val) => 
    //  key === 'password' ? '***' : val
    //));

    // 회원가입 요청
    const result = await signUpAuth(params);
    //console.log('회원가입 성공:', result);
    
    return {
      success: true,
      userConfirmed: result.userConfirmed,
      userSub: result.userSub
    };
  } catch (error) {
    //console.error('회원가입 오류:', error);
    
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
    // console.error('회원가입 확인 오류:', error);
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
    //console.log('로그인 시도:', email);
    
    // Amplify signIn 호출
    const signInParams = {
      username: email,
      password
    };
    
    //console.log('signIn 파라미터:', JSON.stringify(signInParams, (key, val) => 
    //  key === 'password' ? '***' : val
    //));
    
    const result = await signInAuth(signInParams);
    //console.log('로그인 성공:', result.isSignedIn);
    
    return { success: true, isSignedIn: result.isSignedIn };
  } catch (error) {
    //console.error('로그인 오류:', error);
    
    // SECRET_HASH 관련 오류인 경우
    if (error.message && error.message.includes('SECRET_HASH')) {
      //console.error('로그인 SECRET_HASH 오류');
      
      // 대안 방법으로 로그인 시도
      try {
        //console.log('대안 방법으로 로그인 시도...');
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
        //console.log('대안 로그인 응답:', data);
        
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
        //console.error('대안 로그인 실패:', altError);
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
    //console.log(`${provider} 소셜 로그인 시도`);
    
    // provider 문자열을 정규화 (첫 글자 대문자, 나머지 소문자)
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
    
    //console.log(`사용할 provider: ${providerName}`);
    
    // Amplify v6 방식으로 소셜 로그인 구현
    // signInWithRedirect 메서드를 사용해야 하지만 Amplify v6에서는
    // 일반 signIn 메서드와 다른 구성 방식을 사용합니다
    if (providerName === 'Google' || providerName === 'Facebook') {
      // OAuth URL을 직접 구성하여 리디렉션
      const clientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
      const domain = process.env.REACT_APP_OAUTH_DOMAIN;
      const redirectUri = encodeURIComponent(process.env.REACT_APP_REDIRECT_SIGN_IN);
      
      // 현재 페이지 경로를 state로 저장
      const state = encodeURIComponent(JSON.stringify({ 
        path: window.location.pathname,
        provider: providerName
      }));
      
      // OAuth URL 구성
      const oauthUrl = `https://${domain}/oauth2/authorize?identity_provider=${providerName}&redirect_uri=${redirectUri}&response_type=code&client_id=${clientId}&scope=email+openid+profile&state=${state}`;
      
      //console.log(`리디렉션 URL: ${oauthUrl}`);
      
      // 페이지 리디렉션
      window.location.href = oauthUrl;
      
      return { success: true };
    } else {
      throw new Error(`지원하지 않는 소셜 로그인 제공자: ${providerName}`);
    }
  } catch (error) {
    //console.error('소셜 로그인 오류:', error);
    return { 
      success: false, 
      message: error.message || '소셜 로그인 중 오류가 발생했습니다.',
      error 
    };
  }
};

// 로그아웃
export const signOut = async () => {
  try {
    await signOutAuth();
    return { success: true };
  } catch (error) {
    //console.error('로그아웃 오류:', error);
    return { success: false, error: error.message };
  }
};

// 현재 사용자 가져오기
export const getCurrentUser = async () => {
  try {
    //console.log('현재 사용자 정보 가져오기 시도');
    
    // 1. 먼저 세션에서 토큰 정보 확인
    try {
      const session = await fetchAuthSession();
      //console.log('세션 정보 가져오기 성공:', session?.tokens ? '토큰 있음' : '토큰 없음');
      
      // 토큰이 있다면 사용자가 인증된 상태
      if (session?.tokens?.idToken) {
        //console.log('ID 토큰 확인됨');
        
        // 토큰에서 사용자 정보 추출
        const payload = session.tokens.idToken.payload;
        
        // 사용자 정보 구성
        const user = {
          id: payload.sub,
          username: payload.email,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          picture: payload.picture
        };
        
        //console.log('토큰에서 추출한 사용자 정보:', user.email);
        
        return {
          success: true,
          user
        };
      }
    } catch (sessionError) {
      //console.log('세션 정보 가져오기 실패:', sessionError.message);
      // 세션 오류가 있어도 계속 진행하여 getCurrentUserAuth 시도
    }
    
    // 2. 호스팅 UI 로그인 확인
    try {
      if (localStorage.getItem('amplify-signin-with-hostedUI') === 'true') {
        //console.log('호스팅 UI를 통한 로그인 감지됨, 저장된 토큰에서 사용자 정보 추출 시도');
        
        // 클라이언트 ID 가져오기
        const clientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
        if (!clientId) {
          throw new Error('User Pool Client ID가 설정되지 않았습니다.');
        }
        
        // 로컬 스토리지에서 마지막 인증 사용자 가져오기
        const userPoolName = `CognitoIdentityServiceProvider.${clientId}`;
        const lastAuthUser = localStorage.getItem(`${userPoolName}.LastAuthUser`);
        
        if (lastAuthUser) {
          //console.log('마지막 인증 사용자:', lastAuthUser);
          
          // 토큰 가져오기
          const idToken = localStorage.getItem(`${userPoolName}.${lastAuthUser}.idToken`);
          
          if (idToken) {
            //console.log('ID 토큰 발견');
            
            // 토큰 디코딩
            const decodedToken = decodeJWT(idToken);
            const payload = decodedToken.payload;
            
            // 사용자 정보 구성
            const user = {
              id: payload.sub,
              username: payload.email || lastAuthUser,
              email: payload.email || lastAuthUser,
              name: payload.name || (payload.email ? payload.email.split('@')[0] : lastAuthUser),
              picture: payload.picture
            };
            
            //console.log('로컬 스토리지 토큰에서 추출한 사용자 정보:', user.email);
            
            return {
              success: true,
              user
            };
          }
        }
      }
    } catch (localStorageError) {
      //console.error('로컬 스토리지에서 사용자 정보 추출 실패:', localStorageError);
      // 실패해도 계속 진행
    }
    
    // 3. getCurrentUserAuth 시도 (기존 방식)
    try {
      const user = await getCurrentUserAuth();
      //console.log('getCurrentUserAuth 성공:', user.username);
      
      // getCurrentUserAuth에서 속성 정보는 제공하지 않기 때문에
      // 세션에서 추가 정보를 가져오거나 기본값 제공
      return {
        success: true,
        user: {
          id: user.userId,
          username: user.username,
          email: user.username, // Cognito에서는 email을 username으로 사용
          name: user.username.split('@')[0], // 이메일에서 추출한 기본 이름
          picture: null
        }
      };
    } catch (authError) {
      //console.log('getCurrentUserAuth 실패:', authError.message);
      // 실패하면 인증되지 않은 상태로 처리
    }
    
    // 여기까지 왔다면 사용자가 인증되지 않은 상태
    //console.log('사용자가 인증되지 않았습니다.');
    return { success: false, notAuthenticated: true };
  } catch (error) {
    // 모든 오류는 인증되지 않은 상태로 처리
    //console.error('현재 사용자 가져오기 오류:', error);
    return { success: false, error: error.message };
  }
};

// JWT 토큰 가져오기
export const getJwtToken = async () => {
  try {
    // 로컬스토리지에서 먼저 시도
    const localToken = localStorage.getItem('idToken');
    if (localToken) {
      //console.log('로컬스토리지 토큰 사용');
      return { success: true, token: localToken };
    }

    // Amplify 세션에서 추출 시도
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      return { success: true, token: idToken };
    }

    return { success: false, error: '유효한 토큰이 없습니다.', token: null };
  } catch (error) {
    //console.error('JWT 토큰 가져오기 오류:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};


// 비밀번호 재설정 요청
export const forgotPassword = async (email) => {
  try {
    await resetPassword({ username: email });
    return { success: true };
  } catch (error) {
    //console.error('비밀번호 재설정 요청 오류:', error);
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
    //console.error('비밀번호 재설정 확인 오류:', error);
    return { success: false, error: error.message };
  }
};

// 사용자 속성 업데이트
export const updateUserAttributes = async (attributes) => {
  try {
    await updateUserAttributesAuth({ userAttributes: attributes });
    return { success: true };
  } catch (error) {
    //console.error('사용자 속성 업데이트 오류:', error);
    return { success: false, error: error.message };
  }
};

// 인증 이벤트 리스너 설정
export const setupAuthListener = (callback) => {
  return Hub.listen('auth', callback);
};

// 회원가입 - 대안 AWS SDK 사용 방법 (Amplify가 SECRET_HASH를 제대로 처리하지 못할 경우)
export const signUpAlternative = async (email, password, name) => {
  try {
    //console.log('대안 회원가입 방법 시도 - AWS SDK 사용');
    
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
    
    //console.log('SignUp 요청 데이터:', JSON.stringify(signUpData, (key, value) => 
    //  key === 'Password' ? '***' : (key === 'SecretHash' ? value : value)
    //));
    
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
    //console.error('대안 회원가입 오류:', error);
    return {
      success: false,
      message: error.message
    };
  }
}; 