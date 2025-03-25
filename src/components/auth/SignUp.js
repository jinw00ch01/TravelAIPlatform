import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp, confirmSignUp, federatedSignIn } from '../../utils/auth';
import { useAuth } from './AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+82');
  const [birthdate, setBirthdate] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  // 이미 로그인한 경우 홈으로 리디렉션
  if (isAuthenticated) {
    navigate('/');
    return null;
  }

  // 소셜 로그인 처리 함수
  const handleSocialSignIn = async (provider) => {
    setLoading(true);
    setError('');
    
    const result = await federatedSignIn(provider);
    
    setLoading(false);
    
    if (!result.success) {
      setError('소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };
  
  const validatePassword = () => {
    // 비밀번호 유효성 검사
    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return false;
    }
    
    // 대문자, 소문자, 숫자 포함 여부 확인
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      setError('비밀번호는 대문자, 소문자, 숫자를 모두 포함해야 합니다.');
      return false;
    }
    
    if (password !== confirmPassword) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
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
    
    // 전화번호 형식 검사
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      setError('전화번호는 국가 코드를 포함해야 합니다 (예: +8210XXXXXXXX)');
      setLoading(false);
      return;
    }
    
    console.log('사용자가 입력한 생년월일:', birthdate);
    
    try {
      // 회원가입 시도
      console.log('회원가입 시도...');
      const result = await signUp(email, password, name, birthdate, phoneNumber);
      
      if (!result.success) {
        // 이미 가입된 사용자인 경우
        if (result.message && (result.message.includes('User already exists') || result.message.includes('already exists'))) {
          setSuccessMessage('이미 가입된 이메일이지만 확인되지 않았습니다. 확인 코드를 입력하세요.');
          setShowConfirmation(true);
          setLoading(false);
          return;
        }
        
        throw result;
      }
      
      if (result.userConfirmed) {
        setSuccessMessage('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setShowConfirmation(true);
        setSuccessMessage('회원가입이 완료되었습니다. 이메일로 전송된 인증 코드를 입력하세요.');
      }
    } catch (result) {
      // 스키마 에러 처리
      if (result.schemaError) {
        setError(`AWS Cognito 사용자 풀 스키마 오류가 발생했습니다.`);
      }
      // 이미 가입된 사용자 처리
      else if (result.message && (result.message.includes('User already exists') || result.message.includes('already exists'))) {
        setSuccessMessage('이미 가입된 이메일이지만 확인되지 않았습니다. 확인 코드를 입력하세요.');
        setShowConfirmation(true);
      }
      // 기타 오류 메시지 표시
      else if (result.error && typeof result.error === 'string' && (result.error.includes('UsernameExistsException') || result.error.includes('already exists'))) {
        setSuccessMessage('이미 가입된 이메일이지만 확인되지 않았습니다. 확인 코드를 입력하세요.');
        setShowConfirmation(true);
      } else if (result.error && typeof result.error === 'string' && result.error.includes('InvalidPasswordException')) {
        setError('비밀번호 형식이 올바르지 않습니다.');
      } else if (result.message && typeof result.message === 'string') {
        setError('회원가입 중 오류가 발생했습니다: ' + result.message);
      } else {
        setError('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await confirmSignUp(email, confirmationCode);
      if (result.success) {
        setSuccessMessage('회원가입이 성공적으로 완료되었습니다.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(`회원가입 확인 실패: ${result.message}`);
      }
    } catch (error) {
      console.error('회원가입 확인 중 예외 발생:', error);
      setError(`회원가입 확인 중 예외 발생: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // 확인 코드 재전송 함수
  const handleResendConfirmationCode = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 간소화된 방법으로 코드 재전송
      const response = await fetch('https://cognito-idp.ap-northeast-2.amazonaws.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.ResendConfirmationCode'
        },
        body: JSON.stringify({
          ClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
          Username: email
        })
      });
      
      const data = await response.json();
      console.log('코드 재전송 응답:', data);
      
      setSuccessMessage('확인 코드가 이메일로 재전송되었습니다. 이메일을 확인해주세요.');
    } catch (error) {
      console.error('확인 코드 재전송 오류:', error);
      setError('확인 코드 재전송 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {showConfirmation ? '이메일 인증' : '회원가입'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {showConfirmation ? (
              '이메일로 전송된 인증 코드를 입력해주세요.'
            ) : (
              <>
                이미 계정이 있으신가요?{' '}
                <Link to="/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
                  로그인
                </Link>
              </>
            )}
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {showConfirmation ? (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">이메일 확인</h3>
            <p className="mb-4 text-sm text-gray-600">
              {email}로 전송된 확인 코드를 입력하세요.
            </p>
            <div className="mb-4">
              <label htmlFor="confirmationCode" className="block text-sm font-medium text-gray-700">
                확인 코드
              </label>
              <input
                type="text"
                id="confirmationCode"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleConfirmSignUp}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={loading}
              >
                {loading ? <LoadingSpinner /> : '확인 완료'}
              </button>
              <button
                type="button"
                onClick={handleResendConfirmationCode}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={loading}
              >
                코드 재전송
              </button>
            </div>
          </div>
        ) : (
          <>
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
                  <label htmlFor="phone-number" className="sr-only">전화번호</label>
                  <input
                    id="phone-number"
                    name="phone-number"
                    type="tel"
                    autoComplete="tel"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="전화번호 (예: +821012345678)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="birthdate" className="sr-only">생년월일</label>
                  <input
                    id="birthdate"
                    name="birthdate"
                    type="date"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
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

            {/* 소셜 로그인 섹션 추가 */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">
                    또는 소셜 계정으로 회원가입
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div>
                  <button
                    onClick={() => handleSocialSignIn('Google')}
                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    type="button"
                  >
                    <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                    </svg>
                    <span className="ml-2">Google</span>
                  </button>
                </div>

                <div>
                  <button
                    onClick={() => handleSocialSignIn('Facebook')}
                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    type="button"
                  >
                    <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-2">Facebook</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SignUp; 