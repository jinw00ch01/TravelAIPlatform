import React, { useState, useEffect } from 'react';
import Sidebar from '../components/itinerary/Sidebar';
import ItineraryDetail from '../components/itinerary/ItineraryDetail';
import { travelApi } from '../services/api';

// 샘플 데이터 - 실제 사용 시 지우거나 주석 처리하세요
const SAMPLE_ITINERARY_DATA = {
  "1": {
    "title": "5/24 1일차: 도쿄 시부야 & 신주쿠 탐험",
    "schedules": [
      {
        "id": "flight-departure-1",
        "name": "ICN → NRT 항공편",
        "time": "오후 12:55",
        "address": "NRT",
        "category": "항공편",
        "type": "Flight_Departure",
        "duration": "2시간 35분",
        "notes": "가격: ₩333,200",
        "lat": null,
        "lng": null,
        "flightOfferDetails": {/* 항공편 상세정보 생략 */}
      },
      {
        "id": "1-1",
        "name": "시부야 스크램블 교차로",
        "time": "13:55",
        "lat": 35.6594,
        "lng": 139.7009,
        "category": "장소",
        "duration": "1시간",
        "notes": "세계에서 가장 붐비는 교차로 체험",
        "cost": "0",
        "address": "일본 〒150-0043 Tokyo, Shibuya City, Dogenzaka, 2 Chome−24"
      },
      // 나머지 일정은 원래 데이터와 동일하게 포함
    ]
  },
  "2": {
    "title": "5/25 2일차: 아사쿠사 & 우에노 문화 체험",
    "schedules": [
      // 2일차 일정 데이터
    ]
  },
  "3": {
    "title": "5/26 3일차: 하라주쿠 & 오다이바 트렌드 탐방",
    "schedules": [
      // 3일차 일정 데이터
    ]
  },
  "4": {
    "title": "5/27 4일차: 나리타로 이동",
    "schedules": [
      // 4일차 일정 데이터
    ]
  }
};

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
          
          // 실제 데이터가 없을 경우 샘플 데이터 사용 (개발용)
          // 주의: 실제 배포 시 아래 코드는 주석 처리 필요
          const sampleItinerary = {
            id: 'sample-1',
            title: '일본 도쿄 여행',
            ...SAMPLE_ITINERARY_DATA
          };
          setItineraries([sampleItinerary]);
          setSelectedItinerary(sampleItinerary);
          setLoading(false);
          setError(null);
        } else {
          // 2. 필터링된 계획의 상세 정보 로드
          loadDetailedPlans(paidPlans);
        }
      })
      .catch(err => {
        console.error('[ItineraryManager] 여행 계획 불러오기 오류:', err);
        setError('여행 계획을 불러오는데 문제가 발생했습니다: ' + err.message);
        setLoading(false);
        
        // 오류 발생 시 샘플 데이터 사용 (개발용)
        // 주의: 실제 배포 시 아래 코드는 주석 처리 필요
        const sampleItinerary = {
          id: 'sample-1',
          title: '일본 도쿄 여행',
          ...SAMPLE_ITINERARY_DATA
        };
        setItineraries([sampleItinerary]);
        setSelectedItinerary(sampleItinerary);
        setLoading(false);
        setError(null);
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