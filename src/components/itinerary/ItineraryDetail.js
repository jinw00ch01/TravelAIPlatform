import React, { useState } from 'react';

const ItineraryDetail = ({ itinerary, onTitleUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(itinerary.title);
  
  // 임시 일정 상세 데이터
  const details = {
    title: title,
    date: itinerary.date,
    description: '여행 일정에 대한 상세 설명이 들어갑니다.',
    schedule: [
      { time: '09:00', activity: '호텔 체크아웃', icon: '🏨' },
      { time: '10:00', activity: '관광지 방문', icon: '🗾' },
      { time: '12:00', activity: '점심 식사', icon: '🍱' },
      { time: '14:00', activity: '쇼핑', icon: '🛍️' },
      { time: '18:00', activity: '저녁 식사', icon: '🍜' },
    ],
  };

  const handleTitleSubmit = (e) => {
    e.preventDefault();
    onTitleUpdate(itinerary.id, title);
    setIsEditing(false);
  };

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
                    setTitle(itinerary.title);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  취소
                </button>
              </form>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-gray-800">{details.title}</h2>
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
          <p className="text-xl text-gray-600 mt-2">{details.date}</p>
        </div>

        {/* 설명 섹션 */}
        <div className="bg-blue-50 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">여행 개요</h3>
          <p className="text-gray-700 text-lg leading-relaxed">{details.description}</p>
        </div>

        {/* 일정 타임라인 */}
        <div className="relative mb-8">
          {/* 타임라인 라인 */}
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-gray-200"></div>

          {/* 가로 스크롤 컨테이너 */}
          <div className="overflow-x-auto pb-4">
            <div className="flex space-x-8 min-w-max">
              {details.schedule.map((item, index) => (
                <div key={index} className="relative flex-shrink-0">
                  {/* 타임라인 포인트 */}
                  <div className="absolute -top-4 left-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-x-1/2"></div>
                  
                  {/* 일정 카드 */}
                  <div className="w-64 bg-white rounded-lg shadow-md p-6 border border-gray-100">
                    <div className="flex flex-col items-center text-center">
                      <div className="text-3xl mb-4">{item.icon}</div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600 mb-2">{item.time}</div>
                        <div className="text-lg text-gray-700">{item.activity}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 설명 섹션 */}
        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">추가 정보</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">준비물</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>여권</li>
                <li>현지 통화</li>
                <li>여행 보험</li>
                <li>필수 의류</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">주의사항</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>현지 날씨 확인</li>
                <li>교통 정보 확인</li>
                <li>비상 연락처</li>
                <li>현지 법규 준수</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItineraryDetail; 