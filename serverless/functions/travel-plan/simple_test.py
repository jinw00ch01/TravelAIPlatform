import json
import time

def lambda_handler(event, context):
    # 이벤트 로깅
    print('이벤트:', json.dumps(event))
    
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
        
        # 요청 데이터 추출
        query = body.get('query', '')
        preferences = body.get('preferences', {})
        
        print('쿼리:', query)
        print('선호사항:', preferences)
        
        # 간단한 응답 생성
        mock_plan_id = f'test-plan-{int(time.time())}'
        mock_travel_plan = {
            'title': '테스트 여행 계획',
            'summary': '테스트용 간단한 여행 계획입니다.',
            'destination': '도쿄',
            'duration': '1일',
            'budget': {
                'total': 100000,
                'transportation': 30000,
                'accommodation': 40000,
                'food': 20000,
                'activities': 10000,
                'etc': 0
            },
            'itinerary': [
                {
                    'day': 1,
                    'date': '2023-06-01',
                    'title': '도쿄 첫째날',
                    'description': '도쿄 핵심 관광지 방문',
                    'activities': [
                        {
                            'time': '09:00',
                            'title': '아사쿠사 관광',
                            'description': '센소지 방문',
                            'location': '아사쿠사',
                            'cost': 0
                        }
                    ],
                    'accommodation': {
                        'name': '도쿄 게스트하우스',
                        'location': '아사쿠사',
                        'cost': 40000
                    },
                    'transportation': {
                        'method': '대중교통',
                        'from': '공항',
                        'to': '아사쿠사',
                        'cost': 10000
                    },
                    'meals': [
                        {
                            'type': '점심',
                            'suggestion': '라멘집',
                            'cost': 7000
                        }
                    ]
                }
            ],
            'tips': [
                '여행 팁1',
                '여행 팁2'
            ]
        }
        
        # 성공 응답 반환
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
                'planId': mock_plan_id,
                'plan': mock_travel_plan
            }, ensure_ascii=False)
        }
    except Exception as e:
        print('오류 발생:', str(e))
        
        # 오류 응답 반환
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