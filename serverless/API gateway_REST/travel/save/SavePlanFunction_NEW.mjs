/**
 * SavePlanFunction_NEW Lambda 함수
 * JWT 토큰에서 사용자 이메일을 추출하고 DynamoDB의 saved_plans 테이블에 새로운 여행 계획만 저장합니다.
 * 
 * 기능:
 * 1. 새로운 여행 계획 저장만 담당 (수정 기능 제거)
 * 2. shared_email 공유 기능 포함
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
  console.log("SavePlanFunction_NEW Lambda 시작 v1.0 (저장 전용)"); // 버전 표시용 로그
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

    // 3. 수정 요청인지 확인하고 거부 (저장 전용 함수)
    if (body.plan_id && !isNaN(Number(body.plan_id))) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: "이 함수는 새로운 계획 저장만 지원합니다. 기존 계획 수정은 ChangePlan API를 사용해주세요.",
          redirect_api: "/api/travel/ChangePlan"
        })
      };
    }

    // 4. 새로운 계획 저장 처리
    return await handleCreatePlan(userEmail, body);

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

// 새로운 계획 생성 함수
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

    // body.data에서 숙박편과 항공편 정보 추출
    const extractedFlights = [];
    const extractedAccommodations = [];
    const cleanedScheduleData = {};
    
    console.log("데이터에서 숙박편과 항공편 정보 추출 시작");
    
    // 일정 데이터에서 숙박편과 항공편 정보 추출
    if (typeof data === 'object' && !Array.isArray(data)) {
      Object.keys(data).forEach(day => {
        if (data[day].schedules && Array.isArray(data[day].schedules)) {
          const cleanedSchedules = [];
          
          data[day].schedules.forEach(schedule => {
            // 항공편 정보 추출
            if (schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return' || schedule.type === 'Flight_OneWay') {
              if (schedule.flightOfferDetails?.flightOfferData) {
                // 중복 방지를 위한 체크
                const isDuplicate = extractedFlights.some(flight => 
                  flight.id === schedule.flightOfferDetails.flightOfferData.id
                );
                
                if (!isDuplicate) {
                  extractedFlights.push(schedule.flightOfferDetails.flightOfferData);
                  console.log(`${day}일차에서 항공편 추출:`, schedule.flightOfferDetails.flightOfferData.id);
                }
              }
            }
            // 숙박편 정보 추출
            else if (schedule.type === 'accommodation' && schedule.time === '체크인' && schedule.hotelDetails) {
              // 중복 방지를 위한 체크
              const isDuplicate = extractedAccommodations.some(acc => 
                acc.hotel?.hotel_id === schedule.hotelDetails.hotel?.hotel_id &&
                acc.checkIn === schedule.hotelDetails.checkIn
              );
              
              if (!isDuplicate) {
                extractedAccommodations.push(schedule.hotelDetails);
                console.log(`${day}일차에서 숙박편 추출:`, schedule.hotelDetails.hotel?.hotel_name);
              }
            }
            // 일반 일정은 그대로 유지 (숙박편과 항공편 제외)
            else if (schedule.type !== 'accommodation' && 
                     schedule.type !== 'Flight_Departure' && 
                     schedule.type !== 'Flight_Return' && 
                     schedule.type !== 'Flight_OneWay') {
              // hotelDetails, flightOfferDetails 제거하고 저장
              const { hotelDetails, flightOfferDetails, ...cleanSchedule } = schedule;
              cleanedSchedules.push(cleanSchedule);
            }
          });
          
          // 일반 일정만 포함된 데이터 구성
          cleanedScheduleData[day] = {
            ...data[day],
            schedules: cleanedSchedules
          };
        } else {
          // schedules가 없는 경우 그대로 복사
          cleanedScheduleData[day] = data[day];
        }
      });
    }
    
    // 항공편 정보를 날짜 순으로 정렬
    extractedFlights.sort((a, b) => {
      const dateA = new Date(a.itineraries?.[0]?.segments?.[0]?.departure?.at || '1970-01-01');
      const dateB = new Date(b.itineraries?.[0]?.segments?.[0]?.departure?.at || '1970-01-01');
      return dateA.getTime() - dateB.getTime();
    });
    
    // 숙박편 정보를 체크인 날짜 순으로 정렬
    extractedAccommodations.sort((a, b) => {
      const dateA = new Date(a.checkIn || '1970-01-01');
      const dateB = new Date(b.checkIn || '1970-01-01');
      return dateA.getTime() - dateB.getTime();
    });
    
    console.log("추출된 항공편 개수:", extractedFlights.length);
    console.log("추출된 숙박편 개수:", extractedAccommodations.length);
    
    // 프론트엔드에서 직접 전달된 정보와 추출된 정보 병합
    let finalFlights = [];
    let finalAccommodations = [];
    
    // 기존 형식 처리
    if (body.flightInfos && body.flightInfos.length > 0) {
      finalFlights = body.flightInfos;
      console.log("기존 형식 항공편 정보 사용");
    } 
    // 새로운 형식 처리
    else if (body.flightInfo) {
      finalFlights = Array.isArray(body.flightInfo) ? body.flightInfo : [body.flightInfo];
      console.log("새로운 형식 항공편 정보 사용");
    } 
    // 추출된 정보 사용
    else {
      finalFlights = extractedFlights;
      console.log("추출된 항공편 정보 사용");
    }
    
    // 기존 형식 처리
    if (body.accommodationInfos && body.accommodationInfos.length > 0) {
      finalAccommodations = body.accommodationInfos;
      console.log("기존 형식 숙박 정보 사용");
    } 
    // 새로운 형식 처리
    else if (body.accmo_info) {
      finalAccommodations = Array.isArray(body.accmo_info) ? body.accmo_info : [body.accmo_info];
      console.log("새로운 형식 숙박 정보 사용");
    } 
    // 추출된 정보 사용
    else {
      finalAccommodations = extractedAccommodations;
      console.log("추출된 숙박 정보 사용");
    }
    
    console.log("최종 사용할 항공편 정보:", finalFlights.length, "개");
    console.log("최종 사용할 숙박편 정보:", finalAccommodations.length, "개");

    // 다중 항공편 정보를 개별 컬럼으로 저장
    const flightColumns = {};
    finalFlights.forEach((flightInfo, index) => {
      flightColumns[`flight_info_${index + 1}`] = JSON.stringify(cleanData(flightInfo));
    });

    // 다중 숙박편 정보를 개별 컬럼으로 저장 (최적화 적용)
    const accommodationColumns = {};
    finalAccommodations.forEach((accommodationInfo, index) => {
      const optimizedAccommodation = optimizeAccommodationData(accommodationInfo);
      accommodationColumns[`accmo_info_${index + 1}`] = JSON.stringify(cleanData(optimizedAccommodation));
    });

    const itemToSave = {
      user_id: userEmail,
      plan_id: planId,
      name: title,
      paid_plan: paidPlan,
      // 일반 일정 데이터 (항공편, 숙박편 제외)
      itinerary_schedules: JSON.stringify(cleanData(cleanedScheduleData)),
      // 다중 항공편 정보 (flight_info_1, flight_info_2, ...)
      ...flightColumns,
      // 다중 숙박편 정보 (accmo_info_1, accmo_info_2, ...)
      ...accommodationColumns,
      // 총 개수 정보
      total_flights: finalFlights.length,
      total_accommodations: finalAccommodations.length,
      // shared_email 필드 추가
      shared_email: body.shared_email || null,
      last_updated: now
    };

    console.log("DynamoDB에 저장할 최종 아이템 구조:", Object.keys(itemToSave));
    console.log("저장될 shared_email 값:", itemToSave.shared_email);
    
    // 데이터 크기 체크
    const itemSizeInBytes = Buffer.byteLength(JSON.stringify(itemToSave), 'utf8');
    const itemSizeInKB = (itemSizeInBytes / 1024).toFixed(2);
    console.log(`아이템 크기: ${itemSizeInKB} KB (최대 400KB)`);
    
    if (itemSizeInBytes > 400 * 1024) {
      console.error(`⚠️ 아이템 크기가 DynamoDB 제한(400KB)을 초과했습니다: ${itemSizeInKB} KB`);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: `데이터 크기가 너무 큽니다 (${itemSizeInKB} KB). 일부 데이터를 줄여주세요.`,
          currentSize: itemSizeInKB,
          maxSize: "400 KB"
        })
      };
    }
    
    const putCmd = new PutCommand({
      TableName: SAVED_PLANS_TABLE,
      Item: itemToSave
    });
    
    await docClient.send(putCmd);
    console.log("DynamoDB 저장 완료.");

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
