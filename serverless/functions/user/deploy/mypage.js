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
const USER_POOL_ID = process.env.USER_POOL_ID || 'ap-northeast-2_cJFbK5Qal';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';

// AWS 설정
AWS.config.update({ region: AWS_REGION });
const cognito = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event) => {
  console.log('MyPage Lambda 함수 시작');
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
    
    if (!token || token === '') {
      console.error('빈 토큰');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: '빈 토큰입니다.'
        })
      };
    }
    
    // JWT 토큰 디코딩
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
    } catch (error) {
      console.error('JWT 토큰 디코딩 중 오류:', error);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'JWT 토큰 처리 중 오류: ' + error.message
        })
      };
    }
    
    // 사용자 식별자 확인 (sub, username, email 등)
    const userId = decodedToken.sub || decodedToken['cognito:username'];
    const userEmail = decodedToken.email;
    
    console.log('사용자 ID:', userId);
    console.log('사용자 이메일:', userEmail);
    
    if (!userId && !userEmail) {
      console.error('토큰에서 사용자 식별 정보 찾을 수 없음');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: '토큰에서 사용자 식별 정보를 찾을 수 없습니다.'
        })
      };
    }
    
    // 연락할 Cognito 사용자 이름 (sub 또는 email 사용)
    const cognitoUsername = userId || userEmail;
    
    // Cognito에서 사용자 정보 가져오기
    let userDetails;
    try {
      const params = {
        UserPoolId: USER_POOL_ID,
        Username: cognitoUsername
      };
      
      const cognitoResponse = await cognito.adminGetUser(params).promise();
      console.log('Cognito 응답:', JSON.stringify(cognitoResponse, null, 2));
      
      // 사용자 기본 정보
      userDetails = {
        username: cognitoUsername
      };
      
      // 사용자 속성 매핑
      if (cognitoResponse.UserAttributes) {
        cognitoResponse.UserAttributes.forEach(attr => {
          userDetails[attr.Name] = attr.Value;
        });
      }
      
      console.log('추출된 사용자 정보:', JSON.stringify(userDetails, null, 2));
    } catch (error) {
      console.error('Cognito 사용자 정보 조회 실패:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Cognito에서 사용자 정보를 가져오는 중 오류가 발생했습니다.',
          error: error.message
        })
      };
    }
    
    // 최종 사용자 정보 포맷팅
    const user = {
      sub: userDetails.sub || userId,
      email: userDetails.email,
      name: userDetails.name || userDetails.given_name || '사용자',
      phone_number: userDetails.phone_number || '',
      birthdate: userDetails.birthdate || '',
      stats: {
        totalTrips: 0,  // 실제 DB에서 가져와야 함
        countries: 0,  // 실제 DB에서 가져와야 함
        reviews: 0   // 실제 DB에서 가져와야 함
      }
    };
    
    // 실제 DB에서 예약 정보를 가져와야 함
    // 현재는 빈 배열 반환
    const bookings = [];
    
    // 성공 응답
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user,
        bookings
      })
    };
    
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