const AWS = require('aws-sdk');

// AWS 서비스 초기화
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TRAVEL_PLANS_TABLE;

/**
 * 여행 계획 조회 Lambda 함수
 * 특정 ID의 여행 계획을 DynamoDB에서 조회
 */
exports.handler = async (event) => {
  console.log('이벤트 수신:', JSON.stringify(event, null, 2));
  
  try {
    // API Gateway 경로 파라미터에서 계획 ID 추출
    const planId = event.pathParameters.id;
    
    if (!planId) {
      return formatResponse(400, { error: '계획 ID가 필요합니다.' });
    }

    // DynamoDB에서 여행 계획 조회
    const result = await dynamoDb.get({
      TableName: tableName,
      Key: { id: planId }
    }).promise();
    
    // 계획이 존재하지 않는 경우
    if (!result.Item) {
      return formatResponse(404, { error: '여행 계획을 찾을 수 없습니다.' });
    }
    
    // 공유 링크인 경우 사용자 검증 건너뛰기
    const isShared = result.Item.isShared === true;
    
    // 사용자 권한 확인 (공유된 계획이 아닌 경우)
    if (!isShared) {
      try {
        // Cognito 인증된 사용자 ID (만약 있다면)
        const requestUserId = event.requestContext.authorizer ? 
          event.requestContext.authorizer.claims.sub : null;
        
        // 소유자 확인
        if (requestUserId && result.Item.userId !== requestUserId) {
          return formatResponse(403, { error: '이 여행 계획에 접근할 권한이 없습니다.' });
        }
      } catch (error) {
        // 인증 정보가 없는 경우(공개 접근)는 공유된 여행 계획만 접근 가능
        if (!isShared) {
          return formatResponse(401, { error: '인증이 필요합니다.' });
        }
      }
    }
    
    // 응답으로 반환할 계획 데이터
    const plan = result.Item;
    
    return formatResponse(200, plan);
  } catch (error) {
    console.error('Error:', error);
    return formatResponse(500, { error: '여행 계획 조회 중 오류가 발생했습니다.' });
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