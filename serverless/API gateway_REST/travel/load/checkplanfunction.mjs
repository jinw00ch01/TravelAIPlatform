import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false
  }
});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
  "Content-Type": "application/json"
};

const SAVED_PLANS_TABLE = process.env.SAVED_PLANS_TABLE || "saved_plans";
const DEV_MODE = process.env.NODE_ENV !== "production";

export const handler = async (event) => {
  console.log("GetSinglePlan Lambda 시작");
  console.log("event:", JSON.stringify(event));

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "CORS preflight OK" })
    };
  }

  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    let userEmail = DEV_MODE ? "test@example.com" : null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7).trim();
        const decoded = jwt.decode(token);
        if (decoded?.email) {
          userEmail = decoded.email;
        }
      } catch (err) {
        console.error("JWT 디코딩 오류:", err.message);
      }
    }

    userEmail = userEmail || "jhh333210@gmail.com";

    const body = JSON.parse(event.body || "{}");
    const planId = body.plan_id;
    const planIds = body.plan_ids;
    
    // 다중 plan_id 요청인지 확인
    if (Array.isArray(planIds) && planIds.length > 0) {
      console.log("다중 계획 조회 요청:", planIds);
      
      // 다중 조회를 위한 키 생성
      const keys = planIds.map(id => ({
        user_id: userEmail,
        plan_id: Number(id)
      }));
      
      const batchGetCmd = {
        RequestItems: {
          [SAVED_PLANS_TABLE]: {
            Keys: keys
          }
        }
      };
      
      console.log("BatchGet 실행:", JSON.stringify(batchGetCmd));
      const result = await docClient.send(new BatchGetCommand(batchGetCmd));
      
      const plans = result.Responses?.[SAVED_PLANS_TABLE] || [];
      console.log("다중 계획 조회 결과:", plans.length);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          plans: plans,
          single_request: false
        })
      };
    }
  
    // 기존 단일 plan_id 처리 로직
    if (!planId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: "plan_id가 필요합니다." })
      };
    }

    const queryCmd = new QueryCommand({
      TableName: SAVED_PLANS_TABLE,
      KeyConditionExpression: "user_id = :uid and plan_id = :pid",
      ExpressionAttributeValues: {
        ":uid": userEmail,
        ":pid": Number(planId)
      }
    });

    const result = await docClient.send(queryCmd);
    
    // 디버깅 로그 추가
    console.log("DynamoDB 쿼리 결과:", JSON.stringify(result, null, 2));
    if (result.Items && result.Items[0]) {
      console.log("첫 번째 아이템 키들:", Object.keys(result.Items[0]));
      console.log("name 필드 값:", result.Items[0].name);
      console.log("plan_id 필드 값:", result.Items[0].plan_id);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        plan: result.Items?.[0] || null,
        single_request: true
      })
    };
  } catch (err) {
    console.error("조회 실패:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: "조회 중 오류 발생", error: err.message })
    };
  }
};
