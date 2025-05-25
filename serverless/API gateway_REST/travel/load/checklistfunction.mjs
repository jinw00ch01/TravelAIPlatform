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

    // 2. 공유받은 계획 조회 - 하이브리드 방식
    let sharedPlans = [];
    
    try {
      console.log("공유받은 계획 조회 시작 (하이브리드)");
      console.log("현재 사용자 이메일:", userEmail);
      
      // 1) 먼저 새로운 GSI 방식 시도
      const sharedRefQuery = new QueryCommand({
        TableName: SAVED_PLANS_TABLE,
        IndexName: "SharedToEmailIndex",
        KeyConditionExpression: "shared_to_email = :email",
        ExpressionAttributeValues: {
          ":email": userEmail
        },
        ProjectionExpression: "original_owner, original_plan_id, #typ, created_at",
        ExpressionAttributeNames: {
          "#typ": "type"
        }
      });
      
      console.log("GSI를 사용한 공유 참조 조회 중...");
      const sharedRefResult = await docClient.send(sharedRefQuery);
      
      if (sharedRefResult.Items && sharedRefResult.Items.length > 0) {
        console.log(`${sharedRefResult.Items.length}개의 공유 참조 발견`);
        
        // 각 공유 참조에 대해 원본 계획 정보 조회
        for (const refItem of sharedRefResult.Items) {
          try {
            const originalPlanQuery = new GetCommand({
              TableName: SAVED_PLANS_TABLE,
              Key: {
                user_id: refItem.original_owner,
                plan_id: refItem.original_plan_id
              },
              ProjectionExpression: "plan_id, #nm, last_updated, paid_plan, shared_email, user_id",
              ExpressionAttributeNames: {
                "#nm": "name"
              }
            });
            
            const originalPlanResult = await docClient.send(originalPlanQuery);
            
            if (originalPlanResult.Item) {
              const sharedPlan = {
                ...originalPlanResult.Item,
                is_shared_with_me: true,
                original_owner: refItem.original_owner,
                shared_at: refItem.created_at
              };
              
              sharedPlans.push(sharedPlan);
              console.log(`공유 계획 추가: ${sharedPlan.plan_id} (${sharedPlan.name}) - 소유자: ${refItem.original_owner}`);
            }
          } catch (planQueryError) {
            console.error(`원본 계획 조회 실패:`, planQueryError.message);
          }
        }
      }

      // 2) GSI에서 찾지 못했으면 기존 방식으로 fallback (모든 계획 검색)
      if (sharedPlans.length === 0) {
        console.log("GSI에서 공유받은 계획 없음. 전체 테이블 스캔으로 fallback...");
        
        try {
          // shared_email이 있는 모든 계획을 스캔
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
            console.log(`전체 스캔에서 ${scanResult.Items.length}개의 공유 계획 발견`);
            
            sharedPlans = scanResult.Items.map(plan => ({
              ...plan,
              is_shared_with_me: true,
              original_owner: plan.user_id
            }));
            
            sharedPlans.forEach(plan => {
              console.log(`✅ 공유 계획: ${plan.plan_id} (${plan.name}) - 소유자: ${plan.user_id}`);
            });
          } else {
            console.log("전체 스캔에서도 공유받은 계획 없음");
          }
        } catch (scanError) {
          console.error("전체 스캔 실패:", scanError.message);
        }
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
