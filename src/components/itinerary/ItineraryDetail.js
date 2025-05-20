import React, { useState, useEffect } from 'react';

const ItineraryDetail = ({ itinerary, onTitleUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(itinerary?.name || itinerary?.title || '');
  const [activeDay, setActiveDay] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);

  // 일정 데이터 추출 및 가공
  useEffect(() => {
    if (!itinerary) return;
    
    console.log('ItineraryDetail - 일정 데이터 처리:', itinerary);
    
    // 제목 업데이트
    setTitle(itinerary?.name || itinerary?.title || '');
    
    // itinerary_schedules에서 일정 데이터 추출
    let daySchedules = [];
    
    if (itinerary.itinerary_schedules) {
      console.log('itinerary_schedules 데이터 사용', itinerary.itinerary_schedules);
      
      // itinerary_schedules 처리 (문자열이면 파싱)
      let schedules = itinerary.itinerary_schedules;
      if (typeof schedules === 'string') {
        try {
          schedules = JSON.parse(schedules);
          console.log('문자열에서 파싱된 일정:', schedules);
        } catch (err) {
          console.error('일정 문자열 파싱 오류:', err);
          schedules = {};
        }
      }
        
      // 일자별 데이터로 변환
      daySchedules = Object.keys(schedules).map(day => ({
        day: parseInt(day),
        title: schedules[day].title || `${day}일차`,
        schedules: schedules[day].schedules || []
      })).sort((a, b) => a.day - b.day);
      
      console.log('변환된 일정 데이터:', daySchedules);
    } 
    else if (itinerary.plan_data && itinerary.plan_data.days) {
      console.log('plan_data.days 데이터 사용');
      daySchedules = itinerary.plan_data.days.sort((a, b) => a.day - b.day);
    }
    
    console.log('최종 처리된 일정 데이터:', daySchedules);
    setScheduleData(daySchedules);
    
    // 첫 번째 일자를 기본 선택
    if (daySchedules.length > 0) {
      const firstDay = daySchedules[0].day;
      console.log(`첫 번째 일자(${firstDay})를 활성화`);
      setActiveDay(firstDay);
    }
  }, [itinerary]);

  const handleTitleSubmit = (e) => {
    e.preventDefault();
    onTitleUpdate(itinerary.id || itinerary.plan_id, title);
    setIsEditing(false);
  };
  
  const handleDayClick = (day) => {
    console.log(`일자 ${day} 클릭`);
    setActiveDay(day);
  };
  
  // 선택된 일자의 일정 정보
  const activeDaySchedule = scheduleData.find(day => day.day === activeDay);
  console.log('활성 일자 일정:', activeDay, activeDaySchedule);
  
  // 날짜 표시 포맷팅
  const formatDate = (date) => {
    if (!date) return null;
    
    try {
      const dateObj = new Date(date);
      return dateObj.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
      });
    } catch (err) {
      console.error('날짜 포맷팅 오류:', err);
      return date;
    }
  };
  
  // 일정 항목 클릭 처리
  const handleItemClick = (itemId) => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
    console.log('일정 항목 클릭:', itemId, expandedItem === itemId ? '닫기' : '열기');
  };
  
  // 호텔 정보 렌더링
  const renderHotelInfo = (item) => {
    if (!item.hotel_info && !item.accommodation_info) return null;
    
    const hotelInfo = item.hotel_info || item.accommodation_info;
    return (
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-bold text-blue-900 mb-2">숙소 정보</h4>
        {hotelInfo.name && <p className="font-medium">{hotelInfo.name}</p>}
        {hotelInfo.address && <p className="text-sm text-gray-600 mb-2">{hotelInfo.address}</p>}
        
        <div className="grid grid-cols-2 gap-3 text-sm mt-3">
          {hotelInfo.rating && (
            <div>
              <span className="font-medium">평점:</span> {hotelInfo.rating}
            </div>
          )}
          {hotelInfo.price && (
            <div>
              <span className="font-medium">가격:</span> {typeof hotelInfo.price === 'number' ? hotelInfo.price.toLocaleString() + '원' : hotelInfo.price}
            </div>
          )}
          {hotelInfo.check_in && (
            <div>
              <span className="font-medium">체크인:</span> {hotelInfo.check_in}
            </div>
          )}
          {hotelInfo.check_out && (
            <div>
              <span className="font-medium">체크아웃:</span> {hotelInfo.check_out}
            </div>
          )}
        </div>
        
        {hotelInfo.amenities && Array.isArray(hotelInfo.amenities) && hotelInfo.amenities.length > 0 && (
          <div className="mt-2">
            <p className="font-medium text-sm">편의 시설:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {hotelInfo.amenities.map((amenity, i) => (
                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // 관광지 정보 렌더링
  const renderAttractionInfo = (item) => {
    if (!item.attraction_info && !item.tourism_info) return null;
    
    const attractionInfo = item.attraction_info || item.tourism_info;
    return (
      <div className="mt-4 p-4 bg-green-50 rounded-lg">
        <h4 className="font-bold text-green-900 mb-2">관광지 정보</h4>
        {attractionInfo.name && <p className="font-medium">{attractionInfo.name}</p>}
        {attractionInfo.description && <p className="text-sm text-gray-600 mt-1">{attractionInfo.description}</p>}
        
        <div className="grid grid-cols-2 gap-3 text-sm mt-3">
          {attractionInfo.opening_hours && (
            <div>
              <span className="font-medium">운영 시간:</span> {attractionInfo.opening_hours}
            </div>
          )}
          {attractionInfo.entrance_fee && (
            <div>
              <span className="font-medium">입장료:</span> {typeof attractionInfo.entrance_fee === 'number' ? attractionInfo.entrance_fee.toLocaleString() + '원' : attractionInfo.entrance_fee}
            </div>
          )}
        </div>
        
        {attractionInfo.highlights && Array.isArray(attractionInfo.highlights) && attractionInfo.highlights.length > 0 && (
          <div className="mt-2">
            <p className="font-medium text-sm">주요 특징:</p>
            <ul className="list-disc list-inside text-sm mt-1">
              {attractionInfo.highlights.map((highlight, i) => (
                <li key={i}>{highlight}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-3 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 섹션 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {isEditing ? (
                <form onSubmit={handleTitleSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-3xl font-bold text-gray-800 border-b-2 border-blue-500 focus:outline-none bg-transparent w-full"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setTitle(itinerary?.name || itinerary?.title || '');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    취소
                  </button>
                </form>
              ) : (
                <div className="flex items-center">
                  <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="ml-3 text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                </div>
              )}
              
              {itinerary.start_date && (
                <p className="text-gray-600 mt-2">
                  {formatDate(itinerary.start_date)} 
                  {itinerary.end_date && ` ~ ${formatDate(itinerary.end_date)}`}
                </p>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                공유
              </button>
              <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                내보내기
              </button>
            </div>
          </div>
          
          {/* 여행 개요 */}
          {(itinerary.description || itinerary.summary) && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-gray-700">{itinerary.description || itinerary.summary}</p>
            </div>
          )}
        </div>
        
        {/* 일자 선택 탭 */}
        {scheduleData.length > 0 ? (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto scrollbar-hide">
                {scheduleData.map(day => (
                  <button
                    key={`day-${day.day}`}
                    onClick={() => handleDayClick(day.day)}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition
                      ${activeDay === day.day 
                        ? 'border-b-2 border-blue-500 text-blue-500' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                  >
                    {day.title || `${day.day}일차`}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 선택된 일자 일정 내용 */}
            {activeDaySchedule ? (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6">
                  {activeDaySchedule.title || `${activeDaySchedule.day}일차`}
                </h2>
                
                {activeDaySchedule.schedules && activeDaySchedule.schedules.length > 0 ? (
                  <div className="space-y-6">
                    {activeDaySchedule.schedules.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="border-l-4 border-blue-500 bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition cursor-pointer"
                        onClick={() => handleItemClick(`${activeDay}-${idx}`)}
                      >
                        <div className="flex">
                          {/* 시간 */}
                          <div className="w-24 bg-blue-50 p-4 flex items-center justify-center">
                            <span className="text-blue-800 font-bold">{item.time}</span>
                          </div>
                          
                          {/* 내용 */}
                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-bold text-gray-900">{item.name}</h3>
                                {item.category && (
                                  <span className="inline-block mt-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                              {item.cost && (
                                <span className="text-gray-600 font-medium">
                                  {parseInt(item.cost).toLocaleString()}원
                                </span>
                              )}
                            </div>
                            
                            {item.address && (
                              <p className="mt-2 text-sm text-gray-500">
                                <span className="font-medium">위치:</span> {item.address}
                              </p>
                            )}
                            
                            {item.notes && (
                              <p className="mt-2 text-sm text-gray-600">{item.notes}</p>
                            )}
                            
                            {/* 확장된 경우 상세 정보 표시 */}
                            {expandedItem === `${activeDay}-${idx}` && (
                              <div className="mt-4 border-t pt-4">
                                {/* 호텔 정보 */}
                                {renderHotelInfo(item)}
                                
                                {/* 관광지 정보 */}
                                {renderAttractionInfo(item)}
                                
                                {/* 추가 세부 정보 */}
                                {item.details && (
                                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm">
                                    <h4 className="font-bold text-gray-800 mb-2">추가 정보</h4>
                                    <pre className="whitespace-pre-wrap font-sans">{item.details}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    이 날의 일정이 없습니다.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                선택된 일자가 없습니다.
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-500">일정 정보가 없습니다.</p>
          </div>
        )}
        
        {/* 여행 팁 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">여행 팁</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">준비물</h3>
              <ul className="space-y-1 text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>여권 및 여행 서류</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>현지 통화 및 신용카드</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>날씨에 맞는 의류</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>필수 의약품</span>
                </li>
              </ul>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">현지 정보</h3>
              <ul className="space-y-1 text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>현지 긴급 연락처 저장</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>데이터 로밍 또는 현지 유심 준비</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>현지 법규 및 문화 확인</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>환율 확인</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItineraryDetail; 