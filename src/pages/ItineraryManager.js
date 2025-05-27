import React, { useState, useEffect } from 'react';
import Sidebar from '../components/itinerary/Sidebar';
import ItineraryDetail from '../components/itinerary/ItineraryDetail';
import { travelApi } from '../services/api';

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
          return;
        }
        
        // 결제 완료된 계획만 필터링
        const savedPlans = response.plans.filter(plan => plan.paid_plan === 1);
        console.log('[ItineraryManager] 전체 계획:', response.plans.length);
        console.log('[ItineraryManager] 결제 완료된 계획:', savedPlans.length);
        console.log('[ItineraryManager] 필터링된 계획:', savedPlans);
        
        if (savedPlans.length === 0) {
          setError('결제 완료된 여행 계획이 없습니다. 여행 계획을 결제한 후 이용해주세요.');
          setLoading(false);
        } else {
          loadDetailedPlans(savedPlans);
        }
      })
      .catch(err => {
        console.error('[ItineraryManager] 여행 계획 불러오기 오류:', err);
        setError('여행 계획을 불러오는데 문제가 발생했습니다: ' + err.message);
        setLoading(false);
      });
  }, []);
  
  const loadDetailedPlans = async (plans) => {
    console.log('[ItineraryManager] loadDetailedPlans 시작, plans:', plans);
    setLoading(true);
    
    const processedPlans = [];
    const failedPlans = [];
    
    // 순차적으로 계획 로드
    for (const plan of plans) {
      console.log(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 로드 시작`);
      
      // 최대 3번 재시도
      let retryCount = 0;
      let success = false;
      
      while (retryCount < 3 && !success) {
        try {
          const response = await travelApi.invokeCheckplan(plan.plan_id.toString());
          console.log(`[ItineraryManager] 계획 ${plan.plan_id} 상세 데이터 응답:`, response);
          
          if (!response || !response.success || !response.plan) {
            console.warn(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 없음 또는 실패. 응답:`, response);
            throw new Error('상세 정보 로드 실패');
          }
          
          // itinerary_schedules 파싱
          let schedules = response.plan.itinerary_schedules;
          if (typeof schedules === 'string') {
            try {
              schedules = JSON.parse(schedules);
              console.log(`[ItineraryManager] Plan ${plan.plan_id} itinerary_schedules 파싱 완료:`, schedules);
            } catch (parseError) {
              console.error(`[ItineraryManager] Plan ${plan.plan_id} itinerary_schedules JSON 파싱 오류:`, parseError);
              schedules = {};
            }
          }

          // 다중 항공편 정보 파싱 (flight_info_1, flight_info_2, ...)
          const flightInfos = [];
          let flightIndex = 1;
          while (response.plan[`flight_info_${flightIndex}`]) {
            try {
              const flightData = typeof response.plan[`flight_info_${flightIndex}`] === 'string'
                ? JSON.parse(response.plan[`flight_info_${flightIndex}`])
                : response.plan[`flight_info_${flightIndex}`];
              flightInfos.push(flightData);
              console.log(`[ItineraryManager] Plan ${plan.plan_id} 항공편 ${flightIndex} 정보 파싱 완료:`, flightData);
            } catch (e) {
              console.error(`[ItineraryManager] Plan ${plan.plan_id} 항공편 ${flightIndex} 정보 파싱 오류:`, e);
            }
            flightIndex++;
          }

          // 다중 숙박 정보 파싱 (accmo_info_1, accmo_info_2, ...)
          const accommodationInfos = [];
          let accmoIndex = 1;
          while (response.plan[`accmo_info_${accmoIndex}`]) {
            try {
              const accmoData = typeof response.plan[`accmo_info_${accmoIndex}`] === 'string'
                ? JSON.parse(response.plan[`accmo_info_${accmoIndex}`])
                : response.plan[`accmo_info_${accmoIndex}`];
              accommodationInfos.push(accmoData);
              console.log(`[ItineraryManager] Plan ${plan.plan_id} 숙박 ${accmoIndex} 정보 파싱 완료:`, accmoData);
            } catch (e) {
              console.error(`[ItineraryManager] Plan ${plan.plan_id} 숙박 ${accmoIndex} 정보 파싱 오류:`, e);
            }
            accmoIndex++;
          }

          // 일정에 다중 항공편과 숙박 정보 추가
          if (schedules && typeof schedules === 'object') {
            Object.keys(schedules).forEach(dayKey => {
              const daySchedules = schedules[dayKey].schedules || [];
              
              // 해당 날짜의 다중 항공편 추가
              if (flightInfos && flightInfos.length > 0) {
                flightInfos.forEach((flightInfo, flightIdx) => {
                  if (flightInfo && flightInfo.flightOfferDetails?.flightOfferData?.itineraries) {
                    const flightSchedules = flightInfo.flightOfferDetails.flightOfferData.itineraries
                      .filter(itinerary => {
                        const flightDate = new Date(itinerary.segments?.[0]?.departure?.at);
                        const dayDate = new Date(response.plan.start_date);
                        dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
                        return flightDate.toDateString() === dayDate.toDateString();
                      })
                      .map((itinerary, itineraryIdx) => ({
                        id: `flight-${flightIdx}-${itineraryIdx}-${dayKey}`,
                        name: itinerary.segments?.[0]?.departure?.iataCode +
                              ' → ' +
                              itinerary.segments?.[itinerary.segments.length - 1]?.arrival?.iataCode,
                        time: new Date(itinerary.segments?.[0]?.departure?.at)
                              .toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                        type: 'Flight_Departure',
                        category: '항공편',
                        duration: itinerary.duration,
                        notes: `가격: ${flightInfo.flightOfferDetails?.flightOfferData?.price?.total || '정보 없음'}`,
                        lat: null, // 항공편은 위치 정보 없음
                        lng: null
                      }));
                    daySchedules.push(...flightSchedules);
                  }
                });
              }

              // 해당 날짜의 다중 숙박 정보 추가
              if (accommodationInfos && accommodationInfos.length > 0) {
                accommodationInfos.forEach((accommodationInfo, accmoIdx) => {
                  if (accommodationInfo?.hotel && accommodationInfo.checkIn) {
                    const checkInDate = new Date(accommodationInfo.checkIn);
                    const checkOutDate = new Date(accommodationInfo.checkOut);
                    const dayDate = new Date(response.plan.start_date);
                    dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);

                    if (dayDate.toDateString() === checkInDate.toDateString()) {
                      daySchedules.push({
                        id: `hotel-${accommodationInfo.hotel.hotel_id || accmoIdx}-${dayKey}-in`,
                        name: accommodationInfo.hotel.hotel_name || accommodationInfo.hotel.name,
                        time: '체크인',
                        type: 'accommodation',
                        category: '숙소',
                        address: accommodationInfo.hotel.address || accommodationInfo.hotel.address_trans,
                        hotelDetails: accommodationInfo,
                        lat: accommodationInfo.hotel.latitude || null,
                        lng: accommodationInfo.hotel.longitude || null
                      });
                    }

                    if (dayDate.toDateString() === checkOutDate.toDateString()) {
                      daySchedules.push({
                        id: `hotel-${accommodationInfo.hotel.hotel_id || accmoIdx}-${dayKey}-out`,
                        name: accommodationInfo.hotel.hotel_name || accommodationInfo.hotel.name,
                        time: '체크아웃',
                        type: 'accommodation',
                        category: '숙소',
                        address: accommodationInfo.hotel.address || accommodationInfo.hotel.address_trans,
                        hotelDetails: accommodationInfo,
                        lat: accommodationInfo.hotel.latitude || null,
                        lng: accommodationInfo.hotel.longitude || null
                      });
                    }
                  }
                });
              }

              // 일정 시간순 정렬
              schedules[dayKey].schedules = daySchedules.sort((a, b) => {
                if (a.time === '체크인') return -1;
                if (b.time === '체크인') return 1;
                if (a.time === '체크아웃') return 1;
                if (b.time === '체크아웃') return -1;
                return a.time.localeCompare(b.time);
              });
            });
          }

          const processedData = {
            ...plan,
            title: response.plan.name || plan.name,
            ...(schedules && typeof schedules === 'object' ? schedules : {}),
            flightInfo: flightInfos, // 다중 항공편 정보 배열
            accommodationInfo: accommodationInfos.length > 0 ? accommodationInfos[0] : null, // 첫 번째 숙박 정보 (호환성)
            flightInfos, // 전체 항공편 정보 배열
            accommodationInfos, // 전체 숙박 정보 배열
            totalFlights: response.plan.total_flights || flightInfos.length,
            totalAccommodations: response.plan.total_accommodations || accommodationInfos.length
          };
          
          console.log(`[ItineraryManager] Plan ${plan.plan_id} 최종 처리 데이터:`, processedData);
          processedPlans.push(processedData);
          success = true;
        } catch (err) {
          console.error(`[ItineraryManager] 계획 ${plan.plan_id} 상세 정보 조회 중 예외 발생 (시도 ${retryCount + 1}/3):`, err);
          retryCount++;
          
          // 마지막 시도에서도 실패한 경우
          if (retryCount === 3) {
            failedPlans.push({ ...plan, error: '상세 정보 조회 중 예외 발생: ' + err.message });
          } else {
            // 재시도 전 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
    }

    // 결과 처리
    console.log('[ItineraryManager] 모든 상세 정보 로드 완료:', { 성공: processedPlans.length, 실패: failedPlans.length });
    
    if (failedPlans.length > 0) {
      console.warn('[ItineraryManager] 일부 계획 상세 정보 로드 실패:', failedPlans);
      setError(`${failedPlans.length}개의 여행 계획을 불러오지 못했습니다.`);
    }

    if (processedPlans.length > 0) {
      setItineraries(processedPlans);
      console.log('[ItineraryManager] setItineraries 호출됨, 유효한 계획:', processedPlans);
      
      if (!selectedItinerary) {
        console.log('[ItineraryManager] 첫 번째 유효한 계획 자동 선택:', processedPlans[0]);
        setSelectedItinerary(processedPlans[0]);
      }
    } else {
      setError('불러올 수 있는 여행 계획이 없습니다.');
    }

    setLoading(false);
    console.log('[ItineraryManager] loadDetailedPlans 완료');
  };
  
  // 사이드바 캘린더에서 날짜 선택 시 호출될 함수
  const handleCalendarDateSelect = (date) => {
    console.log('[ItineraryManager] Date selected from Sidebar Calendar:', date);
    setSelectedDateFromCalendar(date);
  };

  // 여행 계획 선택 처리
  const handleSelectItinerary = (itinerary) => {
    console.log('[ItineraryManager] 여행 계획 선택:', itinerary);
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
            <p className="ml-3">여행 계획을 불러오는 중...</p>
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
            <p className="text-gray-500 mb-4">여행 계획을 선택해주세요</p>
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