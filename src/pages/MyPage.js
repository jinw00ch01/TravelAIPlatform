import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/auth/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// API 엔드포인트 설정 - 환경변수에서 가져오기
const API_URL = process.env.REACT_APP_API_URL || 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/';
const MY_PAGE_API_URL = `${API_URL}api/user/mypage`;
const USER_PROFILE_API_URL = `${API_URL}api/user/profile`;

// 개발 환경에서 사용할 더미 데이터
const DUMMY_USER_DATA = {
  name: 'user-dev',
  email: 'user-dev@email.com',
  phoneNumber: '+8200000000000',
  birthdate: '2000-01-01',
  stats: {
    totalTrips: 10,
    countries: 5,
    reviews: 20
  }
};

const DUMMY_BOOKINGS = [
      {
        id: 1,
        title: '제주도 호텔',
        type: '숙박',
        date: '2026-03-15',
        status: '예정',
        price: '150,000원',
        location: '제주시'
      },
      {
        id: 2,
        title: '부산 해운대 호텔',
        type: '숙박',
        date: '2024-02-20',
        status: '완료',
        price: '180,000원',
        location: '해운대구'
      },
      {
        id: 3,
        title: '서울 강남 호텔',
        type: '숙박',
        date: '2024-02-25',
        status: '진행 중',
        price: '200,000원',
        location: '강남구'
      },
      {
        id: 4,
        title: '제주도 렌터카',
        type: '렌터카',
        date: '2026-03-15',
        status: '예정',
        price: '80,000원',
        location: '제주공항'
      },
      {
        id: 5,
        title: '부산 해운대 투어',
        type: '투어',
        date: '2024-02-21',
        status: '완료',
        price: '50,000원',
        location: '해운대'
      }
    ];

