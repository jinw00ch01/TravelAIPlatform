const AWS = require('aws-sdk');
const { corsSettings } = require('../utils/corsSettings');

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
    // 경로 파라미터에서 여행 계획 ID 추출
    const planId = event.pathParameters.id;
    
    // 인증된 사용자 ID (없을 경우 공유된 계획만 조회 가능)
    const userId = event.requestContext.authorizer ? 
                  event.requestContext.authorizer.claims.sub : null;
    
    // DynamoDB에서 여행 계획 조회
    const result = await dynamoDb.get({
      TableName: tableName,
      Key: {
        id: planId
      }
    }).promise();
    
    // 여행 계획이 존재하지 않는 경우
    if (!result.Item) {
      return formatResponse(404, { error: '여행 계획을 찾을 수 없습니다.' });
    }
    
    // 권한 확인: 본인의 계획이거나 공유된 계획만 조회 가능
    if (userId !== result.Item.userId && !result.Item.isShared) {
      return formatResponse(403, { error: '이 여행 계획에 접근할 권한이 없습니다.' });
    }
    
    // 성공 응답 반환
    return formatResponse(200, {
      plan: result.Item
    });
    
  } catch (error) {
    console.error('오류 발생:', error);
    return formatResponse(500, { error: '서버 오류가 발생했습니다.' });
  }
};

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