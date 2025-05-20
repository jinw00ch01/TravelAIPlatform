import React, { useState, useEffect } from 'react';

const ItineraryDetail = ({ itinerary, onTitleUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(itinerary?.title || '');
  const [selectedDate, setSelectedDate] = useState(null);
  const [itineraryData, setItineraryData] = useState(null);
  
  useEffect(() => {
    // 실제 데이터 형식에 맞게 처리
    if (itinerary) {
      // 데이터가 이미 dailyPlans 형태로 있는 경우
      if (itinerary.dailyPlans) {
        setItineraryData(itinerary.dailyPlans);
      } 
      // 데이터가 일차별로 직접 제공된 경우 (JSON 예시와 같은 형태)
      else if (typeof itinerary === 'object' && Object.keys(itinerary).some(key => !isNaN(parseInt(key)))) {
        setItineraryData(itinerary);
      }
      
      // 첫 번째 일차 자동 선택
      const firstDay = Object.keys(itinerary.dailyPlans || itinerary).find(key => !isNaN(parseInt(key))) || "1";
      setSelectedDate(firstDay);
      
      // 타이틀 설정
      const mainTitle = itinerary.title || (itinerary["1"] && itinerary["1"].title ? "일본 도쿄 여행" : "");
      setTitle(mainTitle);
    }
  }, [itinerary]);

  const handleTitleSubmit = (e) => {
    e.preventDefault();
    onTitleUpdate(itinerary.id, title);
    setIsEditing(false);
  };
  
  // 데이터가 없을 경우 로딩 표시
  if (!itineraryData) {
    return <div className="p-6 text-center">데이터를 불러오는 중...</div>;
  }
  
  // 날짜별 달력 생성용 배열
  const availableDates = Object.keys(itineraryData)
    .filter(key => !isNaN(parseInt(key))) // 숫자 키만 필터링
    .sort((a, b) => parseInt(a) - parseInt(b)) // 일차 순서대로 정렬
    .map(dayNumber => {
      const dayData = itineraryData[dayNumber];
      // 날짜 추출 (제목에서 날짜 부분만 추출: "5/24 1일차: ..." → "5/24")
      const dateMatch = dayData.title.match(/(\d+\/\d+)/);
      const displayDate = dateMatch ? dateMatch[1] : `${dayNumber}일차`;
      
      return {
        date: dayNumber,
        displayDate: displayDate,
        day: `${dayNumber}일차`
      };
    });
  
  // 현재 선택된 날짜 데이터
  const currentDateData = selectedDate ? itineraryData[selectedDate] : null;

  // 해당 일차의 장소 및 일정 정보
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
                    setTitle(title);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  취소
                </button>
              </form>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
                <button
                  onClick={() => setIsEditing(true)}
                  className="ml-3 text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 캘린더 네비게이션 */}
        <div className="flex mb-6 space-x-2 overflow-x-auto pb-2">
          {availableDates.map(date => (
            <button
              key={date.date}
              onClick={() => setSelectedDate(date.date)}
              className={`px-4 py-2 rounded-full flex-shrink-0 ${
                selectedDate === date.date
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="font-medium">{date.displayDate}</span>
              <span className="ml-1 text-xs">{date.day}</span>
            </button>
          ))}
        </div>

        {/* 설명 섹션 */}
        <div className="bg-blue-50 rounded-lg p-5 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-3">여행 일정</h3>
          <p className="text-gray-700 text-base leading-relaxed">
            {currentDateData ? currentDateData.title : '여행 일정을 선택해주세요.'}
          </p>
        </div>

        {/* 일정 타임라인 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            {currentDateData ? `${currentDateData.title} 상세 일정` : '일정'}
          </h3>
          
          {schedules && schedules.length > 0 ? (
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
                      <h4 className="font-bold text-gray-900">{item.name}</h4>
                      {item.duration && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">소요시간:</span> {item.duration}
                        </p>
                      )}
                      {item.address && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">위치:</span> {item.address}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">메모:</span> {item.notes}
                        </p>
                      )}
                      {item.cost && item.cost !== '0' && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">비용:</span> ¥{item.cost}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">이 날의 일정이 없습니다.</p>
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
                <li>여권</li>
                <li>현지 통화 (엔)</li>
                <li>여행 보험</li>
                <li>필수 의류</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">주의사항</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>일본 날씨 확인</li>
                <li>지하철/교통 정보 확인</li>
                <li>비상 연락처</li>
                <li>여행자 에티켓 준수</li>
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
    case '항공편':
      return '✈️';
    case '식당':
      return '🍱';
    case '장소':
      return '🗾';
    case '호텔':
      return '🏨';
    case '쇼핑':
      return '🛍️';
    default:
      return '📍';
  }
};

export default ItineraryDetail; 