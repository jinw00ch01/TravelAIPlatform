/**
 * ChangePlanFunction_NEW Lambda 함수
 * JWT 토큰에서 사용자 이메일을 추출하고 DynamoDB의 saved_plans 테이블에서 기존 여행 계획만 수정합니다.
 * 
 * 기능:
 * 1. 기존 여행 계획 수정만 담당 (저장 기능 제거)
 * 2. shared_email 공유 기능 포함
 * 3. 부분 업데이트 (plan_data, shared_email, paid_plan 개별 수정)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });

// DynamoDB 문서 클라이언트 생성 시 marshallOptions 옵션 추가
const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false
};

// 문서 클라이언트 생성 시 옵션 지정 - JSON을 원형 그대로 유지하도록 설정
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions
});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "POST,PUT,OPTIONS",
  "Content-Type": "application/json"
};

const SAVED_PLANS_TABLE = process.env.SAVED_PLANS_TABLE || "saved_plans";
// 개발 모드 여부 (테스트용)
const DEV_MODE = process.env.NODE_ENV !== "production";

// 숙박편 데이터 최적화 함수
function optimizeAccommodationData(accommodationData) {
  if (!accommodationData) return accommodationData;
  
  const optimized = { ...accommodationData };
  
  // 호텔 정보 최적화
  if (optimized.hotel) {
    const hotel = { ...optimized.hotel };
    
    // 불필요한 필드 제거
    delete hotel.review_nr; // 리뷰 수는 필수가 아님
    delete hotel.distance_to_center; // 거리 정보는 간소화
    
    optimized.hotel = hotel;
  }
  
  // 객실 정보 최적화
  if (optimized.room) {
    const room = { ...optimized.room };
    
    // 사진은 최대 2개만 유지
    if (room.photos && Array.isArray(room.photos)) {
      room.photos = room.photos.slice(0, 2);
    }
    
    // 시설 정보는 최대 5개만 유지
    if (room.facilities && Array.isArray(room.facilities)) {
      room.facilities = room.facilities.slice(0, 5);
    }
    
    // 긴 설명 제한
    if (room.description && room.description.length > 200) {
      room.description = room.description.substring(0, 200) + '...';
    }
    
    // 불필요한 상세 정보 제거
    delete room.priceBreakdown;
    delete room.blockInfo;
    delete room.highlights;
    
    optimized.room = room;
  }
  
  return optimized;
}

export const handler = async (event) => {
  console.log("ChangePlanFunction_NEW Lambda 시작 v1.0 (수정 전용)"); // 버전 표시용 로그
  console.log("event:", JSON.stringify(event));
  console.log("SAVED_PLANS_TABLE:", SAVED_PLANS_TABLE);
  console.log("개발 모드:", DEV_MODE ? "활성화" : "비활성화");

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

    // 개발 모드에서는 테스트 이메일을 기본값으로 설정
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

    // 항상 테스트 이메일 사용 (임시 해결책)
    userEmail = userEmail || "test@example.com";
    console.log("사용할 이메일:", userEmail);

    // 2. 요청 본문 파싱
    let body = {};
    try {
      // 다양한 입력 형식 처리
      if (event.plan_id) {
        // event 자체가 body인 경우 (테스트 이벤트나 특정 API 호출 형식)
        body = event;
        console.log("event 자체가 body인 케이스");
      } else if (typeof event.body === 'string') {
        // 문자열로 전달된 JSON (일반적인 API Gateway -> Lambda 형식)
        try {
          body = JSON.parse(event.body);
          console.log("문자열 body를 파싱 성공");
        } catch (jsonError) {
          console.error("JSON 파싱 오류:", jsonError.message);
          // 기본 빈 객체 유지
          body = {};
        }
      } else if (typeof event.body === 'object' && event.body !== null) {
        // 이미 객체로 파싱된 경우
        body = event.body;
        console.log("객체 body 사용");
      } else {
        console.error("적절한 요청 본문을 찾을 수 없음:", JSON.stringify(event));
        // 기본 빈 객체 설정
        body = {};
      }
      
      // body가 null이거나 undefined인 경우 빈 객체로 초기화
      if (!body) body = {};
      
      console.log("요청 본문 파싱 결과:", JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error("요청 본문 파싱 오류:", parseError.message, "원본 이벤트:", JSON.stringify(event));
      // 오류 발생 시 빈 객체로 설정
      body = {};
    }

    // body 유효성 검증 (null이나 undefined가 아닌지 확인)
    if (!body || typeof body !== 'object') {
      body = {}; // null이나 undefined인 경우 빈 객체로 초기화
    }

    console.log("body의 키들:", Object.keys(body));

    // 3. plan_id 필수 확인 (수정 전용 함수)
    if (!body.plan_id || isNaN(Number(body.plan_id))) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "이 함수는 기존 계획 수정만 지원합니다. plan_id가 필요합니다. 새로운 계획 저장은 Save_NEW API를 사용해주세요.",
          redirect_api: "/api/travel/Save_NEW"
        })
      };
    }

    // 4. 기존 계획 수정 처리
    return await handleUpdatePlan(userEmail, body);

  } catch (error) {
    console.error("일반 오류:", error);
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

// 기존 계획 수정 함수
async function handleUpdatePlan(userEmail, body) {
  console.log("기존 계획 수정 처리 시작");
  
  const planId = Number(body.plan_id);
  const updateType = body.update_type;
  const now = new Date().toISOString();

  try {
    // 1. 기존 계획 존재 여부 및 권한 확인
    console.log("소유권 확인 시도:", { userEmail, planId });
    const getCmd = new GetCommand({
      TableName: SAVED_PLANS_TABLE,
      Key: {
        user_id: userEmail,
        plan_id: planId
      }
    });

    const existingItem = await docClient.send(getCmd);
    console.log("소유권 확인 결과:", existingItem.Item ? "소유자임" : "소유자 아님");
    
    if (!existingItem.Item) {
      // 현재 사용자 소유가 아닌 경우, scan을 사용하여 공유받은 계획인지 확인
      console.log("소유자가 아님. scan으로 공유받은 계획 확인 중...");
      
      const sharedPlanQuery = new ScanCommand({
        TableName: SAVED_PLANS_TABLE,
        FilterExpression: "plan_id = :pid AND attribute_exists(shared_email) AND shared_email <> :empty",
        ExpressionAttributeValues: {
          ":pid": planId,
          ":empty": ""
        },
        ProjectionExpression: "user_id, plan_id, shared_email"
      });
      
      console.log("scan 조회 시도:", {
        planId: planId,
        tableName: SAVED_PLANS_TABLE
      });
      
      const sharedPlanResult = await docClient.send(sharedPlanQuery);
      console.log("scan 조회 결과:", sharedPlanResult.Items?.length || 0, "개");
      
      let sharedResult = null;
      if (sharedPlanResult.Items && sharedPlanResult.Items.length > 0) {
        console.log("발견된 계획들:", JSON.stringify(sharedPlanResult.Items, null, 2));
        
        // shared_email 필드를 쉼표로 분리하여 정확히 일치하는지 확인
        const matchingPlan = sharedPlanResult.Items.find(plan => {
          if (!plan.shared_email) return false;
          
          // 자신이 소유한 계획은 제외
          if (plan.user_id === userEmail) return false;
          
          const sharedEmails = plan.shared_email.split(',').map(email => email.trim());
          const isShared = sharedEmails.includes(userEmail);
          
          if (isShared) {
            console.log(`✅ 공유 계획 확인: ${plan.plan_id} - 소유자: ${plan.user_id}`);
            console.log(`   공유된 이메일들: ${plan.shared_email}`);
          }
          
          return isShared;
        });
        
        if (matchingPlan) {
          console.log("일치하는 공유 계획 발견:", JSON.stringify(matchingPlan, null, 2));
          
          // 원본 계획 조회
          const originalPlanQuery = new GetCommand({
            TableName: SAVED_PLANS_TABLE,
            Key: {
              user_id: matchingPlan.user_id,
              plan_id: matchingPlan.plan_id
            }
          });
          
          const originalPlanResult = await docClient.send(originalPlanQuery);
          if (originalPlanResult.Item) {
            sharedResult = { Items: [originalPlanResult.Item] };
            console.log("원본 계획 조회 성공");
          }
        } else {
          console.log("현재 사용자와 일치하는 공유 계획 없음");
        }
      }
      
      if (!sharedResult || !sharedResult.Items || sharedResult.Items.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: "해당 여행 계획을 찾을 수 없거나 수정 권한이 없습니다."
          })
        };
      }
      
      // 공유받은 사용자가 shared_email을 수정하려고 하는 경우 차단
      if (updateType === 'shared_email' || (body.shared_email !== undefined && updateType !== 'plan_data')) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            message: "공유 설정은 원래 소유자만 수정할 수 있습니다. 공유자에게 문의하세요.",
            owner_email: sharedResult.Items[0].user_id
          })
        };
      }
      
      // shared_email로 접근하는 경우, 원래 소유자의 user_id 사용 (계획 데이터만 수정 가능)
      const originalOwner = sharedResult.Items[0].user_id;
      return await performUpdate(originalOwner, planId, body, updateType, now, true); // isSharedUser 플래그 추가
    } else {
      // 소유자가 직접 수정하는 경우
      return await performUpdate(userEmail, planId, body, updateType, now, false);
    }
    
  } catch (error) {
    console.error("계획 수정 중 오류:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "계획 수정 중 오류가 발생했습니다.",
        error: error.message
      })
    };
  }
}

// 실제 업데이트 수행 함수
async function performUpdate(userId, planId, body, updateType, now, isSharedUser = false) {
  console.log("performUpdate 함수 시작:", { userId, planId, updateType, isSharedUser });
  console.log("body.shared_email:", body.shared_email);
  
  let updateExpression = "SET last_updated = :now";
  let expressionAttributeValues = { ":now": now };
  let expressionAttributeNames = {};

  // NaN, Infinity 등 직렬화 불가능한 값 처리 및 데이터 최적화
  const cleanData = (obj) => {
    if (obj === null || obj === undefined) return obj;
    try {
      return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) {
          return null;
        }
        // 불필요한 필드 제거로 크기 최적화
        if (key === 'facilities' && Array.isArray(value) && value.length > 10) {
          return value.slice(0, 10); // 시설은 최대 10개만 저장
        }
        // 긴 설명 텍스트 제한
        if (typeof value === 'string' && value.length > 1000) {
          return value.substring(0, 1000) + '...';
        }
        return value;
      }));
    } catch (e) {
      console.warn("데이터 정리 중 오류:", e.message);
      return obj;
    }
  };

  if (updateType === 'plan_data') {
    // 계획 데이터만 수정
    console.log("plan_data 수정 모드");
    
    if (body.title) {
      updateExpression += ", #name = :name";
      expressionAttributeNames["#name"] = "name";
      expressionAttributeValues[":name"] = body.title;
    }
    
    if (body.data) {
      updateExpression += ", itinerary_schedules = :schedules";
      expressionAttributeValues[":schedules"] = JSON.stringify(cleanData(body.data));
    }
    
    // 다중 항공편 정보 처리
    if (body.flightInfos && Array.isArray(body.flightInfos)) {
      body.flightInfos.forEach((flightInfo, index) => {
        const fieldName = `flight_info_${index + 1}`;
        updateExpression += `, ${fieldName} = :${fieldName}`;
        expressionAttributeValues[`:${fieldName}`] = JSON.stringify(cleanData(flightInfo));
      });
      
      // 총 항공편 개수 업데이트
      if (body.totalFlights !== undefined) {
        updateExpression += ", total_flights = :totalFlights";
        expressionAttributeValues[":totalFlights"] = body.totalFlights;
      }
    } else if (body.flightInfo) {
      // 하위 호환성: 단일 항공편 정보
      updateExpression += ", flight_details = :flight";
      expressionAttributeValues[":flight"] = JSON.stringify(cleanData(body.flightInfo));
    }
    
    // 다중 숙박편 정보 처리 (최적화 적용)
    if (body.accommodationInfos && Array.isArray(body.accommodationInfos)) {
      body.accommodationInfos.forEach((accommodationInfo, index) => {
        const fieldName = `accmo_info_${index + 1}`;
        updateExpression += `, ${fieldName} = :${fieldName}`;
        const optimizedAccommodation = optimizeAccommodationData(accommodationInfo);
        expressionAttributeValues[`:${fieldName}`] = JSON.stringify(cleanData(optimizedAccommodation));
      });
      
      // 총 숙박편 개수 업데이트
      if (body.totalAccommodations !== undefined) {
        updateExpression += ", total_accommodations = :totalAccommodations";
        expressionAttributeValues[":totalAccommodations"] = body.totalAccommodations;
      }
    } else if (body.accommodationInfo) {
      // 하위 호환성: 단일 숙박편 정보
      updateExpression += ", accmo_info = :accmo";
      expressionAttributeValues[":accmo"] = JSON.stringify(cleanData(body.accommodationInfo));
    }
    
  } else if (updateType === 'shared_email') {
    // 공유 이메일만 수정 (공유받은 사용자는 수정 불가)
    if (isSharedUser) {
      throw new Error("공유받은 사용자는 공유 설정을 수정할 수 없습니다.");
    }
    
    console.log("shared_email 수정 모드");
    console.log("업데이트할 shared_email 값:", body.shared_email);
    updateExpression += ", shared_email = :shared";
    expressionAttributeValues[":shared"] = body.shared_email || null;
    
  } else if (updateType === 'paid_plan') {
    // 유료 플랜 상태만 수정
    console.log("paid_plan 수정 모드");
    updateExpression += ", paid_plan = :paid";
    expressionAttributeValues[":paid"] = Number(body.paid_plan) || 0;
    
  } else {
    // 전체 수정 (기본 모드)
    console.log("전체 수정 모드");
    
    if (body.title) {
      updateExpression += ", #name = :name";
      expressionAttributeNames["#name"] = "name";
      expressionAttributeValues[":name"] = body.title;
    }
    
    if (body.data) {
      updateExpression += ", itinerary_schedules = :schedules";
      expressionAttributeValues[":schedules"] = JSON.stringify(cleanData(body.data));
    }
    
    // 다중 항공편 정보 처리 (전체 수정 모드)
    if (body.flightInfos && Array.isArray(body.flightInfos)) {
      body.flightInfos.forEach((flightInfo, index) => {
        const fieldName = `flight_info_${index + 1}`;
        updateExpression += `, ${fieldName} = :${fieldName}`;
        expressionAttributeValues[`:${fieldName}`] = JSON.stringify(cleanData(flightInfo));
      });
      
      // 총 항공편 개수 업데이트
      if (body.totalFlights !== undefined) {
        updateExpression += ", total_flights = :totalFlights";
        expressionAttributeValues[":totalFlights"] = body.totalFlights;
      }
    } else if (body.flightInfo) {
      // 하위 호환성: 단일 항공편 정보
      updateExpression += ", flight_details = :flight";
      expressionAttributeValues[":flight"] = JSON.stringify(cleanData(body.flightInfo));
    }
    
    // 다중 숙박편 정보 처리 (전체 수정 모드, 최적화 적용)
    if (body.accommodationInfos && Array.isArray(body.accommodationInfos)) {
      body.accommodationInfos.forEach((accommodationInfo, index) => {
        const fieldName = `accmo_info_${index + 1}`;
        updateExpression += `, ${fieldName} = :${fieldName}`;
        const optimizedAccommodation = optimizeAccommodationData(accommodationInfo);
        expressionAttributeValues[`:${fieldName}`] = JSON.stringify(cleanData(optimizedAccommodation));
      });
      
      // 총 숙박편 개수 업데이트
      if (body.totalAccommodations !== undefined) {
        updateExpression += ", total_accommodations = :totalAccommodations";
        expressionAttributeValues[":totalAccommodations"] = body.totalAccommodations;
      }
    } else if (body.accommodationInfo) {
      // 하위 호환성: 단일 숙박편 정보
      updateExpression += ", accmo_info = :accmo";
      expressionAttributeValues[":accmo"] = JSON.stringify(cleanData(body.accommodationInfo));
    }
    
    if (body.shared_email !== undefined) {
      // 공유받은 사용자는 공유 설정 수정 불가
      if (isSharedUser) {
        console.log("공유받은 사용자가 shared_email 수정 시도 - 무시됨");
      } else {
        updateExpression += ", shared_email = :shared";
        expressionAttributeValues[":shared"] = body.shared_email || null;
      }
    }
    
    if (body.paid_plan !== undefined) {
      updateExpression += ", paid_plan = :paid";
      expressionAttributeValues[":paid"] = Number(body.paid_plan) || 0;
    }
  }

  const updateCmd = new UpdateCommand({
    TableName: SAVED_PLANS_TABLE,
    Key: {
      user_id: userId,
      plan_id: planId
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ...(Object.keys(expressionAttributeNames).length > 0 && {
      ExpressionAttributeNames: expressionAttributeNames
    }),
    ReturnValues: "ALL_NEW"
  });

  console.log("업데이트 명령:", JSON.stringify(updateCmd, null, 2));

  const result = await docClient.send(updateCmd);
  console.log("업데이트 완료:", JSON.stringify(result.Attributes));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: `여행 계획이 성공적으로 ${updateType ? '부분' : '전체'} 수정되었습니다.`,
      plan_id: planId,
      updated_item: result.Attributes
    })
  };
}
