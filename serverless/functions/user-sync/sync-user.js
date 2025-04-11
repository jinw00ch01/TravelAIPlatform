import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Users 테이블 이름을 환경 변수나 직접 지정해야 합니다.
// AWS Lambda 콘솔에서 환경 변수로 설정하는 것을 권장합니다.
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME; // 실제 테이블 이름으로 변경 필요

export const handler = async (event) => {
  console.log('Received Cognito event:', JSON.stringify(event, null, 2));

  // Post Confirmation 트리거에서만 실행되도록 확인
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    console.log('Not a Post Confirmation event. Skipping.');
    return event;
  }

  // Cognito 이벤트에서 사용자 속성 추출
  // custom: 접두사가 붙을 수 있으므로 확인 필요 (콘솔에서 설정 확인)
  const { sub, name, email, picture } = event.request.userAttributes;
  const birthdate = event.request.userAttributes['custom:birthdate'] || event.request.userAttributes['birthdate']; // Cognito 설정에 따라 키 이름 확인 필요
  const phoneNumber = event.request.userAttributes['custom:phone_number'] || event.request.userAttributes['phone_number'] || event.request.userAttributes['phoneNumber']; // Cognito는 phone_number 사용

  // DynamoDB에 저장할 항목
  const item = {
    userId: sub, // Cognito sub를 파티션 키로 사용
    name: name,
    email: email,
    picture: picture || null, // picture 속성이 없을 수도 있음
    birthdate: birthdate || null, // birthdate 추가
    phoneNumber: phoneNumber || null, // phoneNumber로 통일
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // DynamoDB에 사용자 정보 저장 (PutCommand는 덮어쓰기)
  const command = new PutCommand({
    TableName: USERS_TABLE_NAME,
    Item: item,
  });

  try {
    await docClient.send(command);
    console.log(`Successfully added/updated user ${sub} in DynamoDB table ${USERS_TABLE_NAME}.`);
  } catch (error) {
    console.error(`Error saving user ${sub} to DynamoDB:`, error);
    // 필요시 에러 처리 로직 추가 (예: 재시도, 로깅 강화)
    // 에러를 던지면 Cognito는 사용자 등록 실패로 간주할 수 있으므로 주의
  }

  // Cognito에 이벤트를 그대로 반환
  return event;
};
