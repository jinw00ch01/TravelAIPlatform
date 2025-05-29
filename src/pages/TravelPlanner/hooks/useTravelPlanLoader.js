import { useState, useEffect, useCallback } from 'react';
import { format as formatDateFns } from 'date-fns';
import { travelApi } from '../../../services/api';
import useFlightHandlers from './useFlightHandlers';
import { sortSchedulesByTime } from '../utils/scheduleUtils';

// 날짜 포맷팅 유틸리티 함수 (loader 내부용)
const formatDateForTitleInternal = (date, dayNumber) => {
  if (!date || isNaN(date.getTime())) return `Day ${dayNumber}`;
  return formatDateFns(date, 'M/d');
};

// 날짜를 dayKey로 변환하는 유틸리티 함수
const getDayKeyForDate = (dateStr, startDate) => {
  if (!dateStr || !startDate) return null;
  const date = new Date(dateStr);
  const start = new Date(startDate);
  if (isNaN(date.getTime()) || isNaN(start.getTime())) return null;
  
  const diffTime = Math.abs(date - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return (diffDays + 1).toString();
};

const useTravelPlanLoader = (user, planIdFromUrl, loadMode) => {
  const [travelPlans, setTravelPlans] = useState({});
  const [dayOrder, setDayOrder] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [planId, setPlanId] = useState(null);
  const [planName, setPlanName] = useState(null);
  const [sharedEmailFromLoader, setSharedEmailFromLoader] = useState('');
  const [isLoadingPlan, setIsLoadingPlan] = useState(true); 
  const [loadedFlightInfo, setLoadedFlightInfo] = useState(null);
  const [loadedFlightInfos, setLoadedFlightInfos] = useState([]); // 다중 항공편
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loadedAccommodationInfo, setLoadedAccommodationInfo] = useState(null);
  const [loadedAccommodationInfos, setLoadedAccommodationInfos] = useState([]); // 다중 숙박편
  const [isSharedPlan, setIsSharedPlan] = useState(false);
  const [sharedEmails, setSharedEmails] = useState([]);
  const [originalOwner, setOriginalOwner] = useState(null);
  
  const { createFlightSchedules } = useFlightHandlers();

  const initializePlanState = useCallback(() => {
    console.log('[useTravelPlanLoader] initializePlanState 호출됨');
    const initialDate = new Date();
    const initialDateStr = formatDateFns(initialDate, 'M/d');
    setTravelPlans({ '1': { title: initialDateStr, schedules: [] } });
    setDayOrder(['1']);
    setSelectedDay('1');
    setStartDate(initialDate);
    setPlanId(null);
    setPlanName(null);
    setSharedEmailFromLoader('');
    setLoadedFlightInfo(null);
    setLoadedFlightInfos([]);
    setIsRoundTrip(false);
    setLoadError(null);
    setLoadedAccommodationInfo(null);
    setLoadedAccommodationInfos([]);
    setIsSharedPlan(false);
    setSharedEmails([]);
    setOriginalOwner(null);
    setIsLoadingPlan(false);
  }, []);

  // 최신 계획 로드 함수
  const loadNewestPlan = useCallback(async (potentialStartDate) => {
    console.log('[useTravelPlanLoader] 최신 계획 로드 시작');
    const params = { include_details: true, newest: true };
    
    try {
      const data = await travelApi.loadPlan(params);
      console.log('[useTravelPlanLoader] 최신 계획 로드 응답:', data);
      return processLoadedData(data, potentialStartDate);
    } catch (error) {
      console.error('[useTravelPlanLoader] 최신 계획 로드 실패:', error);
      throw error;
    }
  }, []);

  // 특정 ID로 계획 로드 함수
  const loadPlanById = useCallback(async (id, potentialStartDate) => {
    console.log(`[useTravelPlanLoader] ID ${id}로 계획 로드 시작`);
    const params = { include_details: true, planId: id };
    
    try {
      const data = await travelApi.loadPlan(params);
      console.log(`[useTravelPlanLoader] ID ${id} 계획 로드 응답:`, data);
      return processLoadedData(data, potentialStartDate);
    } catch (error) {
      console.error(`[useTravelPlanLoader] ID ${id} 계획 로드 실패:`, error);
      throw error;
    }
  }, []);

  // 데이터 처리 함수 분리
  const processLoadedData = useCallback((data, potentialStartDate) => {
    let newTravelPlans = {};
    let newDayOrder = [];
    let newSelectedDay = '1';
    let newPlanId = null;
    let newStartDate = null;
    let planName = null;
    let sharedEmail = null;
    let isDataProcessed = false;
    let parsedFlightInfo = null;
    let parsedFlightInfos = [];
    let roundTripFlag = false;
    let parsedAccommodationInfo = null;
    let parsedAccommodationInfos = [];

    // checkplanfunction API에서 받은 데이터 구조 확인 및 처리 (plan이 배열이 아니라 객체인 경우)
    if (data?.plan?.itinerary_schedules && typeof data.plan.itinerary_schedules === 'string') {
      console.log('[useTravelPlanLoader] checkplanfunction API 응답 데이터 처리 (plan 객체)');
      console.log('[useTravelPlanLoader] data.plan 전체:', data.plan);
      console.log('[useTravelPlanLoader] data.plan.name:', data.plan.name);
      console.log('[useTravelPlanLoader] data.plan.plan_id:', data.plan.plan_id);
      
      try {
        // plan_id가 있으면 저장
        if (data.plan.plan_id) {
          newPlanId = data.plan.plan_id;
        }
        
        // 계획 제목 저장
        if (data.plan.name) {
          planName = data.plan.name;
          console.log('[useTravelPlanLoader] 계획 제목 추출 성공:', planName);
        } else {
          console.log('[useTravelPlanLoader] 계획 제목(name) 없음!');
        }
        
        // 공유 이메일 정보 저장
        if (data.plan.shared_email) {
          sharedEmail = data.plan.shared_email;
          console.log('[useTravelPlanLoader] 공유 이메일 추출 성공:', sharedEmail);
        }
        
        // 공유 상태 확인 (is_shared_with_me 필드 또는 original_owner 필드로 판단)
        const isSharedWithMe = data.is_shared_with_me === true || data.plan.is_shared_with_me === true;
        console.log('[useTravelPlanLoader] 공유 상태 확인:', { 
          is_shared_with_me: data.is_shared_with_me, 
          plan_is_shared_with_me: data.plan.is_shared_with_me,
          isSharedWithMe 
        });

        // ✅ checkplan API 응답에서 다중 항공편/숙박편 정보 추출
        if (data.flightInfos && Array.isArray(data.flightInfos) && data.flightInfos.length > 0) {
          parsedFlightInfos = data.flightInfos;
          parsedFlightInfo = data.flightInfos[0]; // 하위 호환성
          roundTripFlag = data.isRoundTrip || false;
          console.log('[useTravelPlanLoader] checkplan API에서 다중 항공편 정보 추출:', parsedFlightInfos.length, '개');
        } else if (data.flightInfo) {
          parsedFlightInfo = data.flightInfo;
          parsedFlightInfos = [data.flightInfo];
          roundTripFlag = data.isRoundTrip || false;
          console.log('[useTravelPlanLoader] checkplan API에서 단일 항공편 정보 추출 (하위 호환성)');
        }

        if (data.accommodationInfos && Array.isArray(data.accommodationInfos) && data.accommodationInfos.length > 0) {
          parsedAccommodationInfos = data.accommodationInfos;
          parsedAccommodationInfo = data.accommodationInfos[0]; // 하위 호환성
        } else if (data.accommodationInfo) {
          parsedAccommodationInfo = data.accommodationInfo;
          parsedAccommodationInfos = [data.accommodationInfo];
        }
        
        // 시작 날짜 설정 (다중 정보 처리 전에 먼저 설정)
        if (!newStartDate) {
          // 첫 번째 항공편에서 시작 날짜 추출 시도
          if (parsedFlightInfos && parsedFlightInfos.length > 0) {
            const firstFlight = parsedFlightInfos[0];
            if (firstFlight.itineraries?.[0]?.segments?.[0]?.departure?.at) {
              newStartDate = new Date(firstFlight.itineraries[0].segments[0].departure.at);
              console.log('[useTravelPlanLoader] 다중 항공편에서 시작 날짜 설정:', newStartDate);
            }
          }
          
          // 항공편에서 날짜를 찾지 못했으면 기본값 사용
          if (!newStartDate) {
            newStartDate = potentialStartDate;
            console.log('[useTravelPlanLoader] 기본 시작 날짜 사용:', newStartDate);
          }
        }
        
        // itinerary_schedules 파싱
        console.log('[useTravelPlanLoader] 🔍 itinerary_schedules 확인:', {
          존재여부: !!data.plan.itinerary_schedules,
          타입: typeof data.plan.itinerary_schedules,
          길이: data.plan.itinerary_schedules?.length || 0,
          첫100글자: data.plan.itinerary_schedules?.substring(0, 100) || 'N/A'
        });
        
        // ✅ 수정: itinerary_schedules 존재 여부 확인 후 파싱
        if (data.plan.itinerary_schedules) {
          try {
            const parsedSchedules = JSON.parse(data.plan.itinerary_schedules);
            console.log('[useTravelPlanLoader] 🔍 파싱된 itinerary_schedules:', {
              타입: typeof parsedSchedules,
              키수: Object.keys(parsedSchedules || {}).length,
              키목록: Object.keys(parsedSchedules || {}),
              첫번째일정샘플: parsedSchedules?.[Object.keys(parsedSchedules || {})[0]]
            });
            
            // ✅ 수정: 일반 일정을 먼저 복원하고, 이후에 숙박편/항공편 추가
            newTravelPlans = { ...parsedSchedules };
            newDayOrder = Object.keys(parsedSchedules).sort((a, b) => parseInt(a) - parseInt(b));
            newSelectedDay = newDayOrder[0] || '1';
            
            console.log('[useTravelPlanLoader] ✅ 일반 일정 복원 완료:', {
              복원된일차수: Object.keys(newTravelPlans).length,
              일차별일정수: Object.fromEntries(Object.entries(newTravelPlans).map(([day, plan]) => 
                [day, { 제목: plan.title, 일정수: plan.schedules?.length || 0 }]
              ))
            });
          } catch (error) {
            console.error('[useTravelPlanLoader] itinerary_schedules 파싱 실패:', error);
            console.log('[useTravelPlanLoader] 기본 빈 일정으로 초기화');
            newTravelPlans = {};
            newDayOrder = [];
            newSelectedDay = '1';
          }
        } else {
          console.log('[useTravelPlanLoader] ⚠️ itinerary_schedules 없음 - 기본 빈 일정으로 초기화');
          newTravelPlans = {};
          newDayOrder = [];
          newSelectedDay = '1';
        }
        
        // ✅ 다중 항공편 정보를 travel-plans 형태로 변환하여 일정에 추가
        if (parsedFlightInfos && parsedFlightInfos.length > 0) {
          console.log('[useTravelPlanLoader] checkplan API - 다중 항공편을 일정에 추가 시작:', parsedFlightInfos.length, '개');
          
          parsedFlightInfos.forEach((flightInfo, index) => {
            if (!flightInfo || !flightInfo.itineraries || flightInfo.itineraries.length === 0) {
              console.warn(`[useTravelPlanLoader] checkplan API - 항공편 ${index + 1} 데이터가 유효하지 않음`);
              return;
            }

            console.log(`[useTravelPlanLoader] checkplan API - 항공편 ${index + 1} 처리 중:`, flightInfo.id || 'ID없음');
            
            // 각 여정(itinerary)에 대해 일정 생성
            flightInfo.itineraries.forEach((itinerary, itineraryIndex) => {
              if (!itinerary.segments || itinerary.segments.length === 0) return;
              
              const firstSegment = itinerary.segments[0];
              const lastSegment = itinerary.segments[itinerary.segments.length - 1];
              const departureDateTime = new Date(firstSegment.departure.at);
              
              // 출발 날짜에 해당하는 day 키 찾기
              const dayKey = newDayOrder.find(dayKey => {
                const dayDate = new Date(newStartDate);
                dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
                dayDate.setHours(0, 0, 0, 0);
                
                const flightDate = new Date(departureDateTime.getFullYear(), departureDateTime.getMonth(), departureDateTime.getDate());
                return dayDate.getTime() === flightDate.getTime();
              });

              if (dayKey) {
                // 항공편 타입 결정
                let flightType = 'Flight_OneWay';
                if (flightInfo.itineraries.length > 1) {
                  flightType = itineraryIndex === 0 ? 'Flight_Departure' : 'Flight_Return';
                }
                
                const flightSchedule = {
                  id: `saved-flight-${flightInfo.id || index}-${itineraryIndex}-${dayKey}`,
                  name: `${firstSegment.departure.iataCode} → ${lastSegment.arrival.iataCode}`,
                  address: `${firstSegment.departure.iataCode} → ${lastSegment.arrival.iataCode}`,
                  category: `${firstSegment.carrierCode} ${firstSegment.number}${itinerary.segments.length > 1 ? ` 외 ${itinerary.segments.length - 1}개 구간` : ''}`,
                  time: departureDateTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                  duration: '항공편',
                  type: flightType,
                  lat: null,
                  lng: null,
                  notes: `출발: ${departureDateTime.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
                  flightOfferDetails: {
                    flightOfferData: flightInfo
                  }
                };

                if (!newTravelPlans[dayKey]) {
                  const dayDate = new Date(newStartDate);
                  dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
                  newTravelPlans[dayKey] = {
                    title: formatDateForTitleInternal(dayDate, parseInt(dayKey)),
                    schedules: []
                  };
                }
                
                // ✅ 수정: 기존 일정을 유지하고 항공편을 맨 앞에 추가
                const existingFlightSchedules = newTravelPlans[dayKey].schedules || [];
                newTravelPlans[dayKey].schedules = [flightSchedule, ...existingFlightSchedules]; // 항공편은 맨 앞에 추가
                console.log(`[useTravelPlanLoader] checkplan API - Day ${dayKey}에 항공편 ${index + 1}-${itineraryIndex + 1} 일정 추가 완료`);
              }
            });
          });
          
          console.log('[useTravelPlanLoader] checkplan API - 다중 항공편 일정 추가 완료');
        }
        
        // ✅ 다중 숙박편 정보를 travel-plans 형태로 변환하여 일정에 추가
        if (parsedAccommodationInfos && parsedAccommodationInfos.length > 0) {
          
          // 숙박편 정보에서 실제 여행 시작 날짜 계산
          const accommodationDates = parsedAccommodationInfos.map(acc => new Date(acc.checkIn));
          const earliestCheckIn = new Date(Math.min(...accommodationDates));
          
          // 실제 여행 시작 날짜와 현재 설정된 시작 날짜가 다르면 보정
          if (earliestCheckIn.toISOString().split('T')[0] !== newStartDate.toISOString().split('T')[0]) {
            newStartDate = earliestCheckIn;
            
            // dayOrder도 다시 계산
            const totalDays = Math.max(...Object.keys(newTravelPlans).map(k => parseInt(k)));
            newDayOrder = Array.from({ length: totalDays }, (_, i) => (i + 1).toString());
          }

          parsedAccommodationInfos.forEach((accommodationInfo, index) => {
            if (!accommodationInfo?.hotel || !accommodationInfo.checkIn || !accommodationInfo.checkOut) {
              console.warn(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1} 정보가 불완전함`);
              return;
            }

            console.log(`[useTravelPlanLoader] 숙박편 ${index + 1} 처리 시작:`, {
              hotelName: accommodationInfo.hotel.hotel_name || accommodationInfo.hotel.hotel_name_trans,
              originalCheckIn: accommodationInfo.checkIn,
              originalCheckOut: accommodationInfo.checkOut,
              fullAccommodationInfo: accommodationInfo
            });

            // 가격 정보를 여러 필드에서 추출
            const extractPrice = (accommodationData) => {
              const priceFields = [
                accommodationData.hotel?.price,
                accommodationData.price,
                accommodationData.room?.price,
                accommodationData.hotel?.composite_price_breakdown?.gross_amount?.value,
                accommodationData.composite_price_breakdown?.gross_amount?.value,
                accommodationData.cost
              ];

              for (const priceField of priceFields) {
                if (priceField !== null && priceField !== undefined && priceField !== '') {
                  return priceField;
                }
              }
              return null;
            };

            const hotelInfo = accommodationInfo.hotel;
            const extractedPrice = extractPrice(accommodationInfo);
            console.log(`[useTravelPlanLoader] 저장된 숙박편 가격 추출:`, {
              hotelName: hotelInfo.hotel_name || hotelInfo.hotel_name_trans,
              extractedPrice: extractedPrice,
              originalPrice: hotelInfo.price,
              accommodationPrice: accommodationInfo.price
            });

            // 체크인/체크아웃 날짜를 dayKey로 매핑
            const checkInDate = new Date(accommodationInfo.checkIn);
            const checkOutDate = new Date(accommodationInfo.checkOut);
            
            // ✅ 수정: 문자열 기반 날짜 비교를 위한 변수를 먼저 정의
            const checkInStr = checkInDate.toISOString().split('T')[0];
            const checkOutStr = checkOutDate.toISOString().split('T')[0];
            
            const matchingDays = newDayOrder.map(dayKey => {
              const dayDate = new Date(newStartDate);
              dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
              const dayDateStr = dayDate.toISOString().split('T')[0];
              
              return {
                dayKey,
                dayDate: dayDateStr,
                isCheckIn: dayDateStr === checkInStr,
                isCheckOut: dayDateStr === checkOutStr
              };
            });

            console.log(`[useTravelPlanLoader] 숙박편 ${index + 1} 날짜 매칭 결과:`, {
              hotelName: hotelInfo.hotel_name || hotelInfo.hotel_name_trans,
              checkIn: checkInStr,
              checkOut: checkOutStr,
              여행시작날짜: newStartDate.toISOString().split('T')[0],
              dayOrder: newDayOrder,
              matchingDays: matchingDays.map(d => ({
                dayKey: d.dayKey,
                dayDate: d.dayDate,
                isCheckIn: d.isCheckIn,
                isCheckOut: d.isCheckOut,
                체크인비교: `${d.dayDate} === ${checkInStr} = ${d.isCheckIn}`,
                체크아웃비교: `${d.dayDate} === ${checkOutStr} = ${d.isCheckOut}`
              }))
            });

            // 기본 스케줄 정보
            const baseSchedule = {
              name: hotelInfo.hotel_name || hotelInfo.hotel_name_trans,
              address: hotelInfo.address || hotelInfo.address_trans,
              category: '숙소',
              type: 'accommodation',
              hotelDetails: accommodationInfo,
              lat: hotelInfo.latitude,
              lng: hotelInfo.longitude,
              notes: extractedPrice ? `가격: ${extractedPrice}` : ''
            };

            // 체크인 일정 추가
            const checkInDay = matchingDays.find(d => d.isCheckIn);
            if (checkInDay) {
              const checkInSchedule = {
                ...baseSchedule,
                id: `saved-hotel-${hotelInfo.hotel_id}-${index}-${checkInDay.dayKey}-in`,
                time: '체크인',
                duration: '1박'
              };

              // ✅ 제거: 일반 숙박 일정 중복 생성하지 않음 (data에서 자동 복원됨)
              // const checkInGeneralSchedule = { ... }

              if (!newTravelPlans[checkInDay.dayKey]) {
                const checkInDateObj = new Date(newStartDate);
                checkInDateObj.setDate(checkInDateObj.getDate() + parseInt(checkInDay.dayKey) - 1);
                newTravelPlans[checkInDay.dayKey] = {
                  title: formatDateForTitleInternal(checkInDateObj, parseInt(checkInDay.dayKey)),
                  schedules: []
                };
              }
              
              // ✅ 수정: 기존 일정이 있으면 유지하고 숙박편 추가
              const existingSchedules = newTravelPlans[checkInDay.dayKey].schedules || [];
              newTravelPlans[checkInDay.dayKey].schedules = [...existingSchedules, checkInSchedule];
              console.log(`[useTravelPlanLoader] checkplan API - 저장된 숙박편 ${index + 1} 체크인 일정 추가 완료 (Day ${checkInDay.dayKey}, 날짜: ${checkInDay.dayDate})`);
              console.log(`[useTravelPlanLoader] 추가된 체크인 일정:`, checkInSchedule);
              // ✅ 제거: 일반 일정 로그 제거
              // console.log(`[useTravelPlanLoader] 추가된 체크인 일반 일정:`, checkInGeneralSchedule);
            } else {
              console.warn(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1}의 체크인 날짜(${checkInStr})가 여행 일정 범위에 없음`);
            }

            // 체크아웃 일정 추가 (checkIn과 다를 때만)
            const checkOutDay = matchingDays.find(d => d.isCheckOut);
            if (checkOutDay && checkOutDay.dayKey !== checkInDay?.dayKey) {
              const checkOutSchedule = {
                ...baseSchedule,
                id: `saved-hotel-${hotelInfo.hotel_id}-${index}-${checkOutDay.dayKey}-out`,
                time: '체크아웃',
                duration: ''
              };

              // ✅ 제거: 일반 숙박 일정 중복 생성하지 않음 (data에서 자동 복원됨)
              // const checkOutGeneralSchedule = { ... }

              if (!newTravelPlans[checkOutDay.dayKey]) {
                const checkOutDateObj = new Date(newStartDate);
                checkOutDateObj.setDate(checkOutDateObj.getDate() + parseInt(checkOutDay.dayKey) - 1);
                newTravelPlans[checkOutDay.dayKey] = {
                  title: formatDateForTitleInternal(checkOutDateObj, parseInt(checkOutDay.dayKey)),
                  schedules: []
                };
              }
              
              // ✅ 수정: 기존 일정이 있으면 유지하고 체크아웃 일정 추가
              const existingCheckOutSchedules = newTravelPlans[checkOutDay.dayKey].schedules || [];
              newTravelPlans[checkOutDay.dayKey].schedules = [...existingCheckOutSchedules, checkOutSchedule];
              console.log(`[useTravelPlanLoader] checkplan API - 저장된 숙박편 ${index + 1} 체크아웃 일정 추가 완료 (Day ${checkOutDay.dayKey}, 날짜: ${checkOutDay.dayDate})`);
              console.log(`[useTravelPlanLoader] 추가된 체크아웃 일정:`, checkOutSchedule);
              // ✅ 제거: 일반 일정 로그 제거
              // console.log(`[useTravelPlanLoader] 추가된 체크아웃 일반 일정:`, checkOutGeneralSchedule);
            } else if (checkOutDay && checkOutDay.dayKey === checkInDay?.dayKey) {
              console.log(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1}의 체크인과 체크아웃이 같은 날짜라 체크아웃 일정 스킵`);
            } else {
              console.warn(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1}의 체크아웃 날짜(${checkOutStr})가 여행 일정 범위에 없음`);
            }
          });
          
          console.log('[useTravelPlanLoader] checkplan API - 다중 숙박편 일정 추가 완료');
          
          // ✅ 로딩 시 시간 순서대로 일정 정렬 (숙박편은 같은 시간대에서 뒤로 배치)
          Object.keys(newTravelPlans).forEach(dayKey => {
            if (newTravelPlans[dayKey]?.schedules?.length > 0) {
              newTravelPlans[dayKey].schedules = sortSchedulesByTime(newTravelPlans[dayKey].schedules);
            }
          });
        }
        
        console.log('[useTravelPlanLoader] checkplanfunction API 데이터 처리 완료');
        isDataProcessed = true;
      } catch (e) {
        console.error('[useTravelPlanLoader] itinerary_schedules 파싱 실패:', e);
        throw new Error('여행 일정 데이터 처리 중 오류가 발생했습니다.');
      }
    }
    
    // 기존 정제 로직은 checkplanfunction 처리가 되지 않았을 때만 실행
    if (!isDataProcessed) {
      console.log('[useTravelPlanLoader] 다른 데이터 처리 경로 실행');
      console.log('[useTravelPlanLoader] data 전체 구조:', data);
      
      // 우선 name 필드부터 확인
      if (data?.plan && !Array.isArray(data.plan) && data.plan.name) {
        planName = data.plan.name;
        console.log('[useTravelPlanLoader] 단일 plan 객체에서 name 추출:', planName);
      } else if (data?.plan?.[0]?.name) {
        planName = data.plan[0].name;
        console.log('[useTravelPlanLoader] plan 배열[0]에서 name 추출:', planName);
      }
      
      // shared_email 필드 확인
      if (data?.plan && !Array.isArray(data.plan) && data.plan.shared_email) {
        sharedEmail = data.plan.shared_email;
        console.log('[useTravelPlanLoader] 단일 plan 객체에서 shared_email 추출:', sharedEmail);
      } else if (data?.plan?.[0]?.shared_email) {
        sharedEmail = data.plan[0].shared_email;
        console.log('[useTravelPlanLoader] plan 배열[0]에서 shared_email 추출:', sharedEmail);
      }

      if (data?.plan?.[0]?.start_date) {
        newStartDate = new Date(data.plan[0].start_date);
      } else if (data?.originalData?.start_date) {
        newStartDate = new Date(data.originalData.start_date);
      } else if (data?.start_date) {
        newStartDate = new Date(data.start_date);
      } else if (data?.plan?.[0]?.plan_data?.start_date) {
        newStartDate = new Date(data.plan[0].plan_data.start_date);
      }

      if (!newStartDate || isNaN(newStartDate.getTime())) {
        newStartDate = potentialStartDate; 
        console.log('[useTravelPlanLoader] API 응답에 start_date 없어 기존 또는 오늘 날짜로 newStartDate 설정:', newStartDate);
      } else {
        console.log('[useTravelPlanLoader] API 응답으로부터 newStartDate 설정 성공:', newStartDate);
      }
      
      const flightDataSource = data?.originalData?.flight_info ? data.originalData : (data?.flightInfo ? data : null);

      if (flightDataSource) {
        try {
          parsedFlightInfo = typeof flightDataSource.flight_info === 'string' 
            ? JSON.parse(flightDataSource.flight_info) 
            : flightDataSource.flight_info;
          
          const isRoundTripSource = flightDataSource.is_round_trip;
          roundTripFlag = isRoundTripSource === 'true' || isRoundTripSource === true || 
                          parsedFlightInfo?.isRoundTrip || 
                          (parsedFlightInfo?.oneWay === false) || 
                          (parsedFlightInfo?.itineraries?.length > 1) || 
                          false;
          console.log('[useTravelPlanLoader] flightInfo 파싱 완료', { parsedFlightInfo, roundTripFlag });
        } catch (e) {
          console.error('[useTravelPlanLoader] flight_info 파싱 실패:', e);
        }
      }

      // ✅ 다중 항공편/숙박편 정보 처리 (checkplan API가 아닌 경우에만 실행)
      if (!parsedFlightInfos || parsedFlightInfos.length === 0) {
        // LoadPlanFunction_NEW 응답에서 다중 항공편/숙박편 정보 처리
        if (data?.flightInfos && Array.isArray(data.flightInfos) && data.flightInfos.length > 0) {
          parsedFlightInfos = data.flightInfos;
          parsedFlightInfo = data.flightInfos[0]; // 하위 호환성
          roundTripFlag = data.isRoundTrip || false;
          console.log('[useTravelPlanLoader] LoadPlanFunction_NEW 응답에서 다중 항공편 설정', { 개수: parsedFlightInfos.length, 왕복: roundTripFlag });
        } else if (data?.flightInfo) {
          parsedFlightInfo = data.flightInfo;
          parsedFlightInfos = [data.flightInfo];
          roundTripFlag = data.isRoundTrip || false;
          console.log('[useTravelPlanLoader] LoadPlanFunction_NEW 응답에서 단일 항공편 설정 (하위 호환성)');
        }
      }

      if (!parsedAccommodationInfos || parsedAccommodationInfos.length === 0) {
        if (data?.accommodationInfos && Array.isArray(data.accommodationInfos) && data.accommodationInfos.length > 0) {
          parsedAccommodationInfos = data.accommodationInfos;
          parsedAccommodationInfo = data.accommodationInfos[0]; // 하위 호환성
          console.log('[useTravelPlanLoader] LoadPlanFunction_NEW 응답에서 다중 숙박편 설정', { 개수: parsedAccommodationInfos.length });
        } else if (data?.accommodationInfo) {
          parsedAccommodationInfo = data.accommodationInfo;
          parsedAccommodationInfos = [data.accommodationInfo];
          console.log('[useTravelPlanLoader] LoadPlanFunction_NEW 응답에서 단일 숙박편 설정 (하위 호환성)');
        }
      }



      if (data?.plannerData && Object.keys(data.plannerData).length > 0) {
        console.log('[useTravelPlanLoader] 서버에서 처리된 플래너 데이터 발견 (plannerData)');
        newTravelPlans = data.plannerData;
        newDayOrder = Object.keys(data.plannerData).sort((a, b) => parseInt(a) - parseInt(b));
        newSelectedDay = newDayOrder[0] || '1';
        if (data.plan?.[0]?.id) newPlanId = data.plan[0].id;
        if (data.plan?.[0]?.name) planName = data.plan[0].name;
      } else if (data?.plan?.[0]?.itinerary_schedules && Object.keys(data.plan[0].itinerary_schedules).length > 0) {
        console.log('[useTravelPlanLoader] itinerary_schedules 데이터 발견');
        const itinerarySchedules = data.plan[0].itinerary_schedules;
        if (data.plan[0].plan_id) newPlanId = data.plan[0].plan_id;
        if (data.plan[0].name) planName = data.plan[0].name;

        Object.keys(itinerarySchedules).sort((a, b) => parseInt(a) - parseInt(b)).forEach(dayKey => {
          const dayPlan = itinerarySchedules[dayKey];
          const date = new Date(newStartDate); 
          date.setDate(date.getDate() + parseInt(dayKey) - 1);
          const dateStr = formatDateFns(date, 'M/d');
          const detail = (dayPlan.title || '').replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim();
          const fullTitle = detail ? `${dateStr} ${detail}` : dateStr;
          newTravelPlans[dayKey] = {
            title: fullTitle,
            schedules: Array.isArray(dayPlan.schedules) ? [...dayPlan.schedules] : []
          };
          newDayOrder.push(dayKey);
        });
        newSelectedDay = newDayOrder[0] || '1';
        
        // ✅ itinerary_schedules 처리 후 travel-plans 다중 항공편/숙박편 정보를 일정에 추가
        if (parsedFlightInfos && parsedFlightInfos.length > 0) {
          console.log('[useTravelPlanLoader] travel-plans - 다중 항공편을 일정에 추가 시작:', parsedFlightInfos.length, '개');
          
          parsedFlightInfos.forEach((flightInfo, index) => {
            if (!flightInfo || !flightInfo.itineraries || flightInfo.itineraries.length === 0) {
              console.warn(`[useTravelPlanLoader] travel-plans - 항공편 ${index + 1} 데이터가 유효하지 않음`);
              return;
            }

            console.log(`[useTravelPlanLoader] travel-plans - 항공편 ${index + 1} 처리 중:`, flightInfo.id || 'ID없음');
            
            // 각 여정(itinerary)에 대해 일정 생성
            flightInfo.itineraries.forEach((itinerary, itineraryIndex) => {
              if (!itinerary.segments || itinerary.segments.length === 0) return;
              
              const firstSegment = itinerary.segments[0];
              const lastSegment = itinerary.segments[itinerary.segments.length - 1];
              const departureDateTime = new Date(firstSegment.departure.at);
              
              // 출발 날짜에 해당하는 day 키 찾기
              const dayKey = newDayOrder.find(dayKey => {
                const dayDate = new Date(newStartDate);
                dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
                dayDate.setHours(0, 0, 0, 0);
                
                const flightDate = new Date(departureDateTime.getFullYear(), departureDateTime.getMonth(), departureDateTime.getDate());
                return dayDate.getTime() === flightDate.getTime();
              });

              if (dayKey) {
                // 항공편 타입 결정
                let flightType = 'Flight_OneWay';
                if (flightInfo.itineraries.length > 1) {
                  flightType = itineraryIndex === 0 ? 'Flight_Departure' : 'Flight_Return';
                }
                
                const flightSchedule = {
                  id: `travel-flight-${flightInfo.id || index}-${itineraryIndex}-${dayKey}`,
                  name: `${firstSegment.departure.iataCode} → ${lastSegment.arrival.iataCode}`,
                  address: `${firstSegment.departure.iataCode} → ${lastSegment.arrival.iataCode}`,
                  category: `${firstSegment.carrierCode} ${firstSegment.number}${itinerary.segments.length > 1 ? ` 외 ${itinerary.segments.length - 1}개 구간` : ''}`,
                  time: departureDateTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                  duration: '항공편',
                  type: flightType,
                  lat: null,
                  lng: null,
                  notes: `출발: ${departureDateTime.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
                  flightOfferDetails: {
                    flightOfferData: flightInfo
                  }
                };

                if (!newTravelPlans[dayKey]) {
                  const dayDate = new Date(newStartDate);
                  dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
                  newTravelPlans[dayKey] = {
                    title: formatDateForTitleInternal(dayDate, parseInt(dayKey)),
                    schedules: []
                  };
                }
                
                newTravelPlans[dayKey].schedules.unshift(flightSchedule); // 항공편은 맨 앞에 추가
                console.log(`[useTravelPlanLoader] travel-plans - Day ${dayKey}에 항공편 ${index + 1}-${itineraryIndex + 1} 일정 추가 완료`);
              }
            });
          });
          
          console.log('[useTravelPlanLoader] travel-plans - 다중 항공편 일정 추가 완료');
        }
        
        // ✅ travel-plans 다중 숙박편 정보를 일정에 추가
        if (parsedAccommodationInfos && parsedAccommodationInfos.length > 0) {
          
          // 숙박편 정보에서 실제 여행 시작 날짜 계산
          const accommodationDates = parsedAccommodationInfos.map(acc => new Date(acc.checkIn));
          const earliestCheckIn = new Date(Math.min(...accommodationDates));
          
          // 실제 여행 시작 날짜와 현재 설정된 시작 날짜가 다르면 보정
          if (earliestCheckIn.toISOString().split('T')[0] !== newStartDate.toISOString().split('T')[0]) {
            newStartDate = earliestCheckIn;
            
            // dayOrder도 다시 계산
            const totalDays = Math.max(...Object.keys(newTravelPlans).map(k => parseInt(k)));
            newDayOrder = Array.from({ length: totalDays }, (_, i) => (i + 1).toString());
          }

          parsedAccommodationInfos.forEach((accommodationInfo, index) => {
            if (!accommodationInfo?.hotel || !accommodationInfo.checkIn || !accommodationInfo.checkOut) {
              console.warn(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1} 정보가 불완전함`);
              return;
            }

            const checkInDate = new Date(accommodationInfo.checkIn);
            const checkOutDate = new Date(accommodationInfo.checkOut);
            checkInDate.setHours(0, 0, 0, 0);
            checkOutDate.setHours(0, 0, 0, 0);

            // 체크인과 체크아웃 날짜에 해당하는 day 키 찾기
            const dayKeys = newDayOrder.filter(dayKey => {
              const dayDate = new Date(newStartDate);
              dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
              dayDate.setHours(0, 0, 0, 0);
              
              const isCheckInDay = dayDate.getTime() === checkInDate.getTime();
              const isCheckOutDay = dayDate.getTime() === checkOutDate.getTime();
              return isCheckInDay || isCheckOutDay;
            }).sort((a, b) => parseInt(a) - parseInt(b));

            if (dayKeys.length > 0) {
              const hotelInfo = accommodationInfo.hotel;
              
              // 가격 정보를 여러 필드에서 추출
              const extractPrice = (accommodationData) => {
                const priceFields = [
                  accommodationData.hotel?.price,
                  accommodationData.price,
                  accommodationData.room?.price,
                  accommodationData.hotel?.composite_price_breakdown?.gross_amount?.value,
                  accommodationData.composite_price_breakdown?.gross_amount?.value,
                  accommodationData.cost
                ];

                for (const priceField of priceFields) {
                  if (priceField !== null && priceField !== undefined && priceField !== '') {
                    return priceField;
                  }
                }
                return null;
              };

              const extractedPrice = extractPrice(accommodationInfo);
              console.log(`[useTravelPlanLoader] 저장된 숙박편 가격 추출:`, {
                hotelName: hotelInfo.hotel_name || hotelInfo.hotel_name_trans,
                extractedPrice: extractedPrice,
                originalPrice: hotelInfo.price,
                accommodationPrice: accommodationInfo.price
              });
              
              // 체크인/체크아웃 날짜를 dayKey로 매핑
              // ✅ 수정: 문자열 기반 날짜 비교를 위한 변수를 먼저 정의
              const checkInStr = checkInDate.toISOString().split('T')[0];
              const checkOutStr = checkOutDate.toISOString().split('T')[0];
              
              const matchingDays = newDayOrder.map(dayKey => {
                const dayDate = new Date(newStartDate);
                dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
                const dayDateStr = dayDate.toISOString().split('T')[0];
                
                return {
                  dayKey,
                  dayDate: dayDateStr,
                  isCheckIn: dayDateStr === checkInStr,
                  isCheckOut: dayDateStr === checkOutStr
                };
              });

              console.log(`[useTravelPlanLoader] 숙박편 ${index + 1} 날짜 매칭 결과:`, {
                hotelName: hotelInfo.hotel_name || hotelInfo.hotel_name_trans,
                checkIn: checkInStr,
                checkOut: checkOutStr,
                여행시작날짜: newStartDate.toISOString().split('T')[0],
                dayOrder: newDayOrder,
                matchingDays: matchingDays.map(d => ({
                  dayKey: d.dayKey,
                  dayDate: d.dayDate,
                  isCheckIn: d.isCheckIn,
                  isCheckOut: d.isCheckOut,
                  체크인비교: `${d.dayDate} === ${checkInStr} = ${d.isCheckIn}`,
                  체크아웃비교: `${d.dayDate} === ${checkOutStr} = ${d.isCheckOut}`
                }))
              });

              // 기본 스케줄 정보
              const baseSchedule = {
                name: hotelInfo.hotel_name || hotelInfo.hotel_name_trans,
                address: hotelInfo.address || hotelInfo.address_trans,
                category: '숙소',
                type: 'accommodation',
                hotelDetails: accommodationInfo,
                lat: hotelInfo.latitude,
                lng: hotelInfo.longitude,
                notes: extractedPrice ? `가격: ${extractedPrice}` : ''
              };

              // 체크인 날짜에 체크인 일정 추가
              const checkInDay = matchingDays.find(d => d.isCheckIn);
              if (checkInDay) {
                const checkInSchedule = {
                  ...baseSchedule,
                  id: `saved-hotel-${hotelInfo.hotel_id}-${index}-${checkInDay.dayKey}-in`,
                  time: '체크인',
                  duration: '1박'
                };

                // ✅ 제거: 일반 숙박 일정 중복 생성하지 않음 (data에서 자동 복원됨)
                // const checkInGeneralSchedule = { ... }

                if (!newTravelPlans[checkInDay.dayKey]) {
                  const checkInDateObj = new Date(newStartDate);
                  checkInDateObj.setDate(checkInDateObj.getDate() + parseInt(checkInDay.dayKey) - 1);
                  newTravelPlans[checkInDay.dayKey] = {
                    title: formatDateForTitleInternal(checkInDateObj, parseInt(checkInDay.dayKey)),
                    schedules: []
                  };
                }
                
                // ✅ 수정: 기존 일정이 있으면 유지하고 숙박편 추가
                const existingSchedules = newTravelPlans[checkInDay.dayKey].schedules || [];
                newTravelPlans[checkInDay.dayKey].schedules = [...existingSchedules, checkInSchedule];
                console.log(`[useTravelPlanLoader] checkplan API - 저장된 숙박편 ${index + 1} 체크인 일정 추가 완료 (Day ${checkInDay.dayKey}, 날짜: ${checkInDay.dayDate})`);
                console.log(`[useTravelPlanLoader] 추가된 체크인 일정:`, checkInSchedule);
                // ✅ 제거: 일반 일정 로그 제거
                // console.log(`[useTravelPlanLoader] 추가된 체크인 일반 일정:`, checkInGeneralSchedule);
              } else {
                console.warn(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1}의 체크인 날짜(${checkInStr})가 여행 일정 범위에 없음`);
              }

              // 체크아웃 날짜에 체크아웃 일정 추가
              const checkOutDay = matchingDays.find(d => d.isCheckOut);
              if (checkOutDay && checkOutDay.dayKey !== checkInDay?.dayKey) {
                const checkOutSchedule = {
                  ...baseSchedule,
                  id: `saved-hotel-${hotelInfo.hotel_id}-${index}-${checkOutDay.dayKey}-out`,
                  time: '체크아웃',
                  duration: ''
                };

                // ✅ 제거: 일반 숙박 일정 중복 생성하지 않음 (data에서 자동 복원됨)
                // const checkOutGeneralSchedule = { ... }

                if (!newTravelPlans[checkOutDay.dayKey]) {
                  const checkOutDateObj = new Date(newStartDate);
                  checkOutDateObj.setDate(checkOutDateObj.getDate() + parseInt(checkOutDay.dayKey) - 1);
                  newTravelPlans[checkOutDay.dayKey] = {
                    title: formatDateForTitleInternal(checkOutDateObj, parseInt(checkOutDay.dayKey)),
                    schedules: []
                  };
                }
                
                // ✅ 수정: 기존 일정이 있으면 유지하고 체크아웃 일정 추가
                const existingCheckOutSchedules = newTravelPlans[checkOutDay.dayKey].schedules || [];
                newTravelPlans[checkOutDay.dayKey].schedules = [...existingCheckOutSchedules, checkOutSchedule];
                console.log(`[useTravelPlanLoader] checkplan API - 저장된 숙박편 ${index + 1} 체크아웃 일정 추가 완료 (Day ${checkOutDay.dayKey}, 날짜: ${checkOutDay.dayDate})`);
                console.log(`[useTravelPlanLoader] 추가된 체크아웃 일정:`, checkOutSchedule);
                // ✅ 제거: 일반 일정 로그 제거
                // console.log(`[useTravelPlanLoader] 추가된 체크아웃 일반 일정:`, checkOutGeneralSchedule);
              } else if (checkOutDay && checkOutDay.dayKey === checkInDay?.dayKey) {
                console.log(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1}의 체크인과 체크아웃이 같은 날짜라 체크아웃 일정 스킵`);
              } else {
                console.warn(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1}의 체크아웃 날짜(${checkOutStr})가 여행 일정 범위에 없음`);
              }
            } else {
              console.warn(`[useTravelPlanLoader] checkplan API - 숙박편 ${index + 1}의 체크인/체크아웃 날짜가 모두 여행 일정 범위에 없음:`, {
                checkIn: checkInDate.toISOString().split('T')[0],
                checkOut: checkOutDate.toISOString().split('T')[0],
                travelStart: newStartDate.toISOString().split('T')[0],
                dayOrder: newDayOrder
              });
            }
          });
          
          console.log('[useTravelPlanLoader] travel-plans - 다중 숙박편 일정 추가 완료');
          
          // ✅ 로딩 시 시간 순서대로 일정 정렬 (숙박편은 같은 시간대에서 뒤로 배치)
          Object.keys(newTravelPlans).forEach(dayKey => {
            if (newTravelPlans[dayKey]?.schedules?.length > 0) {
              newTravelPlans[dayKey].schedules = sortSchedulesByTime(newTravelPlans[dayKey].schedules);
            }
          });
        }
      } else if (data?.plan?.[0]?.plan_data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log('[useTravelPlanLoader] AI 생성 데이터 파싱 시도 (Gemini)');
        if (data.plan[0].plan_id) newPlanId = data.plan[0].plan_id;
        if (data.plan[0].name) planName = data.plan[0].name;
        
        try {
          const textContent = data.plan[0].plan_data.candidates[0].content.parts[0].text;
          const finishReason = data.plan[0].plan_data.candidates[0].finishReason;
          console.log('[useTravelPlanLoader] AI 응답 데이터 (finishReason):', finishReason, '내용 길이:', textContent.length);
          
          let jsonString = "";
          const jsonMatch = textContent.match(/```json\n([\s\S]*?)(\n```|$)/);
          if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1];
          } else if (textContent.trim().startsWith("{")) {
            // ```json 태그가 없고 바로 JSON 내용으로 시작하는 경우
            jsonString = textContent;
            console.log('[useTravelPlanLoader] ```json 태그 없이 바로 시작하는 JSON으로 간주');
          }

          if (jsonString) {
            let parsedData;
            // 1. 직접 파싱 시도
            try {
              parsedData = JSON.parse(jsonString);
              console.log('[useTravelPlanLoader] 정상적인 JSON 파싱 성공');
            } catch (e) {
              console.warn('[useTravelPlanLoader] 1단계: 직접 JSON 파싱 실패:', e.message);
              
              if (finishReason === "MAX_TOKENS") {
                console.log('[useTravelPlanLoader] MAX_TOKENS 감지, 복구 절차 시작');
                let tempJsonString = jsonString;

                // 2. 기본적인 복구 시도 (괄호 및 따옴표)
                try {
                  // 2a. 마지막 불완전한 key-value 쌍 제거 시도 (예: "cost":"150 잘림)
                  tempJsonString = tempJsonString.replace(/("[^"]+"\s*:\s*"[^"]*)(?!["\s,}\]])/g, '$1"'); // 닫는 따옴표 추가
                  tempJsonString = tempJsonString.replace(/("[^"]+"\s*:\s*[\d.]+)(?![,}\]])/g, '$1'); // 숫자 뒤에 불필요한 문자 제거
                  tempJsonString = tempJsonString.replace(/,\s*$/, ''); // 마지막 쉼표 제거

                  // 2b. 괄호 짝 맞추기
                  let openBraces = (tempJsonString.match(/\{/g) || []).length;
                  let closeBraces = (tempJsonString.match(/\}/g) || []).length;
                  tempJsonString += '}'.repeat(Math.max(0, openBraces - closeBraces));

                  let openBrackets = (tempJsonString.match(/\[/g) || []).length;
                  let closeBrackets = (tempJsonString.match(/\]/g) || []).length;
                  tempJsonString += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
                  
                  // 2c. 전체가 객체나 배열로 끝나도록
                  if (tempJsonString.startsWith("{") && !tempJsonString.endsWith("}")) tempJsonString += "}";
                  if (tempJsonString.startsWith("[") && !tempJsonString.endsWith("]")) tempJsonString += "]";

                  console.log('[useTravelPlanLoader] 2단계: 기본 복구 시도 후 JSON (일부):', tempJsonString.substring(0, 200) + "..." + tempJsonString.substring(tempJsonString.length - 200));
                  parsedData = JSON.parse(tempJsonString);
                  console.log('[useTravelPlanLoader] 2단계: 기본 복구 후 JSON 파싱 성공');
                } catch (e2) {
                  console.warn('[useTravelPlanLoader] 2단계: 기본 복구 후 파싱 실패:', e2.message);
                  // 3. 정규식을 사용하여 Day 객체 단위로 추출 시도
                  try {
                    console.log('[useTravelPlanLoader] 3단계: 정규식으로 Day 객체 추출 시도');
                    const titleM = jsonString.match(/"title"\s*:\s*"([^"]*)"/);
                    const extractedTitle = titleM ? titleM[1] : '여행 계획';
                    parsedData = { title: extractedTitle, days: [] };

                    const dayEntries = [];
                    // day 객체는 { "day": ..., "schedules": [ ... ] ... } 형태를 가짐.
                    // 각 day 객체를 최대한 추출하려고 시도합니다.
                    const dayRegex = /\{\s*"day"\s*:\s*(\d+)[\s\S]*?("schedules"\s*:\s*\[[\s\S]*?\])[\s\S]*?\}(?=\s*,|\s*\]|$)/g;
                    let match;
                    while ((match = dayRegex.exec(jsonString)) !== null) {
                        dayEntries.push(match[0]);
                    }
                    console.log(`[useTravelPlanLoader] 3단계: 정규식으로 찾은 Day 객체 후보 수: ${dayEntries.length}`);
                    
                    // 마지막에 잘렸을 가능성이 있는 day 객체 확인 시도
                    const lastIncompleteDay = jsonString.match(/\{\s*"day"\s*:\s*(\d+)[\s\S]*?("schedules"\s*:\s*\[[\s\S]*?)$/);
                    if (lastIncompleteDay && !dayEntries.some(entry => entry.includes(`"day":${lastIncompleteDay[1]}`))) {
                      console.log(`[useTravelPlanLoader] 3단계: 잘린 마지막 Day 객체(${lastIncompleteDay[1]}일차) 발견`);
                      // 임의로 day 객체 완성을 시도
                      let lastDayContent = lastIncompleteDay[0] + '}]}';
                      dayEntries.push(lastDayContent);
                    }

                    for (const dayStr of dayEntries) {
                        try {
                            parsedData.days.push(JSON.parse(dayStr));
                        } catch (dayParseError) {
                            console.warn(`[useTravelPlanLoader] 3a단계: Day 객체 파싱 실패. 내용(앞부분): ${dayStr.substring(0, 100)}`);
                            // 부분적 파싱 (id, name, time, lat, lng, category 등을 가진 schedule 아이템들을 최대한 추출)
                            const pDay = {schedules: []};
                            const dayNumM = dayStr.match(/"day"\s*:\s*(\d+)/); if (dayNumM) pDay.day = parseInt(dayNumM[1]);
                            const dateM = dayStr.match(/"date"\s*:\s*"([^"]*)"/); if (dateM) pDay.date = dateM[1];
                            const dayTitleM = dayStr.match(/"title"\s*:\s*"([^"]*)"/); if (dayTitleM) pDay.title = dayTitleM[1];

                            const schedulesContentMatch = dayStr.match(/"schedules"\s*:\s*\[([\s\S]*?)(\]|$)/);
                            if (schedulesContentMatch && schedulesContentMatch[1]) {
                                // 완전한 일정 아이템을 먼저 추출
                                const completeScheduleItemsRegex = /\{\s*"id"\s*:\s*"[\w-]+"[\s\S]*?\}(?=\s*,|\s*$)/g;
                                let itemMatch;
                                while((itemMatch = completeScheduleItemsRegex.exec(schedulesContentMatch[1])) !== null) {
                                    try {
                                        pDay.schedules.push(JSON.parse(itemMatch[0]));
                                    } catch (itemErr) {
                                        console.warn(`Schedule 아이템 파싱 실패: ${itemMatch[0].substring(0,50)}`);
                                    }
                                }
                                
                                // 잘린 마지막 일정 아이템 처리
                                const lastIncompleteSchedule = schedulesContentMatch[1].match(/,\s*(\{\s*"id"\s*:\s*"[\w-]+"[\s\S]*?)$/);
                                if (lastIncompleteSchedule) {
                                    console.log(`[useTravelPlanLoader] 3a단계: 잘린 마지막 일정 항목 발견, 복구 시도`);
                                    const incompItem = lastIncompleteSchedule[1];
                                    
                                    // 필수 필드들 추출
                                    const id = incompItem.match(/"id"\s*:\s*"([\w-]+)"/)?.[1];
                                    const name = incompItem.match(/"name"\s*:\s*"([^"]*)"/)?.[1];
                                    const time = incompItem.match(/"time"\s*:\s*"([^"]*)"/)?.[1];
                                    const lat = incompItem.match(/"lat"\s*:\s*([\d\.]+)/)?.[1];
                                    const lng = incompItem.match(/"lng"\s*:\s*([\d\.]+)/)?.[1];
                                    const category = incompItem.match(/"category"\s*:\s*"([^"]*)"/)?.[1];
                                    const duration = incompItem.match(/"duration"\s*:\s*"([^"]*)"/)?.[1];
                                    const notes = incompItem.match(/"notes"\s*:\s*"([^"]*)"/)?.[1];
                                    const cost = incompItem.match(/"cost"\s*:\s*"?([^",}]*)(?:"|$)/)?.[1];
                                    const address = incompItem.match(/"address"\s*:\s*"([^"]*)"/)?.[1];
                                    
                                    if (id && name) {
                                        const recoveredItem = {
                                            id, name,
                                            ...(time && {time}),
                                            ...(lat && {lat: parseFloat(lat)}),
                                            ...(lng && {lng: parseFloat(lng)}),
                                            ...(category && {category}),
                                            ...(duration && {duration}),
                                            ...(notes && {notes}),
                                            ...(cost && {cost}),
                                            ...(address && {address})
                                        };
                                        
                                        console.log(`[useTravelPlanLoader] 3a단계: 잘린 일정 항목 복구 성공: ${id} ${name}`);
                                        pDay.schedules.push(recoveredItem);
                                    }
                                }
                            }
                            if (pDay.day && pDay.title) parsedData.days.push(pDay);
                        }
                    }
                    if (parsedData.days.length > 0) console.log(`[useTravelPlanLoader] 3단계: 정규식 추출 성공. Day 수: ${parsedData.days.length}`);
                    else console.warn('[useTravelPlanLoader] 3단계: 정규식으로 Day 객체 추출 실패');
                  } catch (e3) {
                    console.error('[useTravelPlanLoader] 3단계: 정규식 기반 파싱 중 심각한 오류:', e3.message, e3.stack);
                  }
                }
              } else {
                 // MAX_TOKENS가 아닌 다른 이유로 파싱 실패한 경우 (이 경우는 거의 없을 것으로 예상)
                 console.error('[useTravelPlanLoader] MAX_TOKENS 아닌데 JSON 파싱 실패:', e.message);
              }
            }
            
            // 4. 최종 데이터 구조화 및 상태 업데이트
            if (parsedData && parsedData.days && parsedData.days.length > 0) {
              const itineraryArray = parsedData.days;
              // 시작 날짜 결정 로직
              if (!newStartDate && parsedFlightInfo?.itineraries?.[0]?.segments?.[0]?.departure?.at) {
                newStartDate = new Date(parsedFlightInfo.itineraries[0].segments[0].departure.at);
              } 
              if (!newStartDate && itineraryArray[0]?.date) {
                try { 
                  const firstDayDate = new Date(itineraryArray[0].date);
                  if (!isNaN(firstDayDate.getTime())) newStartDate = firstDayDate;
                } catch (e) { /* 날짜 파싱 오류 무시 */ }
              }
              if (!newStartDate) newStartDate = potentialStartDate;
              console.log('[useTravelPlanLoader] 최종 결정된 시작 날짜:', newStartDate);
              
              itineraryArray.forEach((dayPlan, index) => {
                const dayNumber = (dayPlan.day || index + 1).toString();
                const currentDate = new Date(newStartDate);
                currentDate.setDate(currentDate.getDate() + index);
                const dateStr = formatDateFns(currentDate, 'M/d');
                const detail = (dayPlan.title || '').replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim();
                const fullTitle = detail ? `${dateStr} ${detail}` : dateStr;
                
                // AI 생성 데이터를 저장된 DB 구조와 동일하게 맞춤
                const formattedSchedules = Array.isArray(dayPlan.schedules) ? dayPlan.schedules.map(schedule => {
                  const isAccommodation = schedule.type === 'accommodation';
                  
                  // 숙소 시간 처리 로직
                  let timeValue = '14:00';  // 기본값
                  if (isAccommodation) {
                    if (schedule.time === '체크인') timeValue = '체크인';
                    else if (schedule.time === '체크아웃') timeValue = '체크아웃';
                    else if (schedule.time) timeValue = schedule.time;
                  } else {
                    timeValue = schedule.time || '09:00';
                  }

                  const baseSchedule = {
                    ...schedule,
                    type: isAccommodation ? 'accommodation' : (schedule.type || 'activity'),
                    time: timeValue,
                    duration: schedule.duration || (isAccommodation ? '1박' : '2시간'),
                    category: schedule.category || (isAccommodation ? '숙소' : '관광')
                  };

                  // 숙소인 경우 추가 필드와 hotelDetails
                  if (isAccommodation) {
                    const hotelDetails = {
                      hotel: {
                        hotel_id: schedule.id,
                        hotel_name: schedule.name,
                        hotel_name_trans: schedule.name,
                        address: schedule.address || '',
                        address_trans: schedule.address || '',
                        latitude: schedule.lat,
                        longitude: schedule.lng,
                        price: schedule.price || schedule.cost || '',
                        checkIn: schedule.checkInTime || '14:00',
                        checkOut: schedule.checkOutTime || '11:00',
                        main_photo_url: schedule.photo_url || schedule.image_url || schedule.photoUrl || schedule.imageUrl,
                        composite_price_breakdown: {
                          gross_amount: {
                            value: parseFloat(schedule.price || schedule.cost || 0),
                            currency: 'KRW'
                          }
                        },
                        room: {
                          name: schedule.roomName || '기본 객실',
                          price: schedule.price || schedule.cost || '',
                          currency: 'KRW'
                        }
                      }
                    };

                    return {
                      ...baseSchedule,
                      hotelDetails,
                      checkInTime: schedule.checkInTime || '14:00',
                      checkOutTime: schedule.checkOutTime || '11:00',
                      hotelName: schedule.name,
                      address: schedule.address || '',
                      price: schedule.price || schedule.cost || ''
                    };
                  }

                  return baseSchedule;
                }) : [];

                newTravelPlans[dayNumber] = {
                  title: fullTitle,
                  description: dayPlan.description || '',
                  schedules: formattedSchedules
                };
                if (!newDayOrder.includes(dayNumber)) newDayOrder.push(dayNumber);
              });
              
              newDayOrder.sort((a, b) => parseInt(a) - parseInt(b));
              newSelectedDay = newDayOrder.length > 0 ? newDayOrder[0] : '1';
              
              // ✅ 로딩 시 시간 순서대로 일정 정렬 (숙박편은 같은 시간대에서 뒤로 배치)
              Object.keys(newTravelPlans).forEach(dayKey => {
                if (newTravelPlans[dayKey]?.schedules?.length > 0) {
                  newTravelPlans[dayKey].schedules = sortSchedulesByTime(newTravelPlans[dayKey].schedules);
                }
              });
              
              console.log('[useTravelPlanLoader] AI 생성 데이터 최종 처리 완료:', Object.keys(newTravelPlans).length, '일차');
            } else {
              console.warn('[useTravelPlanLoader] AI (Gemini) 데이터 최종 파싱/구성 실패 (parsedData 없거나 days 비어있음)');
            }
          } else {
            console.warn('[useTravelPlanLoader] AI 데이터에서 JSON 형식의 내용을 찾을 수 없음 (jsonString 비어있음)');
          }
        } catch (e) {
          console.error('[useTravelPlanLoader] AI 데이터 전체 파싱 과정 중 예외 발생:', e.message, e.stack);
          console.warn('[useTravelPlanLoader] AI 데이터 처리 최종 실패, 기본 일정으로 처리합니다.');
        }
      }
    }
    
    // 데이터가 어떤 방식으로든 처리되지 않았을 경우
    if (Object.keys(newTravelPlans).length === 0) {
      console.log('[useTravelPlanLoader] 유효한 계획 데이터 없음, 기본 1일차 생성. newStartDate:', newStartDate);
      
      // 항공편 정보가 있으면 출발일 기준으로 설정
      if (parsedFlightInfo?.itineraries?.[0]?.segments?.[0]?.departure?.at && !newStartDate) {
        newStartDate = new Date(parsedFlightInfo.itineraries[0].segments[0].departure.at);
        console.log('[useTravelPlanLoader] 항공편 출발일 설정:', newStartDate);
      }
      
      const titleDateStr = formatDateFns(newStartDate || potentialStartDate, 'M/d');
      newTravelPlans['1'] = { title: titleDateStr, schedules: [] };
      newDayOrder = ['1'];
      newSelectedDay = '1';
    }

    // 공유 이메일 배열 파싱
    let parsedSharedEmails = [];
    if (sharedEmail) {
      parsedSharedEmails = sharedEmail.split(',').map(email => email.trim()).filter(email => email);
    }
    
    // 공유 상태 확인 (is_shared_with_me 필드로 판단)
    const isSharedWithMe = data?.is_shared_with_me === true || data?.plan?.is_shared_with_me === true;
    
    // 원래 소유자 정보 추출
    const originalOwner = data?.original_owner || data?.plan?.original_owner || data?.plan?.user_id;
    
    // 최종 반환 데이터
    return {
      travelPlans: newTravelPlans,
      dayOrder: newDayOrder,
      selectedDay: newSelectedDay,
      planId: newPlanId,
      planName: planName,
      sharedEmail: sharedEmail,
      sharedEmails: parsedSharedEmails,
      isSharedPlan: isSharedWithMe,
      originalOwner: originalOwner,
      startDate: newStartDate || potentialStartDate,
      loadedFlightInfo: parsedFlightInfo,
      loadedFlightInfos: parsedFlightInfos,
      isRoundTrip: roundTripFlag,
      loadedAccommodationInfo: parsedAccommodationInfo,
      loadedAccommodationInfos: parsedAccommodationInfos
    };
  }, []);



  const loadTravelPlanInternal = useCallback(async () => {
    if (loadMode === 'none') {
      console.log('[useTravelPlanLoader] loadMode is "none", 초기화 진행.');
      initializePlanState();
      return;
    }

    console.log(`[useTravelPlanLoader] loadTravelPlanInternal 시작. planIdFromUrl: ${planIdFromUrl}, loadMode: ${loadMode}`);
    setIsLoadingPlan(true);
    setLoadError(null);
    setLoadedFlightInfo(null);
    setLoadedFlightInfos([]);
    setIsRoundTrip(false);
    setLoadedAccommodationInfo(null);
    setLoadedAccommodationInfos([]);
    
    const potentialStartDate = startDate || new Date(); 

    try {
      let result;
      
      // URL 경로에 따라 다른 로드 로직 실행
      if (planIdFromUrl === 'newest') {
        // 최신 계획 로드 (/planner/newest)
        result = await loadNewestPlan(potentialStartDate);
      } else if (planIdFromUrl && (!isNaN(Number(planIdFromUrl)) || planIdFromUrl.startsWith('plan-'))) {
        // 특정 ID로 계획 로드 (/planner/12345678 또는 /planner/plan-xxxxxxxxxx)
        result = await loadPlanById(planIdFromUrl, potentialStartDate);
      } else {
        // 기본 경우 (URL에 ID 없음)
        result = await loadNewestPlan(potentialStartDate);
      }

      // 항공편/숙박편 정보는 이미 processLoadedData에서 처리되었으므로 그대로 사용
      const updatedTravelPlans = result.travelPlans;
      console.log('[useTravelPlanLoader] 항공편/숙박편 정보는 이미 processLoadedData에서 처리됨');
      
      // *** 숙소 자동 변환 로직 개선 ***
      // ✅ 수정: 저장된 숙박 정보가 있으면 자동 변환 로직 완전히 건너뛰기
      const hasLoadedAccommodations = result.loadedAccommodationInfos && result.loadedAccommodationInfos.length > 0;
      let convertedPlans = updatedTravelPlans;
      let accommodationsToConvert = [];
      
      if (!hasLoadedAccommodations) {
        console.log('[useTravelPlanLoader] 자동 변환 로직 실행 - 저장된 숙박 정보 없음');
        
        const convertAccommodationsToCustom = (travelPlans, dayOrder, startDate) => {
          console.log('[useTravelPlanLoader] 숙소 자동 변환 시작 (개선된 로직)');
          const convertedPlans = { ...travelPlans };
          const accommodationsToConvert = [];
          
          // 1단계: 모든 숙소 일정을 수집하고 일반 일정에서 제거
          const allAccommodations = [];
          dayOrder.forEach(dayKey => {
            const dayPlan = convertedPlans[dayKey];
            if (dayPlan?.schedules) {
              const nonAccommodationSchedules = [];
              
              dayPlan.schedules.forEach(schedule => {
                // 숙소 판별 로직
                const isAccommodation = 
                  schedule.category === '숙소' ||
                  schedule.category === '호텔' ||
                  schedule.category === '펜션' ||
                  schedule.category === '게스트하우스' ||
                  schedule.category === '민박' ||
                  schedule.type === 'accommodation' ||
                  (schedule.name && (
                    schedule.name.includes('호텔') ||
                    schedule.name.includes('펜션') ||
                    schedule.name.includes('숙소') ||
                    schedule.name.includes('게스트하우스') ||
                    schedule.name.includes('민박')
                  ));
                
                if (isAccommodation && schedule.type !== 'accommodation') {
                  // 숙소 정보를 수집
                  allAccommodations.push({
                    ...schedule,
                    dayKey: parseInt(dayKey),
                    dayIndex: parseInt(dayKey) - 1 // 0부터 시작하는 인덱스
                  });
                  console.log(`[useTravelPlanLoader] 숙소 발견 (Day ${dayKey}):`, schedule.name);
                } else {
                  // 숙소가 아닌 일정은 그대로 유지
                  nonAccommodationSchedules.push(schedule);
                }
              });
              
              // 숙소가 제거된 일정으로 업데이트
              convertedPlans[dayKey] = {
                ...dayPlan,
                schedules: nonAccommodationSchedules
              };
            }
          });

          // 2단계: 숙소들을 이름별로 그룹화하고 연속된 날짜 범위 계산
          const hotelGroups = {};
          allAccommodations.forEach(accommodation => {
            const hotelKey = accommodation.name.trim();
            if (!hotelGroups[hotelKey]) {
              hotelGroups[hotelKey] = [];
            }
            hotelGroups[hotelKey].push(accommodation);
          });

          // 3단계: 각 호텔 그룹에서 연속된 날짜 범위를 찾아 숙박편 생성
          Object.entries(hotelGroups).forEach(([hotelName, accommodations]) => {
            // 날짜순으로 정렬
            accommodations.sort((a, b) => a.dayIndex - b.dayIndex);
            
            console.log(`[useTravelPlanLoader] ${hotelName} 처리:`, accommodations.map(a => `Day${a.dayKey}`).join(', '));
            
            // 연속된 날짜 그룹 찾기
            const consecutiveGroups = [];
            let currentGroup = [accommodations[0]];
            
            for (let i = 1; i < accommodations.length; i++) {
              const prev = accommodations[i - 1];
              const current = accommodations[i];
              
              // 연속된 날짜인지 확인
              if (current.dayIndex === prev.dayIndex + 1) {
                currentGroup.push(current);
              } else {
                // 연속되지 않으면 새 그룹 시작
                consecutiveGroups.push(currentGroup);
                currentGroup = [current];
              }
            }
            consecutiveGroups.push(currentGroup); // 마지막 그룹 추가
            
            // 각 연속 그룹에 대해 숙박편 생성
            consecutiveGroups.forEach((group, groupIndex) => {
              const firstDay = group[0];
              const lastDay = group[group.length - 1];
              
              // 체크인 날짜: 첫째 날
              const checkInDate = new Date(startDate);
              checkInDate.setDate(checkInDate.getDate() + firstDay.dayIndex);
              
              // ✅ 수정: 체크아웃 날짜 계산 개선
              // 숙박 일정이 있는 마지막 날의 다음날이 체크아웃
              const checkOutDate = new Date(startDate);
              checkOutDate.setDate(checkOutDate.getDate() + lastDay.dayIndex + 1);
              
              console.log(`[useTravelPlanLoader] ${hotelName} 그룹 ${groupIndex + 1} 날짜 계산:`, {
                firstDayIndex: firstDay.dayIndex,
                lastDayIndex: lastDay.dayIndex,
                checkIn: checkInDate.toISOString().split('T')[0],
                checkOut: checkOutDate.toISOString().split('T')[0],
                nights: group.length,
                days: group.map(g => `Day${g.dayKey}`).join('-'),
                상세: {
                  '시작날짜': startDate.toISOString().split('T')[0],
                  '체크인계산': `시작날짜 + ${firstDay.dayIndex}일`,
                  '체크아웃계산': `시작날짜 + ${lastDay.dayIndex + 1}일`
                }
              });
              
              // 대표 숙소 정보 (첫 번째 것 사용)
              const representativeAccommodation = firstDay;
              
              const customAccommodationData = {
                hotel: {
                  hotel_id: representativeAccommodation.id || `auto-converted-${hotelName.replace(/\s+/g, '')}-${Date.now()}-${groupIndex}`,
                  hotel_name: representativeAccommodation.name,
                  hotel_name_trans: representativeAccommodation.name,
                  address: representativeAccommodation.address || '',
                  address_trans: representativeAccommodation.address || '',
                  latitude: representativeAccommodation.lat || null,
                  longitude: representativeAccommodation.lng || null,
                  main_photo_url: '',
                  price: representativeAccommodation.cost || representativeAccommodation.price || '',
                  checkIn: checkInDate.toISOString().split('T')[0],
                  checkOut: checkOutDate.toISOString().split('T')[0]
                },
                checkIn: checkInDate.toISOString().split('T')[0],
                checkOut: checkOutDate.toISOString().split('T')[0],
                contact: '',
                notes: representativeAccommodation.notes || `${group.length}박 숙박`,
                lat: representativeAccommodation.lat || null,
                lng: representativeAccommodation.lng || null,
                latitude: representativeAccommodation.lat || null,
                longitude: representativeAccommodation.lng || null
              };
              
              accommodationsToConvert.push(customAccommodationData);
            });
          });
          
          console.log('[useTravelPlanLoader] 변환할 숙소 목록 (개선된 로직):', accommodationsToConvert.length, '개');
          return { convertedPlans, accommodationsToConvert };
        };
        
        const convertResult = convertAccommodationsToCustom(
          updatedTravelPlans, 
          result.dayOrder, 
          result.startDate
        );
        convertedPlans = convertResult.convertedPlans;
        accommodationsToConvert = convertResult.accommodationsToConvert;
        
        // ✅ 로딩 시 시간 순서대로 일정 정렬 (숙박편은 같은 시간대에서 뒤로 배치)
        Object.keys(convertedPlans).forEach(dayKey => {
          if (convertedPlans[dayKey]?.schedules?.length > 0) {
            convertedPlans[dayKey].schedules = sortSchedulesByTime(convertedPlans[dayKey].schedules);
          }
        });
      } else {
        console.log('[useTravelPlanLoader] 자동 변환 로직 건너뛰기 - 저장된 숙박 정보 있음:', {
          loadedCount: result.loadedAccommodationInfos.length
        });
      }
      
      // 상태 업데이트
      setTravelPlans(convertedPlans);
      setDayOrder(result.dayOrder);
      setSelectedDay(result.selectedDay);
      setPlanId(result.planId);
      setStartDate(result.startDate);
      setLoadedFlightInfo(result.loadedFlightInfo);
      setLoadedFlightInfos(result.loadedFlightInfos);
      setIsRoundTrip(result.isRoundTrip);
      setLoadedAccommodationInfo(result.loadedAccommodationInfo);
      setLoadedAccommodationInfos(result.loadedAccommodationInfos);
      setPlanName(result.planName);
      setSharedEmailFromLoader(result.sharedEmail || '');
      setIsSharedPlan(result.isSharedPlan || false);
      setSharedEmails(result.sharedEmails || []);
      setOriginalOwner(result.originalOwner || null);
      
      // ✅ 추가: 로딩 완료 후 최종 상태 로그
      console.log('[useTravelPlanLoader] 📋 로딩 완료 - 최종 travelPlans 상태:', convertedPlans);
      console.log('[useTravelPlanLoader] 📋 로딩 완료 - 각 일차별 일정 요약:');
      Object.entries(convertedPlans).forEach(([dayKey, dayPlan]) => {
        console.log(`[useTravelPlanLoader] Day ${dayKey} (${dayPlan.title}):`, {
          총일정수: dayPlan.schedules?.length || 0,
          숙박일정: dayPlan.schedules?.filter(s => s.type === 'accommodation').length || 0,
          일반일정: dayPlan.schedules?.filter(s => s.type !== 'accommodation' && s.type !== 'Flight_Departure' && s.type !== 'Flight_Return' && s.type !== 'Flight_OneWay').length || 0,
          항공일정: dayPlan.schedules?.filter(s => s.type === 'Flight_Departure' || s.type === 'Flight_Return' || s.type === 'Flight_OneWay').length || 0,
          상세일정: dayPlan.schedules?.map(s => ({ name: s.name, type: s.type, category: s.category, time: s.time })) || []
        });
      });
      
      // ✅ 수정: 저장된 accommodationInfos가 있을 때는 자동 변환 로직 실행하지 않음
      console.log('[useTravelPlanLoader] 🏨 숙박 정보 상태 확인:', {
        hasLoadedAccommodations: hasLoadedAccommodations,
        loadedCount: result.loadedAccommodationInfos?.length || 0,
        accommodationsToConvertCount: accommodationsToConvert.length
      });

      // 변환된 숙소들을 커스텀 숙소로 추가 (저장된 숙박 정보가 없을 때만)
      if (accommodationsToConvert.length > 0 && !hasLoadedAccommodations) {
        console.log('[useTravelPlanLoader] 커스텀 숙소 변환 작업 시작 (개선된 로직):', accommodationsToConvert.length, '개');
        
        // 잠깐 기다린 후 변환 작업 수행 (상태 업데이트 후)
        setTimeout(() => {
          accommodationsToConvert.forEach((customAccommodationData, index) => {
            setTimeout(() => {
              try {
                console.log(`[useTravelPlanLoader] 숙소 ${index + 1} 커스텀 변환 시작:`, {
                  name: customAccommodationData.hotel.hotel_name,
                  checkIn: customAccommodationData.checkIn,
                  checkOut: customAccommodationData.checkOut
                });
                
                // 이벤트 발송으로 TravelPlanner에서 처리하도록 함
                window.dispatchEvent(new CustomEvent('autoConvertAccommodation', {
                  detail: customAccommodationData
                }));
                
              } catch (error) {
                console.error('[useTravelPlanLoader] 숙소 자동 변환 중 오류:', error);
              }
            }, index * 200); // 각 숙소를 200ms 간격으로 처리
          });
        }, 1000); // 1초 후 시작
      }
      
      console.log('[useTravelPlanLoader] 최종 상태 업데이트 완료. newStartDate:', result.startDate, 'sharedEmail:', result.sharedEmail, 'isSharedPlan:', result.isSharedPlan, 'sharedEmails:', result.sharedEmails, 'originalOwner:', result.originalOwner);

    } catch (error) {
      console.error('[useTravelPlanLoader] 여행 계획 로드 실패:', error);
      setLoadError(`여행 계획 로드 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
      initializePlanState(); 
    } finally {
      setIsLoadingPlan(false);
      console.log('[useTravelPlanLoader] loadTravelPlanInternal 함수 종료');
    }
  }, [
    user, planIdFromUrl, loadMode, startDate, initializePlanState, 
    loadNewestPlan, loadPlanById
  ]);

  useEffect(() => {
    if (user) {
      console.log(`[useTravelPlanLoader] useEffect 실행. user: ${user}, planIdFromUrl: ${planIdFromUrl}, loadMode: ${loadMode}`);
      loadTravelPlanInternal();
    } else {
      console.log('[useTravelPlanLoader] useEffect 실행. 사용자 없음, 플랜 초기화.');
      initializePlanState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, planIdFromUrl, loadMode]); // Removed initializePlanState and loadTravelPlanInternal from deps to prevent potential loops if they are not stable

  return {
    travelPlans, setTravelPlans,
    dayOrder, setDayOrder,
    selectedDay, setSelectedDay,
    startDate, setStartDate,
    planId, setPlanId,
    isLoadingPlan,
    loadedFlightInfo,
    loadedFlightInfos, // 다중 항공편
    isRoundTrip,
    loadError,
    loadedAccommodationInfo,
    loadedAccommodationInfos, // 다중 숙박편
    planName,
    setPlanName,
    sharedEmailFromLoader,
    isSharedPlan,
    sharedEmails,
    originalOwner
  };
};

export default useTravelPlanLoader; 