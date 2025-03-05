import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { forgotPasswordSubmit } from '../../utils/auth';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  
  // URL 쿼리 파라미터에서 이메일 가져오기
  const queryParams = new URLSearchParams(location.search);
  const email = queryParams.get('email');

  const validatePassword = () => {
    if (newPassword.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return false;
    }
    
    if (!/[a-z]/.test(newPassword)) {
      setError('비밀번호는 소문자를 포함해야 합니다.');
      return false;
    }
    
    if (!/[A-Z]/.test(newPassword)) {
      setError('비밀번호는 대문자를 포함해야 합니다.');
      return false;
    }
    
    if (!/[0-9]/.test(newPassword)) {
      setError('비밀번호는 숫자를 포함해야 합니다.');
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }
    
    return true;
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!email) {
      setError('이메일 주소가 필요합니다. 비밀번호 재설정 이메일의 링크를 사용해주세요.');
      setLoading(false);
      return;
    }
    
    if (!code) {
      setError('인증 코드를 입력해주세요.');
      setLoading(false);
      return;
    }
    
    if (!validatePassword()) {
      setLoading(false);
      return;
    }
    
    const result = await forgotPasswordSubmit(email, code, newPassword);
    
    setLoading(false);
    
    if (result.success) {
      setSuccess(true);
      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        navigate('/signin');
      }, 3000);
    } else {
      if (result.error.code === 'CodeMismatchException') {
        setError('인증 코드가 일치하지 않습니다.');
      } else if (result.error.code === 'ExpiredCodeException') {
        setError('인증 코드가 만료되었습니다. 다시 요청해주세요.');
      } else if (result.error.code === 'InvalidPasswordException') {
        setError('비밀번호 형식이 올바르지 않습니다.');
      } else {
        setError('비밀번호 재설정 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            비밀번호 재설정
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            새로운 비밀번호를 입력하고 인증 코드를 확인해주세요.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {success ? (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">
              비밀번호가 성공적으로 재설정되었습니다. 잠시 후 로그인 페이지로 이동합니다.
            </span>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            {!email && (
              <div>
                <label htmlFor="email" className="sr-only">이메일 주소</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="이메일 주소"
                  disabled={!!email}
                  value={email || ''}
                />
              </div>
            )}
            
            <div>
              <label htmlFor="code" className="sr-only">인증 코드</label>
              <input
                id="code"
                name="code"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="인증 코드"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="new-password" className="sr-only">새 비밀번호</label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="새 비밀번호 (8자 이상, 대소문자, 숫자 포함)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="sr-only">비밀번호 확인</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="비밀번호 확인"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
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
                  '비밀번호 재설정'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword; 