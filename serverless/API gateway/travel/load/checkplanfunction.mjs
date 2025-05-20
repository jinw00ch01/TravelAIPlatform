import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
    console.log("OPTIONS 요청 처리 중");
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
    const planId = body.plan_id || body.planId;
  
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        plan: result.Items?.[0] || null
      })
    };
  } catch (err) {
    console.error("단일 조회 실패:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: "조회 중 오류 발생", error: err.message })
    };
  }
};
