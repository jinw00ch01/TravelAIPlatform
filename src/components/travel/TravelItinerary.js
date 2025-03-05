import React, { useState } from 'react';
import { formatDate } from '../../utils/dateUtils';

function TravelItinerary({ itinerary, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [editedItinerary, setEditedItinerary] = useState(itinerary);

  // 수정 모드 토글
  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (!editMode) {
      // 편집 모드 진입 시 현재 일정을 복사
      setEditedItinerary(JSON.parse(JSON.stringify(itinerary)));
    }
  };

  // 일정 저장
  const handleSave = () => {
    onSave(editedItinerary);
    setEditMode(false);
  };

  // 일차별 일정 내용 수정
  const handleDayUpdate = (dayIndex, field, value) => {
    const updated = { ...editedItinerary };
    updated.days[dayIndex][field] = value;
    setEditedItinerary(updated);
  };

  // 일정 항목 내용 수정
  const handleItemUpdate = (dayIndex, itemIndex, field, value) => {
    const updated = { ...editedItinerary };
    updated.days[dayIndex].activities[itemIndex][field] = value;
    setEditedItinerary(updated);
  };

  // 일정 항목 추가
  const addItem = (dayIndex) => {
    const updated = { ...editedItinerary };
    updated.days[dayIndex].activities.push({
      time: "",
      description: "",
      location: "",
      notes: ""
    });
    setEditedItinerary(updated);
  };

  // 일정 항목 삭제
  const removeItem = (dayIndex, itemIndex) => {
    const updated = { ...editedItinerary };
    updated.days[dayIndex].activities.splice(itemIndex, 1);
    setEditedItinerary(updated);
  };

  if (!itinerary || !itinerary.days) {
    return <div className="text-center py-8">일정 정보가 없습니다.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h3 className="text-lg font-medium">여행 일정</h3>
        <div>
          <button
            onClick={toggleEditMode}
            className="px-3 py-1 mr-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            {editMode ? "취소" : "수정"}
          </button>
          {editMode && (
            <button
              onClick={handleSave}
              className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-primary-dark"
            >
              저장
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* 기본 정보 */}
        <div className="mb-6">
          <h4 className="text-lg font-medium mb-2">여행 개요</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">목적지</p>
              {editMode ? (
                <input
                  type="text"
                  className="form-input mt-1"
                  value={editedItinerary.destination || ''}
                  onChange={(e) => setEditedItinerary({...editedItinerary, destination: e.target.value})}
                />
              ) : (
                <p className="font-medium">{itinerary.destination || '미정'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">총 예산</p>
              {editMode ? (
                <input
                  type="number"
                  className="form-input mt-1"
                  value={editedItinerary.budget || ''}
                  onChange={(e) => setEditedItinerary({...editedItinerary, budget: e.target.value})}
                />
              ) : (
                <p className="font-medium">{itinerary.budget?.toLocaleString() || '미정'} 원</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">출발일</p>
              {editMode ? (
                <input
                  type="date"
                  className="form-input mt-1"
                  value={editedItinerary.startDate || ''}
                  onChange={(e) => setEditedItinerary({...editedItinerary, startDate: e.target.value})}
                />
              ) : (
                <p className="font-medium">{formatDate(itinerary.startDate) || '미정'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">귀국일</p>
              {editMode ? (
                <input
                  type="date"
                  className="form-input mt-1"
                  value={editedItinerary.endDate || ''}
                  onChange={(e) => setEditedItinerary({...editedItinerary, endDate: e.target.value})}
                />
              ) : (
                <p className="font-medium">{formatDate(itinerary.endDate) || '미정'}</p>
              )}
            </div>
          </div>
        </div>

        {/* 일차별 일정 */}
        <div>
          <h4 className="text-lg font-medium mb-4">일차별 일정</h4>
          
          {itinerary.days.map((day, dayIndex) => (
            <div key={dayIndex} className="mb-6 border rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-3 border-b">
                <h5 className="font-medium">
                  {editMode ? (
                    <input
                      type="text"
                      className="form-input"
                      value={editedItinerary.days[dayIndex].title || `${dayIndex + 1}일차`}
                      onChange={(e) => handleDayUpdate(dayIndex, 'title', e.target.value)}
                    />
                  ) : (
                    `${dayIndex + 1}일차: ${day.title || ''}`
                  )}
                </h5>
                {editMode && (
                  <textarea
                    className="form-input mt-2 w-full"
                    value={editedItinerary.days[dayIndex].summary || ''}
                    onChange={(e) => handleDayUpdate(dayIndex, 'summary', e.target.value)}
                    placeholder="이 날의 일정 요약"
                    rows={2}
                  />
                )}
                {!editMode && day.summary && (
                  <p className="text-sm text-gray-600 mt-1">{day.summary}</p>
                )}
              </div>
              
              <div className="p-3">
                {day.activities.map((activity, itemIndex) => (
                  <div key={itemIndex} className="mb-3 pb-3 border-b last:border-0 last:mb-0 last:pb-0">
                    <div className="flex flex-wrap items-start">
                      {editMode ? (
                        <>
                          <div className="w-full md:w-1/6 mb-2 md:mb-0">
                            <input
                              type="text"
                              className="form-input"
                              value={editedItinerary.days[dayIndex].activities[itemIndex].time || ''}
                              onChange={(e) => handleItemUpdate(dayIndex, itemIndex, 'time', e.target.value)}
                              placeholder="시간"
                            />
                          </div>
                          <div className="w-full md:w-5/6 pl-0 md:pl-3">
                            <input
                              type="text"
                              className="form-input mb-2"
                              value={editedItinerary.days[dayIndex].activities[itemIndex].description || ''}
                              onChange={(e) => handleItemUpdate(dayIndex, itemIndex, 'description', e.target.value)}
                              placeholder="활동 설명"
                            />
                            <input
                              type="text"
                              className="form-input mb-2"
                              value={editedItinerary.days[dayIndex].activities[itemIndex].location || ''}
                              onChange={(e) => handleItemUpdate(dayIndex, itemIndex, 'location', e.target.value)}
                              placeholder="위치"
                            />
                            <textarea
                              className="form-input"
                              value={editedItinerary.days[dayIndex].activities[itemIndex].notes || ''}
                              onChange={(e) => handleItemUpdate(dayIndex, itemIndex, 'notes', e.target.value)}
                              placeholder="추가 정보"
                              rows={2}
                            />
                            <button
                              type="button"
                              onClick={() => removeItem(dayIndex, itemIndex)}
                              className="mt-2 text-sm text-red-500 hover:text-red-700"
                            >
                              항목 삭제
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-full md:w-1/6 font-medium text-gray-900">
                            {activity.time || '시간 미정'}
                          </div>
                          <div className="w-full md:w-5/6 pl-0 md:pl-3">
                            <p className="font-medium">{activity.description}</p>
                            {activity.location && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">위치:</span> {activity.location}
                              </p>
                            )}
                            {activity.notes && (
                              <p className="text-sm text-gray-600 mt-1">{activity.notes}</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                
                {editMode && (
                  <button
                    type="button"
                    onClick={() => addItem(dayIndex)}
                    className="mt-2 text-sm text-primary hover:text-primary-dark flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    일정 추가
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TravelItinerary;
