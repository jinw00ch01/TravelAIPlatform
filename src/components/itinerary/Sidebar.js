import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const Sidebar = ({ onSelectItinerary, selectedItinerary, itineraries, onDeleteItinerary }) => {
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
  const tileClassName = ({ date }) => {
    const dateString = formatDate(date);
    const hasItinerary = itineraries.some(it => it.date === dateString);
    return hasItinerary ? 'relative' : '';
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
    <div className="w-80 bg-white shadow-lg p-4">
      {/* 달력 */}
      <div className="mb-6">
        <Calendar
          onChange={setDate}
          value={date}
          className="w-full border-none text-xs"
          tileClassName={tileClassName}
          calendarClassName="text-xs"
          tileContent={({ date }) => {
            const dateString = formatDate(date);
            const hasItinerary = itineraries.some(it => it.date === dateString);
            return hasItinerary ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-800">{date.getDate()}일</span>
                </div>
              </div>
            ) : null;
          }}
        />
      </div>

      {/* 일정 목록 */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg mb-3">일정 목록</h3>
        {itineraries.map((itinerary) => (
          <div
            key={itinerary.id}
            className={`p-3 rounded-lg cursor-pointer transition-colors group relative ${
              selectedItinerary?.id === itinerary.id
                ? 'bg-blue-100 text-blue-800'
                : 'hover:bg-gray-100'
            }`}
            onClick={() => onSelectItinerary(itinerary)}
          >
            <div className="font-medium">{itinerary.title}</div>
            <div className="text-sm text-gray-500">{itinerary.date}</div>
            <button
              onClick={(e) => handleDeleteClick(e, itinerary.id)}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
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