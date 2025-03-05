const AWS = require('aws-sdk');

// AWS 서비스 초기화
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TRAVEL_PLANS_TABLE;

/**
 * 여행 계획 공유 Lambda 함수
 * 여행 계획을 공유 가능 상태로 설정하고 공유 URL 생성
 */
exports.handler = async (event) => {
  console.log('이벤트 수신:', JSON.stringify(event, null, 2));
  
  try {
    // API Gateway 경로 파라미터에서 계획 ID 추출
    const planId = event.pathParameters.id;
    // API Gateway & Cognito에서 사용자 ID 추출
    const userId = event.requestContext.authorizer.claims.sub;
    
    if (!planId) {
      return formatResponse(400, { error: '계획 ID가 필요합니다.' });
    }

    // 먼저 여행 계획 존재 및 소유권 확인
    const getResult = await dynamoDb.get({
      TableName: tableName,
      Key: { id: planId }
    }).promise();
    
    // 계획이 존재하지 않는 경우
    if (!getResult.Item) {
      return formatResponse(404, { error: '여행 계획을 찾을 수 없습니다.' });
    }
    
    // 소유자 확인
    if (getResult.Item.userId !== userId) {
      return formatResponse(403, { error: '이 여행 계획을 공유할 권한이 없습니다.' });
    }
    
    // 요청 본문에서 공유 옵션 파싱
    const shareOptions = JSON.parse(event.body) || {};
    
    // 공유 설정 업데이트
    // 만료일, 공유 비밀번호 등 추가 설정 가능
    const updateResult = await dynamoDb.update({
      TableName: tableName,
      Key: { id: planId },
      UpdateExpression: 'SET isShared = :isShared, shareExpiration = :expiration, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isShared': true,
        ':expiration': shareOptions.expiresAt || null,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'UPDATED_NEW'
    }).promise();
    
    // 공유 URL 생성
    // API Gateway 엔드포인트 또는 프론트엔드 URL을 사용하여 구성
    const apiUrl = process.env.FRONTEND_URL || 'https://travel-ai-platform.example.com';
    const shareUrl = `${apiUrl}/itinerary/${planId}`;
    
    return formatResponse(200, {
      message: '여행 계획이 공유되었습니다.',
      shareUrl: shareUrl,
      planId: planId,
      isShared: updateResult.Attributes.isShared,
      expiresAt: updateResult.Attributes.shareExpiration
    });
  } catch (error) {
    console.error('Error:', error);
    return formatResponse(500, { error: '여행 계획 공유 중 오류가 발생했습니다.' });
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