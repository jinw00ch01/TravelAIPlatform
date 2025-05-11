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

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '여행 계획을 성공적으로 불러왔습니다.',
          plan: [result.Item]
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

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          message: '가장 최근 여행 계획을 성공적으로 불러왔습니다.',
          plan: result.Items
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