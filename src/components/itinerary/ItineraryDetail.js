import React, { useState, useEffect, useCallback } from 'react';

const ItineraryDetail = ({ itinerary, onTitleUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState(null); // "1", "2"와 같은 내부 키
  const [itineraryData, setItineraryData] = useState(null);
  
  useEffect(() => {
    console.log('[ItineraryDetail] useEffect[itinerary] - START. Received itinerary prop:', itinerary ? JSON.parse(JSON.stringify(itinerary)) : itinerary);
    if (itinerary && typeof itinerary === 'object') {
      // itinerary 객체에서 숫자 키를 가진 일차별 데이터만 추출 시도
      const dailyPlans = Object.entries(itinerary)
        .filter(([key]) => !isNaN(parseInt(key)))
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});

      if (Object.keys(dailyPlans).length > 0) {
        console.log('[ItineraryDetail] Extracted dailyPlans:', JSON.parse(JSON.stringify(dailyPlans)));
        setItineraryData(dailyPlans);

        const validNumericKeys = Object.keys(dailyPlans).sort((a, b) => parseInt(a) - parseInt(b));
        if (validNumericKeys.length > 0) {
          // 기존 selectedDateKey가 새로운 dailyPlans에도 유효한 키인지 확인
          // 그렇지 않다면 첫 번째 유효한 키로 설정
          if (selectedDateKey && dailyPlans[selectedDateKey]) {
            console.log('[ItineraryDetail] Keeping existing selectedDateKey:', selectedDateKey);
          } else {
            const firstDayKey = validNumericKeys[0];
            setSelectedDateKey(firstDayKey);
            console.log('[ItineraryDetail] useEffect[itinerary] - set selectedDateKey to (first day):', firstDayKey);
          }
        } else {
          setSelectedDateKey(null);
          console.warn('[ItineraryDetail] No valid numeric keys found in extracted dailyPlans. Setting selectedDateKey to null.');
        }
      } else {
        // 숫자 키로 구성된 일차 데이터가 없는 경우, itinerary 전체를 사용하되 경고
        console.warn('[ItineraryDetail] No numeric keys found for daily plans in itinerary prop. Using itinerary object as is for itineraryData, but this might be incorrect.');
        setItineraryData(itinerary); // 폴백 또는 다른 구조를 기대하는 경우일 수 있음
        setSelectedDateKey(null); // 이 경우 자동 날짜 선택 어려움
      }
      
      const mainTitle = itinerary.name || itinerary.title || "여행 일정";
      setTitle(mainTitle);
      console.log('[ItineraryDetail] useEffect[itinerary] - set mainTitle to:', mainTitle);

    } else {
      console.log('[ItineraryDetail] itinerary prop is null, undefined, or not an object. Resetting states.');
      setItineraryData(null);
      setSelectedDateKey(null);
      setTitle('선택된 일정 없음');
    }
    console.log('[ItineraryDetail] useEffect[itinerary] - END.');
  }, [itinerary]); // itinerary 객체의 참조가 변경될 때만 실행

  useEffect(() => {
    // 이 useEffect는 selectedDateKey나 itineraryData가 실제로 변경되었을 때만 실행되어야 함
    console.log('[ItineraryDetail] selectedDateKey changed to:', selectedDateKey);
    if (itineraryData && selectedDateKey && itineraryData[selectedDateKey]) {
      console.log('[ItineraryDetail] Corresponding data for selectedDateKey:', JSON.parse(JSON.stringify(itineraryData[selectedDateKey])));
    } else if (itineraryData && selectedDateKey) {
      console.warn('[ItineraryDetail] No data found in itineraryData for selectedDateKey:', selectedDateKey);
    }
  }, [selectedDateKey, itineraryData]);
  
  const handleDateSelect = useCallback((dateKey) => {
    console.log('[ItineraryDetail] Date button clicked, new date key:', dateKey);
    setSelectedDateKey(dateKey);
  }, []);

  if (!itineraryData || Object.keys(itineraryData).filter(key => !isNaN(parseInt(key))).length === 0) {
    // 숫자 키를 가진 일차 데이터가 없으면 로딩 또는 정보 없음 메시지 표시 강화
    return <div className="p-6 text-center">여행 정보를 불러오는 중이거나 표시할 일차별 정보가 없습니다...</div>;
  }
  
  const availableDates = Object.keys(itineraryData)
    .filter(key => {
      const K = parseInt(key);
      return !isNaN(K) && itineraryData[key] && typeof itineraryData[key] === 'object' && itineraryData[key].title;
    }) 
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(dayNumber => {
      const dayData = itineraryData[dayNumber];
      // console.log(`[ItineraryDetail] availableDates map - dayNumber: ${dayNumber}, dayData title: ${dayData.title}`);
      
      let displayDateStr = `${dayNumber}일차`;
      if (dayData.title && typeof dayData.title === 'string') {
        const dateMatch = dayData.title.match(/(\d+\/\d+)/); // "5/24" 형식 찾기
        if (dateMatch && dateMatch[1]) {
          displayDateStr = dateMatch[1];
        }
      }
      return {
        date: dayNumber, 
        displayDate: displayDateStr,
        day: `${dayNumber}일차`
      };
    });
  // console.log('[ItineraryDetail] Computed availableDates:', JSON.parse(JSON.stringify(availableDates)));
  
  const handleTitleSubmit = (e) => {
    e.preventDefault();
    const itineraryId = itinerary?.plan_id || itinerary?.id || 'unknown_id'; 
    onTitleUpdate(itineraryId, title);
    setIsEditing(false);
  };
  
  const currentDateData = selectedDateKey && itineraryData && itineraryData[selectedDateKey] ? itineraryData[selectedDateKey] : null;
  // console.log('[ItineraryDetail] Computed currentDateData for key:', selectedDateKey, currentDateData ? JSON.parse(JSON.stringify(currentDateData)) : currentDateData);

  const schedules = currentDateData?.schedules || [];

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* 헤더 섹션 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {isEditing ? (
                <form onSubmit={handleTitleSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-3xl font-bold text-gray-800 border-b-2 border-blue-500 focus:outline-none"
                    autoFocus
                  />
                  <button type="submit" className="text-blue-500 hover:text-blue-700">저장</button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setTitle(itinerary?.name || itinerary?.title || "제목 없음"); 
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >취소</button>
                </form>
              ) : (
                <>
                  <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
                  {itinerary && Object.keys(itinerary).length > 0 && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="ml-3 text-gray-500 hover:text-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
            {/* 여행 기간 표시 */}
            {itinerary?.accommodationInfo?.checkIn && itinerary?.accommodationInfo?.checkOut && (
              <div className="text-right">
                <div className="text-sm text-gray-600">여행 기간</div>
                <div className="text-lg font-semibold text-blue-600">
                  {new Date(itinerary.accommodationInfo.checkIn).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                  {' - '}
                  {new Date(itinerary.accommodationInfo.checkOut).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 숙소 및 항공권 요약 섹션 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 숙소 요약 */}
          {itinerary?.accommodationInfo?.hotel && (
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2 flex items-center">
                <span className="mr-2">🏨</span>
                숙소 정보
              </h3>
              <div className="space-y-2">
                <div className="font-medium">{itinerary.accommodationInfo.hotel.hotel_name}</div>
                <div className="text-sm text-gray-600">{itinerary.accommodationInfo.hotel.address}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">체크인:</span>
                    <div className="font-medium">{new Date(itinerary.accommodationInfo.checkIn).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">체크아웃:</span>
                    <div className="font-medium">{new Date(itinerary.accommodationInfo.checkOut).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</div>
                  </div>
                </div>
                {itinerary.accommodationInfo.hotel.price && (
                  <div className="text-green-600 font-medium">
                    가격: {itinerary.accommodationInfo.hotel.price}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 항공권 요약 */}
          {itinerary?.flightInfo && itinerary.flightInfo.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center">
                <span className="mr-2">✈️</span>
                항공권 정보
              </h3>
              <div className="space-y-3">
                {itinerary.flightInfo.map((flight, index) => {
                  const departure = flight.flightOfferDetails?.flightOfferData?.itineraries?.[0]?.segments?.[0];
                  return (
                    <div key={index} className="border-b border-blue-100 pb-2 last:border-0">
                      <div className="font-medium">
                        {departure?.departure?.iataCode} → {departure?.arrival?.iataCode}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(departure?.departure?.at).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric'
                        })}
                      </div>
                      {flight.flightOfferDetails?.flightOfferData?.price?.total && (
                        <div className="text-blue-600 text-sm">
                          가격: {flight.flightOfferDetails.flightOfferData.price.total}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 캘린더 네비게이션 */}
        {availableDates.length > 0 ? (
          <div className="flex mb-6 space-x-2 overflow-x-auto pb-2">
            {availableDates.map(dateInfo => (
              <button
                key={dateInfo.date}
                onClick={() => handleDateSelect(dateInfo.date)}
                className={`px-4 py-2 rounded-full flex-shrink-0 ${
                  selectedDateKey === dateInfo.date
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="font-medium">{dateInfo.displayDate}</span>
                <span className="ml-1 text-xs">{dateInfo.day}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-6 text-center text-gray-500">표시할 날짜 정보가 없습니다.</div>
        )}

        {/* 일정 타임라인 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            {currentDateData && currentDateData.title ? `${currentDateData.title} 상세 일정` : (itineraryData ? '상세 일정' : '정보 없음')}
          </h3>
          
          {currentDateData && schedules && schedules.length > 0 ? (
            <div className="space-y-4">
              {/* 항공편 정보 */}
              {schedules.filter(item => item.type === 'Flight_Departure' || item.type === 'Flight_Return').length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h4 className="text-lg font-semibold text-blue-800 mb-3">✈️ 항공편 정보</h4>
                  <div className="space-y-3">
                    {schedules
                      .filter(item => item.type === 'Flight_Departure' || item.type === 'Flight_Return')
                      .map((item, index) => (
                        <div key={item.id || index} className="flex items-start p-3 bg-white rounded-lg shadow-sm">
                          <div className="flex-grow">
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              <div>시간: {item.time}</div>
                              {item.duration && <div>소요시간: {item.duration}</div>}
                              {item.notes && <div className="text-blue-600">{item.notes}</div>}
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 숙박 정보 */}
              {schedules.filter(item => item.type === 'accommodation').length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <h4 className="text-lg font-semibold text-green-800 mb-3">🏨 숙박 정보</h4>
                  <div className="space-y-3">
                    {schedules
                      .filter(item => item.type === 'accommodation')
                      .map((item, index) => (
                        <div key={item.id || index} className="flex items-start p-3 bg-white rounded-lg shadow-sm">
                          <div className="flex-grow">
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              <div>{item.time === '체크인' ? '체크인' : '체크아웃'} 시간: {item.time}</div>
                              {item.address && <div>주소: {item.address}</div>}
                              {item.hotelDetails?.hotel?.price && (
                                <div className="text-green-600">가격: {item.hotelDetails.hotel.price}</div>
                              )}
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 일반 일정 */}
              <div className="space-y-3">
                {schedules
                  .filter(item => item.type !== 'Flight_Departure' && item.type !== 'Flight_Return' && item.type !== 'accommodation')
                  .map((item, index) => {
                    const icon = getIconByCategory(item.category);
                    return (
                      <div key={item.id || index} className="flex items-start p-4 bg-white rounded-lg shadow-sm">
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full mr-4">
                          {icon}
                        </div>
                        <div className="flex-grow">
                          <div className="font-medium text-gray-800">{item.name}</div>
                          <div className="text-sm text-gray-600">
                            <div>시간: {item.time}</div>
                            {item.duration && <div>소요시간: {item.duration}</div>}
                            {item.address && <div>주소: {item.address}</div>}
                            {item.notes && <div className="text-gray-500">{item.notes}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">선택된 날짜의 일정이 없습니다.</div>
          )}
        </div>

        {/* 하단 팁 섹션 */}
        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">여행 팁</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">준비물</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>여권</li><li>현지 통화 (엔)</li><li>여행 보험</li><li>필수 의류</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">주의사항</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>일본 날씨 확인</li><li>지하철/교통 정보 확인</li><li>비상 연락처</li><li>여행자 에티켓 준수</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 카테고리별 아이콘 매핑
const getIconByCategory = (category) => {
  switch (category?.toLowerCase()) {
    case '항공편': return '✈️';
    case '식당': return '🍱';
    case '장소': return '🏛️';
    case '호텔': return '🏨';
    case '쇼핑': return '🛍️';
    default: return '📍';
  }
};

export default ItineraryDetail; 