class WebSocketService {
  constructor() {
    this.ws = null;
    this.messageHandlers = new Map();
    this.isConnected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket('wss://l6ya2ntrme.execute-api.ap-northeast-2.amazonaws.com/Stage/');
        
        this.ws.onopen = () => {
          console.log('WebSocket 연결 성공');
          this.isConnected = true;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] 메시지 수신:', data);
            
            const handler = this.messageHandlers.get(data.action);
            if (handler) {
              console.log(`[WebSocket] ${data.action} 핸들러 실행`);
              handler(data);
            } else {
              console.log(`[WebSocket] ${data.action}에 대한 핸들러가 없음. 등록된 핸들러:`, Array.from(this.messageHandlers.keys()));
            }
          } catch (error) {
            console.error('[WebSocket] 메시지 파싱 오류:', error, '원본 데이터:', event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 오류:', error);
          this.isConnected = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket 연결 종료');
          this.isConnected = false;
        };

      } catch (error) {
        console.error('WebSocket 연결 실패:', error);
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  sendMessage(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
      console.log('WebSocket 메시지 전송:', message);
    } else {
      console.error('WebSocket이 연결되지 않음');
      throw new Error('WebSocket 연결이 필요합니다');
    }
  }

  onMessage(action, handler) {
    this.messageHandlers.set(action, handler);
  }

  removeMessageHandler(action) {
    this.messageHandlers.delete(action);
  }

  // 여행 계획 생성 요청
  async createTravelPlan(planDetails, authToken = null) {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      // 타임아웃 설정 (3분)
      const timeout = setTimeout(() => {
        this.removeMessageHandler('plan_created');
        this.removeMessageHandler('error');
        reject(new Error('요청 시간이 초과되었습니다. (3분)'));
      }, 180000); // 3분

      // 성공 핸들러
      this.onMessage('plan_created', (data) => {
        clearTimeout(timeout);
        this.removeMessageHandler('plan_created');
        this.removeMessageHandler('error');
        console.log('[WebSocket] plan_created 처리 완료:', data);
        resolve(data);
      });

      // 오류 핸들러
      this.onMessage('error', (data) => {
        clearTimeout(timeout);
        this.removeMessageHandler('plan_created');
        this.removeMessageHandler('error');
        console.log('[WebSocket] error 처리 완료:', data);
        reject(new Error(data.message || '알 수 없는 오류가 발생했습니다'));
      });

      // 토큰 처리 로직
      let token = authToken;
      
      // 토큰이 전달되지 않은 경우 localStorage에서 가져오기 (fallback)
      if (!token) {
        token = localStorage.getItem('idToken') || localStorage.getItem('accessToken') || 'test-token';
      }
      
      // 토큰이 null, undefined, 또는 문자열이 아닌 경우 처리 (타입 체크 강화)
      if (!token || typeof token !== 'string') {
        console.warn('[WebSocket] 토큰이 유효하지 않습니다. 타입:', typeof token, '값:', token);
        token = 'test-token'; // fallback
      }
      
      // Bearer 접두사가 없으면 추가
      if (token && !token.startsWith('Bearer ')) {
        token = `Bearer ${token}`;
      }
      
      console.log('[WebSocket] 사용할 토큰 (처음 20자):', token.substring(0, 20) + '...');

      const messageData = {
        ...planDetails,
        authToken: token
      };

      // 메시지 전송
      this.sendMessage(messageData);
    });
  }
}

// 싱글톤 인스턴스
const websocketService = new WebSocketService();

export default websocketService; 