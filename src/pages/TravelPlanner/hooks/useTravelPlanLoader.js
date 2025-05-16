// useTravelPlanLoader.js
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

const useTravelPlanLoader = (user) => {
  const [travelPlans, setTravelPlans] = useState({ 1: { title: formatDateFns(new Date(), 'M/d'), schedules: [] } });
  const [dayOrder, setDayOrder] = useState(['1']);
  const [selectedDay, setSelectedDay] = useState('1');
  const [startDate, setStartDate] = useState(new Date());
  const [planId, setPlanId] = useState(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [loadedFlightInfo, setLoadedFlightInfo] = useState(null);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  // useFlightHandlers 훅에서 createFlightSchedules 함수 가져오기
  const { createFlightSchedules } = useFlightHandlers();

  const loadTravelPlan = useCallback(async (params = { newest: true }) => {
    console.log('[useTravelPlanLoader] loadTravelPlan 함수 시작', params);
    console.log('[useTravelPlanLoader] loadTravelPlan 시작 시점의 startDate:', startDate);
    setIsLoadingPlan(true);
    setLoadError(null);
    setLoadedFlightInfo(null);
    setIsRoundTrip(false);
    const initialStartDateForThisLoad = new Date();

    try {
      const data = await travelApi.loadPlan(params);
      console.log('[useTravelPlanLoader] travelApi.loadPlan 응답 데이터 (전체):', JSON.stringify(data, null, 2)); // 전체 데이터 구조 확인용 로그
      console.log('[useTravelPlanLoader] data.plan?.[0] 객체 확인:', JSON.stringify(data?.plan?.[0], null, 2)); // data.plan[0] 상세 확인

      let newTravelPlans = {};
      let newDayOrder = [];
      let newSelectedDay = '1';
      let newPlanId = null;
      let newStartDate = null;

      // API 응답에서 start_date를 가장 먼저 확인 (여러 경로 시도)
      if (data?.plan?.[0]?.start_date) {
        newStartDate = new Date(data.plan[0].start_date);
        console.log('[useTravelPlanLoader] 경로1 (data.plan[0].start_date)에서 newStartDate 설정:', newStartDate);
      } else if (data?.originalData?.start_date) { 
        newStartDate = new Date(data.originalData.start_date);
        console.log('[useTravelPlanLoader] 경로2 (data.originalData.start_date)에서 newStartDate 설정:', newStartDate);
      } else if (data?.start_date) { // 최상위 start_date 확인 (백엔드 응답 구조에 따라)
        newStartDate = new Date(data.start_date);
        console.log('[useTravelPlanLoader] 경로3 (data.start_date)에서 newStartDate 설정:', newStartDate);
      } else if (data?.plan?.[0]?.plan_data?.start_date) { // plan_data 내부도 확인
        newStartDate = new Date(data.plan[0].plan_data.start_date);
        console.log('[useTravelPlanLoader] 경로4 (data.plan[0].plan_data.start_date)에서 newStartDate 설정:', newStartDate);
      }
      
      // newStartDate가 여전히 null이면 (즉, 어떤 경로에서도 못 찾았으면) 기존 로직대로 처리
      if (!newStartDate || isNaN(newStartDate.getTime())) { 
        newStartDate = startDate || initialStartDateForThisLoad;
        console.log('[useTravelPlanLoader] API 응답에 start_date 없어 기존 startDate 또는 오늘 날짜로 newStartDate 설정:', newStartDate);
      } else {
        console.log('[useTravelPlanLoader] 최종적으로 API 응답으로부터 newStartDate 설정 성공:', newStartDate);
      }

      let parsedFlightInfo = null;
      let roundTripFlag = false;
      if (data?.originalData?.flight_info) {
        try {
          parsedFlightInfo = JSON.parse(data.originalData.flight_info);
          roundTripFlag = data.originalData.is_round_trip === 'true' || data.originalData.is_round_trip === true || parsedFlightInfo?.isRoundTrip || (parsedFlightInfo?.oneWay === false) || (parsedFlightInfo?.itineraries?.length > 1) || false;
          console.log('[useTravelPlanLoader] OriginalData에서 flightInfo 파싱 완료', { parsedFlightInfo, roundTripFlag });
        } catch (e) {
          console.error('[useTravelPlanLoader] OriginalData flight_info 파싱 실패:', e);
        }
      } else if (data?.flightInfo) {
         try {
          parsedFlightInfo = typeof data.flightInfo === 'string' ? JSON.parse(data.flightInfo) : data.flightInfo;
          roundTripFlag = data.isRoundTrip === 'true' || data.isRoundTrip === true || parsedFlightInfo?.isRoundTrip || (parsedFlightInfo?.oneWay === false) || (parsedFlightInfo?.itineraries?.length > 1) || false;
          console.log('[useTravelPlanLoader] 최상위 flightInfo 파싱 완료', { parsedFlightInfo, roundTripFlag });
        } catch (e) {
          console.error('[useTravelPlanLoader] 최상위 flightInfo 파싱 실패:', e);
        }
      }
      setLoadedFlightInfo(parsedFlightInfo);
      setIsRoundTrip(roundTripFlag);

      if (data?.plannerData && Object.keys(data.plannerData).length > 0) {
        console.log('[useTravelPlanLoader] 서버에서 처리된 플래너 데이터 발견');
        newTravelPlans = data.plannerData;
        newDayOrder = Object.keys(data.plannerData).sort((a,b) => parseInt(a) - parseInt(b));
        newSelectedDay = newDayOrder[0] || '1';
        if (data.plan?.[0]?.id) newPlanId = data.plan[0].id;
        console.log('[useTravelPlanLoader] plannerData 사용 시 newStartDate (변경 없음):', newStartDate);

      } else if (data?.plan?.[0]?.itinerary_schedules && Object.keys(data.plan[0].itinerary_schedules).length > 0) {
        console.log('[useTravelPlanLoader] itinerary_schedules 데이터 발견');
        const itinerarySchedules = data.plan[0].itinerary_schedules;
        if (data.plan[0].plan_id) newPlanId = data.plan[0].plan_id;
        console.log('[useTravelPlanLoader] itinerary_schedules 사용 시 newStartDate (변경 없음):', newStartDate);

        Object.keys(itinerarySchedules).sort((a,b) => parseInt(a) - parseInt(b)).forEach(dayKey => {
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
        console.log('[useTravelPlanLoader] AI 생성 데이터 파싱 시도');
        if (data.plan[0].plan_id) newPlanId = data.plan[0].plan_id;
        console.log('[useTravelPlanLoader] AI 생성 데이터 파싱 시 newStartDate (변경 없음):', newStartDate);

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
                    newDayOrder.sort((a,b) => parseInt(a) - parseInt(b));
                    newSelectedDay = newDayOrder[0] || '1';
                }
            }
        } catch (e) {
            console.error('[useTravelPlanLoader] AI 데이터 파싱 중 오류:', e);
            setLoadError('AI 여행 계획 분석 중 오류가 발생했습니다.');
        }
      } 
      
      if (Object.keys(newTravelPlans).length === 0 && !loadError) {
        console.log('[useTravelPlanLoader] 유효한 계획 데이터 없음, 기본 1일차 생성, newStartDate:', newStartDate);
        const titleDateStr = formatDateFns(newStartDate, 'M/d');
        newTravelPlans['1'] = { title: titleDateStr, schedules: [] };
        newDayOrder = ['1'];
        newSelectedDay = '1';
      }

      // 항공편 정보가 있으면 일정에 추가
      if (parsedFlightInfo && parsedFlightInfo.itineraries && parsedFlightInfo.itineraries.length > 0) {
        console.log('[useTravelPlanLoader] 항공편 정보를 일정에 추가 시도');
        
        // createFlightSchedules 함수를 사용하여 항공편 일정 생성
        const formatTitle = (date) => formatDateForTitleInternal(date, 1);
        const { schedulesByDay, isRoundTrip } = createFlightSchedules(parsedFlightInfo, newStartDate, newDayOrder, formatTitle);
        
        // 생성된 스케줄을 각 일자에 배치
        if (schedulesByDay) {
          Object.keys(schedulesByDay).forEach(dayKey => {
            if (!newTravelPlans[dayKey]) {
              const dateForTitle = new Date(newStartDate);
              dateForTitle.setDate(dateForTitle.getDate() + parseInt(dayKey) - 1);
              newTravelPlans[dayKey] = { 
                title: formatDateForTitleInternal(dateForTitle, parseInt(dayKey)), 
                schedules: [] 
              };
            }
            
            const schedules = schedulesByDay[dayKey];
            if (schedules && schedules.length > 0) {
              if (dayKey === newDayOrder[0]) {
                // 첫날이면 항공편을 일정 앞에 추가
                newTravelPlans[dayKey].schedules = [...schedules, ...(newTravelPlans[dayKey].schedules || [])];
              } else {
                // 다른 날이면 항공편을 일정 뒤에 추가
                newTravelPlans[dayKey].schedules = [...(newTravelPlans[dayKey].schedules || []), ...schedules];
              }
            }
          });
        }
        
        console.log('[useTravelPlanLoader] 항공편 정보 일정에 추가 완료');
      }
      
      if (!loadError) {
        setTravelPlans(newTravelPlans);
        setDayOrder(newDayOrder);
        setSelectedDay(newSelectedDay);
        setPlanId(newPlanId);
        console.log('[useTravelPlanLoader] setStartDate 호출 직전 newStartDate:', newStartDate);
        setStartDate(newStartDate);
        console.log('[useTravelPlanLoader] setStartDate 호출 직후 (다음 렌더링 시 반영될 값) newStartDate:', newStartDate);
      }

    } catch (error) {
      console.error('[useTravelPlanLoader] 여행 계획 로드 실패:', error);
      setLoadError(`여행 계획 로드 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
      const todayStr = formatDateFns(startDate, 'M/d'); // 여기서는 현재 startDate를 사용 (오류 상황이므로)
      setTravelPlans({ '1': { title: todayStr, schedules: [] } });
      setDayOrder(['1']);
      setSelectedDay('1');
      setPlanId(null);
      // 오류 발생 시 startDate는 변경하지 않거나, 사용자에게 알림 후 초기화 고려
    } finally {
      setIsLoadingPlan(false);
      console.log('[useTravelPlanLoader] loadTravelPlan 함수 종료');
    }
  }, [user, startDate, createFlightSchedules]); // createFlightSchedules 의존성 추가

  useEffect(() => {
    if (user) {
      loadTravelPlan({ newest: true }); // 최초 로드 시에는 newest: true를 명시적으로 전달
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // loadTravelPlan을 의존성 배열에서 제거하고, 최초 마운트 시에만 실행되도록 user만 남김

  return {
    travelPlans, setTravelPlans,
    dayOrder, setDayOrder,
    selectedDay, setSelectedDay,
    startDate, setStartDate,
    planId, setPlanId,
    isLoadingPlan,
    loadTravelPlan,
    loadedFlightInfo,
    isRoundTrip,
    loadError
  };
};

export default useTravelPlanLoader;
