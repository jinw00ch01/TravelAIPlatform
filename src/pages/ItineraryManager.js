import React, { useState, useEffect } from 'react';
import Sidebar from '../components/itinerary/Sidebar';
import ItineraryDetail from '../components/itinerary/ItineraryDetail';
import { travelApi } from '../services/api';

const ItineraryManager = () => {
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    travelApi.getTravelPlans()
      .then(response => {
        if (response.plans && Array.isArray(response.plans)) {
          setItineraries(response.plans);
        } else {
          setError('여행 계획 데이터 형식이 올바르지 않습니다.');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
        {loading ? (
          <div className="flex items-center justify-center h-full">불러오는 중...</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : selectedItinerary ? (
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