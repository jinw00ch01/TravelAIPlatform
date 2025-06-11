import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const SAVED_PLANS_TABLE = "saved_plans";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

export const handler = async (event) => {
  console.log('=== Lambda 함수 시작 ===');
  console.log('전체 event:', JSON.stringify(event, null, 2));
  
  // CORS 처리
  if (event.httpMethod === "OPTIONS") {
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ message: "CORS preflight OK" }) 
    };
  }

  try {
    let user_id, plan_id;
    
    // API Gateway 통합 방식에 따라 다른 위치에서 데이터 추출
    if (event.body) {
      // 일반적인 API Gateway 프록시 통합
      console.log('event.body에서 데이터 추출');
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      user_id = body.user_id;
      plan_id = body.plan_id;
    } else if (event.user_id && event.plan_id) {
      // Lambda 프록시 통합이 아닌 경우
      console.log('event에서 직접 데이터 추출');
      user_id = event.user_id;
      plan_id = event.plan_id;
    } else {
      console.error('데이터를 찾을 수 없음');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "plan의 소유자가 아닙니다. 공유받은 플랜은 소유자만 결제할 수 있습니다.",
          debug: { 
            event_keys: Object.keys(event),
            event_body: event.body,
            event_user_id: event.user_id,
            event_plan_id: event.plan_id
          }
        })
      };
    }
    
    console.log('추출된 값들:', { user_id, plan_id });

    if (!user_id || plan_id === undefined || plan_id === null) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "user_id와 plan_id는 필수입니다.",
          received: { user_id, plan_id }
        })
      };
    }

    // DynamoDB 업데이트
    const updateKey = {
      user_id: String(user_id),
      plan_id: Number(plan_id)
    };
    
    console.log('DynamoDB 업데이트 Key:', updateKey);

    const updateCommand = new UpdateCommand({
      TableName: SAVED_PLANS_TABLE,
      Key: updateKey,
      UpdateExpression: "SET paid_plan = :p",
      ExpressionAttributeValues: { ":p": 1 },
      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(updateCommand);
    
    console.log('DynamoDB 업데이트 성공:', result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "paid_plan이 1로 성공적으로 수정되었습니다.",
        usedKey: updateKey,
        updatedAttributes: result.Attributes
      })
    };

  } catch (error) {
    console.error('Lambda 함수 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "서버 오류",
        error: error.message
      })
    };
  }
};