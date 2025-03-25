import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';

function MyPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: '',
    birthDate: ''
  });
  const [bookings, setBookings] = useState([]);

  // 임시 데이터 (나중에 실제 API 호출로 대체)
  useEffect(() => {
    // 임시 예약 데이터
    const tempBookings = [
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
    setBookings(tempBookings);
  }, []);

  const getStatus = (startDate, endDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (today < start) {
      return '예정';
    } else if (today > end) {
      return '완료';
    } else {
      return '진행 중';
    }
  };

  const getStatusStyle = (status) => {
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    // TODO: API 호출로 프로필 정보 저장
    console.log('저장할 프로필 정보:', profileData);
    setIsEditing(false);
    // 상단 프로필 섹션 업데이트
    if (user) {
      user.username = profileData.username;
      user.email = profileData.email;
    }
  };

  const handleCancel = () => {
    setProfileData({
      username: user?.username || '',
      email: user?.email || '',
      phone: '',
      birthDate: ''
    });
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 프로필 섹션 */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-2xl text-white font-bold">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold text-gray-900">{user?.username || '사용자'}</h2>
                <p className="text-gray-500">{user?.email || '이메일 없음'}</p>
              </div>
            </div>
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
                        name="username"
                        value={profileData.username}
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
                        name="phone"
                        value={profileData.phone}
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
                        name="birthDate"
                        value={profileData.birthDate}
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