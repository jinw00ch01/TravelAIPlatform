import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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
  console.log("GetPlans Lambda 시작 (공유 계획 포함)");
  console.log("event:", JSON.stringify(event));

  // OPTIONS 메서드 처리
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

    // 1. 사용자 소유 계획 조회
    const ownPlansQuery = new QueryCommand({
      TableName: SAVED_PLANS_TABLE,
      KeyConditionExpression: "user_id = :uid",
      ExpressionAttributeValues: {
        ":uid": userEmail
      },
      ProjectionExpression: "plan_id, #nm, last_updated, paid_plan, shared_email",
      ExpressionAttributeNames: {
        "#nm": "name"
      },
      ScanIndexForward: false
    });

    console.log("사용자 소유 계획 조회 중...");
    const ownPlansResult = await docClient.send(ownPlansQuery);
    const ownPlans = (ownPlansResult.Items || []).map(plan => ({
      ...plan,
      is_shared_with_me: false,
      original_owner: userEmail
    }));

    console.log("사용자 소유 계획:", ownPlans.length, "개");

    // 2. 공유받은 계획 조회 - scan 방식으로 변경
    let sharedPlans = [];
    
    try {
      console.log("공유받은 계획 조회 시작 (scan 방식)");
      console.log("현재 사용자 이메일:", userEmail);
      
      // shared_email 필드에서 현재 사용자 이메일을 포함하는 모든 계획 검색
      const scanCmd = new ScanCommand({
        TableName: SAVED_PLANS_TABLE,
        FilterExpression: "attribute_exists(shared_email) AND shared_email <> :empty AND contains(shared_email, :email)",
        ExpressionAttributeValues: {
          ":empty": "",
          ":email": userEmail
        },
        ProjectionExpression: "plan_id, #nm, last_updated, paid_plan, shared_email, user_id",
        ExpressionAttributeNames: {
          "#nm": "name"
        }
      });
      
      console.log("전체 테이블에서 공유 계획 검색 중...");
      const scanResult = await docClient.send(scanCmd);
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        console.log(`스캔에서 ${scanResult.Items.length}개의 공유 계획 발견`);
        
        // shared_email 필드를 쉼표로 분리하여 정확히 일치하는지 확인
        const filteredPlans = scanResult.Items.filter(plan => {
          if (!plan.shared_email) return false;
          
          const sharedEmails = plan.shared_email.split(',').map(email => email.trim());
          const isShared = sharedEmails.includes(userEmail);
          
          if (isShared) {
            console.log(`✅ 공유 계획 확인: ${plan.plan_id} (${plan.name}) - 소유자: ${plan.user_id}`);
            console.log(`   공유된 이메일들: ${plan.shared_email}`);
          }
          
          return isShared;
        });
        
        sharedPlans = filteredPlans.map(plan => ({
          ...plan,
          is_shared_with_me: true,
          original_owner: plan.user_id
        }));
        
        console.log(`최종 필터링된 공유 계획: ${sharedPlans.length}개`);
      } else {
        console.log("스캔에서 공유받은 계획 없음");
      }

      console.log("최종 공유받은 계획:", sharedPlans.length, "개");
    } catch (sharedError) {
      console.error("공유받은 계획 조회 실패:", sharedError.message);
    }

    // 3. 결과 합치기
    const allPlans = [...ownPlans, ...sharedPlans];
    
    // 최신 업데이트 순으로 정렬
    allPlans.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));

    console.log("전체 계획 수:", allPlans.length, "개 (소유:", ownPlans.length, "개, 공유:", sharedPlans.length, "개)");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        plans: allPlans,
        counts: {
          own: ownPlans.length,
          shared: sharedPlans.length,
          total: allPlans.length
        },
        // 디버깅 정보 추가
        debug: {
          userEmail: userEmail,
          ownPlansCount: ownPlans.length,
          sharedPlansCount: sharedPlans.length
        }
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
