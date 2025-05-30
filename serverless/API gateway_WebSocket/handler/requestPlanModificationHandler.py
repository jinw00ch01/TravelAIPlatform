import json
import boto3
import os

# SQS 클라이언트 초기화
sqs = boto3.client('sqs')
# 생성하신 modifyPlanQueue의 URL을 환경 변수로 설정해야 합니다.
SQS_QUEUE_URL = os.environ.get('MODIFY_PLAN_SQS_QUEUE_URL') # 예: https://sqs.ap-northeast-2.amazonaws.com/977099017123/modifyPlanQueue

# WebSocket 메시지 전송 클라이언트 (초기 응답용)
apigw_management_client = None
WEBSOCKET_API_ENDPOINT = os.environ.get('WEBSOCKET_API_ENDPOINT')
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
    print("Lambda (Plan Modification Request) 이벤트:", json.dumps(event, ensure_ascii=False))

    connection_id = event.get('requestContext', {}).get('connectionId')
    raw_body = event.get('body', '{}')

    try:
        client_request_data = json.loads(raw_body)
        print(f"파싱된 클라이언트 수정 요청 데이터 ({connection_id}): {json.dumps(client_request_data, ensure_ascii=False)}")
    except json.JSONDecodeError as e:
        print(f"본문 파싱 오류 ({connection_id}): 유효한 JSON이 아님 - '{raw_body}', 오류: {str(e)}")
        if connection_id and apigw_management_client:
            send_websocket_message(connection_id, {
                "action": "ai_modification_error", # 프론트엔드와 일치하는 오류 액션
                "message": "요청 형식이 올바르지 않습니다 (JSON 파싱 실패)."
            })
        return {'statusCode': 400, 'body': 'Invalid JSON format in request body'}

    if not connection_id:
        print("connectionId를 찾을 수 없습니다.")
        # 이 경우 클라이언트에게 알릴 방법이 마땅치 않음
        return {'statusCode': 500, 'body': 'connectionId is missing'}

    if not SQS_QUEUE_URL:
        print("MODIFY_PLAN_SQS_QUEUE_URL 환경 변수가 설정되지 않았습니다.")
        if connection_id and apigw_management_client:
             send_websocket_message(connection_id, {
                "action": "ai_modification_error",
                "message": "서버 내부 구성 오류로 계획 수정 요청을 처리할 수 없습니다."
            })
        return {'statusCode': 500, 'body': 'SQS Queue URL for modification not configured'}

    # SQS로 보낼 메시지 구성
    # modifyPlanAsync.py (가칭) 람다가 기대하는 형식
    message_to_sqs = {
        'connectionId': connection_id,
        'requestData': client_request_data.get('modificationDetails', client_request_data) # 프론트에서 보낸 데이터 전체 (action, authToken 포함될 수 있음)
        # useAIMessageHandler에서 보낸 modificationDetails 객체를 requestData로 전달
    }
    
    # requestData에 authToken이 있는지 확인하고, 없으면 client_request_data에서 가져오기
    # useAIMessageHandler.js에서 modificationDetails 객체에 authToken을 포함시키도록 수정했으므로,
    # client_request_data (즉, messageData) 안에 authToken이 이미 있을 것입니다.
    # authToken은 modifyPlanAsync.py에서 JWT 디코딩에 사용됩니다.

    try:
        print(f"SQS (ModifyPlanQueue)로 메시지 전송 시도 ({connection_id}): Queue - {SQS_QUEUE_URL}")
        print(f"전송할 메시지 내용: {json.dumps(message_to_sqs, ensure_ascii=False)}")

        response = sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message_to_sqs, ensure_ascii=False)
        )
        print(f"SQS 메시지 성공적으로 전송 ({connection_id}) to ModifyPlanQueue. MessageId: {response.get('MessageId')}")

        if apigw_management_client:
            send_websocket_message(connection_id, {
                "action": "modification_request_received", # 새로운 액션으로 변경 가능
                "message": "계획 수정 요청이 성공적으로 접수되었습니다. AI가 계획 수정을 시작합니다."
            })
        
        return {'statusCode': 200, 'body': 'Modification request successfully sent to SQS'}

    except Exception as e:
        print(f"SQS 메시지 전송 실패 ({connection_id}) to ModifyPlanQueue: {str(e)}")
        if connection_id and apigw_management_client:
            send_websocket_message(connection_id, {
                "action": "ai_modification_error",
                "message": "계획 수정 요청 처리 중 서버 내부 오류가 발생했습니다.",
                "error_details": str(e)
            })
        return {
            'statusCode': 500,
            'body': f'Failed to send modification request to SQS: {str(e)}'
        }
