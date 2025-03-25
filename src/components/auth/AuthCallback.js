import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Hub } from 'aws-amplify/utils';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import axios from 'axios';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debug, setDebug] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    console.log('AuthCallback 컴포넌트 마운트됨');
    console.log('현재 URL:', window.location.href);
    console.log('인증 상태:', isAuthenticated ? '인증됨' : '인증되지 않음');
    
    // URL 파라미터 파싱
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const error_description = searchParams.get('error_description');
    
    console.log('OAuth 콜백 파라미터:', { 
      code: code ? '존재함' : '없음', 
      state: state ? '존재함' : '없음', 
      error,
      error_description
    });
    
    // 디버그 정보 저장
    setDebug(prev => ({
      ...prev,
      hasCode: !!code,
      hasState: !!state,
      errorParam: error,
      errorDescription: error_description,
      callbackUrl: window.location.href,
      timestamp: new Date().toISOString()
    }));
    
    // 오류 파라미터가 있는 경우
    if (error) {
      console.error('OAuth 응답에서 오류 발견:', error, error_description);
      setError(`OAuth 인증 실패: ${error}${error_description ? ` - ${error_description}` : ''}`);
      setLoading(false);
      return;
    }
    
    // 백엔드 서버에 직접 코드 교환 요청 시도 (선택적)
    const exchangeCodeWithBackend = async (authCode) => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
        const response = await axios.get(`${apiUrl}/api/auth/token`, {
          params: {
            code: authCode,
            redirect_uri: window.location.origin + '/auth/callback'
          }
        });
        
        console.log('백엔드 토큰 교환 응답:', response.status);
        setDebug(prev => ({ 
          ...prev, 
          backendExchangeStatus: response.status,
          backendExchangeTime: new Date().toISOString()
        }));
        
        return response.data;
      } catch (err) {
        console.error('백엔드 코드 교환 실패:', err);
        setDebug(prev => ({ 
          ...prev, 
          backendExchangeError: err.message,
          backendExchangeErrorStatus: err.response?.status
        }));
        return null;
      }
    };
    
    // 현재 사용자 확인 시도 - 바로 시도
    const checkUserAndSession = async () => {
      try {
        // 현재 사용자 정보 가져오기 시도
        console.log('getCurrentUser 시도...');
        let user;
        try {
          user = await getCurrentUser();
          console.log('현재 사용자 정보:', user);
          setDebug(prev => ({ ...prev, currentUser: user ? '있음' : '없음' }));
        } catch (userErr) {
          console.log('현재 사용자 정보 가져오기 실패:', userErr);
          setDebug(prev => ({ ...prev, currentUserError: userErr.message }));
        }

        // 세션 정보 가져오기 시도
        console.log('fetchAuthSession 시도...');
        try {
          const session = await fetchAuthSession();
          console.log('현재 세션 정보:', session);
          
          // 세션 정보 디버깅
          const hasTokens = session && session.tokens;
          const idToken = hasTokens && session.tokens.idToken;
          const accessToken = hasTokens && session.tokens.accessToken;
          
          setDebug(prev => ({
            ...prev,
            hasSession: !!session,
            hasTokens: !!hasTokens,
            hasIdToken: !!idToken,
            hasAccessToken: !!accessToken,
            tokenExpiry: accessToken ? accessToken.payload.exp : null
          }));
          
          // 세션이 유효하면 홈으로 이동
          if (hasTokens) {
            console.log('유효한 세션 발견, 홈으로 이동합니다');
            setLoading(false);
            navigate('/');
            return true;
          }
        } catch (sessionErr) {
          console.log('세션 정보 가져오기 실패:', sessionErr);
          setDebug(prev => ({ ...prev, sessionError: sessionErr.message }));
        }
        
        return false;
      } catch (err) {
        console.error('사용자/세션 정보 확인 중 오류:', err);
        setDebug(prev => ({ ...prev, globalError: err.message }));
        return false;
      }
    };
    
    // 코드가 있으면 처리 시작
    if (code) {
      console.log('인증 코드 발견, 세션 확인 시도...');
      
      // 백엔드에 코드 교환 요청 (선택적)
      exchangeCodeWithBackend(code)
        .then(() => checkUserAndSession())
        .catch(err => {
          console.error('토큰 교환 프로세스 오류:', err);
          setDebug(prev => ({ ...prev, tokenExchangeError: err.message }));
        });
      
      // 백엔드 요청과 별개로 Amplify 자체 프로세스도 병행
      checkUserAndSession();
      
      // 몇 초 후에 다시 시도 (토큰 교환에 시간이 걸릴 수 있음)
      setTimeout(() => {
        console.log('세션 재확인 시도...');
        checkUserAndSession().then(isAuthenticated => {
          // 여전히 인증되지 않은 경우
          if (!isAuthenticated && loading) {
            // 사용자가 로그인 프로세스를 더 기다리게 하지 않기 위해 로그인 페이지로 이동
            console.log('재시도 후에도 인증되지 않음, 로그인 페이지로 이동');
            setError('소셜 로그인 처리 중 문제가 발생했습니다. 다른 방법으로 로그인을 시도해보세요.');
            setLoading(false);
          }
        });
      }, 5000);
    } else if (!code && !error) {
      // 코드도 오류도 없는 경우 (예상치 못한 리다이렉트)
      setError('유효한 인증 정보가 없습니다. 다시 로그인해주세요.');
      setLoading(false);
    }
    
    // 소셜 로그인 이벤트 처리 리스너 설정
    const authListener = ({ payload }) => {
      console.log('Auth 이벤트 발생:', payload.event);
      console.log('Auth 이벤트 데이터:', payload.data);
      
      setDebug(prev => ({
        ...prev,
        authEvent: payload.event,
        authEventTime: new Date().toISOString()
      }));
      
      switch (payload.event) {
        case 'signIn':
          console.log('사용자 로그인 성공');
          setLoading(false);
          navigate('/');
          break;
        case 'tokenRefresh':
          console.log('토큰 새로고침 성공');
          setLoading(false);
          navigate('/');
          break;
        case 'signOut':
          console.log('사용자 로그아웃');
          setLoading(false);
          navigate('/signin');
          break;
        case 'signIn_failure':
        case 'signInWithRedirect_failure':
          console.error('로그인 실패:', payload.data);
          setError(payload.data.message || '로그인에 실패했습니다. 다시 시도해주세요.');
          setDebug(prev => ({
            ...prev,
            failureReason: payload.data.message,
            failureStack: payload.data.stack
          }));
          setLoading(false);
          break;
        case 'codeFlow':
        case 'tokenRefresh_failure':
        case 'tokenRefresh_success':
          console.log(payload.event, '이벤트 발생:', payload.data);
          setDebug(prev => ({
            ...prev,
            [payload.event]: payload.data
          }));
          break;
        default:
          console.log('처리되지 않은 Auth 이벤트:', payload.event);
          break;
      }
    };

    // Hub.listen은 구독 취소 함수를 반환합니다
    const unsubscribe = Hub.listen('auth', authListener);

    // 이미 인증된 경우 홈으로 이동
    if (isAuthenticated) {
      console.log('이미 인증된 상태, 홈으로 이동');
      navigate('/');
    }
    
    // 30초 후에도 응답이 없으면 타임아웃 처리
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('인증 프로세스 타임아웃');
        setError('인증 처리 시간이 초과되었습니다. 다시 시도해주세요.');
        setLoading(false);
      }
    }, 30000);

    return () => {
      console.log('AuthCallback 컴포넌트 언마운트됨');
      // Hub.remove 대신 unsubscribe 함수를 호출합니다
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate, isAuthenticated, location.search]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg">소셜 로그인 진행 중...</p>
          <p className="text-sm text-gray-500">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h3 className="text-xl font-bold mb-2">로그인 오류</h3>
          <p className="text-lg mb-4">{error}</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/signin')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              로그인 페이지로 돌아가기
            </button>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              다시 시도
            </button>
          </div>
          
          {/* 디버그 정보 표시 - 개발 환경에서만 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 text-left text-sm bg-gray-100 p-4 rounded">
              <details>
                <summary className="font-bold cursor-pointer">디버그 정보</summary>
                <pre className="whitespace-pre-wrap text-xs mt-2">
                  {JSON.stringify(debug, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback; 