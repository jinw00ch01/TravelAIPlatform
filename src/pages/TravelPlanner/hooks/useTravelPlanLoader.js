import { useState, useEffect, useCallback } from 'react';
import { format as formatDateFns } from 'date-fns';
import { travelApi } from '../../../services/api';
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
  const [loadedAccommodationInfo, setLoadedAccommodationInfo] = useState(null);
  
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
    setLoadedAccommodationInfo(null);
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
    let isDataProcessed = false;
    let parsedFlightInfo = null;
    let roundTripFlag = false;
    let parsedAccommodationInfo = null;

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
          // accmo_info 필드에서 숙박 정보 파싱
          if (data.plan.accmo_info) {
            parsedAccommodationInfo = JSON.parse(data.plan.accmo_info);
            console.log('[useTravelPlanLoader] 숙박 정보 파싱 완료 (accmo_info)', parsedAccommodationInfo);
            
            // 숙박 정보를 일정에 추가
            if (parsedAccommodationInfo.hotel && parsedAccommodationInfo.checkIn && parsedAccommodationInfo.checkOut) {
              const checkInDate = new Date(parsedAccommodationInfo.checkIn);
              const checkOutDate = new Date(parsedAccommodationInfo.checkOut);
              
              // 체크인 날짜에 해당하는 day 찾기
              const checkInDayKey = Object.keys(newTravelPlans).find(dayKey => {
                const dayDate = new Date(potentialStartDate);
                dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
                dayDate.setHours(0, 0, 0, 0);
                checkInDate.setHours(0, 0, 0, 0);
                return dayDate.getTime() === checkInDate.getTime();
              });

              // 체크아웃 날짜에 해당하는 day 찾기
              const checkOutDayKey = Object.keys(newTravelPlans).find(dayKey => {
                const dayDate = new Date(potentialStartDate);
                dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
                dayDate.setHours(0, 0, 0, 0);
                checkOutDate.setHours(0, 0, 0, 0);
                return dayDate.getTime() === checkOutDate.getTime();
              });

              if (checkInDayKey) {
                const baseSchedule = {
                  type: 'accommodation',
                  name: parsedAccommodationInfo.hotel.hotel_name || parsedAccommodationInfo.hotel.hotel_name_trans,
                  address: parsedAccommodationInfo.hotel.address || parsedAccommodationInfo.hotel.address_trans,
                  category: '숙박',
                  lat: parsedAccommodationInfo.hotel.latitude,
                  lng: parsedAccommodationInfo.hotel.longitude,
                  hotelDetails: parsedAccommodationInfo
                };

                // 체크인 일정 추가
                const checkInSchedule = {
                  ...baseSchedule,
                  id: `hotel-${parsedAccommodationInfo.hotel.hotel_id}-${checkInDayKey}-in`,
                  time: '체크인'
                };
                newTravelPlans[checkInDayKey].schedules.push(checkInSchedule);

                // 체크아웃 일정 추가 (체크아웃 날짜가 다른 경우에만)
                if (checkOutDayKey && checkOutDayKey !== checkInDayKey) {
                  const checkOutSchedule = {
                    ...baseSchedule,
                    id: `hotel-${parsedAccommodationInfo.hotel.hotel_id}-${checkOutDayKey}-out`,
                    time: '체크아웃'
                  };
                  newTravelPlans[checkOutDayKey].schedules.push(checkOutSchedule);
                }
              }
            }
          }
        } catch (e) {
          console.error('[useTravelPlanLoader] 항공편/숙박 정보 파싱 실패:', e);
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

      // LoadPlanFunction_NEW 응답에서 accommodationInfo 처리 (최상위 레벨에 추가됨)
      if (data?.accommodationInfo) {
        parsedAccommodationInfo = data.accommodationInfo;
        console.log('[useTravelPlanLoader] LoadPlanFunction_NEW 응답에서 accommodationInfo 설정', parsedAccommodationInfo);
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
                  const isAccommodation = schedule.category === '숙소' || schedule.type === 'accommodation';
                  
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
                    category: isAccommodation ? '숙소' : (schedule.category || '관광')
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

    // 최종 반환 데이터
    return {
      travelPlans: newTravelPlans,
      dayOrder: newDayOrder,
      selectedDay: newSelectedDay,
      planId: newPlanId,
      startDate: newStartDate || potentialStartDate,
      loadedFlightInfo: parsedFlightInfo,
      isRoundTrip: roundTripFlag,
      loadedAccommodationInfo: parsedAccommodationInfo
    };
  }, []);

  // 항공편 정보를 일정에 추가하는 함수
  const addFlightInfoToSchedules = useCallback((travelPlansData, parsedFlightInfo, newStartDate, dayOrderArray) => {
    if (!parsedFlightInfo || !parsedFlightInfo.itineraries || parsedFlightInfo.itineraries.length === 0) {
      return travelPlansData;
    }

    console.log('[useTravelPlanLoader] 항공편 정보를 일정에 추가 시도');
    const formatTitle = (date, dayNum) => formatDateForTitleInternal(date, dayNum); 
    const { schedulesByDay } = createFlightSchedules(parsedFlightInfo, newStartDate, dayOrderArray, formatTitle);
    
    const updatedTravelPlans = { ...travelPlansData };
    
    if (schedulesByDay) {
      Object.keys(schedulesByDay).forEach(dayKey => {
        if (!updatedTravelPlans[dayKey]) {
          const dateForTitle = new Date(newStartDate);
          dateForTitle.setDate(dateForTitle.getDate() + parseInt(dayKey) - 1);
          updatedTravelPlans[dayKey] = { 
            title: formatDateForTitleInternal(dateForTitle, parseInt(dayKey)), 
            schedules: [] 
          };
        }
        
        const schedules = schedulesByDay[dayKey];
        if (schedules && schedules.length > 0) {
          const existingSchedules = updatedTravelPlans[dayKey].schedules || [];
          updatedTravelPlans[dayKey].schedules = [...schedules, ...existingSchedules];
        }
      });
    }
    console.log('[useTravelPlanLoader] 항공편 정보 일정에 추가 완료');
    
    return updatedTravelPlans;
  }, [createFlightSchedules]);

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
    setLoadedAccommodationInfo(null);
    
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

      // 항공편 정보 추가
      const updatedTravelPlans = addFlightInfoToSchedules(
        result.travelPlans,
        result.loadedFlightInfo,
        result.startDate,
        result.dayOrder
      );
      
      // 상태 업데이트
      setTravelPlans(updatedTravelPlans);
      setDayOrder(result.dayOrder);
      setSelectedDay(result.selectedDay);
      setPlanId(result.planId);
      setStartDate(result.startDate);
      setLoadedFlightInfo(result.loadedFlightInfo);
      setIsRoundTrip(result.isRoundTrip);
      setLoadedAccommodationInfo(result.loadedAccommodationInfo);
      
      console.log('[useTravelPlanLoader] 최종 상태 업데이트 완료. newStartDate:', result.startDate);

      // accommodationInfo 처리 로직 추가
      if (result.loadedAccommodationInfo?.hotel) {
        console.log('[useTravelPlanLoader] accommodationInfo를 일정에 추가 시작');
        const checkInDate = new Date(result.loadedAccommodationInfo.checkIn);
        const checkOutDate = new Date(result.loadedAccommodationInfo.checkOut);
        
        // 날짜 비교를 위해 시간 정보 제거
        checkInDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(0, 0, 0, 0);
        console.log('[useTravelPlanLoader] 체크인/아웃 날짜:', { checkInDate, checkOutDate });

        // 시작 날짜를 체크인 날짜로 업데이트
        result.startDate = checkInDate;
        console.log('[useTravelPlanLoader] 시작 날짜를 체크인 날짜로 업데이트:', result.startDate);
        
        // 체크인과 체크아웃 날짜에 해당하는 day 키 찾기
        const dayKeys = result.dayOrder.filter(dayKey => {
          const dayDate = new Date(result.startDate);
          dayDate.setDate(dayDate.getDate() + parseInt(dayKey) - 1);
          dayDate.setHours(0, 0, 0, 0);
          
          // 체크인 또는 체크아웃 날짜와 일치하는지 확인
          const isCheckInDay = dayDate.getTime() === checkInDate.getTime();
          const isCheckOutDay = dayDate.getTime() === checkOutDate.getTime();
          console.log('[useTravelPlanLoader] 날짜 비교:', {
            dayKey,
            dayDate,
            isCheckInDay,
            isCheckOutDay
          });
          return isCheckInDay || isCheckOutDay;
        }).sort((a, b) => parseInt(a) - parseInt(b));

        console.log('[useTravelPlanLoader] 찾은 숙박 일정 날짜들:', dayKeys);

        if (dayKeys.length > 0) {
          console.log('[useTravelPlanLoader] 숙박 일정 추가:', dayKeys);
          const hotelInfo = result.loadedAccommodationInfo.hotel;
          
          // 기본 스케줄 정보
          const baseSchedule = {
            name: hotelInfo.hotel_name,
            address: hotelInfo.address,
            category: '숙소',
            type: 'accommodation',
            hotelDetails: result.loadedAccommodationInfo,
            lat: hotelInfo.latitude,
            lng: hotelInfo.longitude,
            notes: hotelInfo.price ? `가격: ${hotelInfo.price}` : ''
          };
          console.log('[useTravelPlanLoader] 생성된 기본 스케줄:', baseSchedule);

          // 체크인 날짜에 체크인 일정 추가
          const checkInDayKey = dayKeys[0];
          const checkInSchedule = {
            ...baseSchedule,
            id: `hotel-${hotelInfo.hotel_id}-${checkInDayKey}-in`,
            time: '체크인',
            duration: '1박'
          };

          if (!updatedTravelPlans[checkInDayKey]) {
            const checkInDateObj = new Date(result.startDate);
            checkInDateObj.setDate(checkInDateObj.getDate() + parseInt(checkInDayKey) - 1);
            updatedTravelPlans[checkInDayKey] = {
              title: formatDateForTitleInternal(checkInDateObj, parseInt(checkInDayKey)),
              schedules: []
            };
          }
          updatedTravelPlans[checkInDayKey].schedules.push(checkInSchedule);

          // 체크아웃 날짜에 체크아웃 일정 추가 (체크아웃 날짜가 체크인 날짜와 다른 경우에만)
          if (dayKeys.length > 1) {
            const checkOutDayKey = dayKeys[dayKeys.length - 1];
            const checkOutSchedule = {
              ...baseSchedule,
              id: `hotel-${hotelInfo.hotel_id}-${checkOutDayKey}-out`,
              time: '체크아웃',
              duration: ''
            };

            if (!updatedTravelPlans[checkOutDayKey]) {
              const checkOutDateObj = new Date(result.startDate);
              checkOutDateObj.setDate(checkOutDateObj.getDate() + parseInt(checkOutDayKey) - 1);
              updatedTravelPlans[checkOutDayKey] = {
                title: formatDateForTitleInternal(checkOutDateObj, parseInt(checkOutDayKey)),
                schedules: []
              };
            }
            updatedTravelPlans[checkOutDayKey].schedules.push(checkOutSchedule);
          }
        }
      }

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
    loadNewestPlan, loadPlanById, addFlightInfoToSchedules
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
    isRoundTrip,
    loadError,
    loadedAccommodationInfo
  };
};

export default useTravelPlanLoader; 