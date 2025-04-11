/**
 * 사용자 프로필 업데이트 Lambda 함수
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import jwt from 'jsonwebtoken';
import { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider";

// DynamoDB 클라이언트 초기화
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// CORS 헤더
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

// 환경 변수
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME || 'Users_Table'; // DynamoDB 테이블 이름 환경 변수 사용

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

// Cognito 사용자 속성 업데이트
const userPoolId = process.env.USER_POOL_ID;
const userAttributes = [];

export const handler = async (event) => {
  console.log('사용자 프로필 업데이트 Lambda 함수 시작');
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
    const token = authHeader.substring(7); // 'Bearer ' 이후 부분
    
    // JWT 토큰 디코딩
    const decodedToken = jwt.decode(token);
    if (!decodedToken) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: '유효하지 않은 토큰입니다.'
        })
      };
    }

    // 사용자 ID 추출
    const userId = decodedToken.sub;
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: '토큰에서 사용자 ID를 찾을 수 없습니다.'
        })
      };
    }

    // 요청 본문 파싱
    const requestBody = JSON.parse(event.body);
    console.log('요청 본문:', requestBody);

    // 필수 필드 확인
    const name = requestBody.name;
    const email = requestBody.email;
    const phoneNumber = requestBody.phoneNumber; // phoneNumber로 통일
    const birthdate = requestBody.birthdate; // birthdate로 통일

    // 업데이트할 항목 확인
    if (!name && !email && !phoneNumber && !birthdate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: '업데이트할 필드가 없습니다.'
        })
      };
    }

    // DynamoDB 업데이트 표현식 구성
    let updateExpression = 'SET updatedAt = :updatedAt';
    const expressionAttributeValues = {
      ':updatedAt': new Date().toISOString()
    };

    // 각 필드에 대한 업데이트 표현식 추가
    if (name) {
      updateExpression += ', #nm = :name';
      expressionAttributeValues[':name'] = name;
    }
    
    if (email) {
      updateExpression += ', email = :email';
      expressionAttributeValues[':email'] = email;
    }
    
    if (phoneNumber) {
      updateExpression += ', phone_number = :phoneNumber';
      expressionAttributeValues[':phoneNumber'] = phoneNumber;
    }
    
    if (birthdate) {
      updateExpression += ', birthdate = :birthdate';
      expressionAttributeValues[':birthdate'] = birthdate;
    }

    // DynamoDB 업데이트 명령
    const command = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        userId: userId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: {
        '#nm': 'name'  // name은 DynamoDB의 예약어이므로 속성 이름 사용
      },
      ReturnValues: 'ALL_NEW'
    });

    console.log('Update 명령 파라미터:', JSON.stringify(command.input, null, 2));

    // 업데이트 실행
    const result = await docClient.send(command);
    console.log('업데이트 결과:', JSON.stringify(result, null, 2));

    // Cognito 사용자 속성 업데이트
    if (name) {
      userAttributes.push({ Name: "name", Value: name });
    }
    if (email) {
      userAttributes.push({ Name: "email", Value: email });
    }
    if (phoneNumber) {
      userAttributes.push({ Name: "phone_number", Value: phoneNumber });
    }
    if (birthdate) {
      userAttributes.push({ Name: "birthdate", Value: birthdate });
    }

    if (userAttributes.length > 0) {
      const cognitoParams = {
        UserPoolId: userPoolId,
        Username: userId, // Cognito의 sub 값과 일치
        UserAttributes: userAttributes
      };

      try {
        const cognitoCommand = new AdminUpdateUserAttributesCommand(cognitoParams);
        await cognitoClient.send(cognitoCommand);
        console.log("Cognito 사용자 정보 업데이트 성공");
      } catch (cognitoError) {
        console.error("Cognito 사용자 정보 업데이트 실패:", cognitoError);
        // 여기서 에러를 무시하고 진행할 것인지, 아니면 전체 프로세스를 중단할 것인지 결정
      }
    }

    // 업데이트된 사용자 정보 반환
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: '사용자 프로필이 성공적으로 업데이트되었습니다.',
        user: {
          userId: result.Attributes.userId,
          name: result.Attributes.name,
          email: result.Attributes.email,
          phoneNumber: result.Attributes.phone_number || result.Attributes.phoneNumber,
          birthdate: result.Attributes.birthdate,
          picture: result.Attributes.picture,
          updatedAt: result.Attributes.updatedAt
        }
      })
    };
  } catch (error) {
    console.error('사용자 프로필 업데이트 오류:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: '서버 내부 오류가 발생했습니다.',
        error: error.message
      })
    };
  }
}; 