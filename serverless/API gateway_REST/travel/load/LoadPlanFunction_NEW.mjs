import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import jwt from 'jsonwebtoken';

// DynamoDB v3 클라이언트 설정
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client); // DocumentClient

const TABLE_NAME = 'travel-plans';
const INDEX_NAME = 'UserIdIndex11'; // UserIdIndex11 인덱스 사용

// 공통 응답 헤더
const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
  'Content-Type': 'application/json'
};

// JWT 디코딩 함수 (서명 검증 없이 디코딩)
function decodeJwt(token) {
  try {
    return jwt.decode(token, { complete: false });
  } catch (err) {
    console.error('JWT 디코딩 실패:', err);
    return null;
  }
}

// Gemini API 응답에서 JSON 데이터 추출
function extractGeminiJsonData(planData) {
  try {
    if (planData && planData.candidates && Array.isArray(planData.candidates) && planData.candidates.length > 0) {
      const candidate = planData.candidates[0];
      if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts) && candidate.content.parts.length > 0) {
        const textContent = candidate.content.parts[0].text;
        if (textContent) {
          console.log('[extractGeminiJsonData] 텍스트 길이:', textContent.length);
          
          // 1. ```json ... ``` 마크다운 블록에서 JSON 추출 시도
          const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              let jsonString = jsonMatch[1];
              console.log('[extractGeminiJsonData] JSON 마크다운 블록 발견, 길이:', jsonString.length);
              
              // 백틱과 템플릿 리터럴 문제를 해결하기 위해 정리
              jsonString = cleanJsonString(jsonString);
              
              const parsed = JSON.parse(jsonString);
              console.log('[extractGeminiJsonData] JSON 마크다운 블록 파싱 성공');
              return parsed;
            } catch (parseError) {
              console.log('[extractGeminiJsonData] JSON 마크다운 블록 파싱 실패:', parseError.message);
              // 파싱 실패 시 다음 방법 시도
            }
          }
          
          // 2. 전체 텍스트에서 JSON 객체 추출 시도 (```json 없는 경우)
          try {
            // 텍스트에서 첫 번째 { 부터 마지막 } 까지 추출
            const firstBrace = textContent.indexOf('{');
            const lastBrace = textContent.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              let jsonString = textContent.substring(firstBrace, lastBrace + 1);
              console.log('[extractGeminiJsonData] 브레이스 기반 JSON 추출 시도, 길이:', jsonString.length);
              
              jsonString = cleanJsonString(jsonString);
              
              const parsed = JSON.parse(jsonString);
              console.log('[extractGeminiJsonData] 브레이스 기반 JSON 파싱 성공');
              return parsed;
            }
          } catch (parseError) {
            console.log('[extractGeminiJsonData] 브레이스 기반 JSON 파싱 실패:', parseError.message);
          }
          
          // 3. 직접 JSON 파싱 시도
          try {
            const cleaned = cleanJsonString(textContent);
            const parsed = JSON.parse(cleaned);
            console.log('[extractGeminiJsonData] 직접 JSON 파싱 성공');
            return parsed;
          } catch (e) {
            console.log('[extractGeminiJsonData] 직접 JSON 파싱 실패:', e.message);
          }
          
          // 4. 부분적 JSON 복구 시도
          try {
            console.log('[extractGeminiJsonData] 부분적 JSON 복구 시도 시작');
            const recovered = recoverPartialJson(textContent);
            if (recovered) {
              console.log('[extractGeminiJsonData] 부분적 JSON 복구 성공');
              return recovered;
            } else {
              console.log('[extractGeminiJsonData] 부분적 JSON 복구 결과 없음');
            }
          } catch (e) {
            console.log('[extractGeminiJsonData] 부분적 JSON 복구 실패:', e.message);
          }
          
          // 5. 모든 파싱이 실패한 경우 텍스트로 반환
          console.log('[extractGeminiJsonData] 모든 JSON 파싱 실패, 텍스트로 반환');
          return { text: textContent };
        }
      }
    }
    return planData;
  } catch (error) {
    console.error('[extractGeminiJsonData] Gemini 데이터 추출 오류:', error);
    return planData;
  }
}

