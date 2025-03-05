const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// AWS 서비스 초기화
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TRAVEL_PLANS_TABLE;
const openaiApiKey = process.env.OPENAI_API_KEY;

/**
 * 여행 계획 생성 Lambda 함수
 * 텍스트 쿼리를 받아 OpenAI API를 통해 여행 계획을 생성하고 DynamoDB에 저장
 */
exports.handler = async (event) => {
  console.log('이벤트 수신:', JSON.stringify(event, null, 2));
  
  try {
    // API Gateway를 통해 들어온 요청 파싱
    const requestBody = JSON.parse(event.body);
    const userId = event.requestContext.authorizer.claims.sub; // Cognito 인증된 사용자 ID
    
    // 필수 필드 검증
    if (!requestBody.query) {
      return formatResponse(400, { error: '여행 쿼리가 필요합니다.' });
    }

    // GPT API를 사용하여 여행 계획 생성
    const travelPlan = await generateTravelPlan(requestBody.query, requestBody.preferences);
    
    // 생성된 여행 계획을 DynamoDB에 저장
    const planId = uuidv4();
    const item = {
      id: planId,
      userId: userId,
      query: requestBody.query,
      preferences: requestBody.preferences || {},
      plan: travelPlan,
      createdAt: new Date().toISOString(),
      isShared: false
    };
    
    await dynamoDb.put({
      TableName: tableName,
      Item: item
    }).promise();
    
    // 성공 응답 반환
    return formatResponse(201, {
      message: '여행 계획이 생성되었습니다.',
      planId: planId,
      plan: travelPlan
    });
  } catch (error) {
    console.error('Error:', error);
    return formatResponse(500, { error: '여행 계획 생성 중 오류가 발생했습니다.' });
  }
};

/**
 * OpenAI GPT API를 사용하여 여행 계획 생성
 * @param {string} query - 사용자 여행 쿼리
 * @param {object} preferences - 사용자 선호도 (옵션)
 * @returns {object} - 생성된 여행 계획 JSON
 */
async function generateTravelPlan(query, preferences = {}) {
  try {
    // GPT 프롬프트 구성
    const prompt = createPrompt(query, preferences);
    
    console.log('OpenAI API 호출 시작:', query);
    
    // OpenAI API 호출
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4', // 또는 다른 모델
        messages: [
          { 
            role: 'system', 
            content: '당신은 여행 계획을 상세하게 만들어주는 AI 여행 플래너입니다. 예산, 일정, 교통편, 숙소, 관광지 등의 정보를 포함한 구체적인 여행 계획을 JSON 형식으로 제공합니다.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        }
      }
    );
    
    console.log('OpenAI API 응답 수신 완료');
    
    // API 응답에서 여행 계획 JSON 추출
    const travelPlanJson = JSON.parse(response.data.choices[0].message.content);
    return travelPlanJson;
  } catch (error) {
    console.error('OpenAI API 호출 중 오류:', error);
    throw new Error('여행 계획 생성 API 호출 중 오류가 발생했습니다.');
  }
}

/**
 * GPT 프롬프트 생성 함수
 * @param {string} query - 사용자 쿼리
 * @param {object} preferences - 사용자 선호도
 * @returns {string} - 생성된 프롬프트
 */
function createPrompt(query, preferences) {
  // 기본 프롬프트
  let prompt = `다음 요청에 맞는 여행 계획을 JSON 형식으로 작성해주세요: "${query}"`;
  
  // 사용자 선호도가 있으면 추가
  if (Object.keys(preferences).length > 0) {
    prompt += '\n\n사용자 선호도:';
    
    if (preferences.accommodationType) {
      prompt += `\n- 선호하는 숙소 유형: ${preferences.accommodationType}`;
    }
    
    if (preferences.transportationType) {
      prompt += `\n- 선호하는 교통수단: ${preferences.transportationType}`;
    }
    
    if (preferences.travelStyle) {
      prompt += `\n- 여행 스타일: ${preferences.travelStyle}`;
    }
    
    if (preferences.cuisinePreferences) {
      const cuisines = Array.isArray(preferences.cuisinePreferences) 
        ? preferences.cuisinePreferences.join(', ')
        : preferences.cuisinePreferences;
      prompt += `\n- 선호하는 음식: ${cuisines}`;
    }
    
    if (preferences.budget) {
      prompt += `\n- 예산: ${preferences.budget}`;
    }
    
    if (preferences.duration) {
      prompt += `\n- 희망 기간: ${preferences.duration}`;
    }
  }
  
  // 응답 형식 지정
  prompt += `\n\n다음 JSON 형식으로 응답해주세요:
  {
    "title": "여행 제목",
    "destination": "여행지",
    "duration": "여행 기간 (예: 3박 4일)",
    "budget": {
      "total": "총 예산 (원 단위)",
      "accommodation": "숙박비",
      "transportation": "교통비",
      "food": "식비",
      "activities": "액티비티 및 관광",
      "misc": "기타 비용"
    },
    "itinerary": [
      {
        "day": 1,
        "date": "yyyy-mm-dd",
        "activities": [
          {
            "time": "시간 (예: 09:00-12:00)",
            "description": "활동 설명",
            "location": "장소",
            "cost": "비용 (원 단위)",
            "notes": "추가 참고사항"
          }
        ],
        "accommodation": {
          "name": "숙소명",
          "location": "위치",
          "cost": "숙박비 (원 단위)"
        },
        "meals": [
          {
            "type": "아침/점심/저녁",
            "suggestion": "추천 식당 또는 음식",
            "cost": "예상 비용 (원 단위)"
          }
        ]
      }
    ],
    "transportation": {
      "to_destination": "목적지까지 교통편",
      "local": "현지 교통편"
    },
    "tips": ["여행 팁 1", "여행 팁 2"]
  }`;
  
  return prompt;
}

/**
 * API Gateway 응답 포맷팅
 * @param {number} statusCode - HTTP 상태 코드
 * @param {object} body - 응답 본문
 * @returns {object} - API Gateway 형식의 응답
 */
function formatResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(body)
  };
} 