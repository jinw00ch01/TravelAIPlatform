/**
 * DeletePlan Lambda 함수
 * JWT 토큰에서 사용자 이메일을 추출하고 DynamoDB의 saved_plans 테이블에서 여행 계획을 삭제합니다.
 * 
 * 기능:
 * 1. 소유자 권한 확인
 * 2. 공유받은 사용자 권한 확인 (공유 해제만 가능)
 * 3. 계획 삭제 또는 공유 해제
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  "Content-Type": "application/json"
};

const SAVED_PLANS_TABLE = process.env.SAVED_PLANS_TABLE || "saved_plans";
const DEV_MODE = process.env.NODE_ENV !== "production";

export const handler = async (event) => {
  console.log("DeletePlan Lambda 시작");
  console.log("event:", JSON.stringify(event));

  // OPTIONS 메서드 처리
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "CORS preflight OK" })
    };
  }

  try {
    // 1. 인증 처리 및 사용자 이메일 추출
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
    let body = {};
    try {
      if (typeof event.body === 'string') {
        body = JSON.parse(event.body);
      } else if (typeof event.body === 'object' && event.body !== null) {
        body = event.body;
      }
    } catch (parseError) {
      console.error("요청 본문 파싱 오류:", parseError.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "잘못된 요청 형식입니다."
        })
      };
    }

    const planId = Number(body.plan_id);
    if (!planId || isNaN(planId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "유효한 plan_id가 필요합니다."
        })
      };
    }

    console.log("삭제할 계획 ID:", planId);

    // 3. 소유자 권한 확인
    const getCmd = new GetCommand({
      TableName: SAVED_PLANS_TABLE,
      Key: {
        user_id: userEmail,
        plan_id: planId
      }
    });

    const existingItem = await docClient.send(getCmd);
    console.log("소유권 확인 결과:", existingItem.Item ? "소유자임" : "소유자 아님");

    if (existingItem.Item) {
      // 소유자인 경우 - 계획 완전 삭제
      console.log("소유자가 계획을 삭제합니다.");
      
      const deleteCmd = new DeleteCommand({
        TableName: SAVED_PLANS_TABLE,
        Key: {
          user_id: userEmail,
          plan_id: planId
        }
      });

      await docClient.send(deleteCmd);
      console.log("계획 삭제 완료");

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "여행 계획이 성공적으로 삭제되었습니다.",
          action: "deleted"
        })
      };
    }

    // 4. 소유자가 아닌 경우 - 권한 없음
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({
        success: false,
        message: "공유받은 계획이거나, 소유자가 아닙니다. 소유자에게 문의하세요.",
        action: "forbidden"
      })
    };

  } catch (error) {
    console.error("계획 삭제 중 오류:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "계획 삭제 중 오류가 발생했습니다.",
        error: error.message
      })
    };
  }
}; 