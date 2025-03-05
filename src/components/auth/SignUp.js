import React, { useState } from 'react';
import { signUp, confirmSignUp } from '../../utils/auth';
import { Link, useNavigate } from 'react-router-dom';

const SignUp = () => {
  const [step, setStep] = useState('register'); // 'register', 'confirm'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const validatePassword = () => {
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return false;
    }
    
    if (!/[a-z]/.test(password)) {
      setError('비밀번호는 소문자를 포함해야 합니다.');
      return false;
    }
    
    if (!/[A-Z]/.test(password)) {
      setError('비밀번호는 대문자를 포함해야 합니다.');
      return false;
    }
    
    if (!/[0-9]/.test(password)) {
      setError('비밀번호는 숫자를 포함해야 합니다.');
      return false;
    }
    
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }
    
    return true;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // 비밀번호 유효성 검사
    if (!validatePassword()) {
      setLoading(false);
      return;
    }
    
    const result = await signUp(email, password, name);
    
    setLoading(false);
    
    if (result.success) {
      // 회원가입 성공 시 인증 코드 입력 단계로 이동
      setStep('confirm');
    } else {
      // 오류 메시지 표시
      if (result.error.code === 'UsernameExistsException') {
        setError('이미 가입된 이메일입니다.');
      } else if (result.error.code === 'InvalidPasswordException') {
        setError('비밀번호 형식이 올바르지 않습니다.');
      } else {
        setError('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!confirmationCode) {
      setError('인증 코드를 입력해주세요.');
      setLoading(false);
      return;
    }
    
    const result = await confirmSignUp(email, confirmationCode);
    
    setLoading(false);
    
    if (result.success) {
      // 인증 성공 시 로그인 페이지로 이동
      navigate('/signin', { state: { message: '회원가입이 완료되었습니다. 로그인해주세요.' } });
    } else {
      // 오류 메시지 표시
      if (result.error.code === 'CodeMismatchException') {
        setError('인증 코드가 일치하지 않습니다.');
      } else if (result.error.code === 'ExpiredCodeException') {
        setError('인증 코드가 만료되었습니다. 다시 요청해주세요.');
      } else {
        setError('인증 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 'register' ? '회원가입' : '이메일 인증'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'register' ? (
              <>
                이미 계정이 있으신가요?{' '}
                <Link to="/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
                  로그인
                </Link>
              </>
            ) : (
              '이메일로 전송된 인증 코드를 입력해주세요.'
            )}
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {step === 'register' ? (
          <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="name" className="sr-only">이름</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="email-address" className="sr-only">이메일 주소</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
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
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="비밀번호 (8자 이상, 대소문자, 숫자 포함)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
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
                  '회원가입'
                )}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleConfirmSignUp}>
            <div>
              <label htmlFor="confirmation-code" className="sr-only">인증 코드</label>
              <input
                id="confirmation-code"
                name="confirmation-code"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="인증 코드"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
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
                  '인증 완료'
                )}
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                인증 코드를 받지 못하셨나요?
              </p>
              <button
                type="button"
                onClick={() => setStep('register')}
                className="mt-2 font-medium text-indigo-600 hover:text-indigo-500"
              >
                다시 시도하기
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignUp; 