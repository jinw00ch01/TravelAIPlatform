import json
import boto3
import os

# SQS 클라이언트 초기화
sqs = boto3.client('sqs')
SQS_QUEUE_URL = os.environ.get('SQS_QUEUE_URL')  # 환경 변수에서 SQS 큐 URL 가져오기

# WebSocket 메시지 전송 클라이언트 (선택적 초기 응답용)
apigw_management_client = None
WEBSOCKET_API_ENDPOINT = os.environ.get('WEBSOCKET_API_ENDPOINT') # Lambda ②와 동일한 환경변수 사용 가능
if WEBSOCKET_API_ENDPOINT:
    apigw_management_client = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=WEBSOCKET_API_ENDPOINT
    )

def send_websocket_message(connection_id, message_data):
    if not apigw_management_client:
        print(f"WebSocket 클라이언트(apigw_management_client)가 초기화되지 않아 초기 응답을 보낼 수 없습니다.")
        return
    try:
        apigw_management_client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message_data, ensure_ascii=False)
        )
        print(f"Sent initial response to {connection_id}: Action - {message_data.get('action', 'N/A')}")
    except Exception as e:
        print(f"Failed to send initial response to {connection_id}: {str(e)}")


def lambda_handler(event, context):
    print("Lambda ① (요청 수신) 이벤트:", json.dumps(event, ensure_ascii=False))

    connection_id = event.get('requestContext', {}).get('connectionId')
    
    # API Gateway v2 HTTP API (WebSocket) 페이로드에서 body 추출
    # event['body']는 문자열 형태일 수 있음
    raw_body = event.get('body', '{}') 
    
    try:
        # 클라이언트가 JSON 문자열을 보냈다고 가정하고 파싱
        client_request_data = json.loads(raw_body)
        print(f"파싱된 클라이언트 요청 데이터 ({connection_id}): {json.dumps(client_request_data, ensure_ascii=False)}")
    except json.JSONDecodeError as e:
        print(f"본문 파싱 오류 ({connection_id}): 유효한 JSON이 아님 - '{raw_body}', 오류: {str(e)}")
        # 오류 응답을 클라이언트에게 보낼 수도 있음
        if connection_id and apigw_management_client:
            send_websocket_message(connection_id, {
                "action": "error", 
                "message": "요청 형식이 올바르지 않습니다."
            })
        return {'statusCode': 400, 'body': 'Invalid JSON format in request body'}

    if not connection_id:
        print("connectionId를 찾을 수 없습니다.")
        return {'statusCode': 500, 'body': 'connectionId is missing'}

    if not SQS_QUEUE_URL:
        print("SQS_QUEUE_URL 환경 변수가 설정되지 않았습니다.")
        # 필요시 클라이언트에게 오류 알림
        if connection_id and apigw_management_client:
             send_websocket_message(connection_id, {
                "action": "error", 
                "message": "서버 내부 구성 오류로 요청을 처리할 수 없습니다."
            })
        return {'statusCode': 500, 'body': 'SQS Queue URL not configured'}

    # SQS로 보낼 메시지 구성
    # Lambda ② (createPlanAsync.py)가 기대하는 형식에 맞춰야 함
    # requestData 필드에 클라이언트가 보낸 원본 요청 전체를 넣음
    message_to_sqs = {
        'connectionId': connection_id,
        'requestData': client_request_data  # 클라이언트가 보낸 body 전체
    }

    try:
        print(f"SQS로 메시지 전송 시도 ({connection_id}): Queue - {SQS_QUEUE_URL}")
        print(f"전송할 메시지 내용: {json.dumps(message_to_sqs, ensure_ascii=False)}")
        
        response = sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message_to_sqs, ensure_ascii=False),
            # MessageGroupId, MessageDeduplicationId 등 FIFO 큐 사용 시 필요할 수 있음
        )
        print(f"SQS 메시지 성공적으로 전송 ({connection_id}). MessageId: {response.get('MessageId')}")

        # (선택 사항) 클라이언트에게 요청 접수 확인 메시지 전송
        if apigw_management_client:
            send_websocket_message(connection_id, {
                "action": "request_received", 
                "message": "요청이 성공적으로 접수되었습니다. AI가 계획 생성을 시작합니다."
            })
        
        # API Gateway WebSocket 통합은 일반적으로 200 OK 응답을 기대함
        return {'statusCode': 200, 'body': 'Message successfully sent to SQS'}

    except Exception as e:
        print(f"SQS 메시지 전송 실패 ({connection_id}): {str(e)}")
        # 클라이언트에게 오류 알림 (선택적)
        if connection_id and apigw_management_client:
            send_websocket_message(connection_id, {
                "action": "error", 
                "message": "요청 처리 중 서버 내부 오류가 발생했습니다.",
                "error_details": str(e) # 개발 환경에서만 상세 오류 노출 고려
            })
        # API Gateway에 오류 반환
        return {
            'statusCode': 500, 
            'body': f'Failed to send message to SQS: {str(e)}'
        }
