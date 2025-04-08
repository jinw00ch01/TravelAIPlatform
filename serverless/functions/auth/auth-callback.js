/**
 * 소셜 로그인 콜백 처리를 위한 Lambda 함수
 */
const AWS = require('aws-sdk');

exports.handler = async (event) => {
  try {
    console.log('Auth 콜백 호출됨:', JSON.stringify(event, null, 2));
    
    // 리디렉션 URL 구성
    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const callbackPath = '/auth/callback';
    
    // 쿼리 파라미터 그대로 전달
    const queryString = event.queryStringParameters 
      ? Object.entries(event.queryStringParameters)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&')
      : '';
    
    const redirectWithParams = `${redirectUrl}${callbackPath}?${queryString}`;
    
    // 리디렉션 응답
    return {
      statusCode: 302,
      headers: {
        Location: redirectWithParams
      },
      body: JSON.stringify({ redirectTo: redirectWithParams })
    };
  } catch (error) {
    console.error('Auth 콜백 처리 오류:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      })
    };
  }
}; 