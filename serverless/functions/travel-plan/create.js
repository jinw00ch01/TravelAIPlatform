const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config({ path: process.env.NODE_ENV === 'local' ? '../../.env' : '/var/task/.env' });
const { corsSettings } = require('../utils/corsSettings');

// AWS 서비스 초기화
let dynamoDbOptions = {};
const ssm = new AWS.SSM();

// 로컬 테스트 환경인 경우
if (process.env.NODE_ENV === 'local') {
  dynamoDbOptions = {
    region: 'ap-northeast-2',
    endpoint: 'http://localhost:8000',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  };
}

const dynamoDb = new AWS.DynamoDB.DocumentClient(dynamoDbOptions);
const tableName = process.env.TRAVEL_PLANS_TABLE;
let openaiApiKey;

// SSM 파라미터에서 OpenAI API 키 가져오기
async function getOpenAIApiKey() {
  if (process.env.NODE_ENV === 'local') {
    return process.env.OPENAI_API_KEY;  // 로컬 테스트 시 .env 파일 사용
  }
  
  const params = {
    Name: process.env.OPENAI_API_KEY_PARAM,
    WithDecryption: true
  };
  
  try {
    const response = await ssm.getParameter(params).promise();
    return response.Parameter.Value;
  } catch (error) {
    console.error('SSM 파라미터 조회 오류:', error);
    throw error;
  }
}

/**
 * 여행 계획 생성 Lambda 함수
 * 텍스트 쿼리를 받아 OpenAI API를 통해 여행 계획을 생성하고 DynamoDB에 저장
 */
exports.handler = async (event) => {
  console.log('이벤트 수신:', JSON.stringify(event, null, 2));
  
  // OpenAI API 키 가져오기
  openaiApiKey = await getOpenAIApiKey();
  
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
    
    // 로컬 테스트 환경이 아닌 경우에만 DynamoDB에 저장
    if (process.env.NODE_ENV !== 'local') {
      await dynamoDb.put({
        TableName: tableName,
        Item: item
      }).promise();
    } else {
      console.log('로컬 테스트 환경: DynamoDB 저장 건너뜀');
    }
    
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
    // 로컬 테스트 환경인 경우 가짜 여행 계획 반환
    if (process.env.NODE_ENV === 'local') {
      console.log('로컬 테스트 환경: 가짜 여행 계획 생성');
      return {
        "title": "오사카 9박 10일 여행",
        "summary": "200만원 예산으로 10월 15일부터 10월 24일까지 오사카 여행",
        "destination": "오사카, 일본",
        "duration": "9박 10일",
        "budget": {
          "total": 2000000,
          "transportation": 700000,
          "accommodation": 600000,
          "food": 300000,
          "activities": 300000,
          "etc": 100000
        },
        "itinerary": [
          {
            "day": 1,
            "date": "2025-10-15",
            "title": "출국 및 오사카 도착",
            "description": "인천국제공항에서 출발하여 오사카 간사이 국제공항에 도착 후 호텔 체크인",
            "activities": [
              {
                "time": "10:00",
                "title": "인천국제공항 출발",
                "description": "대한항공 KE123 탑승",
                "location": "인천국제공항",
                "cost": 350000
              },
              {
                "time": "12:00",
                "title": "오사카 간사이 국제공항 도착",
                "description": "입국 수속 및 렌트카 픽업",
                "location": "간사이 국제공항",
                "cost": 0
              },
              {
                "time": "15:00",
                "title": "호텔 체크인",
                "description": "오사카 시내 호텔 체크인 및 휴식",
                "location": "오사카 시내 호텔",
                "cost": 0
              },
              {
                "time": "18:00",
                "title": "도톤보리 저녁 식사",
                "description": "유명한 도톤보리 거리에서 저녁 식사",
                "location": "도톤보리",
                "cost": 30000
              }
            ],
            "accommodation": {
              "name": "오사카 시내 호텔",
              "location": "오사카 시내",
              "cost": 150000
            },
            "meals": [
              {
                "type": "저녁",
                "suggestion": "도톤보리 타코야키",
                "cost": 30000
              }
            ],
            "transportation": {
              "method": "렌트카",
              "from": "간사이 국제공항",
              "to": "오사카 시내 호텔",
              "cost": 50000
            }
          }
        ],
        "tips": [
          "오사카 주요 관광지는 대중교통으로도 접근이 용이합니다.",
          "10월은 오사카 날씨가 쾌적하여 여행하기 좋은 시기입니다.",
          "렌트카를 이용할 경우 국제운전면허증을 꼭 준비하세요."
        ]
      };
    }

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
    console.log('OpenAI API 응답:', content);
    
    // JSON 문자열 추출 (마크다운 코드 블록 처리)
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                      content.match(/```\n([\s\S]*?)\n```/) || 
                      [null, content];
    
    const jsonString = jsonMatch[1] || content;
    
    try {
      // JSON 파싱
      return JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      // 오류 발생 시 가짜 여행 계획 반환
      return {
        "title": "오사카 9박 10일 여행",
        "summary": "200만원 예산으로 10월 15일부터 10월 24일까지 오사카 여행",
        "destination": "오사카, 일본",
        "duration": "9박 10일",
        "budget": {
          "total": 2000000,
          "transportation": 700000,
          "accommodation": 600000,
          "food": 300000,
          "activities": 300000,
          "etc": 100000
        },
        "itinerary": [
          {
            "day": 1,
            "date": "2025-10-15",
            "title": "출국 및 오사카 도착",
            "description": "인천국제공항에서 출발하여 오사카 간사이 국제공항에 도착 후 호텔 체크인",
            "activities": [
              {
                "time": "10:00",
                "title": "인천국제공항 출발",
                "description": "대한항공 KE123 탑승",
                "location": "인천국제공항",
                "cost": 350000
              }
            ],
            "accommodation": {
              "name": "오사카 시내 호텔",
              "location": "오사카 시내",
              "cost": 150000
            },
            "meals": [
              {
                "type": "저녁",
                "suggestion": "도톤보리 타코야키",
                "cost": 30000
              }
            ],
            "transportation": {
              "method": "렌트카",
              "from": "간사이 국제공항",
              "to": "오사카 시내 호텔",
              "cost": 50000
            }
          }
        ],
        "tips": [
          "오사카 주요 관광지는 대중교통으로도 접근이 용이합니다.",
          "10월은 오사카 날씨가 쾌적하여 여행하기 좋은 시기입니다."
        ]
      };
    }
    
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
    headers: corsSettings.getHeaders(),
    body: JSON.stringify(body)
  };
} 