/**
 * Cognito 사용자 등록 후 처리를 위한 Lambda 함수
 * 사용자가 회원가입 후 이메일 인증을 완료했을 때 실행됩니다.
 */

const AWS = require('aws-sdk');
require('dotenv').config();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context) => {
  console.log('Post Confirmation Lambda 트리거 실행:', JSON.stringify(event, null, 2));

  // 사용자 정보 추출
  const { userName, request } = event;
  const { userAttributes } = request;
  const { email, name, sub: userId } = userAttributes;

  try {
    // 사용자 프로필 정보를 DynamoDB에 저장
    const timestamp = new Date().toISOString();
    
    const params = {
      TableName: process.env.TRAVEL_PLANS_TABLE,
      Item: {
        id: `user-profile-${userId}`,
        userId: userId,
        email: email,
        name: name || email.split('@')[0], // 이름이 없으면 이메일 아이디 부분 사용
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'USER_PROFILE',
        preferences: {
          language: 'ko',
          currency: 'KRW',
          notificationsEnabled: true
        }
      }
    };

    await dynamoDB.put(params).promise();
    console.log('사용자 프로필이 성공적으로 저장되었습니다:', userId);

    // Cognito 트리거는 원본 이벤트를 반환해야 합니다
    return event;
  } catch (error) {
    console.error('사용자 프로필 저장 중 오류 발생:', error);
    // 오류가 발생해도 사용자 생성 프로세스는 계속 진행되어야 함
    return event;
  }
}; 