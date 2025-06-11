import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';

const dynamodb = new AWS.DynamoDB.DocumentClient();
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
    // plan_data 객체가 있고 candidates 배열이 있는지 확인
    if (planData && planData.candidates && Array.isArray(planData.candidates) && planData.candidates.length > 0) {
      const candidate = planData.candidates[0];
      
      // content.parts 배열이 있는지 확인
      if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts) && candidate.content.parts.length > 0) {
        const textContent = candidate.content.parts[0].text;
        
        if (textContent) {
          // ```json ... ``` 형식에서 JSON 추출 시도
          const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]);
          }
          
          // 직접 JSON 파싱 시도
          try {
            return JSON.parse(textContent);
          } catch (e) {
            console.log('직접 JSON 파싱 실패:', e);
          }
          
          // 그냥 텍스트 반환
          return { text: textContent };
        }
      }
    }
    
    // 형식이 맞지 않으면 그냥 원본 반환
    return planData;
  } catch (error) {
    console.error('Gemini 데이터 추출 오류:', error);
    return planData;
  }
}

export const handler = async (event) => {
  console.log("이벤트:", JSON.stringify(event));

  // OPTIONS 요청 처리 (CORS preflight 요청)
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

  // POST 요청에서 JSON 본문 파싱
  let requestBody = {};
  if (event.body) {
    try {
      requestBody = JSON.parse(event.body);
      console.log('요청 본문:', requestBody);
    } catch (err) {
      console.error('JSON 파싱 오류:', err);
    }
  }

  // 특정 ID로 플랜을 조회
  if (requestBody.id) {
    try {
      const getParams = {
        TableName: TABLE_NAME,
        Key: { id: requestBody.id }
      };

      const result = await dynamodb.get(getParams).promise();

      if (!result.Item) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ message: '해당 ID의 여행 계획을 찾을 수 없습니다.' })
        };
      }

      // Gemini 응답 처리 및 데이터 변환
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
      console.error('DynamoDB 조회 오류:', err);
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '여행 계획 조회 중 오류가 발생했습니다.',
          error: err.message
        })
      };
    }
  }

  // 최신 플랜 조회
  else if (requestBody.newest === true || Object.keys(requestBody).length === 0) {
    const params = {
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: {
        ':uid': userId
      },
      ScanIndexForward: false, // 최신 순 정렬
      Limit: 1
    };

    try {
      console.log('쿼리 파라미터:', JSON.stringify(params));
      const result = await dynamodb.query(params).promise();
      console.log('쿼리 결과:', JSON.stringify(result));

      if (!result.Items || result.Items.length === 0) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ message: '여행 계획을 찾을 수 없습니다.' })
        };
      }

      // 검색된 항목에 대해 데이터 처리
      const planItem = result.Items[0];
      const processedData = processItemData(planItem);

      // 항공편 정보 처리 - flight_info만 사용하도록 수정
      let flightInfo = null;
      let isRoundTrip = false;

      // 1. flight_info 처리
      if (planItem.flight_info) {
        try {
          // 문자열이면 객체로 파싱
          flightInfo = typeof planItem.flight_info === 'string' 
            ? JSON.parse(planItem.flight_info) 
            : planItem.flight_info;
          
          // 왕복 여부 확인 (oneWay: false 또는 isRoundTrip: true 또는 itineraries 배열 길이 > 1)
          isRoundTrip = planItem.is_round_trip === true ||
                        flightInfo.oneWay === false ||
                        flightInfo.isRoundTrip === true ||
                        (flightInfo.itineraries && flightInfo.itineraries.length > 1);
          
          console.log('항공편 정보 처리 완료:', { 
            항공사: flightInfo.validatingAirlineCodes, 
            왕복여부: isRoundTrip 
          });
        } catch (error) {
          console.error('항공편 정보 파싱 오류:', error);
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
      console.error('DynamoDB 쿼리 오류:', err);
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '여행 계획 조회 중 오류가 발생했습니다.',
          error: err.message
        })
      };
    }
  }

  // 잘못된 요청 처리
  else {
    return {
      statusCode: 400,
      headers: responseHeaders,
      body: JSON.stringify({
        message: '잘못된 요청 형식입니다. "newest: true" 또는 "id: [플랜ID]"를 지정해주세요.'
      })
    };
  }
};

// DynamoDB 항목을 클라이언트에서 사용할 수 있는 형식으로 처리
function processItemData(item) {
  // 클라이언트에 전달할 기본 항목 구조 생성
  const processedItem = {
    id: item.planId || item.id,
    user_id: item.user_id,
    title: item.name || '여행 계획'
  };

  // 1. itinerary_schedules 데이터가 있으면 그대로 사용
  if (item.itinerary_schedules) {
    processedItem.itinerary_schedules = item.itinerary_schedules;
  }
  
  // 2. plan_data에서 데이터 추출 시도 (Gemini API 응답)
  if (item.plan_data) {
    try {
      // Gemini API 응답에서 JSON 데이터 추출
      const extractedData = extractGeminiJsonData(item.plan_data);
      console.log('추출된 Gemini 데이터:', JSON.stringify(extractedData));
      
      // days 배열이 있으면 itinerary_schedules 형식으로 변환
      if (extractedData.days && Array.isArray(extractedData.days)) {
        if (!processedItem.itinerary_schedules) {
          processedItem.itinerary_schedules = {};
          
          extractedData.days.forEach(day => {
            const dayNumber = day.day || 1;
            processedItem.itinerary_schedules[dayNumber.toString()] = {
              title: day.title || `${dayNumber}일차`,
              schedules: day.schedules || []
            };
          });
        }
        
        // 원본 데이터 저장
        processedItem.plan_data = item.plan_data;
      }
    } catch (error) {
      console.error('plan_data 처리 중 오류:', error);
    }
  }
  
  // 3. flight_details 배열이 있으면 추가
  if (item.flight_details && Array.isArray(item.flight_details)) {
    processedItem.flight_details = item.flight_details;
  }

  // 4. flight_info가 있으면 processedItem에 포함
  if (item.flight_info) {
    try {
      processedItem.flight_info = typeof item.flight_info === 'string'
        ? JSON.parse(item.flight_info)
        : item.flight_info;
    } catch (e) {
      processedItem.flight_info = item.flight_info;
    }
  }
  // 5. accmo_info 포함
  if (item.accmo_info) {
    try {
      processedItem.accmo_info = typeof item.accmo_info === 'string'
        ? JSON.parse(item.accmo_info)
        : item.accmo_info;
    } catch (e) {
      processedItem.accmo_info = item.accmo_info;
    }
  }
  
  return processedItem;
}
