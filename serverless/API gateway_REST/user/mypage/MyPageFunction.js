/**
 * MyPage Lambda 함수
 * JWT 토큰에서 사용자 ID를 추출하고 DynamoDB에서 상세 정보를 가져옵니다.
 */

// AWS SDK v3 가져오기
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import jwt from 'jsonwebtoken'; // jsonwebtoken을 import 방식으로 사용

// DynamoDB 클라이언트 초기화
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// CORS 헤더
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

// 환경 변수
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME || 'Users_Table'; // DynamoDB 테이블 이름 환경 변수 사용

// 미리 정의된 더미 예약 데이터 - 연동 전까지 고정 데이터로 사용
const DEFAULT_BOOKINGS = [
  {
    id: 1,
    title: '제주도 호텔',
    type: '숙박',
    date: '2024-06-15',
    status: '예정',
    price: '150,000원',
    location: '제주시'
  },
  {
    id: 2,
    title: '부산 해운대 호텔',
    type: '숙박',
    date: '2024-02-20',
    status: '완료',
    price: '180,000원',
    location: '해운대구'
  },
  {
    id: 3,
    title: '서울 강남 호텔',
    type: '숙박',
    date: '2024-05-10',
    status: '예정',
    price: '200,000원',
    location: '강남구'
  }
];

export const handler = async (event) => {
  console.log('MyPage Lambda 함수 시작 (DynamoDB 버전)');
  console.log('이벤트 객체:', JSON.stringify(event, null, 2));

  // OPTIONS 요청 처리 (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight request successful' })
    };
  }

  try {
    // 인증 헤더 확인
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    console.log('인증 헤더:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('인증 토큰 없음 또는 형식 오류');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: '유효한 인증 토큰이 필요합니다. Bearer 토큰 형식이어야 합니다.'
        })
      };
    }

    // Bearer 토큰 추출
    const token = authHeader.substring(7).trim(); // 'Bearer ' 이후 부분
    console.log('추출된 토큰 길이:', token?.length);

    if (!token || token === '' || token === 'undefined') {
      console.error('빈 토큰 또는 "undefined" 문자열');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: '유효한 토큰이 없습니다.'
        })
      };
    }

    // JWT 토큰 디코딩 시도
    let decodedToken;
    try {
      decodedToken = jwt.decode(token);
      console.log('디코딩된 토큰:', JSON.stringify(decodedToken, null, 2));

      if (!decodedToken) {
        console.error('JWT 디코딩 실패 - 토큰 형식 오류');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: '토큰 디코딩 실패: 유효하지 않은 JWT 형식'
          })
        };
      }
    } catch (decodeError) {
      console.error('JWT 토큰 디코딩 중 오류:', decodeError);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'JWT 토큰 처리 중 오류: ' + decodeError.message
        })
      };
    }

    // 사용자 식별자 확인 (sub 사용 - DynamoDB 파티션 키)
    const userId = decodedToken.sub;
    console.log('사용자 ID (sub):', userId);

    if (!userId) {
      console.error('토큰에서 사용자 sub 클레임 찾을 수 없음');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: '토큰에서 사용자 식별 정보(sub)를 찾을 수 없습니다.'
        })
      };
    }

    // DynamoDB에서 사용자 정보 가져오기
    try {
      const params = {
        TableName: USERS_TABLE_NAME,
        Key: {
          userId: userId // 파티션 키
        }
      };

      console.log('DynamoDB GetItem 요청 파라미터:', JSON.stringify(params));

      const command = new GetCommand(params);
      const { Item } = await docClient.send(command);

      console.log('DynamoDB GetItem 응답:', JSON.stringify(Item, null, 2));

      if (!Item) {
        console.error(`DynamoDB에서 사용자 ${userId} 정보를 찾을 수 없음`);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: '사용자 정보를 찾을 수 없습니다.'
          })
        };
      }

      // 사용자 정보 포맷팅 (DynamoDB 항목 기반)
      const user = {
        userId: Item.userId, // sub 대신 userId로 통일
        email: Item.email || '',
        name: Item.name || '',
        phoneNumber: Item.phoneNumber || '',
        birthdate: Item.birthdate || '',
        picture: Item.picture || null,
        createdAt: Item.createdAt,
        updatedAt: Item.updatedAt,
        // 통계 정보는 별도 로직 필요 (일단 더미값)
        stats: {
          totalTrips: 5,
          countries: 3,
          reviews: 12
        }
      };

      // 성공 응답
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          user: user,
          bookings: DEFAULT_BOOKINGS // 예약 정보는 별도 로직 필요 (일단 더미값)
        })
      };

    } catch (dynamoDbError) {
      console.error('DynamoDB 사용자 정보 조회 실패:', dynamoDbError);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'DynamoDB에서 사용자 정보를 가져오는 중 오류가 발생했습니다.',
          error: dynamoDbError.message
        })
      };
    }
  } catch (error) {
    console.error('서버 내부 오류:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: '서버 내부 오류',
        error: error.message
      })
    };
  }
}; 