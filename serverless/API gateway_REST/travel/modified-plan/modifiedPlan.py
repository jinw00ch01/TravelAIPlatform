import json
import urllib.request
import boto3
import time
import os
from decimal import Decimal, ROUND_HALF_UP
import jwt
import uuid

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def convert_to_decimal_for_dynamo(item):
    if isinstance(item, dict):
        return {k: convert_to_decimal_for_dynamo(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [convert_to_decimal_for_dynamo(i) for i in item]
    elif isinstance(item, float):
        return Decimal(str(item))
    elif isinstance(item, (int, str, bool)) or item is None:
        return item
    elif isinstance(item, Decimal):
        return item
    else:
        print(f"Warning: Unexpected type {type(item)} in convert_to_decimal_for_dynamo. Converting to string: {str(item)}")
        return str(item)

def convert_decimal_to_float_for_json(item):
    if isinstance(item, dict):
        return {k: convert_decimal_to_float_for_json(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [convert_decimal_to_float_for_json(i) for i in item]
    elif isinstance(item, Decimal):
        return float(item)
    return item

def decode_jwt_safely(token):
    try:
        decoded_token = jwt.decode(token, algorithms=["RS256"], options={"verify_signature": False, "verify_aud": False})
        return decoded_token
    except jwt.ExpiredSignatureError:
        print('토큰이 만료되었습니다.')
    except jwt.InvalidTokenError as e:
        print(f'유효하지 않은 토큰입니다: {e}')
    except Exception as e:
        print(f'JWT 디코딩 중 일반 오류 발생: {e}')
    return None

def lambda_handler(event, context):
    if event.get("httpMethod", "") == "OPTIONS":
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps({ "message": "CORS preflight OK" })
        }

    print("수신된 이벤트 (타입만):", type(event), event.get("httpMethod"))

    try:
        body_str = event.get('body', '{}')
        if not isinstance(body_str, str):
            body_str = json.dumps(body_str)
        
        body = json.loads(body_str)
        print("파싱된 요청 본문 (json.loads 후, 일부만):", str(body)[:500])

        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization')
        user_id = 'anonymous'
        if auth_header and auth_header.startswith('Bearer '):
            token_parts = auth_header.split(' ')
            if len(token_parts) == 2:
                token = token_parts[1]
                decoded_token = decode_jwt_safely(token)
                if decoded_token and isinstance(decoded_token, dict):
                    user_id = decoded_token.get('email', decoded_token.get('cognito:username', 'anonymous_after_decode'))
                    print(f'토큰에서 추출한 사용자 ID: {user_id}')
                else:
                    print(f'토큰 디코딩 실패 또는 결과가 dict가 아님. decoded_token: {decoded_token}')
            else:
                print("Authorization 헤더의 Bearer 토큰 형식이 올바르지 않음 (공백 분리 실패)")
        else:
            print('Authorization 헤더가 없거나 Bearer 토큰 형식이 아님.')
        
        plans_from_request = body.get('plans')
        flight_info_from_request = body.get('flightInfo')
        is_round_trip_from_request = body.get('isRoundTrip', False)
        flight_infos_from_request = body.get('flightInfos', [])
        accommodation_infos_from_request = body.get('accommodationInfos', [])
        need = body.get('need', '')
        
        print(f"수신된 plans (타입: {type(plans_from_request)}): {json.dumps(plans_from_request) if plans_from_request else 'None'}")
        print(f"수신된 단일 flightInfo (타입: {type(flight_info_from_request)}): {json.dumps(flight_info_from_request) if flight_info_from_request else 'None'}")
        print(f"수신된 다중 flightInfos 개수: {len(flight_infos_from_request) if flight_infos_from_request else 0}")
        print(f"수신된 다중 accommodationInfos 개수: {len(accommodation_infos_from_request) if accommodation_infos_from_request else 0}")
        print(f"수신된 isRoundTrip (타입: {type(is_round_trip_from_request)}): {is_round_trip_from_request}")
        print(f"수신된 need: {need}")

        plan_id_from_request = None
        if plans_from_request and isinstance(plans_from_request, dict):
            plan_id_from_request = plans_from_request.get('planId')

        current_timestamp = int(time.time())
        
        if plan_id_from_request:
            plan_id = plan_id_from_request
            print(f"기존 planId 사용 (수정): {plan_id}")
        else:
            plan_id = f"plan-{current_timestamp}"
            print(f"새로운 planId 생성: {plan_id}")
        
        if not isinstance(plans_from_request, dict):
            plans_from_request = {}

        flight_prompt = "\n<항공편 정보>\n제공된 항공편 정보 없음."
        final_flight_info_for_response = flight_info_from_request
        final_is_round_trip_for_response = is_round_trip_from_request

        # 다중 항공편 정보 처리 (우선순위: flightInfos > flightInfo)
        flight_data_to_process = None
        if flight_infos_from_request and len(flight_infos_from_request) > 0:
            print("다중 항공편 정보(flightInfos) 사용")
            flight_data_to_process = flight_infos_from_request
        elif flight_info_from_request and isinstance(flight_info_from_request, dict) and \
             'itineraries' in flight_info_from_request:
            print("단일 항공편 정보(flightInfo) 사용")
            flight_data_to_process = [flight_info_from_request]
        
        if flight_data_to_process:
            try:
                print(f"항공편 정보 처리 시작... 총 {len(flight_data_to_process)}개 항공편")
                flight_prompt_parts = ["\n<항공편 정보>"]
                
                for idx, flight_info in enumerate(flight_data_to_process):
                    if not isinstance(flight_info, dict) or 'itineraries' not in flight_info:
                        continue
                        
                    current_is_round_trip_calc = len(flight_info['itineraries']) > 1
                    flight_prompt_parts.append(f"\n=== 항공편 {idx + 1} ===")
                    
                    # 가는 편 정보
                    first_itinerary = flight_info['itineraries'][0]
                    if first_itinerary and isinstance(first_itinerary, dict) and \
                       first_itinerary.get('segments') and isinstance(first_itinerary['segments'], list) and len(first_itinerary['segments']) > 0:
                        first_segment_dep = first_itinerary['segments'][0].get('departure', {})
                        last_segment_arr = first_itinerary['segments'][-1].get('arrival', {})
                        
                        origin_code = first_segment_dep.get('iataCode', 'N/A')
                        destination_code = last_segment_arr.get('iataCode', 'N/A')
                        departure_at = first_segment_dep.get('at', '')
                        arrival_at = last_segment_arr.get('at', '')
                        departure_time = departure_at.split('T')[1][:5] if 'T' in departure_at and len(departure_at.split('T')) > 1 else departure_at
                        arrival_time = arrival_at.split('T')[1][:5] if 'T' in arrival_at and len(arrival_at.split('T')) > 1 else arrival_at

                        flight_prompt_parts.append(f"출발지: {origin_code}")
                        flight_prompt_parts.append(f"도착지: {destination_code}")
                        flight_prompt_parts.append(f"출발 시간: {departure_time}")
                        flight_prompt_parts.append(f"도착 시간: {arrival_time}")
                        flight_prompt_parts.append("도착 이후 1시간 이후부터 일정 시작")

                    # 복귀편 정보 (왕복인 경우)
                    if current_is_round_trip_calc and len(flight_info['itineraries']) > 1:
                        second_itinerary = flight_info['itineraries'][1]
                        if second_itinerary and isinstance(second_itinerary, dict) and \
                           second_itinerary.get('segments') and isinstance(second_itinerary['segments'], list) and len(second_itinerary['segments']) > 0:
                            return_first_segment_dep = second_itinerary['segments'][0].get('departure', {})
                            return_last_segment_arr = second_itinerary['segments'][-1].get('arrival', {})

                            return_origin_code = return_first_segment_dep.get('iataCode', 'N/A')
                            return_destination_code = return_last_segment_arr.get('iataCode', 'N/A')
                            return_departure_at = return_first_segment_dep.get('at', '')
                            return_arrival_at = return_last_segment_arr.get('at', '')
                            return_departure_time = return_departure_at.split('T')[1][:5] if 'T' in return_departure_at and len(return_departure_at.split('T')) > 1 else return_departure_at
                            return_arrival_time = return_arrival_at.split('T')[1][:5] if 'T' in return_arrival_at and len(return_arrival_at.split('T')) > 1 else return_arrival_at
                            
                            flight_prompt_parts.append(f"<복귀편> 출발지: {return_origin_code}")
                            flight_prompt_parts.append(f"<복귀편> 도착지: {return_destination_code}")
                            flight_prompt_parts.append(f"<복귀편> 출발 시간: {return_departure_time}")
                            flight_prompt_parts.append(f"<복귀편> 도착 시간: {return_arrival_time}")
                            flight_prompt_parts.append("복귀편 출발 2시간 전까지 마지막 일정 종료")
                
                if len(flight_prompt_parts) > 1:  # 헤더 외에 내용이 있는 경우
                    flight_prompt = "\n".join(flight_prompt_parts)
                    # 첫 번째 항공편의 왕복 여부를 기준으로 설정
                    if flight_data_to_process[0].get('itineraries'):
                        final_is_round_trip_for_response = len(flight_data_to_process[0]['itineraries']) > 1
                
                print(f"생성된 flight_prompt: {flight_prompt}")
            except Exception as e_flight:
                print(f"항공편 정보 처리 중 오류 발생: {type(e_flight).__name__} - {str(e_flight)}")
                flight_prompt = "\n<항공편 정보>\n제공된 항공편 정보 처리 중 오류 발생."
        else:
            print("유효한 항공편 정보가 제공되지 않았습니다.")
        
        # 숙박편 정보 처리
        accommodation_prompt = "\n<숙박편 정보>\n제공된 숙박편 정보 없음."
        if accommodation_infos_from_request and len(accommodation_infos_from_request) > 0:
            try:
                print(f"숙박편 정보 처리 시작... 총 {len(accommodation_infos_from_request)}개 숙박편")
                accommodation_prompt_parts = ["\n<숙박편 정보>"]
                
                for idx, accommodation_info in enumerate(accommodation_infos_from_request):
                    if not isinstance(accommodation_info, dict):
                        continue
                        
                    accommodation_prompt_parts.append(f"\n=== 숙박편 {idx + 1} ===")
                    
                    # 호텔 정보
                    hotel_name = "정보 없음"
                    if accommodation_info.get('hotel'):
                        hotel_name = accommodation_info['hotel'].get('hotel_name_trans') or \
                                   accommodation_info['hotel'].get('hotel_name') or "정보 없음"
                    elif accommodation_info.get('hotel_name_trans'):
                        hotel_name = accommodation_info['hotel_name_trans']
                    elif accommodation_info.get('hotel_name'):
                        hotel_name = accommodation_info['hotel_name']
                    
                    accommodation_prompt_parts.append(f"호텔명: {hotel_name}")
                    
                    # 체크인/체크아웃 정보
                    check_in = accommodation_info.get('checkIn', '정보 없음')
                    check_out = accommodation_info.get('checkOut', '정보 없음')
                    accommodation_prompt_parts.append(f"체크인: {check_in}")
                    accommodation_prompt_parts.append(f"체크아웃: {check_out}")
                    
                    # 주소 정보
                    address = "정보 없음"
                    if accommodation_info.get('hotel') and accommodation_info['hotel'].get('address'):
                        address = accommodation_info['hotel']['address']
                    elif accommodation_info.get('address'):
                        address = accommodation_info['address']
                    accommodation_prompt_parts.append(f"주소: {address}")
                    
                    # 위치 정보
                    lat = accommodation_info.get('lat') or accommodation_info.get('latitude')
                    lng = accommodation_info.get('lng') or accommodation_info.get('longitude')
                    if accommodation_info.get('hotel'):
                        lat = lat or accommodation_info['hotel'].get('latitude')
                        lng = lng or accommodation_info['hotel'].get('longitude')
                    
                    if lat and lng:
                        accommodation_prompt_parts.append(f"위치: {lat}, {lng}")
                
                if len(accommodation_prompt_parts) > 1:  # 헤더 외에 내용이 있는 경우
                    accommodation_prompt = "\n".join(accommodation_prompt_parts)
                
                print(f"생성된 accommodation_prompt: {accommodation_prompt}")
            except Exception as e_accommodation:
                print(f"숙박편 정보 처리 중 오류 발생: {type(e_accommodation).__name__} - {str(e_accommodation)}")
                accommodation_prompt = "\n<숙박편 정보>\n제공된 숙박편 정보 처리 중 오류 발생."
        else:
            print("유효한 숙박편 정보가 제공되지 않았습니다.")
        
        json_example = "{\"title\":\"ㅁㅁ ㅁ박 ㅁ일 여행\",\"days\":[{\"day\":1,\"date\":\"2025-05-12\",\"title\":\"1일차: ㅁㅁ 방문\",\"schedules\":[{\"id\":\"1-1\",\"name\":\"장소이름\",\"time\":\"14:00\",\"lat\":123.1234,\"lng\":123.1234,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ\",\"cost\":\"50000\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"1-2\",\"name\":\"ㅁㅁ\",\"time\":\"17:00\",\"lat\":35.6936,\"lng\":139.7071,\"category\":\"식당\",\"duration\":\"1시간\",\"notes\":\"현지 이자카야에서 다양한 음식 즐기기\",\"cost\":\"3000\",\"address\":\"ㅁㅁ 주소\"}]},{\"day\":2,\"date\":\"2025-05-13\",\"title\":\"2일차: ㅁㅁ 여행\",\"schedules\":[{\"id\":\"2-1\",\"name\":\"ㅁㅁ 타워\",\"time\":\"10:00\",\"lat\":35.6586,\"lng\":139.7454,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ 시내 전경을 감상할 수 있는 명소\",\"cost\":\"1200\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"2-2\",\"name\":\"ㅁㅁ 멘치\",\"time\":\"13:00\",\"lat\":35.7148,\"lng\":139.7967,\"category\":\"식당\",\"duration\":\"1시간\",\"notes\":\"유명한 ㅁㅁ 멘치카츠 맛보기\",\"cost\":\"800\",\"address\":\"ㅁㅁ 주소\"}]},{\"day\":3,\"date\":\"2025-05-14\",\"title\":\"3일차: ㅁㅁ 온천 여행\",\"schedules\":[{\"id\":\"3-1\",\"name\":\"ㅁㅁ 역\",\"time\":\"09:00\",\"lat\":35.6896,\"lng\":139.7006,\"category\":\"장소\",\"duration\":\"2시간\",\"notes\":\"ㅁㅁ에서 ㅁㅁ 온천 지역으로 이동\",\"cost\":\"2500\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"3-2\",\"name\":\"ㅁㅁ 유모토\",\"time\":\"11:00\",\"lat\":35.2329,\"lng\":139.1056,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"온천 마을 ㅁㅁ 유모토 도착 후 휴식\",\"cost\":\"0\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"3-3\",\"name\":\"ㅁㅁ 소바집\",\"time\":\"12:00\",\"lat\":35.2351,\"lng\":139.1082,\"category\":\"식당\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ 지역의 유명한 소바 맛집\",\"cost\":\"1500\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"3-4\",\"name\":\"ㅁㅁ 로프웨이\",\"time\":\"14:00\",\"lat\":35.2484,\"lng\":139.0203,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ 로프웨이를 타고 산 정상에서 경치 감상\",\"cost\":\"1300\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"3-5\",\"name\":\"ㅁㅁ 호수\",\"time\":\"16:00\",\"lat\":35.2066,\"lng\":139.0260,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ 호수에서 유람선을 타고 경치 감상\",\"cost\":\"1000\",\"address\":\"ㅁㅁ 주소\"}]}]}저 구조로만 반환하세요."
        existing_plan_prompt = "\n<기존 계획>\n기존 계획 없음. 사용자의 요구사항에 맞춰 새로운 계획을 생성해주세요."
        if plans_from_request and isinstance(plans_from_request, dict) and (plans_from_request.get('day_order') or plans_from_request.get('travel_plans')):
            try:
                existing_plan_prompt = f"\n<기존 계획>\n{json.dumps(plans_from_request, ensure_ascii=False, indent=2)}"
            except Exception as e_json_plans:
                print(f"기존 계획 JSON 직렬화 중 오류 (프롬프트용): {e_json_plans}")
                existing_plan_prompt = "\n<기존 계획>\n기존 계획 데이터 처리 중 오류 발생."
        
        # 기존 데이터 보존 지시사항
        preservation_instructions = """
**중요한 지시사항 - 반드시 준수하세요:**
1. 기존 계획에 있는 숙박편(accommodation 타입) 일정은 절대 삭제하거나 수정하지 마세요.
2. 기존 계획에 있는 항공편(flight 타입) 일정은 절대 삭제하거나 수정하지 마세요.
3. 위 항공편 정보와 숙박편 정보에 명시된 시간 제약을 반드시 지키세요.
4. 오직 일반 관광지, 식당, 활동 일정만 사용자 요구사항에 맞게 수정하세요.
5. 기존 숙박편과 항공편의 모든 세부 정보(id, time, lat, lng, hotelDetails, flightOfferDetails 등)를 그대로 유지하세요.
"""
        
        prompt_text = f"""{preservation_instructions}
        
기존 여행 계획을 사용자의 요구사항에 맞게 수정해주세요.

<사용자 요구사항>
{need}

{existing_plan_prompt}
{flight_prompt}
{accommodation_prompt}

<응답 형식 **반드시 이 구조로만 반환하세요!**>
{json_example}"""
        print(f"Gemini API로 전송할 최종 프롬프트 (길이: {len(prompt_text)}, 앞 500자): {prompt_text[:500]}...")

        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            print("오류: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
            raise Exception("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": prompt_text}]}],"generationConfig": { "temperature": 0.3 }}
        request_headers = { "Content-Type": "application/json" }
        
        print(f"Gemini API 호출 시작. URL: {url}")
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=request_headers)
        
        gemini_response_str = None
        with urllib.request.urlopen(req) as res:
            gemini_response_str = res.read().decode('utf-8')
            print(f"Gemini API 응답 상태 코드: {res.status}")
        
        gemini_result_initially_parsed = json.loads(gemini_response_str)
        print(" Gemini API 응답 (json.loads 후, 일부만):", str(gemini_result_initially_parsed)[:500])

        # DynamoDB 저장 로직 제거 - AI 응답을 직접 JSON으로 변환하여 사용
        plan_for_response = convert_decimal_to_float_for_json(gemini_result_initially_parsed)
        print("✅ AI 응답을 JSON으로 변환 완료. DB 저장 없이 로컬메모리용으로 반환됩니다.")
        
        # 응답은 AI가 수정한 여행 계획(plan_data)과 기본 정보만 포함
        response_payload = {
            'message': 'AI가 여행 계획을 임시로 수정했습니다. (로컬메모리용 - DB 저장 안됨)',
            'planId': plan_id,
            'plan': plan_for_response,
            'isRoundTrip': final_is_round_trip_for_response
        }

        print(f"API 응답 페이로드 (일부): {str(response_payload)[:500]}...")
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps(response_payload, ensure_ascii=False, cls=DecimalEncoder)
        }

    except Exception as e:
        print(f"핸들러 실행 중 심각한 오류 발생: {type(e).__name__} - {str(e)}")
        import traceback
        print("스택 트레이스:", traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps({
                'message': '서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.',
                'errorType': type(e).__name__,
                'errorMessage': str(e)
            })
        }
