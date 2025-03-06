import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Hub } from 'aws-amplify/utils';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // 소셜 로그인 이벤트 처리 리스너 설정
    const authListener = ({ payload }) => {
      switch (payload.event) {
        case 'signIn':
          console.log('사용자 로그인 성공');
          setLoading(false);
          navigate('/');
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

    Hub.listen('auth', authListener);

    // 이미 인증된 경우 홈으로 이동
    if (isAuthenticated) {
      navigate('/');
    }

    return () => {
      Hub.removeListener('auth', authListener);
    };
  }, [navigate, isAuthenticated]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg">소셜 로그인 진행 중...</p>
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