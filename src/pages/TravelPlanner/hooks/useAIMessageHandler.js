import { useCallback } from 'react';
import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL - API 엔드포인트 기본 URL
const API_URL = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage';

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
    
    const apiUrl = `${API_URL}/api/travel/modify_python`;

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
    console.log('AI 계획 수정: 사용 중인 flightInfo (from state):', planData.loadedFlightInfo); 
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
      flightInfo: planData.loadedFlightInfo, // loadedFlightInfo 상태 전달
      isRoundTrip: planData.isRoundTrip     // isRoundTrip 상태 전달
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

        // Gemini 응답에서 계획 추출 (기존 로직과 유사하게)
        if (response.data.plan && response.data.plan.candidates) {
          try {
            const aiContent = response.data.plan.candidates[0]?.content?.parts[0]?.text;
            if (aiContent) {
              const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/) || aiContent.match(/{[\s\S]*?}/);
              if (jsonMatch) {
                const planJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                if (planJson.days && Array.isArray(planJson.days)) {
                  const newTravelPlans = {};
                  const newDayOrder = [];
                  planJson.days.forEach((day) => {
                    const dayKey = day.day.toString();
                    newTravelPlans[dayKey] = { title: day.title, schedules: day.schedules || [] };
                    newDayOrder.push(dayKey);
                  });
                  updatePlanData.setTravelPlans(newTravelPlans);
                  updatePlanData.setDayOrder(newDayOrder);
                  currentCallback({ type: 'success', content: response.data.message || 'AI가 계획을 성공적으로 수정했습니다.' });
                } else { 
                  throw new Error('유효한 일자 계획 데이터가 없습니다.'); 
                }
              } else { 
                throw new Error('AI 응답에서 JSON 데이터를 찾을 수 없습니다.'); 
              }
            } else { 
              throw new Error('AI 응답에 콘텐츠가 없습니다.'); 
            }
          } catch (parseError) {
            console.error('AI 응답 파싱 오류:', parseError);
            currentCallback({ type: 'error', content: `AI 응답 처리 중 오류: ${parseError.message}` });
          }
        } else if (response.data.updatedPlan) { // 기존 API 형식 호환
          updatePlanData.setTravelPlans(response.data.updatedPlan.travel_plans || {});
          updatePlanData.setDayOrder(response.data.updatedPlan.day_order || []);
          currentCallback({ type: 'success', content: response.data.message || 'AI가 계획을 성공적으로 수정했습니다.' });
        } else if (response.data.plannerData) { // 다른 형식 호환
          updatePlanData.setTravelPlans(response.data.plannerData || {});
          updatePlanData.setDayOrder(Object.keys(response.data.plannerData || {}).sort());
          currentCallback({ type: 'success', content: response.data.message || 'AI가 계획을 성공적으로 수정했습니다.'});
        } else if (!response.data.plan) { 
          currentCallback({ type: 'error', content: response.data.message || 'AI 계획 수정 결과를 처리할 수 없습니다. 응답 형식을 확인해주세요.' });
        }

        // flightInfo와 isRoundTrip도 응답에 따라 업데이트 (필요한 경우)
        // 이 부분은 실제 상태 관리 구조에 맞게 구현해야 합니다.
        // 예: if (response.data.flightInfo) updatePlanData.setLoadedFlightInfo(response.data.flightInfo);
        // 예: if (typeof response.data.isRoundTrip === 'boolean') updatePlanData.setIsRoundTrip(response.data.isRoundTrip);

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
    planData.isRoundTrip, 
    updatePlanData.setPlanId, 
    updatePlanData.setTravelPlans, 
    updatePlanData.setDayOrder
  ]);

  return handleAISendMessage;
};

export default useAIMessageHandler; 