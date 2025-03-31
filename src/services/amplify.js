import { Amplify } from 'aws-amplify';

// AWS Cognito, S3 설정 - Amplify 6.x 버전에 맞게 수정
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID,
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
      region: process.env.REACT_APP_REGION || 'ap-northeast-2',
      loginWith: {
        oauth: {
          domain: process.env.REACT_APP_OAUTH_DOMAIN ? process.env.REACT_APP_OAUTH_DOMAIN.replace('https://', '') : 'travel-ai-platform.auth.ap-northeast-2.amazoncognito.com',
          scopes: ['email', 'profile', 'openid'],
          redirectSignIn: [process.env.REACT_APP_REDIRECT_SIGN_IN],
          redirectSignOut: [process.env.REACT_APP_REDIRECT_SIGN_OUT],
          responseType: 'code'
        }
      }
    }
  },
  Storage: {
    S3: {
      bucket: process.env.REACT_APP_S3_BUCKET_NAME,
      region: process.env.REACT_APP_REGION || 'ap-northeast-2'
    }
  },
  API: {
    REST: {
      TravelAPI: {
        endpoint: process.env.REACT_APP_API_URL
      }
    }
  }
});

export default Amplify; 