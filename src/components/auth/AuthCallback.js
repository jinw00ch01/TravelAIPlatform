import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Hub } from 'aws-amplify/utils';
import { fetchAuthSession, decodeJWT } from 'aws-amplify/auth';
import axios from 'axios';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, checkAuth } = useAuth();

  // 인증 코드를 토큰으로 교환하는 함수
  const exchangeCodeForTokens = async (code) => {
    try {
      console.log('인증 코드를 토큰으로 교환 시도...');
      
      // Cognito 도메인 및 리다이렉트 URL 설정
      const cognitoDomain = process.env.REACT_APP_OAUTH_DOMAIN;
      const clientId = process.env.REACT_APP_USER_POOL_CLIENT_ID;
      const redirectUri = process.env.REACT_APP_REDIRECT_SIGN_IN;
      const region = process.env.REACT_APP_REGION;
      
      if (!cognitoDomain || !clientId || !redirectUri) {
        throw new Error('필수 Cognito 설정이 누락되었습니다.');
      }
      
      // 토큰 엔드포인트 URL 구성
      const tokenEndpoint = `https://${cognitoDomain}/oauth2/token`;
      
      console.log('토큰 엔드포인트:', tokenEndpoint);
      console.log('클라이언트 ID:', clientId);
      console.log('리다이렉트 URI:', redirectUri);
      
      // 토큰 요청 데이터 구성
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', clientId);
      params.append('code', code);
      params.append('redirect_uri', redirectUri);
      
      // 토큰 교환 요청
      const response = await axios.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // 토큰 추출
      const { id_token, access_token, refresh_token, expires_in } = response.data;
      
      console.log('토큰 교환 성공:', id_token ? '토큰 있음' : '토큰 없음');
      
      if (id_token && access_token) {
        // 토큰 디코딩 및 확인
        const decodedIdToken = decodeJWT(id_token);
        console.log('ID 토큰 디코딩 성공:', decodedIdToken.payload.email);
        
        // 만료 시간 계산
        const expiresAt = new Date().getTime() + expires_in * 1000;
        
        try {
          // Amplify v6에서 인식할 수 있는 형식으로 로컬 스토리지에 토큰 저장
          const userPoolName = `CognitoIdentityServiceProvider.${clientId}`;
          const lastAuthUser = decodedIdToken.payload.email || decodedIdToken.payload.sub;
          
          // 마지막 인증 사용자 저장
          localStorage.setItem(`${userPoolName}.LastAuthUser`, lastAuthUser);
          
          // 각 토큰 저장
          localStorage.setItem(`${userPoolName}.${lastAuthUser}.idToken`, id_token);
          localStorage.setItem(`${userPoolName}.${lastAuthUser}.accessToken`, access_token);
          localStorage.setItem(`${userPoolName}.${lastAuthUser}.refreshToken`, refresh_token);
          localStorage.setItem(`${userPoolName}.${lastAuthUser}.tokenExpires`, expiresAt.toString());
          
          // Amplify 호스팅 UI 플래그 설정
          localStorage.setItem('amplify-signin-with-hostedUI', 'true');
          
          console.log('토큰이 로컬 스토리지에 저장됨');
          
          // 인증 상태 재확인
          setTimeout(async () => {
            try {
              await checkAuth();
              // 홈으로 리디렉션
              navigate('/');
            } catch (error) {
              console.error('인증 상태 확인 실패:', error);
              setError('인증 상태 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
              setLoading(false);
            }
          }, 1000);
          
          return true;
        } catch (storageError) {
          console.error('토큰 저장 오류:', storageError);
          throw storageError;
        }
      } else {
        throw new Error('유효한 토큰이 반환되지 않았습니다');
      }
    } catch (error) {
      console.error('토큰 교환 오류:', error);
      if (error.response) {
        console.error('API 응답:', error.response.data);
      }
      throw error;
    }
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('AuthCallback 마운트됨, URL:', window.location.href);
        
        // URL에서 오류 파라미터 확인
        const urlParams = new URLSearchParams(location.search);
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        
        if (errorParam) {
          console.error('인증 오류 파라미터 발견:', errorParam, errorDescription);
          setError(`인증 오류: ${errorDescription || errorParam}`);
          setLoading(false);
          return;
        }
        
        // 인증 상태 확인
        await checkAuth();
        
        // customState가 있으면 해당 경로로 리디렉션, 없으면 홈으로
        const state = urlParams.get('state');
        let redirectTo = '/';
        
        try {
          if (state) {
            const stateObj = JSON.parse(decodeURIComponent(state));
            redirectTo = stateObj.path || '/';
          }
        } catch (e) {
          console.error('state 파라미터 파싱 오류:', e);
          redirectTo = state && state !== '/' ? state : '/';
        }
        
        console.log('리디렉션 경로:', redirectTo);
        navigate(redirectTo);
      } catch (err) {
        console.error('콜백 처리 오류:', err);
        setError('인증 처리 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    // 인증 코드를 처리하는 함수
    const handleAuthCode = async (code) => {
      try {
        console.log('인증 코드 처리 시작:', code.substring(0, 5) + '...');
        
        try {
          // 인증 코드를 직접 토큰으로 교환 시도
          await exchangeCodeForTokens(code);
          setLoading(false);
          return;
        } catch (tokenError) {
          console.error('토큰 교환 실패, Amplify 세션 확인 시도:', tokenError);
          
          // 토큰 교환이 실패하면 세션 확인 시도
          try {
            console.log('인증 세션 가져오기 시도');
            const session = await fetchAuthSession();
            console.log('인증 세션 가져오기 성공:', session?.tokens ? '토큰 있음' : '토큰 없음');
            
            if (session?.tokens?.idToken) {
              console.log('ID 토큰 확인됨 - 인증이 성공적으로 완료되었습니다');
              await checkAuth();
              console.log('인증 확인 완료, 홈으로 이동합니다');
              navigate('/');
              return;
            } else {
              throw new Error('인증 토큰을 찾을 수 없습니다');
            }
          } catch (sessionError) {
            console.error('인증 세션 가져오기 실패:', sessionError);
            
            // URL에서 필요한 정보 추출
            const urlParams = new URLSearchParams(location.search);
            const state = urlParams.get('state');
            
            // 소셜 로그인 제공자 정보 추출
            let provider = 'Google'; // 기본값
            try {
              if (state) {
                const stateObj = JSON.parse(decodeURIComponent(state));
                if (stateObj.provider) {
                  provider = stateObj.provider;
                }
              }
            } catch (e) {
              console.error('state 파싱 오류:', e);
            }
            
            console.log(`${provider} 로그인 수동 처리 시도 중...`);
            setError('인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('인증 코드 처리 오류:', err);
        setError('인증 코드 처리 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    // 소셜 로그인 이벤트 처리 리스너 설정
    const authListener = ({ payload }) => {
      console.log('Auth 이벤트 발생:', payload.event);
      
      switch (payload.event) {
        case 'signIn':
          console.log('사용자 로그인 성공');
          handleCallback();
          break;
        case 'signOut':
          console.log('사용자 로그아웃');
          setLoading(false);
          navigate('/signin');
          break;
        case 'signIn_failure':
          console.error('사용자 로그인 실패', payload.data);
          setError('로그인에 실패했습니다. 다시 시도해주세요.');
          setLoading(false);
          break;
        default:
          break;
      }
    };

    // Amplify v6에서는 Hub.listen이 리스너 제거 함수를 반환
    const unsubscribe = Hub.listen('auth', authListener);

    // 인증 콜백 코드가 있는 경우 처리
    const code = new URLSearchParams(location.search).get('code');
    if (code) {
      console.log('인증 코드 발견, 처리 중...');
      handleAuthCode(code);
    } else if (isAuthenticated) {
      // 이미 인증된 상태이고 코드가 없는 경우 홈으로 이동
      console.log('이미 인증된 상태, 홈으로 이동');
      navigate('/');
    } else {
      // 콜백 실행
      handleCallback();
    }

    return () => {
      console.log('AuthCallback 언마운트됨');
      // Hub.removeListener 대신 unsubscribe 함수 호출
      unsubscribe();
    };
  }, [navigate, isAuthenticated, location.search, checkAuth]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg">소셜 로그인 처리 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
          <p className="text-lg">{error}</p>
          <button
            onClick={() => navigate('/signin')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback; 