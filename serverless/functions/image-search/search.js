const AWS = require('aws-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: process.env.NODE_ENV === 'local' ? '../../.env' : '/var/task/.env' });
const { corsSettings } = require('../utils/corsSettings');

// AWS 서비스 초기화
const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();
const tableName = process.env.TRAVEL_PLANS_TABLE;
const bucketName = process.env.MEDIA_BUCKET;
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
 * 이미지 검색 Lambda 함수
 * 이미지를 분석하여 유사한 여행지를 추천하고 여행 계획을 생성
 */
exports.handler = async (event) => {
  console.log('이벤트 수신:', JSON.stringify(event, null, 2));
  
  // OpenAI API 키 가져오기
  openaiApiKey = await getOpenAIApiKey();
  
  try {
    let imageKey;
    let userId;
    let preferences = {};
    
    // S3 이벤트에서 호출된 경우 (이미지 업로드 트리거)
    if (event.Records && event.Records[0].s3) {
      imageKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
      userId = imageKey.split('/')[0]; // 이미지 키가 'userId/filename' 형태로 저장되었다고 가정
      console.log(`S3 트리거에서 호출: ${imageKey}, 사용자 ID: ${userId}`);
    } 
    // API Gateway를 통해 호출된 경우 (직접 API 요청)
    else if (event.body) {
      const requestBody = JSON.parse(event.body);
      userId = event.requestContext.authorizer.claims.sub; // Cognito 인증된 사용자 ID
      
      // 이미지 업로드 방식에 따라 처리
      if (requestBody.imageBase64) {
        // Base64 이미지 문자열을 S3에 업로드
        const imageBuffer = Buffer.from(requestBody.imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        imageKey = `${userId}/${uuidv4()}.jpg`;
        
        await s3.putObject({
          Bucket: bucketName,
          Key: imageKey,
          Body: imageBuffer,
          ContentType: 'image/jpeg'
        }).promise();
        
        console.log(`Base64 이미지 업로드 완료: ${imageKey}`);
      } else if (requestBody.imageUrl) {
        // 이미 S3에 업로드된 이미지 URL 사용
        const url = new URL(requestBody.imageUrl);
        if (url.hostname.includes('amazonaws.com') && url.pathname.includes(bucketName)) {
          imageKey = url.pathname.split('/').slice(2).join('/');
          console.log(`S3 이미지 URL 참조: ${imageKey}`);
        } else {
          return formatResponse(400, { error: '유효한 S3 이미지 URL이 필요합니다.' });
        }
      } else {
        return formatResponse(400, { error: '이미지가 필요합니다. imageBase64 또는 imageUrl을 제공해주세요.' });
      }
      
      // 사용자 선호도 저장
      if (requestBody.preferences) {
        preferences = requestBody.preferences;
      }
    } else {
      return formatResponse(400, { error: '유효하지 않은 요청입니다.' });
    }

    // AWS Rekognition을 사용한 이미지 분석
    console.log('이미지 분석 시작...');
    const labels = await analyzeImage(imageKey);
    const landmarks = await detectLandmarks(imageKey);
    
    console.log('분석 결과 - 레이블:', labels);
    console.log('분석 결과 - 랜드마크:', landmarks);
    
    // 이미지 분석 결과를 바탕으로 여행지 추천 및 계획 생성
    const travelPlan = await generateTravelPlanFromImage(imageKey, labels, landmarks, preferences);
    
    // DynamoDB에 저장
    const planId = uuidv4();
    const item = {
      id: planId,
      userId: userId,
      imageKey: imageKey,
      labels: labels,
      landmarks: landmarks,
      preferences: preferences,
      plan: travelPlan,
      createdAt: new Date().toISOString(),
      isShared: false
    };
    
    await dynamoDb.put({
      TableName: tableName,
      Item: item
    }).promise();
    
    // API Gateway를 통한 요청인 경우에만 응답 반환
    if (event.body) {
      return formatResponse(201, {
        message: '이미지 분석 기반 여행 계획이 생성되었습니다.',
        planId: planId,
        imageUrl: `https://${bucketName}.s3.amazonaws.com/${imageKey}`,
        labels: labels,
        landmarks: landmarks,
        plan: travelPlan
      });
    }
    
    // S3 트리거로 실행된 경우는 간단한 성공 응답만 반환
    return {
      statusCode: 200,
      body: JSON.stringify({ message: '이미지 분석 완료', planId: planId })
    };
  } catch (error) {
    console.error('Error:', error);
    return formatResponse(500, { error: '이미지 분석 중 오류가 발생했습니다.' });
  }
};

/**
 * 이미지 레이블 분석 (Rekognition)
 * @param {string} imageKey - S3 이미지 키
 * @returns {Array} - 감지된 레이블 목록
 */
async function analyzeImage(imageKey) {
  const params = {
    Image: {
      S3Object: {
        Bucket: bucketName,
        Name: imageKey
      }
    },
    MaxLabels: 15,
    MinConfidence: 70
  };
  
  const response = await rekognition.detectLabels(params).promise();
  
  return response.Labels.map(label => ({
    name: label.Name,
    confidence: label.Confidence,
    parents: label.Parents.map(parent => parent.Name)
  }));
}

/**
 * 랜드마크 감지 (Rekognition)
 * @param {string} imageKey - S3 이미지 키
 * @returns {Array} - 감지된 랜드마크 목록
 */
async function detectLandmarks(imageKey) {
  const params = {
    Image: {
      S3Object: {
        Bucket: bucketName,
        Name: imageKey
      }
    }
  };
  
  try {
    // 유명 랜드마크 감지
    const response = await rekognition.recognizeCelebrities(params).promise();
    
    // 실제 랜드마크 API
    // 현재 AWS Rekognition은 공식적인 랜드마크 감지 API가 없어서
    // 유명인사 API를 대체로 사용하거나 detectLabels의 결과 중 랜드마크를 필터링해야 함
    
    if (response.CelebrityFaces && response.CelebrityFaces.length > 0) {
      return response.CelebrityFaces.map(celeb => celeb.Name);
    } else {
      // 일반 레이블에서 가능한 랜드마크 필터링
      const labelResponse = await rekognition.detectLabels({
        ...params,
        MaxLabels: 50
      }).promise();
      
      // 랜드마크와 관련된 레이블 필터링 (예시)
      const landmarkRelated = ['Building', 'Architecture', 'Temple', 'Church', 'Monument', 'Tower', 'Castle', 'Landmark', 'Mountain', 'Beach', 'Ocean', 'Lake'];
      
      return labelResponse.Labels
        .filter(label => landmarkRelated.includes(label.Name))
        .map(label => label.Name);
    }
  } catch (error) {
    console.error('랜드마크 감지 오류:', error);
    return [];
  }
}

/**
 * 이미지 분석 결과를 바탕으로 여행 계획 생성 (OpenAI API 사용)
 * @param {string} imageKey - S3 이미지 키
 * @param {Array} labels - 감지된 레이블
 * @param {Array} landmarks - 감지된 랜드마크
 * @param {Object} preferences - 사용자 선호도
 * @returns {Object} - 생성된 여행 계획
 */
async function generateTravelPlanFromImage(imageKey, labels, landmarks, preferences = {}) {
  try {
    // 이미지 분석 결과를 텍스트로 변환
    const labelsText = labels.map(label => label.name).join(', ');
    const landmarksText = landmarks.join(', ');
    const imageUrl = `https://${bucketName}.s3.amazonaws.com/${imageKey}`;
    
    // GPT API에 전달할 프롬프트 생성
    const prompt = `
이미지에서 다음 요소가 감지되었습니다:
- 레이블: ${labelsText}
- 랜드마크/관련 요소: ${landmarksText}

위 정보를 바탕으로 이와 유사한 여행지와 여행 계획을 생성해주세요. 사용자는 이 이미지와 비슷한 장소나 분위기를 찾고 있습니다.
${preferences.budget ? `예산: ${preferences.budget}` : ''}
${preferences.duration ? `여행 기간: ${preferences.duration}` : ''}
${preferences.travelStyle ? `여행 스타일: ${preferences.travelStyle}` : ''}

다음 JSON 형식으로 응답해주세요:
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
  "tips": ["여행 팁 1", "여행 팁 2"],
  "similar_places": ["이미지와 유사한 다른 장소 1", "이미지와 유사한 다른 장소 2"]
}`;

    console.log('OpenAI API 호출 시작');
    
    // OpenAI API 호출
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4', // 또는 gpt-4-vision-preview (이미지 처리 가능)
        messages: [
          { 
            role: 'system', 
            content: '당신은 이미지 기반으로 여행지를 추천하고 여행 계획을 생성하는 AI 여행 플래너입니다. 이미지의 특성과 분위기를 파악하여 유사한 여행지를 제안합니다.' 
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
    throw new Error('이미지 기반 여행 계획 생성 중 오류가 발생했습니다.');
  }
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
    headers: corsSettings.getHeaders(),
    body: JSON.stringify(body)
  };
} 