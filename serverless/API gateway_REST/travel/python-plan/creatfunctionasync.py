import json
import urllib.request
import boto3
import time
import os
from decimal import Decimal
import jwt  # pyjwt 라이브러리 import
import urllib.error

# Decimal을 JSON으로 직렬화할 수 있게 도와주는 함수
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

# JWT 디코딩 함수 (기존과 동일)
def decode_jwt(token):
    try:
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        return decoded_token
    except jwt.ExpiredSignatureError:
        print('토큰이 만료되었습니다.')
    except jwt.InvalidTokenError:
        print('유효하지 않은 토큰입니다.')
    return None

# WebSocket 메시지 전송을 위한 API Gateway Management API 클라이언트
# WEBSOCKET_API_ENDPOINT 환경 변수 설정 필요 (예: 'https://{api_id}.execute-api.{region}.amazonaws.com/{stage}')
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
        print(f"WebSocket 클라이언트가 초기화되지 않아 메시지를 보낼 수 없습니다: {message_data.get('action', 'N/A')}")
        return

    try:
        message_json = json.dumps(message_data, ensure_ascii=False, cls=DecimalEncoder)
        print(f"WebSocket 메시지 전송 시도 ({connection_id}): {message_json[:200]}...")
        
        apigw_management_client.post_to_connection(
            ConnectionId=connection_id,
            Data=message_json
        )
        print(f"Sent WebSocket message to {connection_id}: Action - {message_data.get('action', 'N/A')}")
    except apigw_management_client.exceptions.GoneException:
        print(f"클라이언트 연결이 끊어짐 ({connection_id}): Action - {message_data.get('action', 'N/A')}")
    except Exception as e:
        print(f"Failed to send WebSocket message to {connection_id}: {str(e)}. Action - {message_data.get('action', 'N/A')}")
        print(f"에러 타입: {type(e).__name__}")
        if hasattr(e, 'response'):
            print(f"AWS 응답: {e.response}")


