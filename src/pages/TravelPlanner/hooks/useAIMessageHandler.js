import { useCallback } from 'react';
import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import { sortSchedulesByTime } from '../utils/scheduleUtils';

// API_URL - API 엔드포인트 기본 URL
const API_URL = 'https://9b5hbw9u25.execute-api.ap-northeast-2.amazonaws.com/Stage';

/**
 * AI 메시지 처리를 위한 커스텀 훅
 * @param {Object} planData - 현재 계획 데이터
 * @param {Function} updatePlanData - 계획 데이터 업데이트 함수
 * @returns {Function} handleAISendMessage - AI에 메시지를 전송하는 함수
 */
const useAIMessageHandler = (planData, updatePlanData) => {
  const handleAISendMessage = useCallback(async (message, callback) => {
    console.log('Message to AI from useAIMessageHandler:', message);
    
    if (typeof callback !== 'function') {
      console.error('AI 메시지 처리: 유효한 콜백 함수가 제공되지 않았습니다.');
      return;
    }

    const currentCallback = callback;
    
    const currentPlanData = {
      plan_id: planData.planId, 
      day_order: planData.dayOrder,
      travel_plans: planData.travelPlans,
      start_date: planData.startDate.toISOString().split('T')[0],
      message: message
    };
    
    const apiUrl = `${API_URL}/travel/modify`;

    // Authorization 헤더를 위한 토큰 가져오기
    let authToken = 'Bearer test-token'; // 기본값 또는 개발용 토큰
    try {
      const session = await fetchAuthSession(); 
      if (session.tokens && session.tokens.idToken) {
        authToken = `Bearer ${session.tokens.idToken.toString()}`;
        console.log('Amplify 세션 토큰 사용됨.');
      } else {
        console.log('Amplify 세션 토큰을 찾을 수 없음, 개발용 토큰 사용.');
      }
    } catch (err) {
      console.warn('인증 토큰 가져오기 실패 (개발 환경에서는 test-token 사용):', err);
    }
    
    console.log('AI 계획 수정: 사용 중인 planId (from state):', currentPlanData.plan_id);
    console.log('AI 계획 수정: 사용 중인 단일 flightInfo (from state):', planData.loadedFlightInfo); 
    console.log('AI 계획 수정: 사용 중인 다중 flightInfos (from state):', planData.loadedFlightInfos);
    console.log('AI 계획 수정: 사용 중인 다중 accommodationInfos (from state):', planData.loadedAccommodationInfos);
    console.log('AI 계획 수정: 사용 중인 isRoundTrip (from state):', planData.isRoundTrip);   
    console.log('AI 계획 수정 요청 URL:', apiUrl);
    console.log('AI 계획 수정 요청을 위한 기본 계획 데이터 (currentPlanData):', currentPlanData);
    
    const requestBody = {
      plans: { 
        planId: currentPlanData.plan_id,
        day_order: currentPlanData.day_order,
        travel_plans: currentPlanData.travel_plans,
        start_date: currentPlanData.start_date
      },
      need: currentPlanData.message,
      // 단일 항공편 정보 (기존 호환성 유지)
      flightInfo: planData.loadedFlightInfo, 
      isRoundTrip: planData.isRoundTrip,
      // 다중 항공편 정보 추가
      flightInfos: planData.loadedFlightInfos || [],
      // 다중 숙박편 정보 추가  
      accommodationInfos: planData.loadedAccommodationInfos || []
    };

    console.log('AI 계획 수정 API에 전송하는 최종 요청 본문:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await axios.post(apiUrl, requestBody, {
        timeout: 75000, // 타임아웃을 75초로 늘림
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken // Authorization 헤더 추가
        }
      });

      console.log('AI 계획 수정 응답:', response.data);
      
      if (response.data) {
        // planId 업데이트 (새로 생성되었을 수 있으므로)
        if (response.data.planId) {
          updatePlanData.setPlanId(response.data.planId);
        }

        // AI가 수정한 여행 계획(response.data.plan) 처리
        if (response.data.plan) {
          try {
            const planJson = response.data.plan; // 'plan' 필드가 이미 파싱된 JSON 객체라고 가정

            if (planJson.title && planJson.days && Array.isArray(planJson.days)) {
              const newTravelPlans = {};
              const newDayOrder = [];
              
              planJson.days.forEach((day) => {
                // day.day, day.date, day.id 등 고유한 키로 사용할 값을 결정해야 합니다.
                // 예시에서는 day.day를 사용합니다.
                const dayKey = day.day ? day.day.toString() : (day.date || Math.random().toString(36).substr(2, 9)); 
                
                // ✅ AI 생성 일정에 시간 정렬 적용
                const sortedSchedules = day.schedules && Array.isArray(day.schedules) 
                  ? sortSchedulesByTime(day.schedules) 
                  : [];
                
                newTravelPlans[dayKey] = { 
                  title: day.title || `Day ${dayKey}`, // title이 없을 경우 대비
                  schedules: sortedSchedules
                };
                newDayOrder.push(dayKey);
              });
              
              updatePlanData.setTravelPlans(newTravelPlans);
              updatePlanData.setDayOrder(newDayOrder);
              
              // 필요하다면 전체 plan title도 업데이트 (planJson.title 사용)
              // if (planJson.title && updatePlanData.setPlanTitle) { // setPlanTitle 함수가 있다면
              //   updatePlanData.setPlanTitle(planJson.title);
              // }

              currentCallback({ type: 'success', content: response.data.message || 'AI가 계획을 성공적으로 수정했습니다.' });
            } else { 
              console.error('AI 응답의 plan 객체에 유효한 title 또는 days 데이터가 없습니다.', planJson);
              throw new Error('AI 응답의 계획 데이터 형식이 올바르지 않습니다.'); 
            }
          } catch (parseError) {
            console.error('AI 응답 plan 객체 처리 오류:', parseError, response.data.plan);
            currentCallback({ type: 'error', content: `AI 응답 처리 중 오류: ${parseError.message}` });
          }
        } else if (response.data.message) { // plan 데이터 없이 message만 있는 경우 (오류 등)
          // AI가 계획 수정에 실패했거나, 다른 메시지를 전달하는 경우
          console.warn('AI 응답에 plan 데이터는 없지만 message는 존재:', response.data.message);
          // planId가 있고 message가 있다면 성공으로 간주할 수도 있지만, 여기서는 정보성으로 처리
          currentCallback({ type: response.data.planId ? 'success' : 'info', content: response.data.message });
        } else {
          // 예상치 못한 응답 형식
          console.error('AI로부터 유효한 plan 데이터나 message를 받지 못했습니다.', response.data);
          currentCallback({ type: 'error', content: 'AI 계획 수정 결과를 처리할 수 없습니다. 응답 형식을 확인해주세요.' });
        }

      } else {
        currentCallback({ type: 'error', content: 'AI로부터 유효한 응답을 받지 못했습니다. 다시 시도해주세요.' });
      }
    } catch (error) {
      console.error('AI 계획 수정 중 오류 발생:', error);
      if (error.response) {
        console.error('서버 응답 오류:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('네트워크 오류 (응답 없음):', error.request);
      } else {
        console.error('요청 설정 오류:', error.message);
      }
      currentCallback({
        type: 'error',
        content: 'AI 계획 수정 중 오류가 발생했습니다: ' + (error.response?.data?.message || error.message || '네트워크 오류')
      });
    }
  }, [
    planData.planId, 
    planData.dayOrder, 
    planData.travelPlans, 
    planData.startDate, 
    planData.loadedFlightInfo, 
    planData.loadedFlightInfos,
    planData.loadedAccommodationInfos,
    planData.isRoundTrip, 
    updatePlanData.setPlanId, 
    updatePlanData.setTravelPlans, 
    updatePlanData.setDayOrder
    // updatePlanData.setPlanTitle, // 필요하다면 의존성 배열에 추가
  ]);

  return handleAISendMessage;
};

export default useAIMessageHandler; 