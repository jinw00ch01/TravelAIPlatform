import React, { useState } from 'react';
import Sidebar from '../components/itinerary/Sidebar';
import ItineraryDetail from '../components/itinerary/ItineraryDetail';

const ItineraryManager = () => {
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [itineraries, setItineraries] = useState([
    { id: 1, title: '도쿄 여행', date: '2024-03-20' },
    { id: 2, title: '오사카 여행', date: '2024-03-25' },
    { id: 3, title: '후쿠오카 여행', date: '2024-04-01' },
  ]);

  const handleTitleUpdate = (itineraryId, newTitle) => {
    setItineraries(prevItineraries =>
      prevItineraries.map(itinerary =>
        itinerary.id === itineraryId
          ? { ...itinerary, title: newTitle }
          : itinerary
      )
    );
    
    // 선택된 일정이 수정된 경우 selectedItinerary도 업데이트
    if (selectedItinerary?.id === itineraryId) {
      setSelectedItinerary(prev => ({
        ...prev,
        title: newTitle
      }));
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 사이드바 */}
      <Sidebar 
        onSelectItinerary={setSelectedItinerary}
        selectedItinerary={selectedItinerary}
        itineraries={itineraries}
      />
      
      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-auto">
        {selectedItinerary ? (
          <ItineraryDetail 
            itinerary={selectedItinerary}
            onTitleUpdate={handleTitleUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">일정을 선택해주세요</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItineraryManager; 