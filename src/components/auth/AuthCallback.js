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
        await exchangeCodeForTokens();
        navigate('/');
      } catch (error) {
        console.error('인증 처리 중 오류 발생:', error);
        navigate('/login');
      }
    };

    handleCallback();
  }, [exchangeCodeForTokens, navigate]);

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