/**
 * MyPage Lambda 함수
 * JWT 토큰에서 사용자 정보를 추출하고 Cognito에서 상세 정보를 가져옵니다.
 */

// AWS SDK 가져오기
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

// CORS 헤더
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

// 환경 변수
const USER_POOL_ID = process.env.USER_POOL_ID || 'ap-northeast-2_cpUPIQSuC';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const DEBUG = process.env.DEBUG === 'true';

// AWS 설정
AWS.config.update({ region: AWS_REGION });

// 미리 정의된 더미 사용자 데이터
const DEFAULT_USER = {
  sub: 'user-dev',
  email: 'user-dev@email.com',
  name: 'user-dev',
  phone_number: '+8200000000000',
  birthdate: '2000-01-01',
  stats: {
    totalTrips: 5,
    countries: 3,
    reviews: 12
  }
};

// 미리 정의된 더미 예약 데이터
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

// 성공 응답 생성 헬퍼 함수
const createSuccessResponse = (user, bookings, tokenStatus, errorMessage) => {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      user: user || DEFAULT_USER,
      bookings: bookings || DEFAULT_BOOKINGS,
      tokenStatus: tokenStatus || 'unknown',
      ...(errorMessage && { errorMessage })
    })
  };
};

exports.handler = async (event) => {
  console.log('MyPage Lambda 함수 시작');
  
  try {
    console.log('이벤트 객체:', JSON.stringify(event, null, 2));
    
    // OPTIONS 요청 처리 (CORS)
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'CORS preflight request successful' })
      };
    }
    
    // 인증 헤더 확인
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    console.log('인증 헤더:', authHeader);
    
    // 토큰이 없거나 "Bearer undefined"인 경우 기본 응답 반환
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader === 'Bearer undefined') {
      console.log('토큰이 유효하지 않거나 undefined입니다.');
      return createSuccessResponse(DEFAULT_USER, DEFAULT_BOOKINGS, 'missing_or_invalid');
    }
    
    // Bearer 토큰 추출
    const token = authHeader.substring(7).trim();
    console.log('추출된 토큰 길이:', token?.length);
    
    if (!token || token === '' || token === 'undefined') {
      console.log('빈 토큰 또는 "undefined" 문자열.');
      return createSuccessResponse(DEFAULT_USER, DEFAULT_BOOKINGS, 'undefined_or_empty');
    }
    
    // JWT 토큰 디코딩 시도
    let decodedToken;
    try {
      decodedToken = jwt.decode(token);
      console.log('디코딩된 토큰:', decodedToken ? JSON.stringify(decodedToken, null, 2) : 'null');
      
      if (!decodedToken) {
        console.error('JWT 디코딩 실패 - 토큰 형식 오류');
        return createSuccessResponse(DEFAULT_USER, DEFAULT_BOOKINGS, 'decode_failed');
      }
    } catch (decodeError) {
      console.error('JWT 토큰 디코딩 중 오류:', decodeError);
      return createSuccessResponse(DEFAULT_USER, DEFAULT_BOOKINGS, 'jwt_decode_error', decodeError.message);
    }
    
    // 사용자 식별자 확인 (sub, username, email 등)
    const userId = decodedToken.sub || decodedToken['cognito:username'];
    const userEmail = decodedToken.email;
    
    console.log('사용자 ID:', userId);
    console.log('사용자 이메일:', userEmail);
    
    if (!userId && !userEmail) {
      console.error('토큰에서 사용자 식별 정보 찾을 수 없음');
      return createSuccessResponse(DEFAULT_USER, DEFAULT_BOOKINGS, 'missing_user_id');
    }
    
    // 연락할 Cognito 사용자 이름 (sub 또는 email 사용)
    const cognitoUsername = userEmail || userId;
    
    // Cognito에서 사용자 정보 가져오기
    try {
      const cognito = new AWS.CognitoIdentityServiceProvider();
      const params = {
        UserPoolId: USER_POOL_ID,
        Username: cognitoUsername
      };
      
      console.log('Cognito에 요청할 파라미터:', JSON.stringify(params));
      
      const cognitoResponse = await cognito.adminGetUser(params).promise();
      console.log('Cognito 응답:', JSON.stringify(cognitoResponse, null, 2));
      
      // 사용자 기본 정보
      const userDetails = {
        username: cognitoUsername
      };
      
      // 사용자 속성 매핑
      if (cognitoResponse.UserAttributes) {
        cognitoResponse.UserAttributes.forEach(attr => {
          userDetails[attr.Name] = attr.Value;
        });
      }
      
      console.log('추출된 사용자 정보:', JSON.stringify(userDetails, null, 2));
      
      // 최종 사용자 정보 포맷팅
      const user = {
        sub: userDetails.sub || userId,
        email: userDetails.email || userEmail,
        name: userDetails.name || userDetails.given_name || '사용자',
        phone_number: userDetails.phone_number || DEFAULT_USER.phone_number,
        birthdate: userDetails.birthdate || DEFAULT_USER.birthdate,
        stats: {
          totalTrips: 5,
          countries: 3,
          reviews: 12
        }
      };
      
      // 성공 응답
      return createSuccessResponse(user, DEFAULT_BOOKINGS, 'valid_token');
      
    } catch (cognitoError) {
      console.error('Cognito 사용자 정보 조회 실패:', cognitoError);
      
      // Cognito 조회 실패 시 기본 응답 반환
      return createSuccessResponse(
        {
          sub: userId,
          email: userEmail || DEFAULT_USER.email,
          name: DEFAULT_USER.name,
          phone_number: DEFAULT_USER.phone_number,
          birthdate: DEFAULT_USER.birthdate,
          stats: DEFAULT_USER.stats
        }, 
        DEFAULT_BOOKINGS, 
        'cognito_error',
        cognitoError.message
      );
    }
  } catch (error) {
    console.error('서버 내부 오류:', error);
    
    // 내부 오류 시에도 무조건 200 응답 반환
    return createSuccessResponse(DEFAULT_USER, DEFAULT_BOOKINGS, 'server_error', error.message);
  }
}; 