import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

// DynamoDB 클라이언트 설정
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
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

const SAVED_PLANS_TABLE = process.env.SAVED_PLANS_TABLE || "saved_plans";
const DEV_MODE = process.env.NODE_ENV !== "production";

// Lambda 핸들러
export const handler = async (event) => {
  console.log("GetPlans Lambda 시작");
  console.log("event:", JSON.stringify(event));

  // OPTIONS 메서드 처리 개선
  if (event.httpMethod === "OPTIONS") {
    console.log("OPTIONS 요청 처리 중");
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "CORS preflight OK" })
    };
  }

  try {
    // 인증 처리
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    console.log("인증 헤더 확인:", authHeader ? "있음" : "없음");

    let userEmail = DEV_MODE ? "test@example.com" : null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7).trim();
        const decoded = jwt.decode(token);
        console.log("디코딩된 토큰:", decoded);

        if (decoded?.email) {
          userEmail = decoded.email;
        } else {
          console.warn("토큰에 email 없음");
        }
      } catch (err) {
        console.error("JWT 디코딩 오류:", err.message);
      }
    }

    userEmail = userEmail || "jhh333210@gmail.com";
    console.log("사용자 이메일:", userEmail);

    // Query 수행
    const queryCmd = new QueryCommand({
      TableName: SAVED_PLANS_TABLE,
      KeyConditionExpression: "user_id = :uid",
      ExpressionAttributeValues: {
        ":uid": userEmail
      },
      ProjectionExpression: "plan_id, #nm, last_updated, paid_plan",
      ExpressionAttributeNames: {
        "#nm": "name" // alias 정의
      },
      ScanIndexForward: false
    });
    

    const result = await docClient.send(queryCmd);
    console.log("조회 결과:", JSON.stringify(result.Items));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        plans: result.Items || []
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
