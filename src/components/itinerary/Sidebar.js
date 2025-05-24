import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Sidebar.css';

const Sidebar = ({ onSelectItinerary, selectedItinerary, itineraries, onDeleteItinerary, onDateSelectFromCalendar }) => {
  const [date, setDate] = useState(new Date());
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, itineraryId: null });
  
  // 날짜 포맷팅 함수
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 달력 타일 스타일링을 위한 함수
  const tileClassName = ({ date, view }) => {
    if (view !== 'month' || !selectedItinerary?.accommodationInfo?.checkIn || !selectedItinerary?.accommodationInfo?.checkOut) {
      return '';
    }

    const checkIn = new Date(selectedItinerary.accommodationInfo.checkIn);
    const checkOut = new Date(selectedItinerary.accommodationInfo.checkOut);
    
    // 시간을 0으로 설정하여 날짜만 비교
    checkIn.setHours(0, 0, 0, 0);
    checkOut.setHours(0, 0, 0, 0);
    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);

    const classes = [];

    if (currentDate.getTime() === checkIn.getTime()) {
      classes.push('calendar-check-in');
    }
    if (currentDate.getTime() === checkOut.getTime()) {
      classes.push('calendar-check-out');
    }
    if (currentDate > checkIn && currentDate < checkOut) {
      classes.push('calendar-stay-period');
    }

    return classes.join(' ');
  };

  const handleDeleteClick = (e, itineraryId) => {
    e.stopPropagation();
    setDeleteConfirm({ show: true, itineraryId });
  };

  const handleConfirmDelete = () => {
    onDeleteItinerary(deleteConfirm.itineraryId);
    setDeleteConfirm({ show: false, itineraryId: null });
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ show: false, itineraryId: null });
  };

  return (
    <div className="w-64 bg-white shadow-lg p-4 flex flex-col">
      {/* 캘린더 */}
      <div className="mb-6">
        <Calendar
          onChange={onDateSelectFromCalendar}
          value={null}
          tileClassName={tileClassName}
          className="custom-calendar"
        />
      </div>

      {/* 여행 계획 목록 */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">여행 계획 목록</h3>
        <div className="space-y-2">
          {itineraries.map((itinerary) => (
            <button
              key={itinerary.plan_id}
              onClick={() => onSelectItinerary(itinerary)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedItinerary?.plan_id === itinerary.plan_id
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="font-medium">{itinerary.name || itinerary.title}</div>
              {itinerary.accommodationInfo?.checkIn && (
                <div className="text-sm opacity-80">
                  {new Date(itinerary.accommodationInfo.checkIn).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric'
                  })}
                  {' - '}
                  {new Date(itinerary.accommodationInfo.checkOut).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 삭제 확인 대화상자 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">일정을 삭제하시겠습니까?</h3>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-md transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar; 