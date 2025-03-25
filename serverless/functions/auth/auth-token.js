const AWS = require('aws-sdk');
const axios = require('axios');
const querystring = require('querystring');
const { corsSettings } = require('../utils/corsSettings');

/**
 * 인증 코드를 토큰으로 교환하는 Lambda 함수
 */
exports.handler = async (event) => {
  console.log('Auth 토큰 이벤트:', JSON.stringify(event, null, 2));
  
  // 옵션 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsSettings.getHeaders(),
      body: ''
    };
  }
  
  try {
    // 환경 변수 설정
    const userPoolId = process.env.USER_POOL_ID;
    const clientId = process.env.APP_CLIENT_ID || process.env.USER_POOL_CLIENT_ID;
    const region = process.env.AWS_REGION || 'ap-northeast-2';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const cognitoDomain = process.env.OAUTH_DOMAIN || 'travel-ai-platform.auth.ap-northeast-2.amazoncognito.com';
    
    console.log('설정 정보:', {
      userPoolId,
      clientId,
      region,
      frontendUrl,
      cognitoDomain
    });
    
    // 쿼리 파라미터에서 인증 코드와 리디렉션 URI 추출
    const queryParams = event.queryStringParameters || {};
    const { code, redirect_uri } = queryParams;
    
    if (!code) {
      return {
        statusCode: 400,
        headers: corsSettings.getHeaders(),
        body: JSON.stringify({ error: 'code_required', error_description: '인증 코드가 필요합니다.' })
      };
    }
    
    if (!redirect_uri) {
      return {
        statusCode: 400,
        headers: corsSettings.getHeaders(),
        body: JSON.stringify({ error: 'redirect_uri_required', error_description: '리디렉션 URI가 필요합니다.' })
      };
    }
    
    console.log('인증 코드 교환 시작:', code);
    console.log('리디렉션 URI:', redirect_uri);
    
    // 토큰 엔드포인트 URL
    const tokenEndpoint = `https://${cognitoDomain}/oauth2/token`;
    
    // 토큰 요청 파라미터
    const params = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code: code,
      redirect_uri: redirect_uri
    };
    
    console.log('토큰 요청 파라미터:', params);
    
    // 토큰 요청
    const tokenResponse = await axios.post(
      tokenEndpoint,
      querystring.stringify(params),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('토큰 응답 수신 (민감 정보 숨김)');
    
    // 토큰 정보
    const { access_token, id_token, refresh_token } = tokenResponse.data;
    
    // 사용자 정보 조회
    let userInfo = null;
    if (access_token) {
      try {
        const userInfoResponse = await axios.get(
          `https://${cognitoDomain}/oauth2/userInfo`,
          {
            headers: {
              'Authorization': `Bearer ${access_token}`
            }
          }
        );
        userInfo = userInfoResponse.data;
        console.log('사용자 정보 수신:', JSON.stringify(userInfo, null, 2));
      } catch (userInfoError) {
        console.error('사용자 정보 조회 오류:', userInfoError.message);
      }
    }
    
    // 보안을 위해 실제 토큰을 응답에 포함하지 않고 성공 여부만 반환
    return {
      statusCode: 200,
      headers: corsSettings.getHeaders(),
      body: JSON.stringify({
        success: true,
        user: userInfo ? {
          sub: userInfo.sub,
          email: userInfo.email,
          email_verified: userInfo.email_verified,
          name: userInfo.name
        } : null
      })
    };
  } catch (error) {
    console.error('OAuth 토큰 교환 중 오류:', error);
    
    const errorMessage = error.response?.data?.error || error.message || '인증 처리 중 오류가 발생했습니다';
    const errorDescription = error.response?.data?.error_description || '';
    
    return {
      statusCode: 500,
      headers: corsSettings.getHeaders(),
      body: JSON.stringify({ 
        error: 'token_exchange_error', 
        error_description: errorMessage,
        details: errorDescription 
      })
    };
  }
}; 