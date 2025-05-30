import { useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import websocketService from '../../../services/websocketService'; // 경로 수정

// API_URL - API 엔드포인트 기본 URL (이제 직접 사용 안 함)
// const API_URL = 'https://9b5hbw9u25.execute-api.ap-northeast-2.amazonaws.com/Stage';

/**
 * AI 메시지 처리를 위한 커스텀 훅 (WebSocket 비동기 방식)
 * @param {Object} planData - 현재 계획 데이터
 * @param {Function} updatePlanData - 계획 데이터 업데이트 함수
 * @returns {Function} handleAISendMessage - AI에 메시지를 전송하는 함수
 */
const useAIMessageHandler = (planData, updatePlanData) => {
  const handleAISendMessage = useCallback(async (message, callback) => {
    console.log('Message to AI (WebSocket) from useAIMessageHandler:', message);
    
    if (typeof callback !== 'function') {
      console.error('AI 메시지 처리: 유효한 콜백 함수가 제공되지 않았습니다.');
      return;
    }

    const currentCallback = callback;
    
    // WebSocket을 통해 백엔드로 보낼 데이터 구성
    // 기존 currentPlanData와 requestBody의 내용을 조합
    const modificationDetails = {
      plans: { 
        planId: planData.planId, // 기존 planId가 있을 수 있음
        day_order: planData.dayOrder,
        travel_plans: planData.travelPlans,
        start_date: planData.startDate.toISOString().split('T')[0]
      },
      need: message, // 사용자의 수정 요구사항 메시지
      flightInfo: planData.loadedFlightInfo, // 단일 항공편 정보
      isRoundTrip: planData.isRoundTrip,
      flightInfos: planData.loadedFlightInfos || [], // 다중 항공편 정보
      accommodationInfos: planData.loadedAccommodationInfos || [] // 다중 숙박편 정보
    };

    console.log('[DEBUG] useAIMessageHandler - 전송할 modificationDetails 구조:');
    console.log('  - plans:', modificationDetails.plans);
    console.log('  - need:', modificationDetails.need);
    console.log('  - flightInfo 존재:', !!modificationDetails.flightInfo);
    console.log('  - flightInfos 길이:', modificationDetails.flightInfos.length);
    console.log('  - accommodationInfos 길이:', modificationDetails.accommodationInfos.length);
    console.log('AI 계획 수정 요청 (WebSocket)을 위한 데이터:', JSON.stringify(modificationDetails, null, 2));

    try {
      // 사용자에게 처리 중임을 알림 (요청 접수 단계)
      currentCallback({ 
        type: 'info', 
        content: 'AI에게 계획 수정 요청을 전송 중입니다...'
      });

      // authToken 가져오기 (선택적: websocketService 내부에서도 처리 가능)
      let authToken = 'test-token'; 
      try {
        const session = await fetchAuthSession(); 
        if (session.tokens && session.tokens.idToken) {
          authToken = session.tokens.idToken.toString(); // Bearer 없이 토큰 자체만 전달
          console.log('Amplify 세션 토큰 사용됨 (WebSocket용).');
        } else {
          console.log('Amplify 세션 토큰을 찾을 수 없음, 개발용 토큰 사용 (WebSocket용).');
        }
      } catch (err) {
        console.warn('인증 토큰 가져오기 실패 (개발 환경에서는 test-token 사용 - WebSocket용):', err);
      }

      // websocketService를 통해 AI 계획 수정 요청
      // 응답은 websocketService에 등록된 핸들러('plan_modified', 'ai_modification_error')를 통해 비동기적으로 처리됨
      const result = await websocketService.modifyTravelPlanAsync(modificationDetails, authToken);
      
      // websocketService.modifyTravelPlanAsync가 성공적으로 resolve되면 호출됨
      console.log('AI 계획 수정 비동기 응답 (plan_modified):', result);

      if (result && result.plan) { // 백엔드 응답에 plan 데이터가 있다고 가정
        // planId 업데이트 (새로 생성되었거나 백엔드에서 변경되었을 수 있으므로)
        if (result.planId) {
          updatePlanData.setPlanId(result.planId);
        }

        // AI가 수정한 여행 계획(result.plan) 처리
        // 기존 동기식 응답 처리 로직과 유사하게 적용
        try {
          const planJson = result.plan; 

          if (planJson.title && planJson.days && Array.isArray(planJson.days)) {
            const newTravelPlans = {};
            const newDayOrder = [];
            
            planJson.days.forEach((day) => {
              const dayKey = day.day ? day.day.toString() : (day.date || Math.random().toString(36).substr(2, 9)); 
              newTravelPlans[dayKey] = { 
                title: day.title || `Day ${dayKey}`,
                schedules: day.schedules || [] 
              };
              newDayOrder.push(dayKey);
            });
            
            updatePlanData.setTravelPlans(newTravelPlans);
            updatePlanData.setDayOrder(newDayOrder);

            currentCallback({ type: 'success', content: result.message || 'AI가 계획을 성공적으로 수정했습니다.' });
          } else { 
            console.error('AI 응답의 plan 객체에 유효한 title 또는 days 데이터가 없습니다.', planJson);
            throw new Error('AI 응답의 계획 데이터 형식이 올바르지 않습니다.'); 
          }
        } catch (parseError) {
          console.error('AI 응답 plan 객체 처리 오류 (WebSocket):', parseError, result.plan);
          currentCallback({ type: 'error', content: `AI 응답 처리 중 오류: ${parseError.message}` });
        }
      } else if (result && result.message) { // plan 데이터 없이 message만 있는 경우
        console.warn('AI 응답에 plan 데이터는 없지만 message는 존재 (WebSocket):', result.message);
        currentCallback({ type: result.planId ? 'success' : 'info', content: result.message });
      } else {
        console.error('AI로부터 유효한 plan 데이터나 message를 받지 못했습니다 (WebSocket).', result);
        currentCallback({ type: 'error', content: 'AI 계획 수정 결과를 처리할 수 없습니다. 응답 형식을 확인해주세요.' });
      }

    } catch (error) {
      // websocketService.modifyTravelPlanAsync가 reject되면 호출됨 (타임아웃 또는 ai_modification_error)
      console.error('AI 계획 수정 요청 중 오류 발생 (WebSocket):', error);
      currentCallback({
        type: 'error',
        content: 'AI 계획 수정 중 오류가 발생했습니다: ' + (error.message || '네트워크 또는 서버 오류')
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
  ]);

  return handleAISendMessage;
};

export default useAIMessageHandler; 