import { Amplify } from 'aws-amplify';

// 예: AWS Cognito, S3 설정 (아래는 샘플 값, 실제 리소스 값으로 대체)
Amplify.configure({
  Auth: {
    region: 'ap-northeast-2',   // 예시: 서울 리전
    userPoolId: 'ap-northeast-2_XXXXXXXXX',
    userPoolWebClientId: 'XXXXXXXXXXXXX',
    mandatorySignIn: true,
    authenticationFlowType: 'USER_PASSWORD_AUTH',
    oauth: {
      domain: 'your-cognito-domain.auth.ap-northeast-2.amazoncognito.com',
      scope: ['email', 'profile', 'openid'],
      redirectSignIn: 'http://localhost:3000/',
      redirectSignOut: 'http://localhost:3000/',
      responseType: 'code'
    }
  },
  Storage: {
    AWSS3: {
      bucket: 'your-s3-bucket-name',
      region: 'ap-northeast-2',
    }
  },
  // API, Analytics, PubSub 등의 추가 설정도 가능
});

export default Amplify; 