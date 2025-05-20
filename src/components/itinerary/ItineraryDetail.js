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
                {itinerary && Object.keys(itinerary).length > 0 && ( // itinerary가 있을 때만 수정 버튼 표시
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

        {/* 설명 섹션 */}
        <div className="bg-blue-50 rounded-lg p-5 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            {currentDateData && currentDateData.title ? currentDateData.title : (itineraryData ? "일정 개요" : "정보 없음")}
          </h3>
          <p className="text-gray-700 text-base leading-relaxed">
            {currentDateData?.description || itinerary?.overview || "선택된 날짜의 상세 설명이 없거나, 전체 여행 개요가 없습니다."}
          </p>
        </div>

        {/* 일정 타임라인 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            {currentDateData && currentDateData.title ? `${currentDateData.title} 상세 일정` : (itineraryData ? '상세 일정' : '정보 없음')}
          </h3>
          
          {currentDateData && schedules && schedules.length > 0 ? (
            <div className="space-y-4">
              {schedules.map((item, index) => {
                const icon = getIconByCategory(item.category);
                return (
                  <div key={item.id || index} className="flex border-l-4 border-blue-500 bg-white shadow-sm rounded-lg overflow-hidden">
                    <div className="w-20 bg-blue-50 p-4 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xl mb-1">{icon}</div>
                        <div className="text-blue-800 font-bold">{item.time}</div>
                      </div>
                    </div>
                    <div className="flex-1 p-4">
                      <h4 className="font-bold text-gray-900">{item.name || item.activity}</h4>
                      {item.duration && (<p className="text-sm text-gray-600 mt-1"><span className="font-medium">소요시간:</span> {item.duration}</p>)}
                      {item.address && (<p className="text-sm text-gray-600 mt-1"><span className="font-medium">위치:</span> {item.address}</p>)}
                      {item.notes && (<p className="text-sm text-gray-600 mt-1"><span className="font-medium">메모:</span> {item.notes}</p>)}
                      {item.cost && item.cost !== '0' && (<p className="text-sm text-gray-600 mt-1"><span className="font-medium">비용:</span> ¥{item.cost}</p>)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">
                {selectedDateKey && itineraryData && itineraryData[selectedDateKey] ? "이 날의 일정이 없습니다. 다른 날짜를 선택해보세요." : "날짜를 선택해주세요."}
              </p>
            </div>
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
    case '장소': return '🗾';
    case '호텔': return '🏨';
    case '쇼핑': return '🛍️';
    default: return '📍';
  }
};

export default ItineraryDetail; 