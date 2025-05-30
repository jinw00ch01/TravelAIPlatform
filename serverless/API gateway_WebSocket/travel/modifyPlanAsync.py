import json
import urllib.request
import boto3
import time
import os
from decimal import Decimal, ROUND_HALF_UP # modifiedPlan.py 에서 가져옴
import jwt
import uuid # modifiedPlan.py 에서 가져옴 (planId 생성 시 사용은 안하지만, 필요시)
from datetime import datetime, timedelta
import re

# Decimal 처리를 위한 클래스 및 함수 (modifiedPlan.py와 createPlanAsync.py 참고)
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def convert_decimal_to_float_for_json(item): # modifiedPlan.py에서 가져옴
    if isinstance(item, dict):
        return {k: convert_decimal_to_float_for_json(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [convert_decimal_to_float_for_json(i) for i in item]
    elif isinstance(item, Decimal):
        return float(item)
    return item

# JWT 디코딩 함수 (createPlanAsync.py 또는 modifiedPlan.py 참고)
def decode_jwt_safely(token): # modifiedPlan.py 에서 가져옴
    try:
        # algorithms는 Cognito User Pool의 토큰 서명 알고리즘에 맞춰야 합니다. 보통 RS256.
        # 옵션으로 verify_signature=False를 사용하면 서명 검증을 건너뛰지만, 보안상 권장되지 않습니다.
        # 실제 운영 환경에서는 Cognito User Pool의 JWKS 엔드포인트를 통해 공개키를 가져와 서명을 검증해야 합니다.
        # 여기서는 createPlanAsync.py 와 유사하게 verify_signature=False 로 단순화하거나,
        # modifiedPlan.py 처럼 algorithms=["RS256"], options={"verify_signature": False, "verify_aud": False} 사용
        decoded_token = jwt.decode(token, algorithms=["RS256"], options={"verify_signature": False, "verify_aud": False})
        return decoded_token
    except jwt.ExpiredSignatureError:
        print('토큰이 만료되었습니다.')
    except jwt.InvalidTokenError as e:
        print(f'유효하지 않은 토큰입니다: {e}')
    except Exception as e:
        print(f'JWT 디코딩 중 일반 오류 발생: {e}')
    return None

# WebSocket 메시지 전송 클라이언트 (createPlanAsync.py 참고)
apigw_management_client = None
if 'WEBSOCKET_API_ENDPOINT' in os.environ:
    apigw_management_client = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=os.environ['WEBSOCKET_API_ENDPOINT']
    )
else:
    print("환경변수 'WEBSOCKET_API_ENDPOINT'가 설정되지 않았습니다. WebSocket 메시지를 보낼 수 없습니다.")

def send_websocket_message(connection_id, message_data):
    if not apigw_management_client:
        print(f"WebSocket 클라이언트가 초기화되지 않아 메시지를 보낼 수 없습니다: Action - {message_data.get('action', 'N/A')}")
        return
    try:
        message_json = json.dumps(message_data, ensure_ascii=False, cls=DecimalEncoder)
        print(f"WebSocket 메시지 전송 시도 ({connection_id}): {message_json[:250]}...") # 로그 길이 조절
        apigw_management_client.post_to_connection(
            ConnectionId=connection_id,
            Data=message_json
        )
        print(f"Sent WebSocket message to {connection_id}: Action - {message_data.get('action', 'N/A')}")
    except apigw_management_client.exceptions.GoneException:
        print(f"클라이언트 연결이 끊어짐 ({connection_id}): Action - {message_data.get('action', 'N/A')}")
    except Exception as e:
        print(f"Failed to send WebSocket message to {connection_id}: {str(e)}. Action - {message_data.get('action', 'N/A')}")


def lambda_handler(event, context):
    print("*** modifyPlanAsync.py 함수 시작 - SQS (ModifyPlanQueue) 이벤트 수신 ***")
    print("수신된 event 전체:", json.dumps(event, ensure_ascii=False))

    for record in event.get('Records', []):
        lambda_start_time = time.time()
        connection_id = None
        original_plan_id_from_request = None # 원본 planId를 저장해두기 위함

        try:
            sqs_body_str = record.get('body')
            print(f"[DEBUG] SQS body 원본 문자열: {sqs_body_str[:500]}...")
            
            if not sqs_body_str:
                print("빈 SQS 메시지 본문입니다.")
                continue
            
            sqs_body = json.loads(sqs_body_str)
            print(f"[DEBUG] SQS body 파싱 결과: {json.dumps(sqs_body, ensure_ascii=False)}")
            
            connection_id = sqs_body.get('connectionId')
            client_payload = sqs_body.get('requestData', {})
            
            print(f"[DEBUG] 추출된 connectionId: '{connection_id}' (타입: {type(connection_id)})")
            print(f"[DEBUG] 추출된 client_payload 키들: {list(client_payload.keys()) if isinstance(client_payload, dict) else 'Not a dict'}")

            if not connection_id or not client_payload:
                print(f"[ERROR] SQS 메시지에 connectionId 또는 requestData(client_payload)가 누락되었습니다:")
                print(f"  - connectionId: '{connection_id}' (존재: {bool(connection_id)})")
                print(f"  - client_payload: {client_payload} (존재: {bool(client_payload)})")
                print(f"  - 원본 SQS body: {sqs_body_str}")
                continue
            
            print(f"[SUCCESS] 성공적으로 파싱된 connectionId: {connection_id}")

            print(f"Processing modification for connectionId: {connection_id}")
            send_websocket_message(connection_id, {"action": "status_update", "message": "여행 계획 수정 요청을 수신하여 AI 처리를 시작합니다..."})

            # 사용자 ID 추출 (modifiedPlan.py 로직과 유사하게)
            user_id = 'anonymous'
            # client_payload 안에 authToken 필드가 있음 (websocketService.js 에서 추가)
            auth_header_from_payload = client_payload.get('authToken') # 예: "Bearer eyJ..."
            
            if auth_header_from_payload:
                token_to_decode = auth_header_from_payload
                if auth_header_from_payload.startswith('Bearer '):
                    token_to_decode = auth_header_from_payload.split(' ')[1]
                
                if token_to_decode == 'test-token': # 개발용 토큰 처리
                    user_id = 'dev@example.com'
                    print(f'테스트 토큰 사용, 사용자 ID: {user_id} ({connection_id})')
                else:
                    decoded_token = decode_jwt_safely(token_to_decode)
                    if decoded_token and isinstance(decoded_token, dict):
                        user_id = decoded_token.get('email', decoded_token.get('cognito:username', 'anonymous_after_decode'))
                        print(f'토큰에서 추출한 사용자 ID: {user_id} ({connection_id})')
                    else:
                        print(f'토큰 디코딩 실패 또는 결과가 dict 아님. 기본 사용자 ID 사용 ({connection_id})')
            else:
                print(f'authToken이 페이로드에 없음. 기본 사용자 ID 사용 ({connection_id})')
            
            print(f'최종 사용자 ID (수정용): {user_id} ({connection_id})')

            # AI 수정에 필요한 데이터 파싱 (modifiedPlan.py 참고)
            # client_payload 안에 plans, need, flightInfo 등이 포함되어 있음
            plans_from_request = client_payload.get('plans')
            flight_info_from_request = client_payload.get('flightInfo')
            is_round_trip_from_request = client_payload.get('isRoundTrip', False)
            flight_infos_from_request = client_payload.get('flightInfos', [])
            accommodation_infos_from_request = client_payload.get('accommodationInfos', [])
            need = client_payload.get('need', '') # 사용자의 수정 요구사항

            if plans_from_request and isinstance(plans_from_request, dict):
                original_plan_id_from_request = plans_from_request.get('planId')
            
            current_timestamp = int(time.time())
            # 수정 시에는 기존 planId를 유지하거나, 백엔드에서 필요시 새 ID를 발급할 수 있음
            # 여기서는 기존 planId를 사용하고, Gemini 응답에 planId가 있으면 그것으로 대체
            # 만약 기존 planId가 없다면 (이론상 수정 시에는 있어야 함), 새로 생성
            plan_id_for_response = original_plan_id_from_request if original_plan_id_from_request else f"plan-mod-{current_timestamp}"
            print(f"수정 대상 planId (요청에서): {original_plan_id_from_request}, 최종 사용될 planId (초기): {plan_id_for_response}")

            # === 기존 modifiedPlan.py의 프롬프트 생성 로직 시작 ===
            # (주의: 이 부분은 modifiedPlan.py에서 거의 그대로 가져오되, print문 connection_id 추가 등 약간의 수정 필요)
            flight_prompt = "\n<항공편 정보>\n제공된 항공편 정보 없음."
            final_flight_info_for_response = flight_info_from_request # modifiedPlan.py 변수명 유지
            final_is_round_trip_for_response = is_round_trip_from_request # modifiedPlan.py 변수명 유지

            flight_data_to_process = None
            if flight_infos_from_request and len(flight_infos_from_request) > 0:
                print(f"다중 항공편 정보(flightInfos) 사용 ({connection_id})")
                flight_data_to_process = flight_infos_from_request
            elif flight_info_from_request and isinstance(flight_info_from_request, dict) and \
                 'itineraries' in flight_info_from_request:
                print(f"단일 항공편 정보(flightInfo) 사용 ({connection_id})")
                flight_data_to_process = [flight_info_from_request]
            
            if flight_data_to_process:
                try:
                    print(f"항공편 정보 처리 시작 ({connection_id})... 총 {len(flight_data_to_process)}개 항공편")
                    flight_prompt_parts = ["\n<항공편 정보>"]
                    for idx, flight_info_item in enumerate(flight_data_to_process): # 변수명 변경 flight_info -> flight_info_item
                        if not isinstance(flight_info_item, dict) or 'itineraries' not in flight_info_item:
                            continue
                        current_is_round_trip_calc = len(flight_info_item['itineraries']) > 1
                        flight_prompt_parts.append(f"\n=== 항공편 {idx + 1} ===")
                        first_itinerary = flight_info_item['itineraries'][0]
                        
                        # 핵심 항공편 정보만 추출 (상세한 travelerPricings, fareDetailsBySegment 등 제외)
                        if first_itinerary and isinstance(first_itinerary, dict) and \
                           first_itinerary.get('segments') and isinstance(first_itinerary['segments'], list) and len(first_itinerary['segments']) > 0:
                            first_segment_dep = first_itinerary['segments'][0].get('departure', {})
                            last_segment_arr = first_itinerary['segments'][-1].get('arrival', {})
                            origin_code = first_segment_dep.get('iataCode', 'N/A')
                            dest_code = last_segment_arr.get('iataCode', 'N/A')
                            dep_time = first_segment_dep.get('at', 'N/A')
                            arr_time = last_segment_arr.get('at', 'N/A')
                            
                            # 항공편 기본 정보
                            carrier_code = first_itinerary['segments'][0].get('carrierCode', 'N/A')
                            flight_number = first_itinerary['segments'][0].get('number', 'N/A')
                            
                            flight_prompt_parts.append(f"출발지: {origin_code} → 도착지: {dest_code}")
                            flight_prompt_parts.append(f"항공편: {carrier_code} {flight_number}")
                            flight_prompt_parts.append(f"출발시간: {dep_time}")
                            flight_prompt_parts.append(f"도착시간: {arr_time}")
                            
                            # 가격 정보 (간단히)
                            if 'price' in flight_info_item:
                                price_info = flight_info_item['price']
                                total_price = price_info.get('grandTotal', price_info.get('total', 'N/A'))
                                currency = price_info.get('currency', 'N/A')
                                flight_prompt_parts.append(f"가격: {total_price} {currency}")
                            
                            flight_prompt_parts.append("도착 이후 1시간 이후부터 일정 시작")

                        if current_is_round_trip_calc and len(flight_info_item['itineraries']) > 1:
                            second_itinerary = flight_info_item['itineraries'][1]
                            if second_itinerary and isinstance(second_itinerary, dict) and \
                               second_itinerary.get('segments') and isinstance(second_itinerary['segments'], list) and len(second_itinerary['segments']) > 0:
                                return_dep = second_itinerary['segments'][0].get('departure', {})
                                return_arr = second_itinerary['segments'][-1].get('arrival', {})
                                return_dep_time = return_dep.get('at', 'N/A')
                                
                                flight_prompt_parts.append(f"복귀편 출발: {return_dep_time}")
                                flight_prompt_parts.append("<복귀편> 출발 2시간 전까지 마지막 일정 종료")

                    if len(flight_prompt_parts) > 1:
                        flight_prompt = "\n".join(flight_prompt_parts)
                        if flight_data_to_process[0].get('itineraries'):
                             final_is_round_trip_for_response = len(flight_data_to_process[0]['itineraries']) > 1
                    print(f"생성된 flight_prompt ({connection_id}): {flight_prompt[:200]}...")
                except Exception as e_flight:
                    print(f"항공편 정보 처리 중 오류 발생 ({connection_id}): {type(e_flight).__name__} - {str(e_flight)}")
                    flight_prompt = "\n<항공편 정보>\n제공된 항공편 정보 처리 중 오류 발생."
            else:
                print(f"유효한 항공편 정보가 제공되지 않았습니다 ({connection_id}).")

            accommodation_prompt = "\n<숙박편 정보>\n제공된 숙박편 정보 없음."
            if accommodation_infos_from_request and len(accommodation_infos_from_request) > 0:
                try:
                    print(f"숙박편 정보 처리 시작 ({connection_id})... 총 {len(accommodation_infos_from_request)}개 숙박편")
                    accommodation_prompt_parts = ["\n<숙박편 정보>"]
                    for idx, acc_info_item in enumerate(accommodation_infos_from_request): # 변수명 변경
                        if not isinstance(acc_info_item, dict):
                            continue
                        accommodation_prompt_parts.append(f"\n=== 숙박편 {idx + 1} ===")
                        
                        # 핵심 정보만 추출 (상세한 사진, 시설 정보 제외)
                        hotel_data = acc_info_item.get('hotel', {})
                        hotel_name = hotel_data.get('hotel_name', '정보 없음')
                        address = hotel_data.get('address', '정보 없음')
                        city = hotel_data.get('city', '정보 없음')
                        price = hotel_data.get('price', '정보 없음')
                        checkin_from = hotel_data.get('checkin_from', '정보 없음')
                        checkout_until = hotel_data.get('checkout_until', '정보 없음')
                        
                        accommodation_prompt_parts.append(f"호텔명: {hotel_name}")
                        accommodation_prompt_parts.append(f"주소: {address}, {city}")
                        accommodation_prompt_parts.append(f"가격: {price}")
                        accommodation_prompt_parts.append(f"체크인: {checkin_from}, 체크아웃: {checkout_until}")
                        
                        # 체크인/체크아웃 날짜 정보
                        checkin_date = acc_info_item.get('checkIn', '정보 없음')
                        checkout_date = acc_info_item.get('checkOut', '정보 없음')
                        if checkin_date != '정보 없음' and checkout_date != '정보 없음':
                            accommodation_prompt_parts.append(f"예약 기간: {checkin_date} ~ {checkout_date}")

                    if len(accommodation_prompt_parts) > 1:
                        accommodation_prompt = "\n".join(accommodation_prompt_parts)
                    print(f"생성된 accommodation_prompt ({connection_id}): {accommodation_prompt[:200]}...")
                except Exception as e_accommodation:
                    print(f"숙박편 정보 처리 중 오류 발생 ({connection_id}): {type(e_accommodation).__name__} - {str(e_accommodation)}")
                    accommodation_prompt = "\n<숙박편 정보>\n제공된 숙박편 정보 처리 중 오류 발생."
            else:
                print(f"유효한 숙박편 정보가 제공되지 않았습니다 ({connection_id}).")
            
            # 기존 계획에서 항공편과 숙박편만 추출
            existing_flights_and_hotels = {}
            if plans_from_request and isinstance(plans_from_request, dict):
                travel_plans = plans_from_request.get('travel_plans', {})
                for day_key, day_data in travel_plans.items():
                    if isinstance(day_data, dict) and 'schedules' in day_data:
                        flights_and_hotels = []
                        for schedule in day_data['schedules']:
                            if isinstance(schedule, dict):
                                # 항공편과 숙박편만 추출
                                if (schedule.get('type') in ['Flight_OneWay', 'Flight_RoundTrip', 'accommodation'] or 
                                    'flightOfferDetails' in schedule or 
                                    'hotelDetails' in schedule):
                                    flights_and_hotels.append(schedule)
                        
                        if flights_and_hotels:
                            existing_flights_and_hotels[day_key] = {
                                'title': day_data.get('title', f'{day_key}일차'),
                                'flights_and_hotels': flights_and_hotels
                            }
            
            print(f"추출된 항공편/숙박편 ({connection_id}): {len(existing_flights_and_hotels)}일에 걸쳐 데이터 존재")
            
            # AI에게는 일반 관광일정만 생성하도록 프롬프트 수정
            preservation_instructions = """
**AI 작업 지시사항:**
1. 사용자 요구사항에 맞는 **일반 관광지, 식당, 활동 일정만** 생성하세요.
2. 항공편, 숙박편 일정은 생성하지 마세요 (클라이언트에서 별도로 처리됩니다).
3. 각 일정에는 id, name, time, lat, lng, category, duration, notes, cost, address 정보를 포함하세요.
4. 응답은 반드시 유효한 JSON이어야 합니다.
"""
            
            # 기존 계획에서 일반 관광일정만 추출하여 간단히 전달
            existing_tourist_plans = {}
            if plans_from_request and isinstance(plans_from_request, dict):
                travel_plans = plans_from_request.get('travel_plans', {})
                for day_key, day_data in travel_plans.items():
                    if isinstance(day_data, dict) and 'schedules' in day_data:
                        tourist_schedules = []
                        for schedule in day_data['schedules']:
                            if isinstance(schedule, dict):
                                # 일반 관광일정만 추출 (항공편/숙박편 제외)
                                if (schedule.get('type') not in ['Flight_OneWay', 'Flight_RoundTrip', 'accommodation'] and 
                                    'flightOfferDetails' not in schedule and 
                                    'hotelDetails' not in schedule):
                                    # 핵심 정보만 유지
                                    simple_schedule = {
                                        'id': schedule.get('id', ''),
                                        'name': schedule.get('name', ''),
                                        'time': schedule.get('time', ''),
                                        'lat': schedule.get('lat'),
                                        'lng': schedule.get('lng'),
                                        'category': schedule.get('category', ''),
                                        'duration': schedule.get('duration', ''),
                                        'notes': schedule.get('notes', ''),
                                        'cost': schedule.get('cost', ''),
                                        'address': schedule.get('address', '')
                                    }
                                    tourist_schedules.append(simple_schedule)
                        
                        if tourist_schedules:
                            existing_tourist_plans[day_key] = {
                                'title': day_data.get('title', f'{day_key}일차'),
                                'schedules': tourist_schedules
                            }
            
            existing_plan_prompt = f"\n<기존 일반 관광일정>\n{json.dumps(existing_tourist_plans, ensure_ascii=False, indent=2) if existing_tourist_plans else '기존 일반 관광일정 없음'}"
            
            prompt_text = f"""{preservation_instructions}
사용자 요구사항에 맞는 일반 관광일정만 생성해주세요.

<사용자 요구사항>
{need}

{existing_plan_prompt}
{flight_prompt}
{accommodation_prompt}

**응답 형식 - 이 구조로만 반환하세요:**
{{
  "days": {{
    "1": {{
      "schedules": [{{
        "id": "고유ID",
        "name": "장소이름",
        "time": "시간",
        "lat": 위도,
        "lng": 경도,
        "category": "카테고리",
        "duration": "소요시간",
        "notes": "간단한설명",
        "cost": "비용",
        "address": "주소"
      }}]
    }},
    "2": {{ "schedules": [...] }}
  }}
}}

**주의사항:** 일반 관광일정만 생성하고, 항공편/숙박편은 포함하지 마세요."""
            print(f"Gemini API로 전송할 최종 프롬프트 ({connection_id}), 길이: {len(prompt_text)}, 앞 500자: {prompt_text[:500]}...")
            # === 기존 modifiedPlan.py의 프롬프트 생성 로직 끝 ===

            send_websocket_message(connection_id, {"action": "status_update", "message": "AI 모델과 통신하여 계획 수정을 진행합니다..."})
            
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                raise Exception("환경변수 'GEMINI_API_KEY'가 설정되지 않았습니다.")
            
            # Gemini API 호출 (modifiedPlan.py 로직과 유사)
            # createPlanAsync.py의 이미지 처리 로직은 수정 시에는 불필요하므로 제외 (필요시 추가)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            payload = {"contents": [{"parts": [{"text": prompt_text}]}],"generationConfig": { "temperature": 0.3, "maxOutputTokens": 32768 }}
            request_headers = { "Content-Type": "application/json" }
            
            gemini_request_start_time = time.time()
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=request_headers)
            gemini_result_text = None
            try:
                with urllib.request.urlopen(req, timeout=120) as res: # 타임아웃 설정
                    gemini_response_status = res.status
                    gemini_result_text = res.read().decode('utf-8')
                gemini_request_end_time = time.time()
                print(f"[Gemini API] 수정 응답 ({connection_id}). 상태: {gemini_response_status}, 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초")
                # modifiedPlan.py에서는 Decimal로 파싱하지 않았음. 필요시 createPlanAsync.py처럼 parse_float=Decimal 추가
                gemini_result_initially_parsed = json.loads(gemini_result_text) # modifiedPlan.py 방식
                
                # Gemini 응답 로깅
                print(f"Gemini API 응답 (json.loads 후, 일부만, {connection_id}):", str(gemini_result_initially_parsed)[:500])

            except urllib.error.HTTPError as e_http:
                error_body = e_http.read().decode('utf-8') if hasattr(e_http, 'read') else 'No response body'
                raise Exception(f"Gemini API HTTP 오류 ({connection_id}): {e_http.code} {e_http.reason}. 응답: {error_body}")
            except Exception as e_gemini:
                raise Exception(f"Gemini API 호출 오류 ({connection_id}): {str(e_gemini)}")

            # Gemini 응답에서 실제 plan 텍스트 추출 (createPlanAsync.py 참고)
            ai_tourist_schedules = None
            if gemini_result_initially_parsed and 'candidates' in gemini_result_initially_parsed and gemini_result_initially_parsed['candidates']:
                candidate = gemini_result_initially_parsed['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content'] and candidate['content']['parts']:
                    text_content = candidate['content']['parts'][0].get('text', '').strip()
                    if text_content:
                        try:
                            # Gemini가 ```json과 ``` 마크다운 코드 블록으로 응답을 감쌀 수 있으므로 이를 제거
                            clean_text = text_content
                            if clean_text.startswith('```json'):
                                clean_text = clean_text[7:]  # ```json 제거
                            elif clean_text.startswith('```'):
                                clean_text = clean_text[3:]   # ``` 제거
                            
                            if clean_text.endswith('```'):
                                clean_text = clean_text[:-3]  # 끝의 ``` 제거
                            
                            clean_text = clean_text.strip()
                            print(f"[DEBUG] 정리된 Gemini 응답 텍스트 길이: {len(clean_text)} chars ({connection_id})")
                            print(f"[DEBUG] 정리된 Gemini 응답 텍스트 시작 200자 ({connection_id}): {clean_text[:200]}...")
                            print(f"[DEBUG] 정리된 Gemini 응답 텍스트 끝 200자 ({connection_id}): ...{clean_text[-200:]}")
                            
                            # AI가 반환한 JSON 문자열을 파이썬 객체로 파싱
                            ai_tourist_schedules = json.loads(clean_text)
                            print(f"AI 관광일정 응답 성공적으로 JSON 파싱 ({connection_id})")
                        except json.JSONDecodeError as json_e:
                            print(f"[ERROR] AI 관광일정 응답 JSON 파싱 실패 ({connection_id}):")
                            print(f"  - 오류: {str(json_e)}")
                            print(f"  - 오류 위치: line {getattr(json_e, 'lineno', 'N/A')}, column {getattr(json_e, 'colno', 'N/A')}")
                            print(f"  - 전체 길이: {len(clean_text) if 'clean_text' in locals() else len(text_content)} characters")
                            print(f"  - 응답 끝 500자: ...{(clean_text if 'clean_text' in locals() else text_content)[-500:]}")
                    else:
                        print(f"Gemini 응답에 유효한 텍스트 내용이 없음 ({connection_id})")
            
            if not ai_tourist_schedules:
                raise Exception(f"AI로부터 유효한 관광일정 데이터를 추출하지 못했습니다 ({connection_id}).")
            
            # AI 관광일정과 기존 항공편/숙박편을 병합
            print(f"AI 관광일정과 기존 항공편/숙박편 병합 시작 ({connection_id})")
            merged_travel_plans = {}
            
            # 원본 계획의 기본 구조 유지
            start_date_str = plans_from_request.get('start_date', '2025-07-05') if plans_from_request else '2025-07-05'
            day_order = plans_from_request.get('day_order', []) if plans_from_request else []
            
            # AI 응답의 days 구조 확인
            ai_days = ai_tourist_schedules.get('days', {}) if isinstance(ai_tourist_schedules, dict) else {}
            print(f"AI 응답 구조 ({connection_id}): days 키들 = {list(ai_days.keys()) if ai_days else '없음'}")
            
            # 각 일차별로 병합
            for day_key in day_order:
                merged_schedules = []
                
                # 1. 기존 항공편/숙박편 추가
                if day_key in existing_flights_and_hotels:
                    flight_hotel_data = existing_flights_and_hotels[day_key]['flights_and_hotels']
                    merged_schedules.extend(flight_hotel_data)
                    print(f"Day {day_key}: 기존 항공편/숙박편 {len(flight_hotel_data)}개 추가")
                
                # 2. AI가 생성한 관광일정 추가
                if day_key in ai_days and isinstance(ai_days[day_key], dict):
                    ai_schedules = ai_days[day_key].get('schedules', [])
                    if isinstance(ai_schedules, list):
                        merged_schedules.extend(ai_schedules)
                        print(f"Day {day_key}: AI 관광일정 {len(ai_schedules)}개 추가")
                
                # 병합된 일차 데이터 생성
                if merged_schedules or day_key in existing_flights_and_hotels:
                    # 기존 제목 유지 또는 새로 생성
                    original_title = ''
                    if plans_from_request and isinstance(plans_from_request, dict):
                        original_travel_plans = plans_from_request.get('travel_plans', {})
                        if day_key in original_travel_plans:
                            original_title = original_travel_plans[day_key].get('title', f'{day_key}일차')
                    
                    merged_travel_plans[day_key] = {
                        'title': original_title or f'{day_key}일차',
                        'schedules': merged_schedules
                    }
                    
                    print(f"Day {day_key} 병합 완료: 총 {len(merged_schedules)}개 일정")
            
            # 최종 병합된 계획 구조 생성
            final_merged_plan = {
                'planId': plan_id_for_response,
                'day_order': day_order,
                'travel_plans': merged_travel_plans,
                'start_date': start_date_str
            }
            
            print(f"최종 병합 완료 ({connection_id}): {len(merged_travel_plans)}일, 총 일정 수 = {sum(len(day_data.get('schedules', [])) for day_data in merged_travel_plans.values())}")
            
            # 클라이언트에게 최종 응답 전송
            # 프론트엔드가 기대하는 구조로 변환 (travel_plans -> days)
            print(f"병합된 계획을 프론트엔드 구조로 변환 시작 ({connection_id})")
            converted_plan = {}
            
            if final_merged_plan and isinstance(final_merged_plan, dict):
                travel_plans = final_merged_plan.get('travel_plans', {})
                day_order = final_merged_plan.get('day_order', [])
                print(f"  - day_order: {day_order}")
                print(f"  - travel_plans 키들: {list(travel_plans.keys()) if travel_plans else '없음'}")
                print(f"  - start_date: {final_merged_plan.get('start_date', '없음')}")
                
                # 전체 여행 제목 생성
                if travel_plans and day_order:
                    first_day_title = travel_plans.get(day_order[0], {}).get('title', '')
                    last_day_title = travel_plans.get(day_order[-1], {}).get('title', '')
                    
                    if first_day_title and last_day_title:
                        # 날짜 부분 추출 (예: "7/5" ~ "7/9")
                        first_date = re.search(r'(\d+/\d+)', first_day_title)
                        last_date = re.search(r'(\d+/\d+)', last_day_title)
                        
                        if first_date and last_date:
                            converted_plan['title'] = f"{first_date.group(1)} ~ {last_date.group(1)} 일본 여행"
                        else:
                            converted_plan['title'] = f"{len(day_order)}박 {len(day_order)+1}일 여행"
                    else:
                        converted_plan['title'] = f"{len(day_order)}박 {len(day_order)+1}일 여행"
                
                # travel_plans를 days 배열로 변환
                days = []
                start_date_str = final_merged_plan.get('start_date', '2025-07-05')
                
                # 시작 날짜를 datetime 객체로 변환
                try:
                    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
                except:
                    # 파싱 실패 시 기본값 사용
                    start_date = datetime(2025, 7, 5)
                    start_date_str = '2025-07-05'
                
                for day_num in day_order:
                    if day_num in travel_plans:
                        day_data = travel_plans[day_num]
                        
                        # 각 날의 정확한 날짜 계산 (1일차 = 시작일, 2일차 = 시작일+1, ...)
                        day_index = int(day_num) - 1  # 1일차 -> 0, 2일차 -> 1
                        current_date = start_date + timedelta(days=day_index)
                        date_str = current_date.strftime('%Y-%m-%d')
                        
                        converted_day = {
                            'day': int(day_num),
                            'date': date_str,
                            'title': day_data.get('title', f'{day_num}일차'),
                            'schedules': day_data.get('schedules', [])
                        }
                        days.append(converted_day)
                
                converted_plan['days'] = days
                
                # 추가 정보
                converted_plan['planId'] = plan_id_for_response
                converted_plan['start_date'] = final_merged_plan.get('start_date', '2025-07-05')
                converted_plan['day_order'] = day_order
                
                print(f"변환된 plan 구조 ({connection_id}): title='{converted_plan.get('title', 'N/A')}', days 수={len(converted_plan.get('days', []))}")
                
                # 각 day의 요약 로깅
                for i, day in enumerate(converted_plan.get('days', [])):
                    schedules_count = len(day.get('schedules', []))
                    print(f"  Day {day.get('day', i+1)} ({day.get('date', 'N/A')}): '{day.get('title', 'N/A')}' - {schedules_count}개 일정")
            else:
                # 변환 실패 시 기본 구조
                print(f"  - 유효하지 않은 병합된 계획")
                converted_plan = {
                    'title': '여행 계획',
                    'days': [],
                    'planId': plan_id_for_response
                }
                print(f"Plan 변환 실패, 기본 구조 사용 ({connection_id})")

            final_response_data = {
                "action": "plan_modified", # 프론트엔드 websocketService.js와 일치
                "message": f"여행 계획이 AI에 의해 성공적으로 수정되었습니다. (ID: {plan_id_for_response})",
                "planId": plan_id_for_response, # 수정된 계획의 ID (Gemini 응답에 planId가 있다면 그것을 사용)
                "plan": converted_plan, # 변환된 계획 객체 전달
                "isRoundTrip": final_is_round_trip_for_response # modifiedPlan.py의 응답 구조 참고
                # 필요시 flightInfos, accommodationInfos 등도 함께 전달
            }
            
            # 최종 응답 데이터 요약 로깅
            plan_summary = converted_plan.get('title', 'N/A')
            days_count = len(converted_plan.get('days', []))
            print(f"최종 응답 데이터 ({connection_id}): '{plan_summary}' - {days_count}일 계획")

            # 만약 Gemini 응답에서 새로운 planId를 제공한다면 그것을 사용
            if final_merged_plan and isinstance(final_merged_plan, dict) and final_merged_plan.get('planId'):
                 final_response_data['planId'] = final_merged_plan.get('planId')
                 print(f"Gemini 응답에서 planId 사용: {final_response_data['planId']}")
            
            lambda_end_time = time.time()
            total_lambda_duration = lambda_end_time - lambda_start_time
            print(f"Lambda (ModifyPlanAsync) 함수 총 실행 시간 ({connection_id}): {total_lambda_duration:.2f}초")

            send_websocket_message(connection_id, final_response_data)

        except Exception as e:
            lambda_end_time = time.time()
            total_lambda_duration = lambda_end_time - lambda_start_time
            error_message_str = str(e)
            print(f'Lambda (ModifyPlanAsync) 함수 오류 ({connection_id if connection_id else "Unknown ConnectionId"}): {error_message_str}, 총 시간: {total_lambda_duration:.2f}초')
            
            import traceback # 상세 오류 로깅
            print("스택 트레이스:", traceback.format_exc())

            if connection_id:
                error_payload = {
                    "action": "ai_modification_error", # 프론트엔드 websocketService.js와 일치
                    "message": "여행 계획 수정 중 서버에서 오류가 발생했습니다.",
                    "error_details": error_message_str 
                }
                send_websocket_message(connection_id, error_payload)
    
    return {
        'statusCode': 200, # SQS 트리거 람다는 성공/실패를 SQS에 직접 알림
        'body': json.dumps('SQS (ModifyPlanQueue) 메시지 처리 완료', ensure_ascii=False)
    }