// JSON 문자열 정리 함수
function cleanJsonString(jsonString) {
  // 백틱과 템플릿 리터럴 문제 해결
  // 예: `"address": "Via dell' Aeroporto di Fiumicino, 320, 00054 Fiumicino RM, Italy"\n` +
  jsonString = jsonString.replace(/`\s*\+\s*$/gm, '');
  jsonString = jsonString.replace(/^\s*`/gm, '');
  
  // 줄 끝의 백틱 제거
  jsonString = jsonString.replace(/`$/gm, '');
  
  // 문자열 내부의 잘못된 백틱 처리
  jsonString = jsonString.replace(/([^\\])`([^`]*?)`/g, '$1"$2"');
  
  // 불완전한 JSON 문자열 정리 (마지막에 잘린 경우)
  if (!jsonString.trim().endsWith('}') && !jsonString.trim().endsWith(']')) {
    // JSON이 잘린 경우, 마지막 완전한 객체까지만 파싱 시도
    const lastCompleteObject = jsonString.lastIndexOf('}');
    const lastCompleteArray = jsonString.lastIndexOf(']');
    const lastComplete = Math.max(lastCompleteObject, lastCompleteArray);
    
    if (lastComplete !== -1) {
      jsonString = jsonString.substring(0, lastComplete + 1);
    }
  }
  
  return jsonString.trim();
}

// 부분적 JSON 복구 함수
function recoverPartialJson(textContent) {
  console.log('[recoverPartialJson] 복구 시도 시작, 텍스트 길이:', textContent.length);
  
  try {
    // 1. ```json 마크다운 블록에서 JSON 부분만 추출
    let jsonContent = textContent;
    const jsonMatch = textContent.match(/```json\n([\s\S]*?)(?:\n```|$)/);
    if (jsonMatch && jsonMatch[1]) {
      jsonContent = jsonMatch[1];
      console.log('[recoverPartialJson] JSON 마크다운 블록에서 추출, 길이:', jsonContent.length);
    }
    
    // 2. 기본적인 JSON 구조 찾기
    const titleMatch = jsonContent.match(/"title"\s*:\s*"([^"]+)"/);
    const daysMatch = jsonContent.match(/"days"\s*:\s*\[/);
    
    console.log('[recoverPartialJson] title 발견:', !!titleMatch, 'days 발견:', !!daysMatch);
    
    if (titleMatch && daysMatch) {
      // 최소한의 JSON 구조 생성
      const basicStructure = {
        title: titleMatch[1],
        days: []
      };
      
      console.log('[recoverPartialJson] 기본 구조 생성, title:', basicStructure.title);
      
      // 3. 완전한 day 객체들 추출 시도 (더 정교한 패턴)
      // day 객체의 시작부터 해당 day의 끝까지 찾기
      const dayPattern = /"day"\s*:\s*(\d+)[^}]*?"schedules"\s*:\s*\[[^\]]*?\]/g;
      let dayMatch;
      let dayCount = 0;
      
      while ((dayMatch = dayPattern.exec(jsonContent)) !== null) {
        try {
          // day 객체의 시작 위치 찾기
          const dayStart = jsonContent.lastIndexOf('{', dayMatch.index);
          if (dayStart !== -1) {
            // day 객체의 끝 위치 찾기 (중괄호 균형 맞추기)
            let braceCount = 0;
            let dayEnd = -1;
            
            for (let i = dayStart; i < jsonContent.length; i++) {
              if (jsonContent[i] === '{') braceCount++;
              else if (jsonContent[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  dayEnd = i;
                  break;
                }
              }
            }
            
            if (dayEnd !== -1) {
              const dayJsonString = jsonContent.substring(dayStart, dayEnd + 1);
              console.log('[recoverPartialJson] day 객체 추출 시도:', dayCount + 1, '길이:', dayJsonString.length);
              
              try {
                const dayObj = JSON.parse(dayJsonString);
                if (dayObj.day && dayObj.schedules) {
                  basicStructure.days.push(dayObj);
                  dayCount++;
                  console.log('[recoverPartialJson] day', dayObj.day, '성공적으로 추가');
                }
              } catch (parseError) {
                console.log('[recoverPartialJson] day 객체 파싱 실패:', parseError.message);
              }
            }
          }
        } catch (e) {
          console.log('[recoverPartialJson] day 처리 중 오류:', e.message);
        }
      }
      
      // 4. 부분적으로라도 day가 추출되었다면 반환
      if (basicStructure.days.length > 0) {
        console.log('[recoverPartialJson] 복구 성공:', basicStructure.days.length, '개 day 추출');
        return basicStructure;
      } else {
        console.log('[recoverPartialJson] day 추출 실패, 기본 구조만 반환');
        // 최소한 title이라도 있다면 기본 day 하나 생성
        basicStructure.days.push({
          day: 1,
          date: new Date().toISOString().split('T')[0],
          title: "1일차: 여행 시작",
          schedules: [{
            id: "1-1",
            name: "여행 계획 확인 필요",
            time: "09:00",
            notes: "원본 데이터에서 일부 정보를 복구했습니다. 상세 내용을 확인해주세요.",
            category: "기타"
          }]
        });
        return basicStructure;
      }
    } else {
      console.log('[recoverPartialJson] 기본 JSON 구조를 찾을 수 없음');
    }
  } catch (e) {
    console.log('[recoverPartialJson] 복구 중 오류:', e.message);
  }
  
  console.log('[recoverPartialJson] 복구 실패');
  return null;
}

