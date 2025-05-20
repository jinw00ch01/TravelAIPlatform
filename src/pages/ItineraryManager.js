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
    console.log('[ItineraryManager] 유료 여행 계획 불러오기 시작');
    setLoading(true);
    
    travelApi.invokeChecklist()
      .then(response => {
        console.log('[ItineraryManager] invokeChecklist 응답:', response);
        
        if (!response || !response.success || !Array.isArray(response.plans)) {
          setError('여행 계획 데이터를 불러오는데 실패했습니다.');
          return;
        }
        
        // 유료 계획만 필터링 (paid_plan이 1인 항목)
        const paidPlans = response.plans.filter(plan => plan.paid_plan === 1);
        console.log('[ItineraryManager] 필터링된 유료 계획:', paidPlans);
        
        if (paidPlans.length === 0) {
          setError('유료 여행 계획이 없습니다.');
          setItineraries([]);
        } else {
          setItineraries(paidPlans);
        }
      })
      .catch(err => {
        console.error('[ItineraryManager] 여행 계획 불러오기 오류:', err);
        setError('여행 계획을 불러오는데 문제가 발생했습니다: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleTitleUpdate = (itineraryId, newTitle) => {
    setItineraries(prevItineraries =>
      prevItineraries.map(itinerary =>
        itinerary.plan_id === itineraryId
          ? { ...itinerary, name: newTitle }
          : itinerary
      )
    );
    
    // 선택된 일정이 수정된 경우 selectedItinerary도 업데이트
    if (selectedItinerary?.plan_id === itineraryId) {
      setSelectedItinerary(prev => ({
        ...prev,
        name: newTitle
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
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
            <p className="ml-3">유료 여행 계획을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">{error}</div>
        ) : selectedItinerary ? (
          <ItineraryDetail 
            itinerary={selectedItinerary}
            onTitleUpdate={handleTitleUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-full flex-col">
            <p className="text-gray-500 mb-4">유료 여행 계획을 선택해주세요</p>
            {itineraries.length > 0 && (
              <p className="text-sm text-gray-400">좌측 사이드바에서 계획을 선택하면 자세한 내용을 볼 수 있습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItineraryManager; 