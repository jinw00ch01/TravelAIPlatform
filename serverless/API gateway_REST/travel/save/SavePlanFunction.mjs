/**
 * SavePlan Lambda 함수
 * JWT 토큰에서 사용자 이메일을 추출하고 DynamoDB의 saved_plans 테이블에 새로운 여행 계획을 저장하거나 기존 계획을 수정합니다.
 * 
 * 기능:
 * 1. 새로운 여행 계획 저장 (기존 기능)
 * 2. 기존 여행 계획 수정 (plan_id 제공시)
 * 3. shared_email 공유 기능
 * 4. 부분 업데이트 (plan_data, shared_email, paid_plan 개별 수정)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
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
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json"
};

const SAVED_PLANS_TABLE = process.env.SAVED_PLANS_TABLE || "saved_plans";
// 개발 모드 여부 (테스트용)
const DEV_MODE = process.env.NODE_ENV !== "production";

// DynamoDB 형식의 객체를 일반 JavaScript 객체로 변환하는 함수
function convertDynamoDBToJS(item) {
  if (!item) return null;
  
  // 객체가 아닌 경우 그대로 반환
  if (typeof item !== 'object') return item;
  
  // 배열인 경우 각 요소를 재귀적으로 변환
  if (Array.isArray(item)) {
    return item.map(element => convertDynamoDBToJS(element));
  }
  
  // DynamoDB 형식인지 확인 (S, N, BOOL, M, L 키가 있는지)
  const keys = Object.keys(item);
  if (keys.length === 1 && ['S', 'N', 'BOOL', 'M', 'L', 'NULL'].includes(keys[0])) {
    const type = keys[0];
    const value = item[type];
    
    switch (type) {
      case 'S': return value;  // 문자열
      case 'N': return Number(value);  // 숫자
      case 'BOOL': return value;  // 불리언
      case 'NULL': return null;  // null
      case 'M': // 객체(맵)
        const result = {};
        for (const key in value) {
          result[key] = convertDynamoDBToJS(value[key]);
        }
        return result;
      case 'L': // 배열(리스트)
        return value.map(element => convertDynamoDBToJS(element));
      default:
        return value;
    }
  }
  
  // 이미 일반 JavaScript 객체인 경우 각 속성을 재귀적으로 변환
  const result = {};
  for (const key in item) {
    result[key] = convertDynamoDBToJS(item[key]);
  }
  
  return result;
}

export const handler = async (event) => {
  console.log("SavePlan Lambda 시작 v7 (수정 기능 추가)"); // 버전 표시용 로그
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
      if (event.title && event.data) {
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

    // 3. 요청 타입 확인 (새로 저장 vs 수정)
    const isUpdateRequest = body.plan_id && !isNaN(Number(body.plan_id));
    const isPartialUpdate = body.update_type && ['plan_data', 'shared_email', 'paid_plan'].includes(body.update_type);
    
    console.log("요청 타입:", {
      isUpdateRequest,
      isPartialUpdate,
      planId: body.plan_id,
      updateType: body.update_type
    });

    if (isUpdateRequest) {
      // 기존 계획 수정 로직
      return await handleUpdatePlan(userEmail, body);
    } else {
      // 새로운 계획 저장 로직 (기존 코드 유지)
      return await handleCreatePlan(userEmail, body);
    }

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

// 새로운 계획 생성 함수 (기존 로직)
async function handleCreatePlan(userEmail, body) {
  console.log("새로운 계획 저장 처리 시작");
  
  // paid_plan 숫자 처리
  let paidPlan = 0;
  if (typeof body.paid_plan === 'number') {
    paidPlan = body.paid_plan;
    console.log("받은 paid_plan:", paidPlan);
  } else {
    console.log("paid_plan이 숫자가 아니거나 없음. 기본값 0 사용");
  }
  
  // 데이터 구조 확인 - title과 data가 있는지 체크
  let title = "기본 여행 계획", data = {};
  
  if (body.title && body.data) {
    title = body.title;
    data = body.data;
    console.log("정상 구조 - title, data 필드 발견");
  } else if (body.plans && body.name) {
    // 이전 코드 호환성 유지
    title = body.name;
    data = body.plans;
    console.log("이전 구조 - plans, name 필드 발견. 변환 완료");
  } else {
    console.error("경고: 필수 필드(title/data 또는 name/plans)가 없습니다");
    console.log("사용 가능한 필드:", Object.keys(body));
    
    // 테스트 데이터 생성 (개발 모드에서만)
    if (DEV_MODE) {
      title = "테스트 여행 계획";
      data = { 1: { title: "1일차", schedules: [] } };
      console.log("개발 모드: 테스트 데이터 사용");
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: "필수 필드가 누락되었습니다. title과 data(또는 name과 plans)가 필요합니다." 
        })
      };
    }
  }
  
  console.log("처리할 데이터:", { title, dataLength: data ? Object.keys(data).length : 0 });

  const now = new Date().toISOString();

  // 현재 사용자의 plan 개수를 조회
  const queryCmd = new QueryCommand({
    TableName: SAVED_PLANS_TABLE,
    KeyConditionExpression: "user_id = :uid",
    ExpressionAttributeValues: {
      ":uid": userEmail
    }
  });

  console.log("쿼리 명령 생성됨:", JSON.stringify(queryCmd));
  
  try {
    const queryResult = await docClient.send(queryCmd);
    console.log("쿼리 결과:", JSON.stringify(queryResult));      
    
    function generateTimeBased8DigitId() {
      const now = Date.now(); // 예: 1715947533457
      const timePart = now % 10000000; // 마지막 7자리 (시간 순서)
      const randomDigit = Math.floor(Math.random() * 10); // 0~9 하나 추가
      return Number(`${timePart}${randomDigit}`); // 8자리 숫자
    }
    
    const planId = generateTimeBased8DigitId();
    console.log("생성할 planId:", planId);

    // 데이터 준비 - 항공편과 일정 분리하기
    // NaN, Infinity 등 직렬화 불가능한 값 처리
    const cleanData = (obj) => {
      if (obj === null || obj === undefined) return obj;
      try {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
          if (typeof value === 'number' && !Number.isFinite(value)) {
            return null;
          }
          return value;
        }));
      } catch (e) {
        console.warn("데이터 정리 중 오류:", e.message);
        return obj;
      }
    };

    // 항공편 데이터 분리 및 처리
    let flightDetails = [];
    
    // DynamoDB 형식인지 확인 - 배열 형태의 항공편 데이터인 경우
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      const keys = Object.keys(data[0]);
      if (keys.length === 1 && keys[0] === 'M') {
        console.log("DynamoDB 형식의 항공편 데이터 감지됨, 변환 시도...");
        flightDetails = convertDynamoDBToJS(data);
      } else {
        // 일반 항공편 데이터
        flightDetails = data;
      }
    } 
    // 일정 데이터 내에서 항공편 정보가 있는 경우 (기존 구조)
    else if (typeof data === 'object' && !Array.isArray(data)) {
      // 일정 데이터의 경우 - 일자별 데이터에서 항공편 정보 추출
      const schedules = [];
      
      Object.keys(data).forEach(day => {
        if (data[day].schedules && Array.isArray(data[day].schedules)) {
          data[day].schedules.forEach(schedule => {
            if (schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return') {
              // 항공편 정보 추출
              flightDetails.push({
                ...schedule,
                day: parseInt(day, 10)
              });
            } else {
              // 일반 일정 정보 추가
              schedules.push({
                ...schedule,
                day: parseInt(day, 10)
              });
            }
          });
        }
      });
      
      // 일정 데이터가 없는 경우 기존 데이터 그대로 사용
      if (schedules.length === 0) {
        console.log("일정 내 항공편 정보 추출 실패, 전체 데이터 저장");
      }
    }
    
    const itemToSave = {
      user_id: userEmail,
      plan_id: planId,
      name: title,
      paid_plan: paidPlan,
      // 기존 추출된 flightDetails가 아니라, body.flightInfo를 우선 저장
      flight_details: body.flightInfo && (Array.isArray(body.flightInfo) ? body.flightInfo.length > 0 : !!body.flightInfo)
        ? JSON.stringify(body.flightInfo)
        : JSON.stringify(cleanData(flightDetails)),
      itinerary_schedules: JSON.stringify(cleanData(data)),
      // 숙소 정보 저장 추가
      accmo_info: body.accommodationInfo ? JSON.stringify(cleanData(body.accommodationInfo)) : null,
      // shared_email 필드 추가
      shared_email: body.shared_email || null,
      last_updated: now
    };

    console.log("DynamoDB에 저장할 최종 아이템 구조:", Object.keys(itemToSave));
    console.log("저장될 shared_email 값:", itemToSave.shared_email);
    
    const putCmd = new PutCommand({
      TableName: SAVED_PLANS_TABLE,
      Item: itemToSave
    });
    
    await docClient.send(putCmd);
    console.log("DynamoDB 저장 완료.");

    // 공유 이메일이 있는 경우 공유 참조 아이템들 생성
    if (body.shared_email && body.shared_email.trim()) {
      console.log("공유 참조 아이템 생성 시작");
      await createSharedReferences(userEmail, planId, body.shared_email);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "여행 계획이 성공적으로 저장되었습니다.",
        plan_id: planId
      })
    };
  } catch (putError) {
    console.error("데이터 저장 중 오류:", putError);
    console.error("오류 세부 정보:", JSON.stringify({
      code: putError.code,
      name: putError.name,
      message: putError.message,
      requestId: putError.$metadata?.requestId,
      cfId: putError.$metadata?.cfId
    }));
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        message: "데이터 저장 중 오류가 발생했습니다.",
        error: putError.message,
        errorCode: putError.code || putError.name
      })
    };
  }
}

// 기존 계획 수정 함수
async function handleUpdatePlan(userEmail, body) {
  console.log("기존 계획 수정 처리 시작");
  
  const planId = Number(body.plan_id);
  const updateType = body.update_type;
  const now = new Date().toISOString();

  try {
    // 1. 기존 계획 존재 여부 및 권한 확인
    const getCmd = new GetCommand({
      TableName: SAVED_PLANS_TABLE,
      Key: {
        user_id: userEmail,
        plan_id: planId
      }
    });

    const existingItem = await docClient.send(getCmd);
    
    if (!existingItem.Item) {
      // 현재 사용자 소유가 아닌 경우, shared_email로 접근 권한 확인
      const querySharedCmd = new QueryCommand({
        TableName: SAVED_PLANS_TABLE,
        FilterExpression: "plan_id = :pid AND (contains(shared_email, :email) OR shared_email = :email)",
        ExpressionAttributeValues: {
          ":pid": planId,
          ":email": userEmail
        }
      });

      const sharedResult = await docClient.send(querySharedCmd);
      
      if (!sharedResult.Items || sharedResult.Items.length === 0) {
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
  let updateExpression = "SET last_updated = :now";
  let expressionAttributeValues = { ":now": now };
  let expressionAttributeNames = {};

  // NaN, Infinity 등 직렬화 불가능한 값 처리
  const cleanData = (obj) => {
    if (obj === null || obj === undefined) return obj;
    try {
      return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) {
          return null;
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
    
    if (body.flightInfo) {
      updateExpression += ", flight_details = :flight";
      expressionAttributeValues[":flight"] = JSON.stringify(cleanData(body.flightInfo));
    }
    
    if (body.accommodationInfo) {
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
    
    // 공유 참조 아이템들도 업데이트
    await updateSharedReferences(userId, planId, body.shared_email);
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
    
    if (body.flightInfo) {
      updateExpression += ", flight_details = :flight";
      expressionAttributeValues[":flight"] = JSON.stringify(cleanData(body.flightInfo));
    }
    
    if (body.accommodationInfo) {
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

// 공유 참조 아이템 생성 함수
async function createSharedReferences(originalOwner, planId, sharedEmailString) {
  if (!sharedEmailString || !sharedEmailString.trim()) {
    console.log("공유할 이메일이 없음");
    return;
  }

  // 쉼표로 분리된 이메일들 처리
  const emailList = sharedEmailString.split(',')
    .map(email => email.trim())
    .filter(email => email && email.includes('@'));

  console.log(`${emailList.length}개의 이메일에 대한 공유 참조 생성:`, emailList);

  // 기존 공유 참조 아이템들 삭제
  await deleteExistingSharedReferences(originalOwner, planId);

  // 새로운 공유 참조 아이템들 생성
  for (const email of emailList) {
    try {
      const sharedRefItem = {
        user_id: "shared_reference",
        plan_id: `${originalOwner}#${planId}`,
        shared_to_email: email,
        original_owner: originalOwner,
        original_plan_id: planId,
        type: "shared_reference",
        created_at: new Date().toISOString()
      };

      const putRefCmd = new PutCommand({
        TableName: SAVED_PLANS_TABLE,
        Item: sharedRefItem
      });

      await docClient.send(putRefCmd);
      console.log(`공유 참조 생성 완료: ${email} -> ${originalOwner}#${planId}`);
    } catch (error) {
      console.error(`공유 참조 생성 실패 (${email}):`, error.message);
    }
  }
}

// 기존 공유 참조 아이템 삭제 함수
async function deleteExistingSharedReferences(originalOwner, planId) {
  try {
    console.log(`기존 공유 참조 삭제 시작: ${originalOwner}#${planId}`);
    
    // 기존 공유 참조 아이템들 조회
    const queryCmd = new QueryCommand({
      TableName: SAVED_PLANS_TABLE,
      KeyConditionExpression: "user_id = :uid",
      FilterExpression: "original_owner = :owner AND original_plan_id = :pid",
      ExpressionAttributeValues: {
        ":uid": "shared_reference",
        ":owner": originalOwner,
        ":pid": planId
      }
    });

    const existingRefs = await docClient.send(queryCmd);
    
    if (existingRefs.Items && existingRefs.Items.length > 0) {
      console.log(`${existingRefs.Items.length}개의 기존 공유 참조 발견`);
      
      // 각 참조 아이템 삭제
      for (const refItem of existingRefs.Items) {
        try {
          const deleteRefCmd = new DeleteCommand({
            TableName: SAVED_PLANS_TABLE,
            Key: {
              user_id: refItem.user_id,
              plan_id: refItem.plan_id
            }
          });
          
          await docClient.send(deleteRefCmd);
          console.log(`공유 참조 삭제 완료: ${refItem.plan_id}`);
        } catch (deleteError) {
          console.error(`공유 참조 삭제 실패 (${refItem.plan_id}):`, deleteError.message);
        }
      }
    } else {
      console.log("삭제할 기존 공유 참조 없음");
    }
  } catch (error) {
    console.error("기존 공유 참조 삭제 중 오류:", error.message);
  }
}

// 공유 이메일 업데이트 시 참조 아이템들도 업데이트
async function updateSharedReferences(originalOwner, planId, newSharedEmailString) {
  console.log("공유 참조 업데이트 시작");
  
  // 기존 참조들 삭제
  await deleteExistingSharedReferences(originalOwner, planId);
  
  // 새로운 참조들 생성
  if (newSharedEmailString && newSharedEmailString.trim()) {
    await createSharedReferences(originalOwner, planId, newSharedEmailString);
  }
  
  console.log("공유 참조 업데이트 완료");
} 
