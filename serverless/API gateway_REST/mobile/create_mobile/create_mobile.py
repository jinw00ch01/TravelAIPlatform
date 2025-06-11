import json
import urllib.request
import boto3
import time
import os
from decimal import Decimal
import jwt  # pyjwt 라이브러리 import
import urllib.error # URLError, HTTPError를 잡기 위해 추가

# Decimal을 JSON으로 직렬화할 수 있게 도와주는 함수
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def decode_jwt(token):
    try:
        # 서명 검증 없이 디코딩 (보안상 권장하지 않음)
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        return decoded_token
    except jwt.ExpiredSignatureError:
        print('토큰이 만료되었습니다.')
    except jwt.InvalidTokenError:
        print('유효하지 않은 토큰입니다.')
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

    print("이벤트:", json.dumps(event))

    # --- 전체 함수 실행 시작 시간 기록 ---
    lambda_start_time = time.time()

    try:
        # 요청 본문 파싱
        try:
            if isinstance(event.get('body'), str):
                body = json.loads(event['body'])
            else:
                body = event.get('body', {})
        except Exception as e:
            print('요청 본문 파싱 오류:', str(e))
            return {
                'statusCode': 400,  
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
                },
                'body': json.dumps({
                    'message': '요청 본문 형식이 올바르지 않습니다.',
                    'error': str(e)
                })
            }

        # JWT 토큰에서 사용자 이메일 추출
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization')
        user_id = 'anonymous'
        is_round_trip = False  # <--- 여기에 기본값 선언!

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]  # 'Bearer ' 이후 부분 추출
            decoded_token = decode_jwt(token)
            
            if decoded_token:
                # 이메일을 사용자 ID로 사용
                user_id = decoded_token.get('email', 'anonymous')
                print('토큰에서 추출한 사용자 이메일:', user_id)
            else:
                print('토큰 디코딩 실패, 기본 사용자 ID 사용')
        else:
            print('Authorization 헤더가 없거나 잘못된 형식, 기본 사용자 ID 사용')

        # 요청 파라미터 추출
        query_text = body.get('query', '')
        start_date = body.get('startDate')
        end_date = body.get('endDate')
        adults = body.get('adults', 1)
        children = body.get('children', 0) 
        flight_info = body.get('flightInfo', None)
        accommodation_info = body.get('accommodationInfo', None)
        
        # Base64 이미지 처리 추가
        images = body.get('images', [])  # Base64 이미지 배열
        has_images = len(images) > 0
        print(f"수신된 이미지 개수: {len(images)}")

        # Geo 정보 기본값 초기화
        out_arrival_geo_lat = None
        out_arrival_geo_lng = None
        in_depart_geo_lat = None
        in_depart_geo_lng = None

        # 항공편 정보가 있으면 추가
        if flight_info:
            # 항공편 정보가 원본 JSON 형태로 전달된 경우 (전체 flight-offer 객체)
            if 'itineraries' in flight_info:
                # 왕복 항공편인지 확인
                is_round_trip = len(flight_info.get('itineraries', [])) > 1
                
                # 첫 번째 여정 정보 추출 (프롬프트 구성용)
                first_itinerary = flight_info['itineraries'][0]
                first_segment = first_itinerary['segments'][0]
                last_segment = first_itinerary['segments'][-1]
                origin_code = first_segment['departure']['iataCode']
                destination_code = last_segment['arrival']['iataCode']
                
                # 시간 정보 추출
                departure_date = first_segment['departure']['at']
                departure_time = departure_date.split('T')[1][:5] if 'T' in departure_date else departure_date
                
                arrival_date = last_segment['arrival']['at']
                arrival_time = arrival_date.split('T')[1][:5] if 'T' in arrival_date else arrival_date
                
                # GeoCode 정보 추출 (가는 편 도착 공항)
                out_arrival_geo_lat = last_segment.get('arrival', {}).get('geoCode', {}).get('latitude')
                out_arrival_geo_lng = last_segment.get('arrival', {}).get('geoCode', {}).get('longitude')
                
                # 왕복 정보 처리
                return_departure_time = None
                return_arrival_time = None
                if is_round_trip and len(flight_info['itineraries']) > 1:
                    # 오는 편 정보 추출
                    return_itinerary = flight_info['itineraries'][1]
                    return_first_segment = return_itinerary['segments'][0]
                    return_last_segment = return_itinerary['segments'][-1]
                    
                    # 귀국편 정보 캡처 (DynamoDB에 저장용)
                    flight_info['returnDate'] = return_first_segment['departure']['at']
                    flight_info['returnArrivalDate'] = return_last_segment['arrival']['at']
                    flight_info['returnCarrierCode'] = return_first_segment['carrierCode']
                    flight_info['returnDuration'] = return_itinerary['duration']
                    flight_info['returnStops'] = len(return_itinerary['segments']) - 1
                    
                    return_departure_date = return_first_segment['departure']['at']
                    return_departure_time = return_departure_date.split('T')[1][:5] if 'T' in return_departure_date else return_departure_date
                    
                    return_arrival_date = return_last_segment['arrival']['at']
                    return_arrival_time = return_arrival_date.split('T')[1][:5] if 'T' in return_arrival_date else return_arrival_date
                    
                    # GeoCode 정보 추출 (오는 편 출발 공항)
                    in_depart_geo_lat = return_first_segment.get('departure', {}).get('geoCode', {}).get('latitude')
                    in_depart_geo_lng = return_first_segment.get('departure', {}).get('geoCode', {}).get('longitude')
                
                # 개발 디버그용 로그
                print("항공편 정보 처리됨:", json.dumps(flight_info, cls=DecimalEncoder))
                print("왕복 여부:", is_round_trip, "returnDate:", flight_info.get('returnDate'))
            
            # 기존 변환된 형식인 경우 (하위 호환성 유지)
            else:
                origin_code = flight_info.get('originCode', '')
                destination_code = flight_info.get('destinationCode', '')
                
                try:
                    departure_date = flight_info.get('departureDate', '')
                    departure_time = departure_date.split('T')[1][:5] if 'T' in departure_date else departure_date
                    
                    arrival_date = flight_info.get('arrivalDate', '')
                    arrival_time = arrival_date.split('T')[1][:5] if 'T' in arrival_date else arrival_date
                except:
                    departure_time = flight_info.get('departureDate', '')
                    arrival_time = flight_info.get('arrivalDate', '')
                
                # 왕복 항공편인지 확인
                is_round_trip = flight_info.get('isRoundTrip', False)
                if not is_round_trip and flight_info.get('returnDate', None):  # 하위 호환성 유지
                    is_round_trip = True
                
                # 왕복 시간 정보
                return_departure_time = None
                return_arrival_time = None
                if is_round_trip:
                    # returnInfo 객체가 있는 경우
                    if 'returnInfo' in flight_info:
                        return_departure_date = flight_info['returnInfo'].get('departureDate', '')
                        return_departure_time = return_departure_date.split('T')[1][:5] if 'T' in return_departure_date else return_departure_date
                        
                        return_arrival_date = flight_info['returnInfo'].get('arrivalDate', '')
                        return_arrival_time = return_arrival_date.split('T')[1][:5] if 'T' in return_arrival_date else return_arrival_date

                    # GeoCode 정보 추출 시도 (레거시 구조에서는 제공되지 않을 수 있음)
                    try:
                        in_depart_geo_lat = flight_info['returnInfo'].get('geoCode', {}).get('latitude')
                        in_depart_geo_lng = flight_info['returnInfo'].get('geoCode', {}).get('longitude')
                    except:  # noqa
                        pass

        # 프롬프트 구성 시작
        prompt_text = ""

        # 항공편 정보가 있으면 추가
        if flight_info:
            # 항공편 정보 추가
            prompt_text += """
<항공편 정보>
출발지: {0}
도착지: {1}
출발 시간: {2}
도착 시간: {3}
도착 공항 이름: {6} (공항 코드는 {1})
도착 공항 위도/경도: {4}/{5}

*** 중요: 첫날 첫 번째 일정은 반드시 <항공편 정보>의 '도착지' 공항에 '도착 시간'에 도착하는 것으로 생성하고, 해당 공항의 이름, 위도, 경도를 `schedules`에 포함하세요. 이 도착 일정 후 다음 실제 활동(예: 호텔 체크인)은 최소 1시간 이후에 시작되어야 합니다. 모든 시간은 해당 공항의 현지 시간대입니다. ***
""".format(origin_code, destination_code, departure_time, arrival_time, out_arrival_geo_lat or 'Unknown', out_arrival_geo_lng or 'Unknown', flight_info.get('itineraries', [{}])[0].get('segments', [{}])[-1].get('arrival', {}).get('airportInfo', {}).get('koreanName', destination_code)) # 도착 공항 이름 추가

            # 왕복 항공편 정보 추가
            if is_round_trip:
                try:
                    # 왕복 항공편의 경우, 도착 공항 이름 (출발지가 됨)
                    return_origin_airport_name = destination_code # 기본값
                    
                    # 안전하게 값을 가져오기 위한 다중 .get() 사용 및 기본값 설정
                    itineraries = flight_info.get('itineraries', [])
                    if len(itineraries) > 1:
                        segments = itineraries[1].get('segments', [])
                        if segments:
                            departure_info = segments[0].get('departure', {})
                            airport_info = departure_info.get('airportInfo', {})
                            # airport_info가 존재하고, 그 안에 koreanName이 있으면 해당 값을 사용, 없으면 destination_code 사용
                            return_origin_airport_name = airport_info.get('koreanName', destination_code) if isinstance(airport_info, dict) else destination_code

                    prompt_text += """

<복귀 항공편 정보>
출발지: {0}
도착지: {1}
출발 시간: {2}
출발 공항 이름: {6} (공항 코드는 {0})
출발 공항 위도/경도: {4}/{5}
도착 시간: {3}

*** 중요: 마지막 날 마지막 일정은 복귀 항공편 출발 시간({2}) 최소 2시간 전에 해당 공항({6})에서 출발 준비를 마치는 것으로 생성하고, `schedules`에 해당 공항 정보를 포함해야 합니다. 모든 시간은 해당 공항의 현지 시간대입니다. ***
""".format(destination_code, origin_code, return_departure_time, return_arrival_time, 
           str(in_depart_geo_lat) if in_depart_geo_lat is not None else 'Unknown', 
           str(in_depart_geo_lng) if in_depart_geo_lng is not None else 'Unknown', 
           return_origin_airport_name)

                    # 로깅 데이터 구성 시 위도/경도 값을 문자열로 변환
                    log_data = {
                        "출발지": destination_code, 
                        "도착지": origin_code,
                        "출발시간": return_departure_time, 
                        "도착시간": return_arrival_time,
                        "위도": str(in_depart_geo_lat) if in_depart_geo_lat is not None else 'Unknown',
                        "경도": str(in_depart_geo_lng) if in_depart_geo_lng is not None else 'Unknown',
                        "출발공항이름": return_origin_airport_name
                    }
                    print("왕복 항공편 정보 처리됨 (json):", json.dumps(log_data, ensure_ascii=False, cls=DecimalEncoder))
                except Exception as e:
                    print("왕복 항공편 정보 처리 중 오류:", str(e))

        # 숙박 정보가 있으면 추가
        if accommodation_info:
            try:
                hotel = accommodation_info.get('hotel', {})
                hotel_name = hotel.get('hotel_name_trans') or hotel.get('hotel_name') or hotel.get('name') or 'Unknown Hotel'
                hotel_lat = hotel.get('latitude') or hotel.get('lat') or hotel.get('latitude_raw') or 'Unknown'
                hotel_lng = hotel.get('longitude') or hotel.get('lng') or hotel.get('longitude_raw') or 'Unknown'

                checkin_dt = accommodation_info.get('checkIn')
                checkout_dt = accommodation_info.get('checkOut')

                prompt_text += """
<숙박 정보>
호텔명: {0}
체크인 시간: {1}
체크아웃 시간: {2}
호텔 위도/경도: {3}/{4}

*** 중요: 첫날 일정에 호텔 체크인을 포함하고, 매일 일정은 호텔에서 시작하여 호텔로 돌아오는 구조로 작성하세요. 마지막 날 일정은 호텔 체크아웃 이후, 복귀 항공편 출발 공항으로 이동하는 루트를 포함해야 합니다. 모든 시간은 호텔 위치의 현지 시간대입니다. ***
""".format(hotel_name, checkin_dt, checkout_dt, hotel_lat, hotel_lng)
            except Exception as e:
                print("숙박 정보 처리 중 오류:", str(e))

        # 기본 요구사항 추가
        prompt_text += """
<요구사항>
{0}

장소, 일차에 맞춰 계획하세요.

<날짜>
{1} ~ {2}, 이 날짜에 맞게 계획하세요.

<인원수>
어른 : {3}, 유아 {4}""".format(query_text, start_date, end_date, adults, children)

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
관광지 : 지도 상에 존재하는 명소나, 구경거리 (제외 : 호텔, 지하철역,항공 등등..) 만 넣어야해.
추가로, 하루 일정의 마지막 장소의 위도(latitude)와 경도(longitude) 정보를 포함해야 해.
항공편 도착/출발 공항도 '장소'로 취급하여 일정에 포함해야 한다.


