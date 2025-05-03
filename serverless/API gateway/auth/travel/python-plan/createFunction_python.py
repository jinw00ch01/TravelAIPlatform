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

        query_text = body.get('query', '')
        start_date = body.get('startDate')
        end_date = body.get('endDate')
        adults = body.get('adults', 1)
        children = body.get('children', 0) 
        # 쿼리 텍스트 추출
        prompt_text = """


<요구사항>
{query_text}

장소, 일차에 맞춰 계획하세요.

<날짜>
{start_date} ~ {end_date}, 이 날짜에 맞게 계획하세요.

<인원수>
어른 : {adults}, 유아 {children}
<규칙>
모든 장소는 실제로 있는 장소여야 해. 호텔, 장소, 식당을 너가 검색해서 잡아줘.
"무조건 이름이 지도에 있는 이름이어야 해."
현실적인 일정을 잡아야 하니, 하루 총 일정에 너무 많은 이동거리가 있으면 안 돼.
(대신 교통수단을 타고 빨리 갈 수 있다면 하루 총 이동시간이 3시간 이상 5시간 이하로 잡히게)
그리고, 다음날의 첫 일정에는 전날의 호텔과 가까이 있는 걸로 해줘.
이어지는 흐름으로 갈 수 있도록.
그런데 장소와 장소 사이가 너무 가까워도 안됨.

<답변형식>
하루치 일정은 "(장소)-(식당)-(장소)-(장소)-(장소)-(식당)-(마지막 장소)" 이렇게 잡아줘.
장소 : 지도 상에 존재하는 명소나, 구경거리 (제외 : 호텔, 지하철역 등등..)
최종 답변 형식은 다른 설명 없이 "문자(장소나 식당, 너가 넣어야 할 것)"-"문자" 형식(예: ㅁ-ㅁ-ㅁ-ㅁ-ㅁ-ㅁ)이라고만 얘기해.

추가로, 하루 일정의 마지막 장소의 위도(latitude)와 경도(longitude) 정보를 포함해야 해.
Json형식으로 말야


JSON 예시
{json_example}
"""
        prompt_template = """
        
{
  "title": "ㅇㅇ ㅇ박 ㅇ일 여행",
  "summary": "ㅇㅇ만원 예산으로 ㅇㅇ 여행",
  "destination": "ㅇㅇ, ㅇㅇ",
  "duration": "ㅇ박 ㅇ일",
  "budget": {
    "total": ㅇㅇㅇㅇㅇ,
    "transportation": ㅇㅇㅇㅇㅇ,
    "accommodation": ㅇㅇㅇㅇㅇ,
    "food": ㅇㅇㅇㅇ,
    "activities": ㅇㅇㅇㅇ,
    "etc": ㅇㅇㅇㅇ
  },
  "itinerary": [
    {
      "day": 1,
      "date": "ㅇㅇㅇㅇ-ㅇㅇ-ㅇㅇ",
      "title": "ㅇㅇ 도착과 ㅇㅇ 탐방",
      "description": "ㅇㅇ 항공으로 ㅇㅇ 도착 후 ㅇㅇ 일대 관광",
      "activities": [
        {
          "time": "ㅇㅇ:ㅇㅇ",
          "title": "ㅇㅇ 출발",
          "description": "ㅇㅇ항공 이용",
          "location": "ㅇㅇㅇㅇㅇㅇㅇㅇ",
          "cost": ㅇㅇㅇㅇ
        },
        {
          "time": "ㅇㅇ:ㅇㅇ",
          "title": "ㅇㅇ 도착",
          "description": "ㅇㅇㅇㅇㅇ 탑승",
          "location": "ㅇㅇㅇㅇㅇㅇㅇㅇ",
          "cost": ㅇㅇㅇㅇ
        },
        {
          "time": "ㅇㅇ:ㅇㅇ",
          "title": "ㅇㅇ 방문",
          "description": "ㅇㅇ에서 유명한 장소 방문",
          "location": "ㅇㅇㅇㅇ",
          "cost": ㅇㅇㅇ
        },
        {
          "time": "ㅇㅇ:ㅇㅇ",
          "title": "ㅇㅇ 저녁 식사",
          "description": "ㅇㅇ 거리에서 저녁",
          "location": "ㅇㅇㅇ 거리",
          "cost": ㅇㅇㅇㅇ
        }
      ],
      "accommodation": {
        "name": "ㅇㅇㅇㅇㅇㅇ ㅇㅇㅇㅇ",
        "location": "ㅇㅇㅇ",
        "cost": ㅇㅇㅇㅇ
      },
      "transportation": {
        "method": "ㅇㅇㅇ/ㅇㅇㅇㅇㅇㅇ",
        "from": "ㅇㅇㅇ",
        "to": "ㅇㅇㅇ",
        "cost": ㅇㅇㅇㅇ
      },
      "meals": [
        {
          "type": "저녁",
          "suggestion": "ㅇㅇㅇㅇ",
          "cost": ㅇㅇㅇㅇ
        }
      ],
      "last_location": {
        "name": "ㅇㅇㅇ 거리",
        "latitude": ㅇㅇ.ㅇㅇㅇㅇ,
        "longitude": ㅇㅇㅇ.ㅇㅇㅇㅇ
      }
    }
  ],
  "tips": [
    "ㅇㅇ은 대중교통이 잘 되어 있어 ㅇㅇ 패스를 활용하면 효율적입니다.",
    "ㅇㅇ 식사는 저렴하고 맛도 좋아 예산 절감에 좋습니다."
  ]
}
"""
        prompt_text = prompt_text.format(
            query_text=query_text,
            start_date=start_date,
            end_date=end_date,
            adults=adults,
            children=children,
            json_example = prompt_template
        )


        # Gemini API 호출
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            raise Exception("환경변수 'GEMINI_API_KEY'가 설정되지 않았습니다.")
            
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"

        payload = {
            "contents": [ {
                "parts": [ {"text": prompt_text} ]
            } ],
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

        table.put_item(
            Item={
                'user_id': user_id,  # 이메일을 사용자 ID로 저장
                'planId': plan_id,
                'plan_data': gemini_result
            }
        )

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
                'plan': gemini_result
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
                'message': '여행 계획 생성 중 오류가 발생했습니다.',
                'error': str(e)
            }, ensure_ascii=False)
        }