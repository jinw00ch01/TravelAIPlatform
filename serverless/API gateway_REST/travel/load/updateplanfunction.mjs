import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const SAVED_PLANS_TABLE = "saved_plans";
const DEV_MODE = process.env.NODE_ENV !== "production";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

export const handler = async (event) => {
  console.log('=== UpdatePlan Lambda 함수 시작 ===');
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
    // 1. JWT 토큰에서 사용자 이메일 추출
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    console.log("인증 헤더 확인:", authHeader ? "헤더 있음" : "헤더 없음");

    let userEmail = DEV_MODE ? "test@example.com" : null;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7).trim();
        const decodedToken = jwt.decode(token);
        console.log("디코딩된 토큰:", JSON.stringify(decodedToken));
        
        if (decodedToken?.email) {
          userEmail = decodedToken.email;
          console.log("토큰에서 이메일 추출:", userEmail);
        } else {
          console.warn("토큰에 이메일 정보가 없습니다.");
        }
      } catch (tokenError) {
        console.error("토큰 디코딩 오류:", tokenError.message);
      }
    }

    userEmail = userEmail || "test@example.com";
    console.log("사용할 이메일:", userEmail);

    // 2. 요청 본문에서 plan_id 추출
    let plan_id;
    
    if (event.body) {
      // 일반적인 API Gateway 프록시 통합
      console.log('event.body에서 데이터 추출');
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      plan_id = body.plan_id;
    } else if (event.plan_id) {
      // Lambda 프록시 통합이 아닌 경우
      console.log('event에서 직접 데이터 추출');
      plan_id = event.plan_id;
    } else {
      console.error('plan_id를 찾을 수 없음');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "plan_id를 찾을 수 없습니다.",
          debug: { 
            event_keys: Object.keys(event),
            event_body: event.body,
            event_plan_id: event.plan_id
          }
        })
      };
    }
    
    console.log('추출된 값들:', { userEmail, plan_id });

    if (plan_id === undefined || plan_id === null) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "plan_id는 필수입니다.",
          received: { userEmail, plan_id }
        })
      };
    }

    // 3. DynamoDB 업데이트 (JWT에서 추출한 이메일을 user_id로 사용)
    const updateKey = {
      user_id: String(userEmail),
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