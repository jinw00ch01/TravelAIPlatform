/**
 * Profile Lambda 함수
 * 사용자 프로필 정보를 업데이트하기 위한 API 엔드포인트
 */

const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

// CORS 헤더
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'PUT,OPTIONS',
  'Content-Type': 'application/json'
};

// 환경 변수
const USER_POOL_ID = process.env.USER_POOL_ID || 'ap-northeast-2_8z1jH3Siu';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';

// AWS 설정
AWS.config.update({ region: AWS_REGION });
const cognito = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event) => {
  console.log('Profile Lambda 함수 시작');
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
    
    // 요청 본문 파싱
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
      console.log('요청 본문:', JSON.stringify(requestBody, null, 2));
    } catch (error) {
      console.error('요청 본문 파싱 오류:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: '유효하지 않은 요청 형식입니다.'
        })
      };
    }
    
    // 업데이트할 사용자 속성 생성
    const userAttributes = [];
    
    // 이름 업데이트
    if (requestBody.username) {
      userAttributes.push({
        Name: 'name',
        Value: requestBody.username
      });
    }
    
    // 전화번호 업데이트
    if (requestBody.phone) {
      userAttributes.push({
        Name: 'phone_number',
        Value: requestBody.phone
      });
    }
    
    // 생년월일 업데이트
    if (requestBody.birthDate) {
      userAttributes.push({
        Name: 'birthdate',
        Value: requestBody.birthDate
      });
    }
    
    // 속성이 없으면 업데이트할 필요 없음
    if (userAttributes.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: '업데이트할 속성이 없습니다.'
        })
      };
    }
    
    // Cognito 사용자 업데이트
    try {
      // 연락할 Cognito 사용자 이름 (sub 또는 email 사용)
      const cognitoUsername = userId || userEmail;
      
      const params = {
        UserPoolId: USER_POOL_ID,
        Username: cognitoUsername,
        UserAttributes: userAttributes
      };
      
      console.log('Cognito 업데이트 요청 파라미터:', JSON.stringify(params, null, 2));
      
      await cognito.adminUpdateUserAttributes(params).promise();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: '사용자 정보가 성공적으로 업데이트되었습니다.',
          updatedAttributes: userAttributes.map(attr => attr.Name)
        })
      };
    } catch (error) {
      console.error('Cognito 사용자 업데이트 실패:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: '사용자 정보 업데이트 중 오류가 발생했습니다.',
          error: error.message
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