export const handler = async (event) => {
  console.log("이벤트:", JSON.stringify(event));

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({ message: 'CORS preflight request successful' })
    };
  }

  const headers = event.headers || {};
  const authHeader = headers.Authorization || headers.authorization || '';
  let userId = 'anonymous';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = decodeJwt(token);
    if (decoded && decoded.email) {
      userId = decoded.email;
      console.log('추출된 이메일:', userId);
    } else {
      console.warn('JWT에서 이메일을 추출할 수 없습니다.');
    }
  } else {
    console.warn('Authorization 헤더가 없거나 잘못된 형식입니다.');
  }

  let requestBody = {};
  if (event.body) {
    try {
      requestBody = JSON.parse(event.body);
      console.log('요청 본문:', requestBody);
    } catch (err) {
      console.error('JSON 파싱 오류:', err);
    }
  }

  if (requestBody.id || requestBody.planId) {
    const planIdToUse = requestBody.id || requestBody.planId;
    try {
      // 먼저 planId 키로 시도 (WebSocket으로 생성된 계획)
      let getParams = {
        TableName: TABLE_NAME,
        Key: { planId: planIdToUse }
      };
      console.log('GetCommand 파라미터 (planId 키 시도):', getParams);
      let result = await docClient.send(new GetCommand(getParams));
      
      // planId로 찾지 못하면 id 키로 시도 (기존 계획 호환성)
      if (!result.Item) {
        getParams = {
          TableName: TABLE_NAME,
          Key: { id: planIdToUse }
        };
        console.log('GetCommand 파라미터 (id 키 시도):', getParams);
        result = await docClient.send(new GetCommand(getParams));
      }
      
      console.log('GetCommand 결과 (v3):', result);

      if (!result.Item) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ message: '해당 ID의 여행 계획을 찾을 수 없습니다.' })
        };
      }
      const planItem = result.Item;
      const processedData = processItemData(planItem);
      
      // travel-plans 테이블에서 다중 항공편/숙박편 정보 추출 (saved-plans와 동일한 로직)
      let flightInfos = [];
      let flightInfo = null;
      let isRoundTrip = false;
      
      // flight_info_1, flight_info_2, ... 추출
      Object.keys(planItem).forEach(key => {
        if (key.startsWith('flight_info_') && key.match(/flight_info_\d+$/)) {
          try {
            const flightData = typeof planItem[key] === 'string' ? JSON.parse(planItem[key]) : planItem[key];
            flightInfos.push(flightData);
          } catch (error) {
            console.error(`항공편 정보 파싱 오류 (${key}):`, error);
          }
        }
      });
      
      // 하위 호환성을 위한 단일 정보
      if (flightInfos.length > 0) {
        flightInfo = flightInfos[0];
        isRoundTrip = flightInfos.length > 0 && flightInfos[0].itineraries && flightInfos[0].itineraries.length > 1;
      }
      
      console.log(`travel-plans에서 추출: 항공편 ${flightInfos.length}개`);

      // 다중 숙박편 정보 처리
      let accommodationInfos = [];
      let accommodationInfo = null;
      
      // accmo_info_1, accmo_info_2, ... 추출
      Object.keys(planItem).forEach(key => {
        if (key.startsWith('accmo_info_') && key.match(/accmo_info_\d+$/)) {
          try {
            const accommodationData = typeof planItem[key] === 'string' ? JSON.parse(planItem[key]) : planItem[key];
            accommodationInfos.push(accommodationData);
          } catch (error) {
            console.error(`숙박편 정보 파싱 오류 (${key}):`, error);
          }
        }
      });
      
      // 하위 호환성을 위한 단일 정보
      if (accommodationInfos.length > 0) {
        accommodationInfo = accommodationInfos[0];
      }
      
      console.log(`travel-plans에서 추출: 숙박편 ${accommodationInfos.length}개`);

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '여행 계획을 성공적으로 불러왔습니다.',
          plan: [processedData],
          originalData: planItem,
          flightInfo: flightInfo, // 하위 호환성
          flightInfos: flightInfos, // 다중 항공편
          isRoundTrip: isRoundTrip,
          accommodationInfo: accommodationInfo, // 하위 호환성
          accommodationInfos: accommodationInfos // 다중 숙박편
        })
      };
    } catch (err) {
      console.error('DynamoDB GetItem 오류 (v3):', err);
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '여행 계획 조회 중 오류가 발생했습니다.',
          error: err.message
        })
      };
    }
  } else if (requestBody.newest === true || Object.keys(requestBody).length === 0) {
    const params = {
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: {
        ':uid': userId
      },
      ScanIndexForward: false,
      Limit: 1
    };
    try {
      console.log('QueryCommand 파라미터 (v3):', JSON.stringify(params));
      const result = await docClient.send(new QueryCommand(params));
      console.log('QueryCommand 결과 (v3):', JSON.stringify(result));

      if (!result.Items || result.Items.length === 0) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ message: '여행 계획을 찾을 수 없습니다.' })
        };
      }
      const planItem = result.Items[0];
      const processedData = processItemData(planItem);
      
      // travel-plans 테이블에서 다중 항공편/숙박편 정보 추출 (saved-plans와 동일한 로직)
      let flightInfos = [];
      let flightInfo = null;
      let isRoundTrip = false;
      
      // flight_info_1, flight_info_2, ... 추출
      Object.keys(planItem).forEach(key => {
        if (key.startsWith('flight_info_') && key.match(/flight_info_\d+$/)) {
          try {
            const flightData = typeof planItem[key] === 'string' ? JSON.parse(planItem[key]) : planItem[key];
            flightInfos.push(flightData);
          } catch (error) {
            console.error(`항공편 정보 파싱 오류 (${key}):`, error);
          }
        }
      });
      
      // 하위 호환성을 위한 단일 정보
      if (flightInfos.length > 0) {
        flightInfo = flightInfos[0];
        isRoundTrip = flightInfos.length > 0 && flightInfos[0].itineraries && flightInfos[0].itineraries.length > 1;
      }
      
      console.log(`travel-plans에서 추출 (newest): 항공편 ${flightInfos.length}개`);

      // 다중 숙박편 정보 처리
      let accommodationInfos = [];
      let accommodationInfo = null;
      
      // accmo_info_1, accmo_info_2, ... 추출
      Object.keys(planItem).forEach(key => {
        if (key.startsWith('accmo_info_') && key.match(/accmo_info_\d+$/)) {
          try {
            const accommodationData = typeof planItem[key] === 'string' ? JSON.parse(planItem[key]) : planItem[key];
            accommodationInfos.push(accommodationData);
          } catch (error) {
            console.error(`숙박편 정보 파싱 오류 (${key}):`, error);
          }
        }
      });
      
      // 하위 호환성을 위한 단일 정보
      if (accommodationInfos.length > 0) {
        accommodationInfo = accommodationInfos[0];
      }
      
      console.log(`travel-plans에서 추출 (newest): 숙박편 ${accommodationInfos.length}개`);

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '가장 최근 여행 계획을 성공적으로 불러왔습니다.',
          plan: [processedData],
          flightInfo: flightInfo, // 하위 호환성
          flightInfos: flightInfos, // 다중 항공편
          isRoundTrip: isRoundTrip,
          originalData: planItem,
          accommodationInfo: accommodationInfo, // 하위 호환성
          accommodationInfos: accommodationInfos // 다중 숙박편
        })
      };
    } catch (err) {
      console.error('DynamoDB Query 오류 (v3):', err);
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '여행 계획 조회 중 오류가 발생했습니다.',
          error: err.message
        })
      };
    }
  } else {
    return {
      statusCode: 400,
      headers: responseHeaders,
      body: JSON.stringify({
        message: '잘못된 요청 형식입니다. "newest: true" 또는 "id: [플랜ID]"를 지정해주세요.'
      })
    };
  }
};

