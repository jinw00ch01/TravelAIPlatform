const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

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
    console.error('오류 발생:', error);
    return formatResponse(500, { error: '서버 오류가 발생했습니다.' });
  }
};

/**
 * OpenAI API를 사용하여 여행 계획 생성
 */
async function generateTravelPlan(query, preferences = {}) {
  try {
    // 프롬프트 구성
    const systemPrompt = `당신은 전문 여행 계획가입니다. 사용자의 요청에 따라 상세한 여행 계획을 생성해주세요.
    여행 계획은 다음 형식의 JSON으로 반환해주세요:
    {
      "title": "여행 제목",
      "summary": "여행 요약",
      "destination": "목적지",
      "duration": "기간",
      "budget": {
        "total": 총예산,
        "transportation": 교통비,
        "accommodation": 숙박비,
        "food": 식비,
        "activities": 활동비,
        "etc": 기타비용
      },
      "itinerary": [
        {
          "day": 1,
          "date": "YYYY-MM-DD",
          "title": "일차 제목",
          "description": "일차 설명",
          "activities": [
            {
              "time": "HH:MM",
              "title": "활동 제목",
              "description": "활동 설명",
              "location": "장소",
              "cost": 비용
            }
          ],
          "accommodation": {
            "name": "숙소명",
            "location": "숙소 위치",
            "cost": 숙박비
          },
          "meals": [
            {
              "type": "아침/점심/저녁",
              "suggestion": "추천 식당 또는 음식",
              "cost": 예상 비용
            }
          ],
          "transportation": {
            "method": "이동 수단",
            "from": "출발지",
            "to": "도착지",
            "cost": 비용
          }
        }
      ],
      "tips": [
        "여행 팁1",
        "여행 팁2"
      ]
    }`;

    // 사용자 선호도 정보 추가
    let userPrompt = query;
    if (Object.keys(preferences).length > 0) {
      userPrompt += `\n\n추가 선호 사항:\n`;
      for (const [key, value] of Object.entries(preferences)) {
        userPrompt += `- ${key}: ${value}\n`;
      }
    }

    // OpenAI API 호출
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        }
      }
    );

    // API 응답에서 JSON 추출
    const content = response.data.choices[0].message.content;
    
    // JSON 문자열 추출 (마크다운 코드 블록 처리)
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                      content.match(/```\n([\s\S]*?)\n```/) || 
                      [null, content];
    
    const jsonString = jsonMatch[1] || content;
    
    // JSON 파싱
    return JSON.parse(jsonString);
    
  } catch (error) {
    console.error('OpenAI API 호출 오류:', error);
    throw new Error('여행 계획 생성 중 오류가 발생했습니다.');
  }
}

/**
 * API Gateway 응답 형식화
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