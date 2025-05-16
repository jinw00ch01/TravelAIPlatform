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
          const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]);
          }
          try {
            return JSON.parse(textContent);
          } catch (e) {
            console.log('직접 JSON 파싱 실패:', e);
          }
          return { text: textContent };
        }
      }
    }
    return planData;
  } catch (error) {
    console.error('Gemini 데이터 추출 오류:', error);
    return planData;
  }
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

  if (requestBody.id) {
    try {
      const getParams = {
        TableName: TABLE_NAME,
        Key: { id: requestBody.id }
      };
      console.log('GetCommand 파라미터 (v3):', getParams);
      const result = await docClient.send(new GetCommand(getParams));
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
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '여행 계획을 성공적으로 불러왔습니다.',
          plan: [processedData],
          originalData: planItem
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
      let flightInfo = null;
      let isRoundTrip = false;
      if (planItem.flight_info) {
        try {
          flightInfo = typeof planItem.flight_info === 'string' 
            ? JSON.parse(planItem.flight_info) 
            : planItem.flight_info;
          isRoundTrip = planItem.is_round_trip === true ||
                        flightInfo.oneWay === false ||
                        flightInfo.isRoundTrip === true ||
                        (flightInfo.itineraries && flightInfo.itineraries.length > 1);
          console.log('항공편 정보 처리 완료 (v3):', { 항공사: flightInfo.validatingAirlineCodes, 왕복여부: isRoundTrip });
        } catch (error) {
          console.error('항공편 정보 파싱 오류 (v3):', error);
          flightInfo = null;
        }
      }
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '가장 최근 여행 계획을 성공적으로 불러왔습니다.',
          plan: [processedData],
          flightInfo: flightInfo,
          isRoundTrip: isRoundTrip,
          originalData: planItem
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
      const extractedData = extractGeminiJsonData(item.plan_data); // 이 함수는 ```json ... ``` 제거 및 JSON 파싱
      if (extractedData && extractedData.days && Array.isArray(extractedData.days) && extractedData.days.length > 0 && extractedData.days[0].date) {
        // extractedData.days[0].date가 "YYYY-MM-DD" 형식이므로 그대로 사용
        processedItem.start_date = extractedData.days[0].date;
        console.log('[LoadPlanFunction] plan_data.days[0].date에서 start_date 설정:', processedItem.start_date);
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
    try {
      const extractedData = extractGeminiJsonData(item.plan_data);
      if (extractedData.days && Array.isArray(extractedData.days)) {
        processedItem.itinerary_schedules = {};
        extractedData.days.forEach(day => {
          const dayNumber = day.day || (Object.keys(processedItem.itinerary_schedules).length + 1); // day 번호가 없으면 순차적으로 부여
          processedItem.itinerary_schedules[dayNumber.toString()] = {
            title: day.title || `${dayNumber}일차`,
            schedules: day.schedules || []
          };
        });
        // plan_data 자체도 유지할 수 있도록 추가 (필요하다면 클라이언트에서 활용)
        // processedItem.plan_data = item.plan_data; // 원본 plan_data 유지 여부는 결정 필요
      }
    } catch (error) {
      console.error('[LoadPlanFunction] plan_data로부터 itinerary_schedules 구성 중 오류:', error);
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
  console.log('[LoadPlanFunction] processItemData - processedItem:', JSON.stringify(processedItem, null, 2)); // 최종 processedItem 로깅 추가
  return processedItem;
}