function processItemData(item) {
  console.log('[LoadPlanFunction] processItemData - item:', JSON.stringify(item, null, 2));
  const processedItem = {
    id: item.planId || item.id,
    user_id: item.user_id,
    title: item.name || '여행 계획'
  };

  // 1. 최상위 item.start_date가 있는지 명시적으로 확인 (가장 우선)
  if (item.start_date) {
    processedItem.start_date = item.start_date;
    console.log('[LoadPlanFunction] item.start_date에서 start_date 설정:', processedItem.start_date);
  } 
  // 2. item.start_date가 없다면, plan_data 내부의 첫 번째 day의 date를 사용 시도
  //    (Gemini API 응답으로 생성된 계획의 경우 여기에 시작일 정보가 있을 수 있음)
  else if (item.plan_data) {
    try {
      console.log('[LoadPlanFunction] plan_data에서 start_date 추출 시도');
      const extractedData = extractGeminiJsonData(item.plan_data); // 이 함수는 ```json ... ``` 제거 및 JSON 파싱
      console.log('[LoadPlanFunction] extractGeminiJsonData 결과 타입:', typeof extractedData);
      
      if (extractedData && extractedData.days && Array.isArray(extractedData.days) && extractedData.days.length > 0 && extractedData.days[0].date) {
        // extractedData.days[0].date가 "YYYY-MM-DD" 형식이므로 그대로 사용
        processedItem.start_date = extractedData.days[0].date;
        console.log('[LoadPlanFunction] plan_data.days[0].date에서 start_date 설정:', processedItem.start_date);
      } else {
        console.log('[LoadPlanFunction] plan_data에서 유효한 start_date를 찾을 수 없음');
      }
    } catch (e) {
      console.error('[LoadPlanFunction] plan_data에서 start_date 추출 중 오류:', e);
    }
  }

  if (item.itinerary_schedules) {
    processedItem.itinerary_schedules = item.itinerary_schedules;
  }
  // itinerary_schedules가 없고 plan_data에 days 정보가 있다면, 이를 기반으로 itinerary_schedules 구성 (기존 로직 유지)
  else if (item.plan_data && !processedItem.itinerary_schedules) { 
    console.log('[LoadPlanFunction] plan_data 발견, 처리 시도:', typeof item.plan_data);
    try {
      const extractedData = extractGeminiJsonData(item.plan_data);
      console.log('[LoadPlanFunction] extractGeminiJsonData 결과:', extractedData ? Object.keys(extractedData) : 'null');
      
      if (extractedData && extractedData.days && Array.isArray(extractedData.days)) {
        console.log('[LoadPlanFunction] days 배열 발견, 길이:', extractedData.days.length);
        processedItem.itinerary_schedules = {};
        extractedData.days.forEach(day => {
          const dayNumber = day.day || (Object.keys(processedItem.itinerary_schedules).length + 1); // day 번호가 없으면 순차적으로 부여
          processedItem.itinerary_schedules[dayNumber.toString()] = {
            title: day.title || `${dayNumber}일차`,
            schedules: day.schedules || []
          };
        });
        console.log('[LoadPlanFunction] itinerary_schedules 구성 완료:', Object.keys(processedItem.itinerary_schedules));
      } else if (extractedData && extractedData.days && typeof extractedData.days === 'object') {
        console.log('[LoadPlanFunction] days 객체 발견, 키들:', Object.keys(extractedData.days));
        processedItem.itinerary_schedules = {};
        Object.keys(extractedData.days).forEach(dayKey => {
          const dayData = extractedData.days[dayKey];
          processedItem.itinerary_schedules[dayKey] = {
            title: dayData.title || `${dayKey}일차`,
            schedules: dayData.schedules || []
          };
        });
        console.log('[LoadPlanFunction] itinerary_schedules 구성 완료 (객체):', Object.keys(processedItem.itinerary_schedules));
      } else if (extractedData && extractedData.text) {
        console.log('[LoadPlanFunction] JSON 파싱 실패, 텍스트 형태로 반환됨. 길이:', extractedData.text.length);
        // 텍스트 형태인 경우 기본 구조 생성
        processedItem.itinerary_schedules = {
          "1": {
            title: "여행 계획",
            schedules: [{
              id: "1-1",
              name: "여행 계획 확인 필요",
              time: "09:00",
              notes: "AI 응답 파싱에 실패했습니다. 원본 데이터를 확인해주세요.",
              category: "기타"
            }]
          }
        };
      } else {
        console.log('[LoadPlanFunction] days 필드가 없거나 올바른 형식이 아님:', extractedData);
        // 기본 구조 생성
        processedItem.itinerary_schedules = {
          "1": {
            title: "여행 계획",
            schedules: [{
              id: "1-1",
              name: "여행 계획 로드 실패",
              time: "09:00",
              notes: "계획 데이터를 불러오는데 실패했습니다.",
              category: "기타"
            }]
          }
        };
      }
    } catch (error) {
      console.error('[LoadPlanFunction] plan_data로부터 itinerary_schedules 구성 중 오류:', error);
      // 오류 발생 시 기본 구조 생성
      processedItem.itinerary_schedules = {
        "1": {
          title: "여행 계획",
          schedules: [{
            id: "1-1",
            name: "데이터 처리 오류",
            time: "09:00",
            notes: `오류: ${error.message}`,
            category: "기타"
          }]
        }
      };
    }
  }

  if (item.flight_details && Array.isArray(item.flight_details)) {
    processedItem.flight_details = item.flight_details;
  }
  if (item.flight_info) {
    try {
      processedItem.flight_info = typeof item.flight_info === 'string'
        ? JSON.parse(item.flight_info)
        : item.flight_info;
    } catch (e) {
      processedItem.flight_info = item.flight_info; // 파싱 실패 시 원본 유지
      console.error('[LoadPlanFunction] flight_info 파싱 오류:', e);
    }
  }
  // accmo_info는 최상위에서 이미 처리하므로 여기서 별도 처리 안 함. 필요시 원본 item.accmo_info 참조.
  console.log('[LoadPlanFunction] processItemData - processedItem:', JSON.stringify(processedItem, null, 2)); // 최종 processedItem 로깅 추가
  return processedItem;
}