def lambda_handler(event, context):
    print("SQS 이벤트 수신:", json.dumps(event, ensure_ascii=False))

    for record in event.get('Records', []):
        lambda_start_time = time.time()
        connection_id = None # 오류 발생 시 WebSocket 알림을 위해 미리 선언

        try:
            sqs_body_str = record.get('body')
            if not sqs_body_str:
                print("빈 SQS 메시지 본문입니다. 다음 레코드로 넘어갑니다.")
                continue
            
            sqs_body = json.loads(sqs_body_str)
            
            connection_id = sqs_body.get('connectionId')
            request_data = sqs_body.get('requestData') # 프론트엔드에서 보낸 원본 요청

            if not connection_id or not request_data:
                print(f"SQS 메시지에 connectionId 또는 requestData가 누락되었습니다: {sqs_body_str}")
                continue
            
            print(f"Processing for connectionId: {connection_id}")
            send_websocket_message(connection_id, {"action": "status_update", "message": "여행 계획 생성 요청을 수신하여 처리를 시작합니다..."})

            # 사용자 ID 추출 (원본 createFunction_python.py와 동일한 방식)
            user_id = 'anonymous'
            auth_token_from_payload = request_data.get('authToken') # 예: "Bearer eyJ..." 또는 "eyJ..."
            
            if auth_token_from_payload:
                print(f'수신된 토큰 형태 ({connection_id}): {auth_token_from_payload[:30]}...')
                
                # "Bearer " 접두사가 있는 경우 제거 (원본과 동일)
                if auth_token_from_payload.startswith('Bearer '):
                    token = auth_token_from_payload[7:]  # 'Bearer ' 이후 부분 추출
                else:
                    token = auth_token_from_payload
                
                print(f'처리할 토큰 (앞부분) ({connection_id}): {token[:50]}...')
                
                # 개발 환경에서 test-token인 경우 처리
                if token == 'test-token':
                    user_id = 'dev@example.com'  # AuthContext의 개발 유저와 일치
                    print(f'테스트 토큰 사용, 사용자 ID: {user_id} ({connection_id})')
                else:
                    # 실제 JWT 토큰 디코딩 시도 (원본과 동일)
                    decoded_token = decode_jwt(token)
                    if decoded_token:
                        # 이메일을 사용자 ID로 사용 (원본과 동일)
                        user_id = decoded_token.get('email', 'anonymous')
                        print(f'토큰에서 추출한 사용자 이메일 ({connection_id}): {user_id}')
                    else:
                        print(f'토큰 디코딩 실패, 기본 사용자 ID 사용 ({connection_id})')
            else:
                print(f'Authorization 헤더가 없거나 잘못된 형식, 기본 사용자 ID 사용 ({connection_id})')
                
            print(f'최종 사용자 ID ({connection_id}): {user_id}')

            # 요청 파라미터 추출 (request_data에서 가져옴)
            query_text = request_data.get('query', '')
            start_date = request_data.get('startDate')
            end_date = request_data.get('endDate')
            adults = request_data.get('adults', 1)
            children = request_data.get('children', 0)
            
            # Base64 이미지 처리 추가
            images = request_data.get('images', [])  # Base64 이미지 배열
            has_images = len(images) > 0
            print(f"수신된 이미지 개수 ({connection_id}): {len(images)}")
            
            # 다중 항공편/숙박편 지원 (하위 호환성 유지)
            flight_info = request_data.get('flightInfo', None)  # 단일 항공편 (하위 호환성)
            flight_infos = request_data.get('flightInfos', None)  # 다중 항공편 (새로운 방식)
            accommodation_info = request_data.get('accommodationInfo', None)  # 단일 숙박편 (하위 호환성)
            accommodation_infos = request_data.get('accommodationInfos', None)  # 다중 숙박편 (새로운 방식)
            
            # 다중 데이터가 있으면 우선 사용, 없으면 단일 데이터 사용
            if flight_infos and len(flight_infos) > 0:
                flights_to_process = flight_infos
                print(f"다중 항공편 모드: {len(flight_infos)}개 항공편 처리 ({connection_id})")
            elif flight_info:
                flights_to_process = [flight_info]
                print(f"단일 항공편 모드: 1개 항공편 처리 ({connection_id})")
            else:
                flights_to_process = []
                print(f"항공편 없음 ({connection_id})")
            
            if accommodation_infos and len(accommodation_infos) > 0:
                accommodations_to_process = accommodation_infos
                print(f"다중 숙박편 모드: {len(accommodation_infos)}개 숙박편 처리 ({connection_id})")
            elif accommodation_info:
                accommodations_to_process = [accommodation_info]
                print(f"단일 숙박편 모드: 1개 숙박편 처리 ({connection_id})")
            else:
                accommodations_to_process = []
                print(f"숙박편 없음 ({connection_id})")
            
            is_round_trip = False # 기본값

            print(f"요청 파라미터 ({connection_id}): query={query_text}, start_date={start_date}, end_date={end_date}, adults={adults}, children={children}")
            print(f"처리할 항공편 수: {len(flights_to_process)}, 처리할 숙박편 수: {len(accommodations_to_process)} ({connection_id})")

            # Geo 정보 기본값 초기화
            out_arrival_geo_lat = None
            out_arrival_geo_lng = None
            in_depart_geo_lat = None
            in_depart_geo_lng = None

            # 프롬프트 구성 시작
            prompt_text = ""

            # 다중 항공편 정보 처리
            if flights_to_process:
                print(f"항공편 정보 처리 중 ({connection_id}): {len(flights_to_process)}개")
                
                # 왕복편 여부 확인 (첫 번째 항공편 기준)
                if flights_to_process[0] and 'itineraries' in flights_to_process[0]:
                    is_round_trip = len(flights_to_process[0].get('itineraries', [])) > 1
                
                if is_round_trip and len(flights_to_process) == 1:
                    # 단일 왕복편 처리 (기존 로직 유지)
                    flight_info = flights_to_process[0]
                    first_itinerary = flight_info['itineraries'][0]
                    first_segment = first_itinerary['segments'][0]
                    last_segment = first_itinerary['segments'][-1]
                    origin_code = first_segment['departure']['iataCode']
                    destination_code = last_segment['arrival']['iataCode']
                    departure_date = first_segment['departure']['at']
                    departure_time = departure_date.split('T')[1][:5] if 'T' in departure_date else departure_date
                    arrival_date = last_segment['arrival']['at']
                    arrival_time = arrival_date.split('T')[1][:5] if 'T' in arrival_date else arrival_date
                    out_arrival_geo_lat = last_segment.get('arrival', {}).get('geoCode', {}).get('latitude')
                    out_arrival_geo_lng = last_segment.get('arrival', {}).get('geoCode', {}).get('longitude')
                    
                    # 도착 공항 한글명 추출
                    arrival_airport_info = last_segment.get('arrival', {}).get('airportInfo', {})
                    arrival_airport_name = arrival_airport_info.get('koreanName', destination_code)
                    
                    prompt_text += f"<항공편 정보>\n출발지: {origin_code}\n도착지: {destination_code}\n출발 시간: {departure_time}\n도착 시간: {arrival_time}\n도착 공항 이름: {arrival_airport_name} (공항 코드는 {destination_code})\n도착 공항 위도/경도: {out_arrival_geo_lat or 'Unknown'}/{out_arrival_geo_lng or 'Unknown'}\n\n*** 중요: 첫날 첫 번째 일정은 반드시 <항공편 정보>의 '도착지' 공항에 '도착 시간'에 도착하는 것으로 생성하고, 해당 공항의 이름, 위도, 경도를 `schedules`에 포함하세요. ***\n\n"
                    
                    # 복귀 항공편 정보
                    if len(flight_info['itineraries']) > 1:
                        return_itinerary = flight_info['itineraries'][1]
                        return_first_segment = return_itinerary['segments'][0]
                        return_last_segment = return_itinerary['segments'][-1]
                        return_departure_date = return_first_segment['departure']['at']
                        return_departure_time = return_departure_date.split('T')[1][:5] if 'T' in return_departure_date else return_departure_date
                        return_arrival_date = return_last_segment['arrival']['at']
                        return_arrival_time = return_arrival_date.split('T')[1][:5] if 'T' in return_arrival_date else return_arrival_date
                        in_depart_geo_lat = return_first_segment.get('departure', {}).get('geoCode', {}).get('latitude')
                        in_depart_geo_lng = return_first_segment.get('departure', {}).get('geoCode', {}).get('longitude')
                        
                        # 출발 공항 한글명 추출
                        departure_airport_info = return_first_segment.get('departure', {}).get('airportInfo', {})
                        departure_airport_name = departure_airport_info.get('koreanName', destination_code)
                        
                        prompt_text += f"<복귀 항공편 정보>\n출발지: {destination_code}\n도착지: {origin_code}\n출발 시간: {return_departure_time}\n출발 공항 이름: {departure_airport_name} (공항 코드는 {destination_code})\n출발 공항 위도/경도: {in_depart_geo_lat or 'Unknown'}/{in_depart_geo_lng or 'Unknown'}\n도착 시간: {return_arrival_time}\n\n*** 중요: 마지막 날 마지막 일정은 복귀 항공편 출발 시간({return_departure_time}) 최소 2시간 전에 해당 공항({departure_airport_name})에서 출발 준비를 마치는 것으로 생성하세요. 모든 시간은 해당 공항의 현지 시간대입니다.***\n\n"
                
                else:
                    # 다중 편도 항공편 처리 (새로운 로직)
                    prompt_text += f"<다중 항공편 정보>\n총 {len(flights_to_process)}개의 편도 항공편이 있습니다.\n\n"
                    
                    for i, flight in enumerate(flights_to_process):
                        if 'itineraries' in flight and len(flight['itineraries']) > 0:
                            itinerary = flight['itineraries'][0]  # 편도이므로 첫 번째 itinerary만
                            first_segment = itinerary['segments'][0]
                            last_segment = itinerary['segments'][-1]
                            origin_code = first_segment['departure']['iataCode']
                            destination_code = last_segment['arrival']['iataCode']
                            departure_date = first_segment['departure']['at']
                            departure_time = departure_date.split('T')[1][:5] if 'T' in departure_date else departure_date
                            arrival_date = last_segment['arrival']['at']
                            arrival_time = arrival_date.split('T')[1][:5] if 'T' in arrival_date else arrival_date
                            
                            # 공항 정보 추출
                            departure_airport_info = first_segment.get('departure', {}).get('airportInfo', {})
                            departure_airport_name = departure_airport_info.get('koreanName', origin_code)
                            arrival_airport_info = last_segment.get('arrival', {}).get('airportInfo', {})
                            arrival_airport_name = arrival_airport_info.get('koreanName', destination_code)
                            
                            # 위경도 정보
                            departure_geo_lat = first_segment.get('departure', {}).get('geoCode', {}).get('latitude')
                            departure_geo_lng = first_segment.get('departure', {}).get('geoCode', {}).get('longitude')
                            arrival_geo_lat = last_segment.get('arrival', {}).get('geoCode', {}).get('latitude')
                            arrival_geo_lng = last_segment.get('arrival', {}).get('geoCode', {}).get('longitude')
                            
                            # 첫 번째 항공편인 경우
                            if i == 0:
                                prompt_text += f"항공편 {i+1} (출국편): {origin_code}({departure_airport_name}) -> {destination_code}({arrival_airport_name})\n"
                                prompt_text += f"출발: {departure_time}, 도착: {arrival_time}\n"
                                prompt_text += f"도착 공항 위도/경도: {arrival_geo_lat or 'Unknown'}/{arrival_geo_lng or 'Unknown'}\n"
                                prompt_text += f"*** 중요: 첫날 첫 번째 일정은 반드시 {arrival_airport_name}({destination_code}) 공항에 {arrival_time}에 도착하는 것으로 생성하세요. ***\n\n"
                                
                                # 첫 번째 항공편의 도착지 정보를 전역 변수에 저장
                                out_arrival_geo_lat = arrival_geo_lat
                                out_arrival_geo_lng = arrival_geo_lng
                            
                            # 마지막 항공편인 경우 (귀국편)
                            elif i == len(flights_to_process) - 1:
                                prompt_text += f"항공편 {i+1} (귀국편): {origin_code}({departure_airport_name}) -> {destination_code}({arrival_airport_name})\n"
                                prompt_text += f"출발: {departure_time}, 도착: {arrival_time}\n"
                                prompt_text += f"출발 공항 위도/경도: {departure_geo_lat or 'Unknown'}/{departure_geo_lng or 'Unknown'}\n"
                                prompt_text += f"*** 중요: 마지막 날 마지막 일정은 {departure_airport_name}({origin_code}) 공항에서 {departure_time} 최소 2시간 전에 출발 준비를 마치는 것으로 생성하세요. ***\n\n"
                                
                                # 마지막 항공편의 출발지 정보를 전역 변수에 저장
                                in_depart_geo_lat = departure_geo_lat
                                in_depart_geo_lng = departure_geo_lng
                            
                            # 중간 항공편인 경우
                            else:
                                prompt_text += f"항공편 {i+1} (중간편): {origin_code}({departure_airport_name}) -> {destination_code}({arrival_airport_name})\n"
                                prompt_text += f"출발: {departure_time}, 도착: {arrival_time}\n"
                                prompt_text += f"출발 공항 위도/경도: {departure_geo_lat or 'Unknown'}/{departure_geo_lng or 'Unknown'}\n"
                                prompt_text += f"도착 공항 위도/경도: {arrival_geo_lat or 'Unknown'}/{arrival_geo_lng or 'Unknown'}\n"
                                prompt_text += f"*** 중요: 해당 날짜에 {departure_airport_name}({origin_code}) 공항에서 출발하여 {arrival_airport_name}({destination_code}) 공항에 도착하는 일정을 포함하세요. ***\n\n"
                    
                    prompt_text += "*** 전체 항공편 연결 규칙: 각 항공편의 출발지 공항에 도착하는 일정과 도착지 공항에서 출발하는 일정을 반드시 포함하세요. ***\n\n"

            # 다중 숙박 정보 처리
            if accommodations_to_process:
                print(f"숙박 정보 처리 중 ({connection_id}): {len(accommodations_to_process)}개")
                
                if len(accommodations_to_process) == 1:
                    # 단일 숙박편 처리 (기존 로직 유지)
                    accommodation_info = accommodations_to_process[0]
                    hotel = accommodation_info.get('hotel', {})
                    room = accommodation_info.get('room', {})
                    hotel_name = hotel.get('hotel_name_trans') or hotel.get('hotel_name') or hotel.get('name') or 'Unknown Hotel'
                    room_name = room.get('name', 'Standard Room')
                    
                    prompt_text += f"<숙박 정보>\n호텔명: {hotel_name}\n객실 타입: {room_name}\n체크인: {accommodation_info.get('checkIn', start_date)}\n체크아웃: {accommodation_info.get('checkOut', end_date)}\n주소: {hotel.get('address', '정보 없음')}\n\n***  중요: 첫날 일정에 호텔 체크인을 포함하고, 매일 일정은 호텔에서 시작하여 호텔로 돌아오는 구조로 작성하세요. 마지막 날 일정은 호텔 체크아웃 이후, 복귀 항공편 출발 공항으로 이동하는 루트를 포함해야 합니다. 모든 시간은 호텔 위치의 현지 시간대입니다. ***\n\n"
                
                else:
                    # 다중 숙박편 처리 (새로운 로직)
                    prompt_text += f"<다중 숙박 정보>\n총 {len(accommodations_to_process)}개의 숙박편이 있습니다.\n\n"
                    
                    for i, accommodation in enumerate(accommodations_to_process):
                        hotel = accommodation.get('hotel', {})
                        room = accommodation.get('room', {})
                        hotel_name = hotel.get('hotel_name_trans') or hotel.get('hotel_name') or hotel.get('name') or f'Unknown Hotel {i+1}'
                        room_name = room.get('name', 'Standard Room')
                        check_in = accommodation.get('checkIn', start_date)
                        check_out = accommodation.get('checkOut', end_date)
                        hotel_address = hotel.get('address', '정보 없음')
                        
                        # 체크인/체크아웃 날짜 포맷팅
                        if isinstance(check_in, str):
                            check_in_date = check_in
                        else:
                            check_in_date = check_in.strftime('%Y-%m-%d') if check_in else start_date
                        
                        if isinstance(check_out, str):
                            check_out_date = check_out
                        else:
                            check_out_date = check_out.strftime('%Y-%m-%d') if check_out else end_date
                        
                        prompt_text += f"숙박편 {i+1}: {hotel_name}\n"
                        prompt_text += f"객실 타입: {room_name}\n"
                        prompt_text += f"체크인: {check_in_date}\n"
                        prompt_text += f"체크아웃: {check_out_date}\n"
                        prompt_text += f"주소: {hotel_address}\n"
                        
                        # 첫 번째 숙박편인 경우
                        if i == 0:
                            prompt_text += f"*** 중요: 첫날 일정에 {hotel_name} 체크인을 포함하세요. ***\n"
                        
                        # 마지막 숙박편인 경우
                        if i == len(accommodations_to_process) - 1:
                            prompt_text += f"*** 중요: 마지막 날 일정은 {hotel_name} 체크아웃 이후, 복귀 항공편 출발 공항으로 이동하는 루트를 포함하세요. ***\n"
                        
                        # 중간 숙박편인 경우
                        if i > 0 and i < len(accommodations_to_process) - 1:
                            prev_accommodation = accommodations_to_process[i-1]
                            prev_hotel_name = prev_accommodation.get('hotel', {}).get('hotel_name_trans') or prev_accommodation.get('hotel', {}).get('hotel_name') or f'이전 호텔'
                            prompt_text += f"*** 중요: {prev_hotel_name} 체크아웃 후 {hotel_name}으로 이동하여 체크인하는 일정을 포함하세요. ***\n"
                        
                        prompt_text += "\n"
                    
                    prompt_text += "*** 전체 숙박편 연결 규칙: 각 숙박편에서 체크인/체크아웃 일정을 포함하고, 매일 일정은 해당 숙박편에서 시작하여 돌아오는 구조로 작성하세요. 숙박편 간 이동 시에는 체크아웃 후 다음 숙박편으로 이동하는 일정을 포함하세요. ***\n\n"
            
            else:
                # 숙박편이 선택되지 않은 경우 - AI가 추천하는 숙소를 개인 숙소 박스에 들어가도록 생성
                prompt_text += "<숙박 정보 없음>\n사용자가 숙박편을 선택하지 않았습니다.\n\n*** 중요: 각 날마다 'category': '숙소'인 추천 숙소 일정을 포함하세요. 이 숙소들은 TravelPlanner의 개인 숙소 박스(일반 일정)에 표시되어야 합니다. 여행 목적지에 맞는 실제 존재하는 호텔, 게스트하우스, 펜션 등을 검색하여 추천해주세요.\n\n반드시 다음 형식으로 생성하세요:\n- id: 'custom-숙소고유번호' (예: 'custom-1234567890')\n- name: '실제 숙소명 (예: 서울 롯데호텔, 부산 파라다이스 호텔 등)'\n- address: '실제 숙소 주소'\n- lat: 실제 위도 (숫자)\n- lng: 실제 경도 (숫자)\n- category: '숙소' (반드시 포함)\n- time: '22:00' (체크인 시간)\n- duration: '8시간' (숙박 시간)\n- notes: '숙소 특징, 편의시설, 추천 이유, 체크인/체크아웃 시간, 연락처 등을 포함한 상세 설명. 예: 시내 중심가 위치, 무료 Wi-Fi, 조식 제공, 체크인 14:00, 체크아웃 11:00, 연락처: 02-1234-5678'\n- cost: '예상 1박 요금 (원 단위, 숫자만)'\n\n이렇게 생성된 숙소는 개인 숙소 폼과 동일한 구조로 처리되어 일반 일정에 표시됩니다. ***\n\n"
             
            # 메인 요구사항 추가
            prompt_text += f"""
<요구사항>
{query_text}

장소, 일차에 맞춰 계획하세요.

<날짜>
{start_date} ~ {end_date}, 이 날짜에 맞게 계획하세요.

<인원수>
어른 : {adults}, 유아 {children}"""

            # 이미지가 있는 경우 추가 안내
            if has_images:
                prompt_text += f"""

<첨부된 이미지>
사용자가 {len(images)}개의 이미지를 첨부했습니다. 이 이미지들을 분석하여 여행 계획에 반영해주세요.
- 이미지에 나타난 장소, 음식, 활동 등을 파악하여 유사한 경험을 할 수 있는 일정을 포함하세요.
- 이미지의 분위기나 테마를 고려하여 여행 스타일을 맞춰주세요.
- 이미지에서 특정 관심사를 발견하면 관련된 장소나 활동을 추천해주세요."""

            prompt_text += """

<규칙>
모든 장소는 실제로 있는 장소여야 해. 호텔, 장소, 식당을 너가 검색해서 잡아줘.
"무조건 이름이 지도에 있는 이름이어야 해."
현실적인 일정을 잡아야 하니, 하루 총 일정에 너무 많은 이동거리가 있으면 안 돼.
그리고, 다음날의 첫 일정에는 전날의 호텔과 가까이 있는 걸로 해줘.
이어지는 흐름으로 갈 수 있도록.
그런데 장소와 장소 사이가 너무 가까워도 안됨.
항공편 정보가 제공된 경우, 첫날 첫 번째 일정은 반드시 제공된 '가는 편' 항공편의 도착 공항에, 명시된 '도착 시간'에 도착하는 것으로 생성해야 하며, 해당 공항의 이름, 위도, 경도를 `schedules`에 포함해야 한다.
마찬가지로, 복귀 항공편 정보가 제공된 경우, 마지막 날 마지막 일정은 제공된 '오는 편' 항공편의 출발 공항에서, 명시된 '출발 시간' 이전에 출발 준비를 마치는 것으로 생성하고, 해당 공항 이름, 위도, 경도를 `schedules`에 포함해야 한다.

<답변형식>
하루치 일정은 \\"(관광지)-(식당)-(관광지)-(관광지)-(관광지)-(관광지)-(마지막 관광지)\\" 이렇게 잡아줘.
관광지 : 지도 상에 존재하는 명소나, 구경거리 (제외 : 호텔, 지하철역, 항공 등등..) 만 넣어야해.
추가로, 하루 일정의 마지막 장소의 위도(latitude)와 경도(longitude) 정보를 포함해야 해.
항공편 도착/출발 공항도 '장소'로 취급하여 일정에 포함해야 한다.


JSON 예시
{{\\"title\\":\\"ㅁㅁ ㅁ박 ㅁ일 여행\\",\\"days\\":[{{\\"day\\":1,\\"date\\":\\"2025-05-12\\",\\"title\\":\\"1일차: 공항 도착 및 ㅁㅁ 방문\\",\\"schedules\\":[{{\\"id\\":\\"1-0\\",\\"name\\":\\"도착 공항 이름 (예: 인천 국제공항)\\",\\"time\\":\\"14:00\\",\\"lat\\":37.45584,\\"lng\\":126.4453,\\"category\\":\\"장소\\",\\"duration\\":\\"0.5시간\\",\\"notes\\":\\"공항 도착 및 입국 수속\\",\\"cost\\":\\"0\\",\\"address\\":\\"공항 주소\\"}},{{\\"id\\":\\"1-1\\",\\"name\\":\\"장소이름\\",\\"time\\":\\"15:30\\",\\"lat\\":123.1234,\\"lng\\":123.1234,\\"category\\":\\"장소\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"ㅁㅁ\\",\\"cost\\":\\"50000\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"1-2\\",\\"name\\":\\"ㅁㅁ\\",\\"time\\":\\"17:00\\",\\"lat\\":35.6936,\\"lng\\":139.7071,\\"category\\":\\"식당\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"현지 이자카야에서 다양한 음식 즐기기\\",\\"cost\\":\\"3000\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"custom-1234567890\\",\\"name\\":\\"ㅁㅁ 호텔\\",\\"time\\":\\"22:00\\",\\"lat\\":35.6762,\\"lng\\":139.6503,\\"category\\":\\"숙소\\",\\"duration\\":\\"8시간\\",\\"notes\\":\\"시내 중심가에 위치한 4성급 호텔. 무료 Wi-Fi, 조식 제공, 지하철역 도보 5분 거리. 체크인 14:00, 체크아웃 11:00, 연락처: 02-1234-5678\\",\\"cost\\":\\"120000\\",\\"address\\":\\"ㅁㅁ시 ㅁㅁ구 ㅁㅁ동 123-45\\"}}]}},{{\\"day\\":2,\\"date\\":\\"2025-05-13\\",\\"title\\":\\"2일차: ㅁㅁ 여행\\",\\"schedules\\":[{{\\"id\\":\\"2-1\\",\\"name\\":\\"ㅁㅁ 타워\\",\\"time\\":\\"10:00\\",\\"lat\\":35.6585805,\\"lng\\":139.7454329,\\"category\\":\\"장소\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"ㅁㅁ 시내 전경을 감상할 수 있는 명소\\",\\"cost\\":\\"1200\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"2-2\\",\\"name\\":\\"ㅁㅁ 멘치\\",\\"time\\":\\"13:00\\",\\"lat\\":35.714765,\\"lng\\":139.79669,\\"category\\":\\"식당\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"유명한 ㅁㅁ 멘치카츠 맛보기\\",\\"cost\\":\\"800\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"custom-0987654321\\",\\"name\\":\\"ㅁㅁ 게스트하우스\\",\\"time\\":\\"22:00\\",\\"lat\\":35.6895,\\"lng\\":139.6917,\\"category\\":\\"숙소\\",\\"duration\\":\\"8시간\\",\\"notes\\":\\"현지 분위기를 느낄 수 있는 전통 게스트하우스. 온천 시설, 한식 조식 제공. 체크인 15:00, 체크아웃 10:00, 연락처: 02-9876-5432\\",\\"cost\\":\\"80000\\",\\"address\\":\\"ㅁㅁ시 ㅁㅁ구 ㅁㅁ동 456-78\\"}}]}},{{\\"day\\":3,\\"date\\":\\"2025-05-14\\",\\"title\\":\\"3일차: ㅁㅁ 온천 여행 및 출국\\",\\"schedules\\":[{{\\"id\\":\\"3-1\\",\\"name\\":\\"ㅁㅁ 역\\",\\"time\\":\\"09:00\\",\\"lat\\":35.6896342,\\"lng\\":139.700627,\\"category\\":\\"장소\\",\\"duration\\":\\"2시간\\",\\"notes\\":\\"ㅁㅁ에서 ㅁㅁ 온천 지역으로 이동\\",\\"cost\\":\\"2500\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"3-2\\",\\"name\\":\\"ㅁㅁ 유모토\\",\\"time\\":\\"11:00\\",\\"lat\\":35.232916,\\"lng\\":139.105582,\\"category\\":\\"장소\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"온천 마을 ㅁㅁ 유모토 도착 후 휴식\\",\\"cost\\":\\"0\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"3-3\\",\\"name\\":\\"ㅁㅁ 소바집\\",\\"time\\":\\"12:00\\",\\"lat\\":35.235083,\\"lng\\":139.108167,\\"category\\":\\"식당\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"ㅁㅁ 지역의 유명한 소바 맛집\\",\\"cost\\":\\"1500\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"3-4\\",\\"name\\":\\"출발 공항 이름 (예: 나리타 국제공항)\\",\\"time\\":\\"16:00\\",\\"lat\\":35.771987,\\"lng\\":140.392903,\\"category\\":\\"장소\\",\\"duration\\":\\"2시간\\",\\"notes\\":\\"출국 수속\\",\\"cost\\":\\"0\\",\\"address\\":\\"공항 주소\\"}}]}}]\n}}
저 구조로만 반환하세요.
"""

            print(f"프롬프트 생성 완료 ({connection_id}), 길이: {len(prompt_text)} 문자")

            send_websocket_message(connection_id, {"action": "status_update", "message": "AI 모델과 통신을 시작합니다..."})
            
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                raise Exception("환경변수 'GEMINI_API_KEY'가 설정되지 않았습니다.")
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            
            # 이미지가 있는 경우와 없는 경우 페이로드 구성
            if has_images:
                # 이미지가 있는 경우: 텍스트와 이미지를 함께 전송
                parts = [{"text": prompt_text}]
                
                # Base64 이미지들을 parts에 추가
                for i, image_data in enumerate(images):
                    # "data:image/jpeg;base64," 접두사 제거
                    if image_data.startswith('data:image/'):
                        mime_type = image_data.split(';')[0].split(':')[1]  # "image/jpeg" 추출
                        base64_data = image_data.split(',')[1]  # Base64 데이터만 추출
                    else:
                        # 접두사가 없는 경우 기본값 사용
                        mime_type = "image/jpeg"
                        base64_data = image_data
                    
                    parts.append({
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64_data
                        }
                    })
                    print(f"이미지 {i+1} 추가됨 ({connection_id}): {mime_type}, 데이터 길이: {len(base64_data)}")
                
                payload = {
                    "contents": [{"parts": parts}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 8192
                    }
                }
            else:
                # 이미지가 없는 경우: 기존 방식 (텍스트만)
                payload = {
                    "contents": [{"parts": [{"text": prompt_text}]}], 
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 8192  # 출력 토큰 제한을 8192로 증가 (기본값보다 높게 설정)
                    }
                }
            
            headers = {"Content-Type": "application/json"}

            gemini_request_start_time = time.time()
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
            gemini_result_text = None
            try:
                with urllib.request.urlopen(req, timeout=120) as res: # 타임아웃 증가
                    gemini_response_status = res.status
                    gemini_result_text = res.read().decode('utf-8')
                gemini_request_end_time = time.time()
                print(f"[Gemini API] 응답 ({connection_id}). 상태: {gemini_response_status}, 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초")
                gemini_result = json.loads(gemini_result_text, parse_float=Decimal)
                
                # Gemini 응답 구조 로깅 (디버깅용)
                print(f"[Gemini API] 응답 구조 ({connection_id}):")
                if 'candidates' in gemini_result:
                    print(f"  - candidates 개수: {len(gemini_result['candidates'])}")
                    for i, candidate in enumerate(gemini_result['candidates']):
                        print(f"  - candidate[{i}] 키들: {list(candidate.keys())}")
                        if 'content' in candidate:
                            print(f"    - content 키들: {list(candidate['content'].keys())}")
                            if 'parts' in candidate['content']:
                                print(f"    - parts 개수: {len(candidate['content']['parts'])}")
                                for j, part in enumerate(candidate['content']['parts']):
                                    if isinstance(part, dict) and 'text' in part:
                                        text_len = len(part['text']) if part['text'] else 0
                                        print(f"      - part[{j}] text 길이: {text_len}")
                else:
                    print(f"  - candidates 키가 없음. 응답 키들: {list(gemini_result.keys())}")
                
            except urllib.error.HTTPError as e:
                gemini_request_end_time = time.time()
                error_body = e.read().decode('utf-8') if hasattr(e, 'read') else 'No response body'
                error_details = f"Gemini API HTTP 오류 ({connection_id}): {e.code} {e.reason}. 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초. 응답: {error_body}"
                print(error_details)
                raise Exception(error_details)
            except urllib.error.URLError as e:
                gemini_request_end_time = time.time()
                error_details = f"Gemini API URL 오류 ({connection_id}): {str(e)}. 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초"
                print(error_details)
                raise Exception(error_details)
            except Exception as e:
                gemini_request_end_time = time.time()
                error_details = f"Gemini API 기타 오류 ({connection_id}): {str(e)}. 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초"
                print(error_details)
                raise Exception(error_details)

            send_websocket_message(connection_id, {"action": "status_update", "message": "생성된 여행 계획을 저장 중입니다..."})
            
            dynamodb_write_start_time = time.time()
            dynamodb = boto3.resource('dynamodb')
            table = dynamodb.Table('travel-plans')
            
            # planId를 plan-xxxxxxxxxx 형식으로 생성 (원본과 같은 형식)
            plan_id = f'plan-{int(time.time())}'
            
            # 원본 createFunction_python.py와 같은 구조로 저장
            save_item = {
                'user_id': user_id,  # 이메일을 사용자 ID로 저장
                'planId': plan_id,   # plan-xxxxxxxxxx 형식
                'plan_data': gemini_result,
            }
            
            # 다중 항공편 정보 저장 (새로운 방식만 사용)
            if flights_to_process:
                save_item['is_round_trip'] = is_round_trip
                
                # 다중 항공편: flight_info_1, flight_info_2, ... 형태로 저장
                for i, flight in enumerate(flights_to_process):
                    save_item[f'flight_info_{i+1}'] = json.dumps(flight, cls=DecimalEncoder)
                
                # 총 항공편 개수 저장
                save_item['total_flights'] = len(flights_to_process)
                print(f"다중 항공편 저장 ({connection_id}): {len(flights_to_process)}개 항공편")
            
            # 다중 숙박 정보 저장 (새로운 방식만 사용)
            if accommodations_to_process:
                # 다중 숙박편: accmo_info_1, accmo_info_2, ... 형태로 저장
                for i, accommodation in enumerate(accommodations_to_process):
                    save_item[f'accmo_info_{i+1}'] = json.dumps(accommodation, cls=DecimalEncoder)
                
                # 총 숙박편 개수 저장
                save_item['total_accommodations'] = len(accommodations_to_process)
                print(f"다중 숙박편 저장 ({connection_id}): {len(accommodations_to_process)}개 숙박편")

            print("저장할 항목:", json.dumps(save_item, cls=DecimalEncoder))
            
            table.put_item(Item=save_item)
            dynamodb_write_end_time = time.time()
            print(f"DynamoDB 저장 완료 ({connection_id}). planId: {plan_id}, 시간: {dynamodb_write_end_time - dynamodb_write_start_time:.2f}초")

            lambda_end_time = time.time()
            total_lambda_duration = lambda_end_time - lambda_start_time
            print(f"Lambda 함수 총 실행 시간 ({connection_id}): {total_lambda_duration:.2f}초")

            # 클라이언트에게 반환할 최종 응답 (원본과 동일한 구조)
            final_response_data = {
                "action": "plan_created",
                "message": f"여행 계획이 성공적으로 생성되었습니다! ID: {plan_id}",
                "planId": plan_id,
                "redirectUrl": f"/planner/{plan_id}" # 프론트엔드 라우팅 경로
            }
            
            # Gemini 결과 파싱 검증
            final_parsed_plan_for_warning_check = None
            if gemini_result and 'candidates' in gemini_result and gemini_result['candidates']:
                try:
                    candidate = gemini_result['candidates'][0]
                    if 'content' in candidate and 'parts' in candidate['content']:
                        parts = candidate['content']['parts']
                        if parts and len(parts) > 0:
                            text_content = parts[0].get('text', '').strip()
                            print(f"Gemini 응답 텍스트 길이 ({connection_id}): {len(text_content)}")
                            
                            if text_content:
                                # JSON 파싱 시도
                                try:
                                    parsed_plan = json.loads(text_content)
                                    final_parsed_plan_for_warning_check = parsed_plan
                                    print(f"Gemini 응답 파싱 성공 ({connection_id})")
                                except json.JSONDecodeError as json_e:
                                    print(f"Gemini 응답 JSON 파싱 실패 ({connection_id}): {str(json_e)}")
                                    print(f"응답 텍스트 앞부분 (200자): {text_content[:200]}")
                            else:
                                print(f"Gemini 응답 텍스트가 비어있음 ({connection_id})")
                        else:
                            print(f"Gemini 응답에 parts가 없음 ({connection_id})")
                    else:
                        print(f"Gemini 응답에 content 또는 parts가 없음 ({connection_id})")
                except Exception as parse_e:
                    print(f"Gemini 응답 구조 파싱 실패 ({connection_id}): {str(parse_e)}")
            else:
                print(f"Gemini 응답에 candidates가 없음 ({connection_id})")
                    
            if not final_parsed_plan_for_warning_check:
                final_response_data['warning'] = '계획 내용이 백엔드에서 완전히 파싱되지 않았을 수 있습니다. ID로 조회하여 확인하세요.'

            print(f"최종 응답 데이터 ({connection_id}): planId={plan_id}")

            send_websocket_message(connection_id, final_response_data)

        except Exception as e:
            lambda_end_time = time.time()
            total_lambda_duration = lambda_end_time - lambda_start_time
            error_message_str = str(e)
            print(f'Lambda 함수 오류 ({connection_id if connection_id else "Unknown ConnectionId"}): {error_message_str}, 총 시간: {total_lambda_duration:.2f}초')
            
            if connection_id: # 연결 ID가 있으면 클라이언트에게 오류 알림
                error_payload = {
                    "action": "error",
                    "message": "여행 계획 생성 중 서버에서 오류가 발생했습니다.",
                    "error_details": error_message_str 
                }
                send_websocket_message(connection_id, error_payload)

    return {
        'statusCode': 200,
        'body': json.dumps('SQS 메시지 처리 완료', ensure_ascii=False)
    }