JSON 예시
{5}
저 구조로만 반환하세요.
""".format(
            query_text, 
            start_date, 
            end_date, 
            adults, 
            children,
            """
{{\\"title\\":\\"ㅁㅁ ㅁ박 ㅁ일 여행\\",\\"days\\":[{{\\"day\\":1,\\"date\\":\\"2025-05-12\\",\\"title\\":\\"1일차: 공항 도착 및 ㅁㅁ 방문\\",\\"schedules\\":[{{\\"id\\":\\"1-0\\",\\"name\\":\\"도착 공항 이름 (예: 인천 국제공항)\\",\\"time\\":\\"14:00\\",\\"lat\\":37.45584,\\"lng\\":126.4453,\\"category\\":\\"장소\\",\\"duration\\":\\"0.5시간\\",\\"notes\\":\\"공항 도착 및 입국 수속\\",\\"cost\\":\\"0\\",\\"address\\":\\"공항 주소\\"}},{{\\"id\\":\\"1-1\\",\\"name\\":\\"장소이름\\",\\"time\\":\\"15:30\\",\\"lat\\":123.1234,\\"lng\\":123.1234,\\"category\\":\\"장소\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"ㅁㅁ\\",\\"cost\\":\\"50000\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"1-2\\",\\"name\\":\\"ㅁㅁ\\",\\"time\\":\\"17:00\\",\\"lat\\":35.6936,\\"lng\\":139.7071,\\"category\\":\\"식당\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"현지 이자카야에서 다양한 음식 즐기기\\",\\"cost\\":\\"3000\\",\\"address\\":\\"ㅁㅁ 주소\\"}}]}},{{\\"day\\":2,\\"date\\":\\"2025-05-13\\",\\"title\\":\\"2일차: ㅁㅁ 여행\\",\\"schedules\\":[{{\\"id\\":\\"2-1\\",\\"name\\":\\"ㅁㅁ 타워\\",\\"time\\":\\"10:00\\",\\"lat\\":35.6585805,\\"lng\\":139.7454329,\\"category\\":\\"장소\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"ㅁㅁ 시내 전경을 감상할 수 있는 명소\\",\\"cost\\":\\"1200\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"2-2\\",\\"name\\":\\"ㅁㅁ 멘치\\",\\"time\\":\\"13:00\\",\\"lat\\":35.714765,\\"lng\\":139.79669,\\"category\\":\\"식당\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"유명한 ㅁㅁ 멘치카츠 맛보기\\",\\"cost\\":\\"800\\",\\"address\\":\\"ㅁㅁ 주소\\"}}]}},{{\\"day\\":3,\\"date\\":\\"2025-05-14\\",\\"title\\":\\"3일차: ㅁㅁ 온천 여행 및 출국\\",\\"schedules\\":[{{\\"id\\":\\"3-1\\",\\"name\\":\\"ㅁㅁ 역\\",\\"time\\":\\"09:00\\",\\"lat\\":35.6896342,\\"lng\\":139.700627,\\"category\\":\\"장소\\",\\"duration\\":\\"2시간\\",\\"notes\\":\\"ㅁㅁ에서 ㅁㅁ 온천 지역으로 이동\\",\\"cost\\":\\"2500\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"3-2\\",\\"name\\":\\"ㅁㅁ 유모토\\",\\"time\\":\\"11:00\\",\\"lat\\":35.232916,\\"lng\\":139.105582,\\"category\\":\\"장소\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"온천 마을 ㅁㅁ 유모토 도착 후 휴식\\",\\"cost\\":\\"0\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"3-3\\",\\"name\\":\\"ㅁㅁ 소바집\\",\\"time\\":\\"12:00\\",\\"lat\\":35.235083,\\"lng\\":139.108167,\\"category\\":\\"식당\\",\\"duration\\":\\"1시간\\",\\"notes\\":\\"ㅁㅁ 지역의 유명한 소바 맛집\\",\\"cost\\":\\"1500\\",\\"address\\":\\"ㅁㅁ 주소\\"}},{{\\"id\\":\\"3-4\\",\\"name\\":\\"출발 공항 이름 (예: 나리타 국제공항)\\",\\"time\\":\\"16:00\\",\\"lat\\":35.771987,\\"lng\\":140.392903,\\"category\\":\\"장소\\",\\"duration\\":\\"2시간\\",\\"notes\\":\\"출국 수속\\",\\"cost\\":\\"0\\",\\"address\\":\\"공항 주소\\"}}]}}]\n}}
"""
        )

        # Gemini API 호출
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            print("환경변수 'GEMINI_API_KEY'가 설정되지 않았습니다.") # 로그 강화
            raise Exception("환경변수 'GEMINI_API_KEY'가 설정되지 않았습니다.") # 명시적 예외 발생
            
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
                print(f"이미지 {i+1} 추가됨: {mime_type}, 데이터 길이: {len(base64_data)}")
            
            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "temperature": 0.3
                }
            }
        else:
            # 이미지가 없는 경우: 기존 방식 (텍스트만)
            payload = {
                "contents": [{
                    "parts": [{"text": prompt_text}]
                }],
                "generationConfig": {
                    "temperature": 0.3
                }
            }

        headers = {
            "Content-Type": "application/json"
        }

        gemini_request_start_time = time.time() # Gemini API 호출 시작 시간
        print(f"[Gemini API] 요청 시작. URL: {url}")
        print(f"[Gemini API] 요청 페이로드 (일부): {json.dumps(payload, cls=DecimalEncoder)[:500]}...") # 페이로드 일부 로깅

        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers) # 인코딩 명시
        gemini_result_text = None
        try:
            # urlopen에 timeout 설정 (예: 50초)
            with urllib.request.urlopen(req, timeout=50) as res: # timeout 초 단위
                gemini_response_status = res.status
                gemini_result_text = res.read().decode('utf-8') # 디코딩 명시
            gemini_request_end_time = time.time() # Gemini API 호출 종료 시간
            print(f"[Gemini API] 응답 수신 완료. 상태 코드: {gemini_response_status}, 소요 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초")
            
            gemini_result = json.loads(gemini_result_text, parse_float=Decimal)

        except urllib.error.HTTPError as e:
            gemini_request_end_time = time.time()
            print(f"[Gemini API] HTTPError 발생. 상태 코드: {e.code}, 소요 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초, 이유: {e.reason}")
            print(f"[Gemini API] HTTPError 내용: {e.read().decode('utf-8', errors='replace')}") # 오류 내용 디코딩 시도
            raise Exception(f"Gemini API HTTPError: {e.code} - {e.reason}")
        except urllib.error.URLError as e:
            gemini_request_end_time = time.time()
            print(f"[Gemini API] URLError 발생. 소요 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초, 이유: {e.reason}")
            # e.reason이 문자열이 아닌 경우 처리 (예: socket.timeout 객체)
            reason_str = str(e.reason) if hasattr(e.reason, '__str__') else repr(e.reason)
            raise Exception(f"Gemini API URLError: {reason_str}")
        except Exception as e: # 그 외 예외 (json.loads 등)
            gemini_request_end_time = time.time()
            print(f"[Gemini API] 처리 중 기타 오류 발생. 소요 시간: {gemini_request_end_time - gemini_request_start_time:.2f}초, 오류: {str(e)}")
            if gemini_result_text: # 응답이 있었지만 파싱 실패한 경우 로그
                 print(f"[Gemini API] 오류 발생 시 응답 텍스트 (일부): {gemini_result_text[:500]}...")
            raise Exception(f"Gemini API 응답 처리 중 오류: {str(e)}")


        print('Gemini 응답 (일부):', json.dumps(gemini_result, ensure_ascii=False, cls=DecimalEncoder)[:500] + "...") # 로그 길이 제한

        # DynamoDB에 저장
        dynamodb_write_start_time = time.time() # DynamoDB 저장 시작 시간
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('travel-plans')

        plan_id = f'plan-{int(time.time())}'
        
        # 항공편 정보를 별도의 필드로 저장
        save_item = {
            'user_id': user_id,  # 이메일을 사용자 ID로 저장
            'planId': plan_id,
            'plan_data': gemini_result,
        }
        
        # 항공편 정보가 있으면 추가
        if flight_info:
            save_item['flight_info'] = json.dumps(flight_info)
            # 왕복 여부 플래그 추가
            save_item['is_round_trip'] = is_round_trip
            
            # 왕복 항공 정보는 별도로 저장하지 않음 (flight_info에 모든 정보가 있음)
            # flight_info 객체 안에 이미 가는 편과 오는 편 정보가 모두 포함되어 있음
            if is_round_trip:
                print("왕복 항공편 정보가 flight_info에 모두 포함됨")
                
        # 숙박 정보가 있으면 추가
        if accommodation_info:
            try:
                save_item['accmo_info'] = json.dumps(accommodation_info)
            except Exception:
                save_item['accmo_info'] = str(accommodation_info)

        print("저장할 항목:", json.dumps(save_item, cls=DecimalEncoder))
        
        table.put_item(Item=save_item)
        dynamodb_write_end_time = time.time() # DynamoDB 저장 종료 시간
        print(f"DynamoDB 저장 완료. 소요 시간: {dynamodb_write_end_time - dynamodb_write_start_time:.2f}초")

        # --- 전체 함수 실행 종료 시간 기록 ---
        lambda_end_time = time.time()
        total_lambda_duration = lambda_end_time - lambda_start_time
        print(f"Lambda 함수 총 실행 시간: {total_lambda_duration:.2f}초")

        # 클라이언트에게 반환할 최종 응답 본문
        client_response_body = {
            'message': '여행 계획이 성공적으로 생성되었으며, ID로 조회 가능합니다.',
            'planId': plan_id,
            'plan': gemini_result
        }

        # (선택 사항) Gemini 결과 파싱 시도 및 경고 추가
        final_parsed_plan_for_warning_check = None
        if gemini_result and 'candidates' in gemini_result and gemini_result['candidates']:
            try:
                plan_text_content = gemini_result['candidates'][0]['content']['parts'][0]['text']
                cleaned_plan_text = plan_text_content.strip()
                if cleaned_plan_text.startswith("```json"):
                    cleaned_plan_text = cleaned_plan_text[7:]
                if cleaned_plan_text.endswith("```"):
                    cleaned_plan_text = cleaned_plan_text[:-3]
                final_parsed_plan_for_warning_check = json.loads(cleaned_plan_text.strip(), parse_float=Decimal)
            except Exception as e:
                print(f"Error parsing Gemini response content (for warning check only): {str(e)}")
        
        if not final_parsed_plan_for_warning_check:
             client_response_body['warning'] = '계획 내용이 백엔드에서 완전히 파싱되지 않았을 수 있습니다. ID로 조회하여 확인하세요.'

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps(client_response_body, ensure_ascii=False, cls=DecimalEncoder)
        }

    except Exception as e:
        # --- 전체 함수 실행 종료 시간 기록 (오류 시) ---
        lambda_end_time = time.time()
        total_lambda_duration = lambda_end_time - lambda_start_time
        error_message = str(e)
        print(f'Lambda 함수 총 실행 시간 (오류 발생): {total_lambda_duration:.2f}초, 오류: {error_message}')

        # 오류 응답에도 CORS 헤더 포함
        return {
            'statusCode': 500, # 또는 구체적인 오류 코드
            'headers': {
                'Content-Type': 'application/json; charset=utf-8', # charset=utf-8 추가
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps({
                'message': '오류가 발생했습니다.',
                'error': error_message 
            }, ensure_ascii=False) # cls=DecimalEncoder 불필요할 수 있음
        }