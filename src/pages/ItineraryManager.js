import React, { useState, useEffect } from 'react';
import Sidebar from '../components/itinerary/Sidebar';
import ItineraryDetail from '../components/itinerary/ItineraryDetail';
import { travelApi } from '../services/api';

const ItineraryManager = () => {
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 초기 데이터 로드
  useEffect(() => {
    console.log('[ItineraryManager] 유료 여행 계획 불러오기 시작');
    setLoading(true);
    
    // 1. 여행 계획 목록 로드
    travelApi.invokeChecklist()
      .then(response => {
        console.log('[ItineraryManager] invokeChecklist 응답:', response);
        
        if (!response || !response.success || !Array.isArray(response.plans)) {
          setError('여행 계획 데이터를 불러오는데 실패했습니다.');
          setLoading(false);
          return;
        }
        
        // 유료 계획만 필터링 (paid_plan이 1인 항목)
        const paidPlans = response.plans.filter(plan => plan.paid_plan === 1);
        console.log('[ItineraryManager] 필터링된 유료 계획:', paidPlans);
        
        if (paidPlans.length === 0) {
          setError('유료 여행 계획이 없습니다.');
          setItineraries([]);
          setLoading(false);
        } else {
          // 2. 필터링된 계획의 상세 정보 로드
          loadDetailedPlans(paidPlans);
        }
      })
      .catch(err => {
        console.error('[ItineraryManager] 여행 계획 불러오기 오류:', err);
        setError('여행 계획을 불러오는데 문제가 발생했습니다: ' + err.message);
        setLoading(false);
      });
  }, []);
  
  // 상세 정보 로드 함수
  const loadDetailedPlans = (plans) => {
    console.log('[ItineraryManager] 상세 정보 로드 시작:', plans.length);
    
    // 각 계획의 상세 정보 가져오기
    const promises = plans.map(plan => {
      console.log(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 로드 시작`);
      return travelApi.invokeCheckplan(plan.plan_id.toString())
        .then(response => {
          console.log(`[ItineraryManager] 계획 ${plan.plan_id} 상세 데이터:`, response);
          
          if (!response || !response.success || !response.plan) {
            console.warn(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 없음`);
            return plan;
          }
          
          // 계획 데이터와 상세 정보 병합
          return processItineraryData(plan, response.plan);
        })
        .catch(err => {
          console.error(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 조회 오류:`, err);
          return plan;
        });
    });
    
    // 모든 상세 정보 로드 완료 후 처리
    Promise.all(promises)
      .then(detailedPlans => {
        console.log('[ItineraryManager] 모든 상세 정보 로드 완료:', detailedPlans);
        setItineraries(detailedPlans);
        
        // 첫 번째 계획 자동 선택 (선택이 없을 경우에만)
        if (detailedPlans.length > 0 && !selectedItinerary) {
          setSelectedItinerary(detailedPlans[0]);
          console.log('[ItineraryManager] 첫 번째 계획 자동 선택:', detailedPlans[0]);
        }
      })
      .catch(err => {
        console.error('[ItineraryManager] 상세 정보 처리 오류:', err);
        setError('일부 계획 정보를 불러오는데 실패했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  };
  
  // 여행 계획 데이터 가공 함수
  const processItineraryData = (basicInfo, detailInfo) => {
    console.log('[ItineraryManager] 계획 데이터 가공:', basicInfo.plan_id);
    
    try {
      // 기본 정보와 상세 정보 병합
      const processedPlan = {
        ...basicInfo,
        ...detailInfo
      };
      
      // JSON 문자열 파싱
      const fieldsToProcess = [
        'itinerary_schedules',
        'flight_details',
        'accommodation_details',
        'transportation_details'
      ];
      
      fieldsToProcess.forEach(field => {
        if (detailInfo[field]) {
          try {
            processedPlan[field] = typeof detailInfo[field] === 'string'
              ? JSON.parse(detailInfo[field])
              : detailInfo[field];
          } catch (err) {
            console.warn(`[ItineraryManager] ${field} 파싱 오류:`, err);
            processedPlan[field] = detailInfo[field];
          }
        }
      });
      
      console.log('[ItineraryManager] 가공된 계획 데이터:', processedPlan);
      return processedPlan;
    } catch (err) {
      console.error('[ItineraryManager] 데이터 가공 오류:', err);
      return { ...basicInfo, ...detailInfo };
    }
  };

  // 여행 계획 선택 처리
  const handleSelectItinerary = (itinerary) => {
    console.log('[ItineraryManager] 여행 계획 선택:', itinerary);
    setSelectedItinerary(itinerary);
  };

  // 제목 업데이트 처리
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
        onSelectItinerary={handleSelectItinerary}
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