const MyPage = () => {
  const { user, logout, getJwtToken } = useAuth();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: '',
    birthdate: ''
  });
  const [bookings, setBookings] = useState([]);
  const [notification, setNotification] = useState(null);
  const [apiResponseReceived, setApiResponseReceived] = useState(false);
  const [travelStats, setTravelStats] = useState({
    myPlansCount: 0,
    paidPlansCount: 0,
    sharedPlansCount: 0
  });

  // 개발 환경에서 skipAuth 확인 - 정확히 문자열 비교
  const isSkipAuth = process.env.REACT_APP_SKIP_AUTH === 'true';
  
  console.log('환경 변수 확인:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('REACT_APP_SKIP_AUTH:', process.env.REACT_APP_SKIP_AUTH);
  console.log('isSkipAuth 계산값:', isSkipAuth);

  // 알림 표시 함수
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    // 5초 후 알림 자동 제거
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // 여행 통계 데이터 가져오기
  const fetchTravelStats = async () => {
    try {
      console.log('여행 통계 데이터 가져오기 시작');
      
      const tokenData = await getJwtToken();
      const token = tokenData?.token;
      
      if (!token) {
        console.warn('토큰이 없어 여행 통계를 가져올 수 없습니다.');
        return;
      }

      const response = await axios.post(
        'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/checklist',
        { mode: 'list' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.success && response.data.plans) {
        const plans = response.data.plans;
        
        // 내 계획 수 (공유받은 것 제외)
        const myPlansCount = plans.filter(plan => !plan.is_shared_with_me).length;
        
        // 결제된 계획 수 (공유받은 것 제외)
        const paidPlansCount = plans.filter(plan => 
          !plan.is_shared_with_me && (plan.paid_plan === 1 || plan.paid_plan === true)
        ).length;
        
        // 공유받은 계획 수
        const sharedPlansCount = plans.filter(plan => plan.is_shared_with_me === true).length;

        setTravelStats({
          myPlansCount,
          paidPlansCount,
          sharedPlansCount
        });

        console.log('여행 통계 업데이트:', {
          myPlansCount,
          paidPlansCount,
          sharedPlansCount
        });
      }
    } catch (error) {
      console.error('여행 통계 가져오기 실패:', error);
    }
  };

  // getBookingStatusStyle 함수 추가
  const getBookingStatusStyle = (status) => {
    switch (status) {
      case '예정':
        return 'bg-blue-100 text-blue-800';
      case '진행 중':
        return 'bg-yellow-100 text-yellow-800';
      case '완료':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 사용자 데이터 가져오기
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setError(null);
      setApiResponseReceived(false);
      
      try {
        console.log('MyPage 데이터 로드 시작');
        console.log('개발 모드 자동 로그인 여부:', isSkipAuth);
        console.log('API URL:', MY_PAGE_API_URL);
        
        // skipAuth가 true인 경우 더미 데이터 사용
        if (isSkipAuth) {
          console.log('개발 모드 더미 데이터 사용');
          setUserInfo(DUMMY_USER_DATA);
          setBookings(DUMMY_BOOKINGS);
          
          // 프로필 데이터 업데이트
          setProfileData({
            name: DUMMY_USER_DATA.name || '',
            email: DUMMY_USER_DATA.email || '',
            phoneNumber: DUMMY_USER_DATA.phoneNumber || '',
            birthdate: DUMMY_USER_DATA.birthdate || ''
          });
          
          showNotification('개발 모드: 더미 데이터가 로드되었습니다.', 'info');
          setApiResponseReceived(true);
          
          // 개발 모드에서도 여행 통계 가져오기
          fetchTravelStats();
        } 
        // skipAuth가 false인 경우 실제 API 호출
        else {
          console.log('MyPage API 호출 시도...');
          showNotification('Lambda 함수 호출 중...', 'info');
          
          // JWT 토큰 가져오기 시도
          let headers = {
            'Content-Type': 'application/json'
          };
          
          try {
            const tokenResult = await getJwtToken();
            console.log('토큰 요청 결과:', tokenResult);
            
            if (tokenResult.success && tokenResult.token) {
              console.log('JWT 토큰 획득 성공');
              headers.Authorization = `Bearer ${tokenResult.token}`;
            } else {
              console.log('JWT 토큰 획득 실패, 토큰 없이 계속 진행합니다.', tokenResult.error || '알 수 없는 오류');
            }
          } catch (tokenError) {
            console.error('토큰 획득 중 예외 발생:', tokenError);
            console.log('토큰 없이 계속 진행합니다.');
          }
          
          console.log('API 호출에 사용할 헤더:', headers);
          
          // API 호출 - 타임아웃 증가 및 에러 처리 강화
          try {
            const response = await axios.get(MY_PAGE_API_URL, {
              headers,
              timeout: 10000 // 10초 타임아웃
            });
            
            console.log('MyPage API 응답:', response.data);
            setApiResponseReceived(true);
            
            // API 응답 데이터 설정
            if (response.data.success) {
              setUserInfo(response.data.user);
              
              // 프로필 데이터 업데이트 (DynamoDB 데이터 사용)
              setProfileData({
                name: response.data.user.name || '',
                email: response.data.user.email || '',
                phoneNumber: response.data.user.phoneNumber || '',
                birthdate: response.data.user.birthdate || ''
              });
              
              // 예약 내역 업데이트 (있는 경우)
              if (response.data.bookings) {
                setBookings(response.data.bookings);
              }
              
              showNotification(`Lambda 응답 수신: ${response.data.user.name}님의 정보가 로드되었습니다.`, 'success');
              
              // 여행 통계 가져오기
              fetchTravelStats();
            } else {
              throw new Error(response.data.message || '데이터를 가져오는데 실패했습니다.');
            }
          } catch (apiError) {
            console.error('API 호출 오류:', apiError);
            throw apiError;
          }
        }
      } catch (error) {
        console.error('사용자 데이터 가져오기 오류:', error);
        setError('사용자 정보를 가져오는데 실패했습니다. ' + error.message);
        showNotification('API 호출 오류: ' + (error.response?.data?.message || error.message), 'error');
        setApiResponseReceived(true);
        
        // 에러 발생 시에도 더미 데이터 표시 (기존 로직 유지)
        const fallbackUserData = DUMMY_USER_DATA;
        setUserInfo(fallbackUserData);

        // 프로필 데이터 업데이트 - 더미 데이터 사용
        setProfileData({
          name: fallbackUserData.name || '',
          email: fallbackUserData.email || '',
          phoneNumber: fallbackUserData.phoneNumber || '',
          birthdate: fallbackUserData.birthdate || ''
        });
        
        // 오류 발생 시에도 예약 데이터 표시
        setBookings(DUMMY_BOOKINGS);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user, getJwtToken, isSkipAuth]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      showNotification('프로필 정보 저장 중...', 'info');
      
      if (!isSkipAuth) {
        // JWT 토큰 가져오기
        const tokenResult = await getJwtToken();
        if (!tokenResult.success) {
          throw new Error('인증 토큰을 가져올 수 없습니다.');
        }
        
        console.log('저장할 프로필 정보:', profileData);
        
        // 프로필 업데이트 API 호출
        const response = await axios.put(USER_PROFILE_API_URL, profileData, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenResult.token}`
          },
          timeout: 10000 // 10초 타임아웃
        });
        
        console.log('프로필 업데이트 응답:', response.data);
        
        if (response.data.success) {
          // 성공적으로 업데이트된 경우
          showNotification('프로필 정보가 성공적으로 저장되었습니다.', 'success');
          
          // 최신 사용자 정보 가져오기 위해 MyPage API 다시 호출
          const myPageResponse = await axios.get(MY_PAGE_API_URL, {
            headers: {
              Authorization: `Bearer ${tokenResult.token}`
            },
            timeout: 10000
          });
          
          if (myPageResponse.data.success) {
            setUserInfo(myPageResponse.data.user);
          }
        } else {
          throw new Error(response.data.message || '프로필 정보 저장에 실패했습니다.');
        }
      } else {
        console.log('개발 모드 - 프로필 정보 저장 시뮬레이션:', profileData);
        // 개발 모드에서는 즉시 성공으로 처리
        showNotification('개발 모드: 프로필 정보가 저장되었습니다 (시뮬레이션).', 'success');
        
        // 개발 모드에서 사용자 정보 업데이트
        setUserInfo(prev => ({
          ...prev,
          name: profileData.name,
          email: profileData.email,
          phoneNumber: profileData.phoneNumber,
          birthdate: profileData.birthdate
        }));
      }
      
      setIsEditing(false);
      
      // 상단 프로필 섹션 업데이트
      if (user) {
        user.name = profileData.name;
        user.email = profileData.email;
      }
    } catch (error) {
      console.error('프로필 저장 오류:', error);
      showNotification('프로필 저장 실패: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setProfileData({
      name: userInfo?.name || user?.name || '',
      email: userInfo?.email || user?.email || '',
      phoneNumber: userInfo?.phoneNumber || '',
      birthdate: userInfo?.birthdate || ''
    });
    setIsEditing(false);
  };

  // 로딩 중 UI - API 응답을 기다리도록 수정
  if (loading || !apiResponseReceived) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-lg text-gray-700">
          {loading ? '로딩 중...' : 'Lambda 함수 응답 대기 중...'}
        </p>
        {!loading && !apiResponseReceived && (
          <p className="mt-2 text-sm text-gray-500">
            Lambda 함수에서 응답이 오는 동안 잠시 기다려주세요.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 알림 메시지 */}
        {notification && (
          <div className={`mb-6 p-4 rounded-md ${
            notification.type === 'error' ? 'bg-red-50 border-l-4 border-red-500' :
            notification.type === 'success' ? 'bg-green-50 border-l-4 border-green-500' :
            'bg-blue-50 border-l-4 border-blue-500'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {notification.type === 'error' ? (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : notification.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm ${
                  notification.type === 'error' ? 'text-red-700' :
                  notification.type === 'success' ? 'text-green-700' :
                  'text-blue-700'
                }`}>
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 개발 모드 표시 */}
        {isSkipAuth && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">개발 모드 활성화 - 더미 데이터 사용 중</p>
              </div>
            </div>
          </div>
        )}

        {/* 프로필 섹션 */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-2xl text-white font-bold">
                    {userInfo?.name?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold text-gray-900">{userInfo?.name || user?.name || 'user-dev'}</h2>
                <p className="text-gray-500">{userInfo?.email || user?.email || 'user-dev@email.com'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 여행 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">내 계획 수</h3>
            <p className="text-3xl font-bold text-primary">{travelStats.myPlansCount}개</p>
            <p className="text-sm text-gray-500 mt-1">공유받은 계획 제외</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">결제된 계획 수</h3>
            <p className="text-3xl font-bold text-green-600">{travelStats.paidPlansCount}개</p>
            <p className="text-sm text-gray-500 mt-1">내 계획 중 결제 완료</p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">공유받은 계획 수</h3>
            <p className="text-3xl font-bold text-blue-600">{travelStats.sharedPlansCount}개</p>
            <p className="text-sm text-gray-500 mt-1">다른 사용자가 공유한 계획</p>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('profile')}
                className={`${
                  activeTab === 'profile'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                프로필 정보
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`${
                  activeTab === 'bookings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                예약 내역
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`${
                  activeTab === 'settings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                설정
              </button>
            </nav>
          </div>

          {/* 탭 컨텐츠 */}
          <div className="px-6 py-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">기본 정보</h3>
                  <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">이름</label>
                      <input
                        type="text"
                        name="name"
                        value={profileData.name}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm ${
                          !isEditing ? 'bg-gray-50' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">이메일</label>
                      <input
                        type="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm ${
                          !isEditing ? 'bg-gray-50' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">전화번호</label>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={profileData.phoneNumber}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm ${
                          !isEditing ? 'bg-gray-50' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">생년월일</label>
                      <input
                        type="date"
                        name="birthdate"
                        value={profileData.birthdate}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm ${
                          !isEditing ? 'bg-gray-50' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        저장
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      정보 수정
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'bookings' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">예약 내역</h3>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="year-select" className="text-sm font-medium text-gray-700">연도 선택:</label>
                    <select
                      id="year-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {selectedYear && (
                  <div className="mt-4 space-y-6">
                    {/* 제주도 여행 예약 */}
                    {bookings.some(booking => 
                      booking.location.includes('제주') && 
                      new Date(booking.date).getFullYear() === selectedYear
                    ) && (
                      <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h4 className="text-lg font-medium text-gray-900">제주도 여행 예약</h4>
                        </div>
                        <div className="overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">예약명</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">유형</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">날짜</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">위치</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">가격</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">상태</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {bookings
                                .filter(booking => 
                                  booking.location.includes('제주') && 
                                  new Date(booking.date).getFullYear() === selectedYear
                                )
                                .map((booking) => (
                                  <tr key={booking.id}>
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                      {booking.title}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.type}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.date}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.location}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.price}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBookingStatusStyle(booking.status)}`}>
                                        {booking.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 부산 여행 예약 */}
                    {bookings.some(booking => 
                      (booking.location.includes('부산') || booking.location.includes('해운대')) &&
                      new Date(booking.date).getFullYear() === selectedYear
                    ) && (
                      <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h4 className="text-lg font-medium text-gray-900">부산 여행 예약</h4>
                        </div>
                        <div className="overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">예약명</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">유형</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">날짜</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">위치</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">가격</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">상태</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {bookings
                                .filter(booking => 
                                  (booking.location.includes('부산') || booking.location.includes('해운대')) &&
                                  new Date(booking.date).getFullYear() === selectedYear
                                )
                                .map((booking) => (
                                  <tr key={booking.id}>
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                      {booking.title}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.type}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.date}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.location}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.price}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBookingStatusStyle(booking.status)}`}>
                                        {booking.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 서울 여행 예약 */}
                    {bookings.some(booking => 
                      (booking.location.includes('서울') || booking.location.includes('강남')) &&
                      new Date(booking.date).getFullYear() === selectedYear
                    ) && (
                      <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h4 className="text-lg font-medium text-gray-900">서울 여행 예약</h4>
                        </div>
                        <div className="overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">예약명</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">유형</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">날짜</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">위치</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">가격</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">상태</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {bookings
                                .filter(booking => 
                                  (booking.location.includes('서울') || booking.location.includes('강남')) &&
                                  new Date(booking.date).getFullYear() === selectedYear
                                )
                                .map((booking) => (
                                  <tr key={booking.id}>
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                      {booking.title}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.type}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.date}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.location}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                      {booking.price}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBookingStatusStyle(booking.status)}`}>
                                        {booking.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">알림 설정</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <label className="ml-3 text-sm text-gray-700">이메일 알림</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <label className="ml-3 text-sm text-gray-700">SMS 알림</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <label className="ml-3 text-sm text-gray-700">여행 일정 알림</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <label className="ml-3 text-sm text-gray-700">프로모션 및 이벤트 알림</label>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">언어 설정</h3>
                  <div>
                    <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
                      <option value="ko">한국어</option>
                      <option value="en">English</option>
                      <option value="ja">日本語</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">테마 설정</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                      />
                      <label className="ml-3 text-sm text-gray-700">라이트 모드</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                      />
                      <label className="ml-3 text-sm text-gray-700">다크 모드</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                      />
                      <label className="ml-3 text-sm text-gray-700">시스템 설정 따르기</label>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">개인정보 설정</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">프로필 공개</label>
                        <p className="text-sm text-gray-500">다른 사용자가 내 프로필을 볼 수 있습니다</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">여행 일정 공개</label>
                        <p className="text-sm text-gray-500">다른 사용자가 내 여행 일정을 볼 수 있습니다</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">계정 관리</h3>
                  <div className="space-y-4">
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      계정 삭제
                    </button>
                    <p className="text-sm text-gray-500">계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다</p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    설정 저장
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyPage; 