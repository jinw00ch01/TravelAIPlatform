// 로컬 테스트 스크립트
const AWS = require('aws-sdk');
// AWS 리전 설정
AWS.config.update({ region: 'ap-northeast-2' });

const { handler } = require('./create');

// 테스트 이벤트 객체
const event = {
  body: JSON.stringify({
    query: '200만원의 예산내에서 10월 15일 출국 10월 24일 귀국 일정으로 오사카로 가는 항공편과 숙소, 렌트카를 예약해줘.',
    preferences: {
      accommodation: '호텔',
      transportation: '렌트카',
      activities: '관광, 쇼핑'
    }
  }),
  requestContext: {
    authorizer: {
      claims: {
        sub: 'test-user-id'
      }
    }
  }
};

// 테스트용 DynamoDB 설정
const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: 'ap-northeast-2',
  // 로컬 테스트를 위한 가짜 자격 증명
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});

// Lambda 함수 호출
async function testHandler() {
  try {
    // 환경 변수 설정
    process.env.NODE_ENV = 'local';
    process.env.TRAVEL_PLANS_TABLE = 'TravelPlans';
    process.env.OPENAI_API_KEY = 'your-openai-api-key-here'; // 실제 테스트 시 유효한 키로 교체하세요
    
    const result = await handler(event);
    console.log('응답:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('오류:', error);
  }
}

testHandler(); 