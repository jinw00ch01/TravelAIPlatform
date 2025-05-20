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
  const [selectedDateFromCalendar, setSelectedDateFromCalendar] = useState(null);

  // 초기 데이터 로드
  useEffect(() => {
    console.log('[ItineraryManager] useEffect 시작, selectedItinerary:', selectedItinerary);
    setLoading(true);
    
    travelApi.invokeChecklist()
      .then(response => {
        console.log('[ItineraryManager] invokeChecklist 응답:', response);
        
        if (!response || !response.success || !Array.isArray(response.plans)) {
          console.error('[ItineraryManager] 여행 계획 데이터 로드 실패:', response);
          setError('여행 계획 데이터를 불러오는데 실패했습니다.');
          setLoading(false);
          // 개발용: 실패 시 샘플 데이터 사용
          console.log('[ItineraryManager] API 실패, 샘플 데이터로 대체합니다.');
          const sampleItinerary = {
            plan_id: 'sample-1', // API 응답과 유사하게 plan_id 사용
            name: '일본 도쿄 여행 (샘플)', // API 응답과 유사하게 name 사용
            // dailyPlans 대신 직접 일차별 데이터 포함
            ...SAMPLE_ITINERARY_DATA 
          };
          setItineraries([sampleItinerary]);
          setSelectedItinerary(sampleItinerary);
          setError(null); // 샘플 데이터 사용 시 에러 메시지 제거
          setLoading(false);
          return;
        }
        
        const paidPlans = response.plans.filter(plan => plan.paid_plan === 1);
        console.log('[ItineraryManager] 필터링된 유료 계획:', paidPlans);
        
        if (paidPlans.length === 0) {
          console.log('[ItineraryManager] 유료 여행 계획 없음, 샘플 데이터로 대체합니다.');
          setError('유료 여행 계획이 없습니다.');
          // 개발용: 유료 플랜 없을 시 샘플 데이터 사용
          const sampleItinerary = {
            plan_id: 'sample-1',
            name: '일본 도쿄 여행 (샘플)',
            ...SAMPLE_ITINERARY_DATA
          };
          setItineraries([sampleItinerary]);
          setSelectedItinerary(sampleItinerary);
          setError(null);
          setLoading(false);
        } else {
          loadDetailedPlans(paidPlans);
        }
      })
      .catch(err => {
        console.error('[ItineraryManager] 여행 계획 불러오기 오류:', err);
        setError('여행 계획을 불러오는데 문제가 발생했습니다: ' + err.message);
        // 개발용: 에러 발생 시 샘플 데이터 사용
        console.log('[ItineraryManager] API 오류, 샘플 데이터로 대체합니다.');
        const sampleItinerary = {
          plan_id: 'sample-1',
          name: '일본 도쿄 여행 (샘플)',
          ...SAMPLE_ITINERARY_DATA
        };
        setItineraries([sampleItinerary]);
        setSelectedItinerary(sampleItinerary);
        setError(null);
        setLoading(false);
      });
  }, []); // 의존성 배열 비워둠 (마운트 시 1회 실행)
  
  const loadDetailedPlans = (plans) => {
    console.log('[ItineraryManager] loadDetailedPlans 시작, plans:', plans);
    setLoading(true); // 상세 정보 로드 시작 시 로딩 상태 설정
    
    const promises = plans.map(plan => {
      console.log(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 로드 시작`);
      return travelApi.invokeCheckplan(plan.plan_id.toString())
        .then(response => {
          console.log(`[ItineraryManager] 계획 ${plan.plan_id} 상세 데이터 응답:`, response);
          
          if (!response || !response.success || !response.plan) {
            console.warn(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 없음 또는 실패. 응답:`, response);
            // 상세 정보가 없거나 실패한 경우, 기본 plan 정보만 반환할 수 있습니다.
            // 또는 오류 처리를 위해 null이나 특정 객체를 반환할 수 있습니다.
            return { ...plan, error: '상세 정보 로드 실패' }; 
          }
          
          // itinerary_schedules가 문자열이면 JSON 파싱
          let schedules = response.plan.itinerary_schedules;
          if (typeof schedules === 'string') {
            try {
              schedules = JSON.parse(schedules);
              console.log(`[ItineraryManager] Plan ${plan.plan_id} itinerary_schedules 파싱 완료:`, schedules);
            } catch (parseError) {
              console.error(`[ItineraryManager] Plan ${plan.plan_id} itinerary_schedules JSON 파싱 오류:`, parseError);
              schedules = {}; // 파싱 실패 시 빈 객체로 설정 또는 다른 오류 처리
            }
          }
          
          // ItineraryDetail이 기대하는 형태로 데이터 구조화
          // API 응답의 plan 객체 내에 일차별 데이터가 바로 있다고 가정
          // 예: response.plan이 {'1': {...}, '2': {...}} 형태거나, 
          //    response.plan.itinerary_schedules가 그런 형태일 수 있음
          const processedData = {
            ...plan, // 기본 plan 정보 (plan_id, name 등)
            title: response.plan.name || plan.name, // 전체 여정 제목
            // dailyPlans 대신 schedules 객체를 직접 전달하도록 수정
            // ItineraryDetail에서 itinerary 데이터 자체를 {...} 로 받아서 처리
            ...(schedules && typeof schedules === 'object' ? schedules : {}), // dailyPlans 대신 직접 일자별 스케줄 주입
          };
          console.log(`[ItineraryManager] Plan ${plan.plan_id} 최종 처리 데이터:`, processedData);
          return processedData;
        })
        .catch(err => {
          console.error(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 조회 중 예외 발생:`, err);
          return { ...plan, error: '상세 정보 조회 중 예외 발생: ' + err.message }; // 오류 정보와 함께 반환
        });
    });
    
    Promise.all(promises)
      .then(detailedPlans => {
        console.log('[ItineraryManager] 모든 상세 정보 Promise.all 결과:', detailedPlans);
        
        // 오류가 있는 계획을 필터링하거나 사용자에게 알릴 수 있습니다.
        const validPlans = detailedPlans.filter(p => p && !p.error);
        const erroredPlans = detailedPlans.filter(p => p && p.error);

        if (erroredPlans.length > 0) {
          console.warn('[ItineraryManager] 일부 계획 상세 정보 로드 실패:', erroredPlans);
          // 필요하다면 사용자에게 부분적 오류 알림
        }

        setItineraries(validPlans);
        console.log('[ItineraryManager] setItineraries 호출됨, 유효한 계획:', validPlans);
        
        if (validPlans.length > 0 && !selectedItinerary) {
          console.log('[ItineraryManager] 첫 번째 유효한 계획 자동 선택 시도:', validPlans[0]);
          setSelectedItinerary(validPlans[0]);
        } else if (validPlans.length === 0) {
          console.log('[ItineraryManager] 유효한 상세 계획 없음. 샘플 데이터를 사용합니다.');
            const sampleItinerary = {
                plan_id: 'sample-fallback',
                name: '일본 도쿄 여행 (상세 로드 실패)',
                ...SAMPLE_ITINERARY_DATA
            };
            setItineraries([sampleItinerary]);
            setSelectedItinerary(sampleItinerary);
            setError('상세 여행 정보를 불러오지 못했습니다. 샘플 데이터를 표시합니다.');
        }
      })
      .catch(err => {
        console.error('[ItineraryManager] Promise.all 처리 중 오류:', err);
        setError('일부 계획 정보를 불러오는데 실패했습니다.');
        // 여기서도 샘플 데이터 폴백을 고려할 수 있습니다.
        const sampleItinerary = {
            plan_id: 'sample-promise-error',
            name: '일본 도쿄 여행 (Promise 오류)',
            ...SAMPLE_ITINERARY_DATA
        };
        setItineraries([sampleItinerary]);
        setSelectedItinerary(sampleItinerary);
      })
      .finally(() => {
        console.log('[ItineraryManager] loadDetailedPlans finally 블록 실행, 로딩 상태 false로 설정');
        setLoading(false);
      });
  };
  
  // 사이드바 캘린더에서 날짜 선택 시 호출될 함수
  const handleCalendarDateSelect = (date) => {
    console.log('[ItineraryManager] Date selected from Sidebar Calendar:', date);
    setSelectedDateFromCalendar(date);
    // TODO: 이 날짜를 기준으로 itineraries 필터링 및 selectedItinerary 업데이트 로직 추가
  };

  // 여행 계획 선택 처리
  const handleSelectItinerary = (itinerary) => {
    console.log('[ItineraryManager] 여행 계획 선택 (아마도 사이드바 목록에서):', itinerary);
    setSelectedItinerary(itinerary);
  };

  // 제목 업데이트 처리
  const handleTitleUpdate = (itineraryId, newTitle) => {
    console.log(`[ItineraryManager] handleTitleUpdate 호출: id=${itineraryId}, newTitle=${newTitle}`);
    setItineraries(prevItineraries =>
      prevItineraries.map(itinerary =>
        itinerary.plan_id === itineraryId
          ? { ...itinerary, name: newTitle }
          : itinerary
      )
    );
    
    // 선택된 일정이 수정된 경우 selectedItinerary도 업데이트
    if (selectedItinerary?.plan_id === itineraryId) {
      setSelectedItinerary(prev => {
        console.log('[ItineraryManager] selectedItinerary 업데이트:', {...prev, name: newTitle });
        return { ...prev, name: newTitle };
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 사이드바 */}
      <Sidebar 
        onSelectItinerary={handleSelectItinerary}
        selectedItinerary={selectedItinerary}
        itineraries={itineraries}
        onDateSelectFromCalendar={handleCalendarDateSelect}
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