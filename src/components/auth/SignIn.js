import React, { useState } from 'react';
import { forgotPassword, forgotPasswordSubmit } from '../../utils/auth';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const result = await signIn(email, password);
    
    setLoading(false);
    
    if (result.success) {
      // 로그인 성공 시 메인 페이지로 이동
      navigate('/');
    } else {
      // 오류 메시지 표시
      if (result.error && result.error.code === 'UserNotConfirmedException') {
        setError('이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.');
      } else if (result.error && result.error.code === 'NotAuthorizedException') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleForgotPasswordRequest = async (e) => {
    e && e.preventDefault();
    setLoading(true);
    setResetError('');
    if (!email) {
      setResetError('이메일을 입력해주세요.');
      setLoading(false);
      return;
    }
    const result = await forgotPassword(email);
    setLoading(false);
    if (result.success) {
      setResetStep(2);
    } else {
      setResetError('이메일 전송 실패');
    }
  };

  const handleResetPassword = async (e) => {
    e && e.preventDefault();
    setLoading(true);
    setResetError('');
    const result = await forgotPasswordSubmit(email, resetCode, resetNewPassword);
    setLoading(false);
    if (result.success) {
      setResetSuccess('비밀번호가 변경되었습니다. 로그인 해주세요.');
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetStep(1);
        setResetCode('');
        setResetNewPassword('');
        setResetError('');
        setResetSuccess('');
      }, 2000);
    } else {
      setResetError('인증코드 또는 비밀번호 오류');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[2160px] min-h-screen">
        <div className="relative h-full min-h-screen">
          {/* Hero background section */}
          <div 
            className="absolute w-full h-full top-0 left-0 bg-gradient-to-b from-sky-300 via-sky-200 to-white"
            style={{
              position: 'relative'
            }}
          >
            {/* 배경 이미지 제거 - 그라데이션 배경만 유지 */}
          </div>

          {/* 로그인/비밀번호 재설정 폼 컨테이너 */}
          <div className="absolute w-full max-w-md top-[150px] left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-gray-200">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                {showForgotPassword ? '비밀번호 재설정' : '로그인'}
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {showForgotPassword
                  ? '이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.'
                  : (<>
                      또는{' '}
                      <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
                        회원가입
                      </Link>
                    </>)}
              </p>
            </div>

            {/* 에러/성공 메시지 */}
            {error && !showForgotPassword && (
              <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {/* 비밀번호 재설정 UI */}
            {showForgotPassword ? (
              <div className="mt-8">
                {resetStep === 1 && (
                  <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                    <input
                      id="reset-email"
                      name="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="이메일 주소"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      {loading ? '처리 중...' : '인증코드 받기'}
                    </button>
                  </form>
                )}
                {resetStep === 2 && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <input
                      id="reset-code"
                      name="reset-code"
                      type="text"
                      required
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="이메일로 받은 인증코드"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                    />
                    <input
                      id="reset-new-password"
                      name="reset-new-password"
                      type="password"
                      required
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="새 비밀번호"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      {loading ? '처리 중...' : '비밀번호 변경'}
                    </button>
                  </form>
                )}
                {resetError && <div className="mt-2 text-red-600 text-sm">{resetError}</div>}
                {resetSuccess && <div className="mt-2 text-green-600 text-sm">{resetSuccess}</div>}
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetStep(1);
                      setResetCode('');
                      setResetNewPassword('');
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    로그인으로 돌아가기
                  </button>
                </div>
              </div>
            ) : (
              // 로그인 폼
              <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
                <div className="rounded-md shadow-sm -space-y-px">
                  <div>
                    <label htmlFor="email-address" className="sr-only">이메일 주소</label>
                    <input
                      id="email-address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="이메일 주소"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="sr-only">비밀번호</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="비밀번호"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                      로그인 상태 유지
                    </label>
                  </div>

                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      비밀번호를 잊으셨나요?
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        처리 중...
                      </span>
                    ) : (
                      '로그인'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn; 