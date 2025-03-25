import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * 인증 오류 페이지 컴포넌트
 * 소셜 로그인, 회원가입 등 인증 중 발생한 오류를 표시
 */
const AuthError = () => {
  const [errorInfo, setErrorInfo] = useState({
    code: '',
    message: '',
    description: '',
    timestamp: new Date().toISOString()
  });
  
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // URL 파라미터에서 오류 정보 추출
    const searchParams = new URLSearchParams(location.search);
    const errorCode = searchParams.get('error') || '';
    const errorDescription = searchParams.get('error_description') || '';
    
    // 오류 코드에 따라 사용자 친화적인 메시지 매핑
    let userMessage = '';
    
    switch (errorCode) {
      case 'redirect_mismatch':
        userMessage = '리디렉션 URL이 일치하지 않습니다. 관리자에게 문의하세요.';
        break;
      case 'invalid_request':
        userMessage = '잘못된 요청입니다. 다시 로그인해주세요.';
        break;
      case 'invalid_client':
        userMessage = '클라이언트 인증에 실패했습니다. 관리자에게 문의하세요.';
        break;
      case 'access_denied':
        userMessage = '로그인이 거부되었습니다. 권한을 확인해주세요.';
        break;
      case 'no_code':
        userMessage = '인증 코드가 없습니다. 다시 로그인해주세요.';
        break;
      case 'token_error':
        userMessage = '인증 토큰 발급에 실패했습니다. 다시 시도해주세요.';
        break;
      default:
        userMessage = errorDescription || '인증 중 오류가 발생했습니다. 다시 시도해주세요.';
    }
    
    // 오류 정보 저장
    setErrorInfo({
      code: errorCode,
      message: userMessage,
      description: errorDescription,
      timestamp: new Date().toISOString()
    });
    
    // 개발 환경에서는 콘솔에 오류 정보 출력
    if (process.env.NODE_ENV === 'development') {
      console.error('인증 오류:', {
        code: errorCode,
        description: errorDescription,
        url: window.location.href
      });
    }
  }, [location.search]);
  
  const handleRetry = () => {
    // 로그인 페이지로 이동
    navigate('/signin');
  };
  
  const handleGoHome = () => {
    // 홈으로 이동
    navigate('/');
  };
  
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
        
        <h2 className="text-center text-3xl font-extrabold text-gray-900 mb-4">
          로그인 오류
        </h2>
        
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-lg text-red-700">{errorInfo.message}</p>
          {errorInfo.code && (
            <p className="text-sm text-red-500 mt-1">오류 코드: {errorInfo.code}</p>
          )}
        </div>
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={handleRetry}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            다시 로그인하기
          </button>
          <button
            onClick={handleGoHome}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            홈으로 돌아가기
          </button>
        </div>
        
        {/* 개발 환경에서만 디버그 정보 표시 */}
        {process.env.NODE_ENV === 'development' && errorInfo.description && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <details className="text-sm text-gray-600">
              <summary className="font-medium cursor-pointer">디버그 정보</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto text-xs">
                {JSON.stringify({
                  code: errorInfo.code,
                  description: errorInfo.description,
                  timestamp: errorInfo.timestamp
                }, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthError; 