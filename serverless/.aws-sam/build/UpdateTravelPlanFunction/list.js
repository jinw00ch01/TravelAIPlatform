const AWS = require('aws-sdk');

// AWS 서비스 초기화
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TRAVEL_PLANS_TABLE;

/**
 * 여행 계획 목록 조회 Lambda 함수
 * 현재 로그인한 사용자의 모든 여행 계획 목록을 반환
 */
exports.handler = async (event) => {
  console.log('이벤트 수신:', JSON.stringify(event, null, 2));
  
  try {
    // API Gateway & Cognito에서 사용자 ID 추출
    const userId = event.requestContext.authorizer.claims.sub;
    
    if (!userId) {
      return formatResponse(401, { error: '인증이 필요합니다.' });
    }

    // GSI를 사용하여 사용자의 여행 계획 목록 조회
    const result = await dynamoDb.query({
      TableName: tableName,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();
    
    // 여행 계획 목록 간소화 (불필요한 세부 정보 제거)
    const plans = result.Items.map(item => ({
      id: item.id,
      title: item.plan?.title || '제목 없음',
      destination: item.plan?.destination || '목적지 미정',
      duration: item.plan?.duration || '',
      createdAt: item.createdAt,
      isShared: item.isShared || false,
      // 이미지가 있는 경우에만 이미지 URL 포함
      ...(item.imageKey && { 
        imageUrl: `https://${process.env.MEDIA_BUCKET}.s3.amazonaws.com/${item.imageKey}`
      })
    }));
    
    // 생성일 기준 최신순 정렬
    plans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return formatResponse(200, {
      message: '여행 계획 목록을 성공적으로 조회했습니다.',
      plans: plans,
      count: plans.length
    });
  } catch (error) {
    console.error('Error:', error);
    return formatResponse(500, { error: '여행 계획 목록 조회 중 오류가 발생했습니다.' });
  }
};

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