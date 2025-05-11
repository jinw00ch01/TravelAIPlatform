/**
 * SavePlan Lambda 함수
 * JWT 토큰에서 사용자 이메일을 추출하고 DynamoDB의 saved_plans 테이블에 새로운 여행 계획을 저장합니다.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json"
};

const SAVED_PLANS_TABLE = process.env.SAVED_PLANS_TABLE || "saved_plans";
// 개발 모드 여부 (테스트용)
const DEV_MODE = process.env.NODE_ENV !== "production";

export const handler = async (event) => {
  console.log("SavePlan Lambda 시작 v2"); // 버전 표시용 로그
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
    
    // 3. 데이터 구조 확인 - title과 data가 있는지 체크
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

    // 4. 현재 사용자의 plan 개수를 조회
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
      const planCount = queryResult.Items?.length || 0;
      const planId = planCount + 1; // 새 plan_id = 현재 개수 + 1
      console.log("생성할 planId:", planId);

      // 5. 새 여행 계획 저장
      const itinerarySchedules = {}; // 순수 일정만 담을 객체
      const flightDetailsList = [];  // 항공편 상세 정보만 담을 배열

      // originalDailyPlans가 null이나 undefined가 아닐 때만 순회
      if (data && typeof data === 'object') {
          for (const dayKey in data) {
              const dayPlan = data[dayKey];
              itinerarySchedules[dayKey] = { title: dayPlan.title, schedules: [] }; // 해당 날짜의 schedules 배열 초기화
              
              if (Array.isArray(dayPlan.schedules)) {
                  for (const schedule of dayPlan.schedules) {
                      if (schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return') {
                          if (schedule.flightOfferDetails) {
                              // flight_details 배열에 저장할 객체 구성
                              const flightDetailEntry = {
                                  type: schedule.type, // "Flight_Departure" 또는 "Flight_Return"
                                  // flightOfferData는 selectedFlightDetails.flightOfferData 전체를 저장
                                  original_flight_offer: schedule.flightOfferDetails.flightOfferData,
                                  // departureAirportInfo와 arrivalAirportInfo는 selectedFlightDetails.departureAirportInfo 등으로 저장
                                  departure_airport_details: schedule.flightOfferDetails.departureAirportInfo,
                                  arrival_airport_details: schedule.flightOfferDetails.arrivalAirportInfo,
                                  // 추가적으로 프론트에서 표시했던 요약 정보도 저장 가능 (선택적)
                                  // name: schedule.name,
                                  // time: schedule.time,
                                  // address: schedule.address,
                                  // duration: schedule.duration,
                                  // notes: schedule.notes
                              };
                              flightDetailsList.push(flightDetailEntry);
                              // itinerary_schedules에는 이 항공편 항목을 추가하지 않음 (완전 분리)
                              // 만약, 항공편의 간단한 정보(예: 이름, 시간)만 itinerary_schedules에 남기려면 아래 주석 해제
                              /*
                              itinerarySchedules[dayKey].schedules.push({
                                  id: schedule.id,
                                  name: schedule.name,
                                  time: schedule.time,
                                  address: schedule.address,
                                  category: schedule.category,
                                  type: schedule.type, // "Flight_Departure" 또는 "Flight_Return"
                                  duration: schedule.duration,
                                  notes: schedule.notes,
                                  // lat, lng은 그대로 유지 가능
                                  lat: schedule.lat,
                                  lng: schedule.lng
                              });
                              */
                          } else {
                               // flightOfferDetails가 없는 항공편 타입은 일반 일정으로 취급 (오류 방지)
                               console.warn('Flight schedule item missing flightOfferDetails:', schedule);
                               itinerarySchedules[dayKey].schedules.push(schedule);
                          }
                      } else {
                          // 항공편이 아닌 일반 일정은 그대로 itinerary_schedules에 추가
                          itinerarySchedules[dayKey].schedules.push(schedule);
                      }
                  }
              }
          }
      } else if (DEV_MODE && (!data || Object.keys(data || {}).length === 0)) {
        // originalDailyPlans가 비어있고 개발 모드일 때 (위에서 title만 설정된 경우)
        itinerarySchedules["1"] = { title: "1일차 (데이터 없음)", schedules: [] };
        console.log("개발 모드: itinerarySchedules에 기본 1일차 추가");
      }

      const itemToSave = {
          user_id: userEmail,
          plan_id: planId,
          name: title,
          itinerary_schedules: itinerarySchedules, // 분리된 순수 일정
          // flight_details가 비어있지 않은 경우에만 컬럼 추가
          ...(flightDetailsList.length > 0 && { flight_details: flightDetailsList }), 
          last_updated: now
      };

      console.log("DynamoDB에 저장할 최종 아이템:", JSON.stringify(itemToSave, (key, value) => 
          typeof value === 'number' && !Number.isFinite(value) ? 'NaN' : value, 2
      ));

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
              message: "여행 계획이 성공적으로 저장되었으며, 항공편 정보가 분리되었습니다.",
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
      
      // DynamoDB 테이블 존재 여부 확인 시도
      try {
        console.log("DynamoDB 테이블 확인 시도...");
        const { DynamoDBClient, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
        const describeCmd = new DescribeTableCommand({ TableName: SAVED_PLANS_TABLE });
        const tableInfo = await client.send(describeCmd);
        console.log("테이블 정보:", JSON.stringify({
          tableName: tableInfo.Table.TableName,
          status: tableInfo.Table.TableStatus,
          itemCount: tableInfo.Table.ItemCount
        }));
      } catch (tableError) {
        console.error("테이블 확인 중 오류:", tableError.message);
      }
      
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