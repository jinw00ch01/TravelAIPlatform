import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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
  console.log("GetSinglePlan Lambda 시작 (공유 계획 지원)");
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
    console.log("사용자 이메일:", userEmail);

    const body = JSON.parse(event.body || "{}");
    const planId = body.plan_id;
    const planIds = body.plan_ids;
    
    // 다중 plan_id 요청인지 확인
    if (Array.isArray(planIds) && planIds.length > 0) {
      console.log("다중 계획 조회 요청:", planIds);
      return await handleBatchGetPlans(userEmail, planIds);
    }
  
    // 기존 단일 plan_id 처리 로직
    if (!planId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: "plan_id가 필요합니다." })
      };
    }

    console.log("단일 계획 조회 요청 - plan_id:", planId);
    return await handleSinglePlanGet(userEmail, Number(planId));

  } catch (err) {
    console.error("조회 실패:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: "조회 중 오류 발생", error: err.message })
    };
  }
};

// 다중 계획 조회 함수
async function handleBatchGetPlans(userEmail, planIds) {
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
  
  const ownPlans = result.Responses?.[SAVED_PLANS_TABLE] || [];
  console.log("사용자 소유 계획 조회 결과:", ownPlans.length, "개");

  // 조회되지 않은 계획들에 대해 공유 계획인지 확인
  const foundPlanIds = ownPlans.map(plan => plan.plan_id);
  const missingPlanIds = planIds.filter(id => !foundPlanIds.includes(Number(id)));
  
  let sharedPlans = [];
  if (missingPlanIds.length > 0) {
    console.log("공유 계획 확인 필요한 plan_id들:", missingPlanIds);
    
    // 공유된 계획 조회
    const sharedPlanQuery = new ScanCommand({
      TableName: SAVED_PLANS_TABLE,
      FilterExpression: "attribute_exists(shared_email) AND shared_email <> :empty",
      ExpressionAttributeValues: {
        ":empty": ""
      }
    });

    const sharedResult = await docClient.send(sharedPlanQuery);
    
    // shared_email 필드를 쉼표로 분리하여 정확히 일치하는지 확인하고 missingPlanIds에 포함된 것만 필터링
    const filteredSharedPlans = (sharedResult.Items || []).filter(plan => {
      if (!plan.shared_email || !missingPlanIds.includes(plan.plan_id)) return false;
      
      // 자신이 소유한 계획은 제외
      if (plan.user_id === userEmail) return false;
      
      const sharedEmails = plan.shared_email.split(',').map(email => email.trim());
      const isShared = sharedEmails.includes(userEmail);
      
      if (isShared) {
        console.log(`✅ 공유 계획 확인: ${plan.plan_id} (${plan.name}) - 소유자: ${plan.user_id}`);
        console.log(`   공유된 이메일들: ${plan.shared_email}`);
      }
      
      return isShared;
    });
    
    sharedPlans = filteredSharedPlans;
    
    console.log("공유된 계획 조회 결과:", sharedPlans.length, "개");
  }

  const allPlans = [...ownPlans, ...sharedPlans];
  console.log("전체 다중 계획 조회 결과:", allPlans.length, "개");
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      plans: allPlans,
      single_request: false
    })
  };
}

// 단일 계획 조회 함수
async function handleSinglePlanGet(userEmail, planId) {
  // 1. 먼저 사용자 소유 계획인지 확인
  const queryCmd = new QueryCommand({
    TableName: SAVED_PLANS_TABLE,
    KeyConditionExpression: "user_id = :uid and plan_id = :pid",
    ExpressionAttributeValues: {
      ":uid": userEmail,
      ":pid": planId
    }
  });

  const ownPlanResult = await docClient.send(queryCmd);
  
  if (ownPlanResult.Items && ownPlanResult.Items.length > 0) {
    console.log("사용자 소유 계획 발견");
    const plan = ownPlanResult.Items[0];
    
    // 디버깅 로그 추가
    console.log("DynamoDB 쿼리 결과:", JSON.stringify(ownPlanResult, null, 2));
    console.log("첫 번째 아이템 키들:", Object.keys(plan));
    console.log("name 필드 값:", plan.name);
    console.log("plan_id 필드 값:", plan.plan_id);
    console.log("shared_email 필드 값:", plan.shared_email);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        plan: plan,
        single_request: true,
        is_shared_with_me: false
      })
    };
  }

  // 2. 소유 계획이 아니면 공유된 계획인지 확인
  console.log("소유 계획이 아님. 공유 계획 확인 중...");
  
  const sharedPlanQuery = new ScanCommand({
    TableName: SAVED_PLANS_TABLE,
    FilterExpression: "plan_id = :pid AND attribute_exists(shared_email) AND shared_email <> :empty",
    ExpressionAttributeValues: {
      ":pid": planId,
      ":empty": ""
    }
  });

  const sharedResult = await docClient.send(sharedPlanQuery);
  
  if (sharedResult.Items && sharedResult.Items.length > 0) {
    // shared_email 필드를 쉼표로 분리하여 정확히 일치하는지 확인
    const matchingPlan = sharedResult.Items.find(plan => {
      if (!plan.shared_email) return false;
      
      // 자신이 소유한 계획은 제외
      if (plan.user_id === userEmail) return false;
      
      const sharedEmails = plan.shared_email.split(',').map(email => email.trim());
      const isShared = sharedEmails.includes(userEmail);
      
      if (isShared) {
        console.log(`✅ 공유 계획 확인: ${plan.plan_id} (${plan.name}) - 소유자: ${plan.user_id}`);
        console.log(`   공유된 이메일들: ${plan.shared_email}`);
      }
      
      return isShared;
    });
    
    if (matchingPlan) {
      console.log("공유된 계획 발견");
      
      console.log("공유 계획 세부 정보:");
      console.log("원래 소유자:", matchingPlan.user_id);
      console.log("shared_email:", matchingPlan.shared_email);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          plan: matchingPlan,
          single_request: true,
          is_shared_with_me: true,
          original_owner: matchingPlan.user_id
        })
      };
    }
  }

  // 3. 계획을 찾을 수 없음
  console.log("계획을 찾을 수 없음 - plan_id:", planId);
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({
      success: false,
      message: "해당 여행 계획을 찾을 수 없거나 접근 권한이 없습니다.",
      plan: null,
      single_request: true
    })
  };
}
