import { useState, useEffect, useCallback } from 'react';
import { format as formatDateFns } from 'date-fns';
import { travelApi } from '../../../services/api';
import { formatPrice, formatDuration } from '../../../utils/flightFormatters';
import useFlightHandlers from './useFlightHandlers';

// 날짜 포맷팅 유틸리티 함수 (loader 내부용)
const formatDateForTitleInternal = (date, dayNumber) => {
  if (!date || isNaN(date.getTime())) return `Day ${dayNumber}`;
  return formatDateFns(date, 'M/d');
};

const useTravelPlanLoader = (user, planIdFromUrl, loadMode) => {
  const [travelPlans, setTravelPlans] = useState({});
  const [dayOrder, setDayOrder] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [planId, setPlanId] = useState(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true); 
  const [loadedFlightInfo, setLoadedFlightInfo] = useState(null);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
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
    setLoadedFlightInfo(null);
    setIsRoundTrip(false);
    setLoadError(null);
    setIsLoadingPlan(false);
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
    setIsRoundTrip(false);
    
    const potentialStartDate = startDate || new Date(); 

    try {
      let params = { include_details: true }; 
      if (planIdFromUrl) {
        // planIdFromUrl 값에 따라 다른 파라미터 설정
        if (planIdFromUrl === 'newest') {
          // /planner/newest 경로에 해당
          params.planId = 'newest'; // API.js에서 newest=true로 변환됨
          console.log('[useTravelPlanLoader] 최신 계획 로드 (planIdFromUrl=newest):', params);
        } else if (!isNaN(Number(planIdFromUrl))) {
          // /planner/12345678 등 숫자 ID 경로에 해당
          params.planId = planIdFromUrl;
          console.log('[useTravelPlanLoader] 특정 계획 로드 (planIdFromUrl 숫자):', params);
        } else {
          // 알 수 없는 형식의 planIdFromUrl - newest로 처리
          params.newest = true;
          console.log('[useTravelPlanLoader] 알 수 없는 planIdFromUrl 값, 최신 계획 로드:', params);
        }
      } else { 
        // planIdFromUrl가 없는 기본 경우
        params.newest = true;
        console.log('[useTravelPlanLoader] 최신 계획 로드 (newest):', params);
      }
      
      const data = await travelApi.loadPlan(params);
      console.log('[useTravelPlanLoader] travelApi.loadPlan 응답 데이터:', JSON.stringify(data, null, 2));

      let newTravelPlans = {};
      let newDayOrder = [];
      let newSelectedDay = '1';
      let newPlanId = null;
      let newStartDate = null;
      // 데이터 처리 완료 여부 플래그
      let isDataProcessed = false;
      let parsedFlightInfo = null;
      let roundTripFlag = false;

      // checkplanfunction API에서 받은 데이터 구조 확인 및 처리 (plan이 배열이 아니라 객체인 경우)
      if (data?.plan?.itinerary_schedules && typeof data.plan.itinerary_schedules === 'string') {
        console.log('[useTravelPlanLoader] checkplanfunction API 응답 데이터 처리 (plan 객체)');
        try {
          // plan_id가 있으면 저장
          if (data.plan.plan_id) {
            newPlanId = data.plan.plan_id;
          }
          
          // itinerary_schedules 파싱
          const parsedSchedules = JSON.parse(data.plan.itinerary_schedules);
          
          // 이미 정제된 형태의 데이터이므로 그대로 사용
          newTravelPlans = parsedSchedules;
          newDayOrder = Object.keys(parsedSchedules).sort((a, b) => parseInt(a) - parseInt(b));
          newSelectedDay = newDayOrder[0] || '1';
          
          // 시작 날짜 설정 (데이터에 없으면 현재 날짜 사용)
          try {
            // 첫 번째 항공편에서 시작 날짜 추출 시도
            if (data.plan.flight_details) {
              const flights = JSON.parse(data.plan.flight_details);
              const departureFlights = flights.filter(f => f.type === 'Flight_Departure');
              if (departureFlights.length > 0 && departureFlights[0].flightOfferDetails?.flightOfferData?.itineraries?.[0]?.segments?.[0]?.departure?.at) {
                newStartDate = new Date(departureFlights[0].flightOfferDetails.flightOfferData.itineraries[0].segments[0].departure.at);
                console.log('[useTravelPlanLoader] 항공편 데이터에서 출발 날짜 설정:', newStartDate);
              }
            }
          } catch (e) {
            console.error('[useTravelPlanLoader] 항공편 정보에서 날짜 추출 실패:', e);
          }
          
          // 항공편 정보 파싱
          try {
            if (data.plan.flight_details) {
              parsedFlightInfo = JSON.parse(data.plan.flight_details);
              roundTripFlag = parsedFlightInfo.some(f => f.type === 'Flight_Return');
              console.log('[useTravelPlanLoader] 항공편 정보 파싱 완료', { parsedFlightInfo, roundTripFlag });
            }
          } catch (e) {
            console.error('[useTravelPlanLoader] 항공편 정보 파싱 실패:', e);
          }
          
          console.log('[useTravelPlanLoader] checkplanfunction API 데이터 처리 완료');
          isDataProcessed = true;
        } catch (e) {
          console.error('[useTravelPlanLoader] itinerary_schedules 파싱 실패:', e);
          setLoadError('여행 일정 데이터 처리 중 오류가 발생했습니다.');
        }
      }
      
      // 기존 정제 로직은 checkplanfunction 처리가 되지 않았을 때만 실행
      if (!isDataProcessed) {
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

        if (data?.plannerData && Object.keys(data.plannerData).length > 0) {
          console.log('[useTravelPlanLoader] 서버에서 처리된 플래너 데이터 발견 (plannerData)');
          newTravelPlans = data.plannerData;
          newDayOrder = Object.keys(data.plannerData).sort((a, b) => parseInt(a) - parseInt(b));
          newSelectedDay = newDayOrder[0] || '1';
          if (data.plan?.[0]?.id) newPlanId = data.plan[0].id;
        } else if (data?.plan?.[0]?.itinerary_schedules && Object.keys(data.plan[0].itinerary_schedules).length > 0) {
          console.log('[useTravelPlanLoader] itinerary_schedules 데이터 발견');
          const itinerarySchedules = data.plan[0].itinerary_schedules;
          if (data.plan[0].plan_id) newPlanId = data.plan[0].plan_id;

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
        } else if (data?.plan?.[0]?.plan_data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log('[useTravelPlanLoader] AI 생성 데이터 파싱 시도 (Gemini)');
          if (data.plan[0].plan_id) newPlanId = data.plan[0].plan_id;
          try {
            const textContent = data.plan[0].plan_data.candidates[0].content.parts[0].text;
            const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
              const parsedData = JSON.parse(jsonMatch[1]);
              const itineraryArray = parsedData.days || parsedData.itinerary;
              if (itineraryArray && Array.isArray(itineraryArray)) {
                itineraryArray.forEach((dayPlan, index) => {
                  const dayNumber = (dayPlan.day || index + 1).toString();
                  const date = new Date(newStartDate); 
                  date.setDate(date.getDate() + index);
                  const dateStr = formatDateFns(date, 'M/d');
                  const detail = (dayPlan.title || '').replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim();
                  const fullTitle = detail ? `${dateStr} ${detail}` : dateStr;
                  newTravelPlans[dayNumber] = {
                    title: fullTitle,
                    description: dayPlan.description || '',
                    schedules: dayPlan.schedules || []
                  };
                  newDayOrder.push(dayNumber);
                });
                newDayOrder.sort((a, b) => parseInt(a) - parseInt(b));
                newSelectedDay = newDayOrder[0] || '1';
              }
            }
          } catch (e) {
            console.error('[useTravelPlanLoader] AI 데이터 파싱 중 오류:', e);
            setLoadError('AI 여행 계획 분석 중 오류가 발생했습니다.');
          }
        }
      }
      
      // 데이터가 어떤 방식으로든 처리되지 않았을 경우
      if (Object.keys(newTravelPlans).length === 0 && !loadError) {
        console.log('[useTravelPlanLoader] 유효한 계획 데이터 없음, 기본 1일차 생성. newStartDate:', newStartDate);
        const titleDateStr = formatDateFns(newStartDate || potentialStartDate, 'M/d');
        newTravelPlans['1'] = { title: titleDateStr, schedules: [] };
        newDayOrder = ['1'];
        newSelectedDay = '1';
      }

      // 항공편 정보 설정
      setLoadedFlightInfo(parsedFlightInfo);
      setIsRoundTrip(roundTripFlag);

      // 항공편 정보 추가 (일반적인 항공편 데이터인 경우)
      if (!isDataProcessed && parsedFlightInfo && parsedFlightInfo.itineraries && parsedFlightInfo.itineraries.length > 0) {
        console.log('[useTravelPlanLoader] 항공편 정보를 일정에 추가 시도');
        const formatTitle = (date, dayNum) => formatDateForTitleInternal(date, dayNum); 
        const { schedulesByDay } = createFlightSchedules(parsedFlightInfo, newStartDate, newDayOrder, formatTitle);
        
        if (schedulesByDay) {
          Object.keys(schedulesByDay).forEach(dayKey => {
            if (!newTravelPlans[dayKey]) {
              const dateForTitle = new Date(newStartDate);
              dateForTitle.setDate(dateForTitle.getDate() + parseInt(dayKey) - 1);
              newTravelPlans[dayKey] = { 
                title: formatDateForTitleInternal(dateForTitle, parseInt(dayKey)), 
                schedules: [] 
              };
              if (!newDayOrder.includes(dayKey)) { 
                newDayOrder.push(dayKey);
                newDayOrder.sort((a, b) => parseInt(a) - parseInt(b));
              }
            }
            
            const schedules = schedulesByDay[dayKey];
            if (schedules && schedules.length > 0) {
              const existingSchedules = newTravelPlans[dayKey].schedules || [];
              newTravelPlans[dayKey].schedules = [...schedules, ...existingSchedules];
            }
          });
        }
        console.log('[useTravelPlanLoader] 항공편 정보 일정에 추가 완료');
      }
      
      if (!loadError) {
        setTravelPlans(newTravelPlans);
        setDayOrder(newDayOrder.length > 0 ? newDayOrder : ['1']); 
        setSelectedDay(newDayOrder.length > 0 ? newDayOrder[0] : '1'); 
        setPlanId(newPlanId);
        setStartDate(newStartDate || potentialStartDate); 
        console.log('[useTravelPlanLoader] 최종 상태 업데이트 완료. newStartDate:', newStartDate);
      }

    } catch (error) {
      console.error('[useTravelPlanLoader] 여행 계획 로드 실패:', error);
      setLoadError(`여행 계획 로드 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
      initializePlanState(); 
    } finally {
      setIsLoadingPlan(false);
      console.log('[useTravelPlanLoader] loadTravelPlanInternal 함수 종료');
    }
  }, [user, planIdFromUrl, loadMode, createFlightSchedules, startDate, initializePlanState]);

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
    isRoundTrip,
    loadError
  };
};

export default useTravelPlanLoader; 