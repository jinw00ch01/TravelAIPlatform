import json
import urllib.request
import boto3
import time
import os
from decimal import Decimal
import jwt  # pyjwt 라이브러리 import

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
도착 공항 위도/경도: {4}/{5}

*** 중요: 항공편 도착 시간({3})을 첫 일정의 시작 시간으로 고려하세요. 첫 일정은 항공편 도착 후 최소 1시간 이후에 시작되어야 합니다. 모든 시간은 해당 공항의 현지 시간대입니다. ***
""".format(origin_code, destination_code, departure_time, arrival_time, out_arrival_geo_lat or 'Unknown', out_arrival_geo_lng or 'Unknown')

            # 왕복 항공편 정보 추가
            if is_round_trip:
                try:
                    prompt_text += """
<복귀 항공편 정보>
출발지: {0}
도착지: {1}
출발 시간: {2}
출발 공항 위도/경도: {4}/{5}
도착 시간: {3}

*** 중요: 마지막 일정은 복귀 항공편 출발 시간({2}) 최소 2시간 전에 종료되어야 합니다. 모든 시간은 해당 공항의 현지 시간대입니다. ***
""".format(destination_code, origin_code, return_departure_time, return_arrival_time, in_depart_geo_lat or 'Unknown', in_depart_geo_lng or 'Unknown')

                    print("왕복 항공편 정보 처리됨:",
                          {"출발지": destination_code, "도착지": origin_code,
                           "출발시간": return_departure_time, "도착시간": return_arrival_time,
                           "위도": in_depart_geo_lat, "경도": in_depart_geo_lng})
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
어른 : {3}, 유아 {4}
<규칙>
모든 장소는 실제로 있는 장소여야 해. 호텔, 장소, 식당을 너가 검색해서 잡아줘.
"무조건 이름이 지도에 있는 이름이어야 해."
현실적인 일정을 잡아야 하니, 하루 총 일정에 너무 많은 이동거리가 있으면 안 돼.
그리고, 다음날의 첫 일정에는 전날의 호텔과 가까이 있는 걸로 해줘.
이어지는 흐름으로 갈 수 있도록.
그런데 장소와 장소 사이가 너무 가까워도 안됨.

<답변형식>
하루치 일정은 \"(관광지)-(식당)-(관광지)-(관광지)-(관광지)-(관광지)-(마지막 관광지)\" 이렇게 잡아줘.
관광지 : 지도 상에 존재하는 명소나, 구경거리 (제외 : 호텔, 지하철역,항공 등등..) 만 넣어야해.
추가로, 하루 일정의 마지막 장소의 위도(latitude)와 경도(longitude) 정보를 포함해야 해.


JSON 예시
{5}
""".format(
            query_text, 
            start_date, 
            end_date, 
            adults, 
            children,
            """
{\"title\":\"ㅁㅁ ㅁ박 ㅁ일 여행\",\"days\":[{\"day\":1,\"date\":\"2025-05-12\",\"title\":\"1일차: ㅁㅁ 방문\",\"schedules\":[{\"id\":\"1-1\",\"name\":\"장소이름\",\"time\":\"14:00\",\"lat\":123.1234,\"lng\":123.1234,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ\",\"cost\":\"50000\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"1-2\",\"name\":\"ㅁㅁ\",\"time\":\"17:00\",\"lat\":35.6936,\"lng\":139.7071,\"category\":\"식당\",\"duration\":\"1시간\",\"notes\":\"현지 이자카야에서 다양한 음식 즐기기\",\"cost\":\"3000\",\"address\":\"ㅁㅁ 주소\"}]},{\"day\":2,\"date\":\"2025-05-13\",\"title\":\"2일차: ㅁㅁ 여행\",\"schedules\":[{\"id\":\"2-1\",\"name\":\"ㅁㅁ 타워\",\"time\":\"10:00\",\"lat\":35.6586,\"lng\":139.7454,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ 시내 전경을 감상할 수 있는 명소\",\"cost\":\"1200\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"2-2\",\"name\":\"ㅁㅁ 멘치\",\"time\":\"13:00\",\"lat\":35.7148,\"lng\":139.7967,\"category\":\"식당\",\"duration\":\"1시간\",\"notes\":\"유명한 ㅁㅁ 멘치카츠 맛보기\",\"cost\":\"800\",\"address\":\"ㅁㅁ 주소\"}]},{\"day\":3,\"date\":\"2025-05-14\",\"title\":\"3일차: ㅁㅁ 온천 여행\",\"schedules\":[{\"id\":\"3-1\",\"name\":\"ㅁㅁ 역\",\"time\":\"09:00\",\"lat\":35.6896,\"lng\":139.7006,\"category\":\"장소\",\"duration\":\"2시간\",\"notes\":\"ㅁㅁ에서 ㅁㅁ 온천 지역으로 이동\",\"cost\":\"2500\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"3-2\",\"name\":\"ㅁㅁ 유모토\",\"time\":\"11:00\",\"lat\":35.2329,\"lng\":139.1056,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"온천 마을 ㅁㅁ 유모토 도착 후 휴식\",\"cost\":\"0\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"3-3\",\"name\":\"ㅁㅁ 소바집\",\"time\":\"12:00\",\"lat\":35.2351,\"lng\":139.1082,\"category\":\"식당\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ 지역의 유명한 소바 맛집\",\"cost\":\"1500\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"3-4\",\"name\":\"ㅁㅁ 로프웨이\",\"time\":\"14:00\",\"lat\":35.2484,\"lng\":139.0203,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ 로프웨이를 타고 산 정상에서 경치 감상\",\"cost\":\"1300\",\"address\":\"ㅁㅁ 주소\"},{\"id\":\"3-5\",\"name\":\"ㅁㅁ 호수\",\"time\":\"16:00\",\"lat\":35.2066,\"lng\":139.0260,\"category\":\"장소\",\"duration\":\"1시간\",\"notes\":\"ㅁㅁ 호수에서 유람선을 타고 경치 감상\",\"cost\":\"1000\",\"address\":\"ㅁㅁ 주소\"}]}]}
저 구조로만 반환하세요.
"""
        )

        # Gemini API 호출
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            raise Exception("환경변수 'GEMINI_API_KEY'가 설정되지 않았습니다.")
            
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"

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

        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
        with urllib.request.urlopen(req) as res:
            gemini_result = json.loads(res.read().decode(), parse_float=Decimal)

        print('Gemini 응답:', json.dumps(gemini_result, ensure_ascii=False, cls=DecimalEncoder))

        # DynamoDB에 저장
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

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps({
                'message': '여행 계획이 성공적으로 생성되었습니다.',
                'planId': plan_id,
                'plan': gemini_result,
                'flightInfo': flight_info,
                'isRoundTrip': is_round_trip
            }, ensure_ascii=False, cls=DecimalEncoder)
        }

    except Exception as e:
        print('오류 발생:', str(e))

        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
            },
            'body': json.dumps({
                'message': '오류가 발생했습니다.',
                'error': str(e)
            })
        }