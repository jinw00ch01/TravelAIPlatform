import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL 환경 변수에서 가져오기 (문제가 해결될 때까지 임시로 직접 지정)
const API_URL = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage';

// Booking.com 호텔 검색 Lambda 함수를 위한 API Gateway 엔드포인트 URL
const SEARCH_HOTELS_URL = `${API_URL}/api/Booking-com/SearchHotelsByCoordinates`;

// axios 재시도 로직 구현
axios.interceptors.response.use(null, async (error) => {
  // 원본 요청 설정 가져오기
  const config = error.config;
  
  // 재시도 회수 설정이 있고 최대 재시도 회수에 도달하지 않았다면
  if (config.retry && (!config._retryCount || config._retryCount < config.retry)) {
    // 재시도 횟수 증가
    config._retryCount = config._retryCount ? config._retryCount + 1 : 1;
    
    // 재시도 딜레이 설정
    const delay = config.retryDelay || 1000;
    
    // 로그 출력
    console.log(`요청 재시도 (${config._retryCount}/${config.retry}): ${config.url}`);
    
    // 지정된 시간만큼 대기
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 같은 설정으로 요청 재시도
    return axios(config);
  }
  
  // 모든 재시도가 실패하면 오류 전달
  return Promise.reject(error);
});

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false // CORS 요청 시 credentials 전송 안함
});

// 요청 인터셉터 - 인증 토큰 추가
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Amplify 세션에서 JWT 토큰 가져오기
      const { tokens } = await fetchAuthSession();
      const token = tokens.idToken.toString();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      // 로그인 안 된 상태에서 개발 환경인 경우 테스트용 토큰 추가
      if (process.env.NODE_ENV === 'development') {
        config.headers.Authorization = 'Bearer test-token';
      }
      // 그 외에는 그냥 통과
    }
    console.log('API 요청:', config.url, config.headers, config.data);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 응답 로깅
apiClient.interceptors.response.use(
  (response) => {
    console.log('API 응답:', response.status, response.data);
    return response;
  },
  (error) => {
    console.error('API 오류:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API 함수들
export const travelApi = {
  // 여행 계획 생성 요청
  createTravelPlan: async (planDetails) => {
    try {
      console.log('여행 계획 생성 요청 시도 - URL:', `${API_URL}/api/travel/python-plan`, 'Details:', planDetails);
      
      // apiClient 인스턴스를 사용하여 요청 (인터셉터에서 인증 헤더 자동 추가)
      const response = await apiClient.post('/api/travel/python-plan', planDetails, {
        timeout: 60000, // Gemini 호출 포함 시 타임아웃 늘림 (60초)
        // 재시도는 생성 요청에 부적합
      });
      
      return response.data;
    } catch (error) {
      // 오류 로깅은 인터셉터에서 처리되므로 여기서는 throw만 해도 됨
      // console.error('여행 계획 생성 실패:', error); 
      throw error;
    }
  },
  
  // 최신 여행 계획 또는 조건에 맞는 계획 불러오기
  loadPlan: async (params = { newest: true }) => {
    try {
      console.log('여행 계획 불러오기 시도 - URL:', `${API_URL}/api/travel/load`, 'Params:', params);
      
      // 직접 axios 대신 apiClient 사용 (인터셉터에서 인증 헤더 자동 추가)
      const response = await apiClient.post('/api/travel/load', params, {
        // 타임아웃 설정 (8초)
        timeout: 8000,
        // 재시도 설정 
        retry: 2,
        retryDelay: 1000
      });
      
      return response.data;
    } catch (error) {
      // 오류 상세 로깅
      if (error.response) {
        // 서버가 응답했지만 2xx 범위 외의 상태 코드인 경우
        console.error('여행 계획 불러오기 실패 - 서버 응답:', error.response.status, error.response.data);
      } else if (error.request) {
        // 요청이 전송되었지만 응답이 없는 경우
        console.error('여행 계획 불러오기 실패 - 응답 없음:', error.request);
      } else {
        // 요청 설정 중 오류가 발생한 경우
        console.error('여행 계획 불러오기 실패 - 요청 오류:', error.message);
      }
      
      // 예외 정보 전달
      throw error;
    }
  },
  
  // 여행 계획 저장 (SavePlanFunction)
  savePlan: async (planData) => {
    try {
      console.log('여행 계획 저장 요청 시도 - URL:', `${API_URL}/api/travel/save`, 'Data:', planData);
      
      // 서버에 맞는 형식으로 데이터 변환
      // SavePlanFunction에서 기대하는 형식: { title: "제목", data: { ... 일차별 데이터 ... } }
      const serverData = {
        title: planData.title,
        data: planData.days.reduce((obj, day) => {
          obj[day.day] = {
            title: day.title,
            schedules: day.schedules
          };
          return obj;
        }, {})
      };
      
      console.log('변환된 서버 데이터:', serverData);
      
      // apiClient를 사용하여 요청 (인터셉터에서 인증 헤더 자동 추가)
      const response = await apiClient.post('/api/travel/save', serverData, {
        timeout: 10000, // 타임아웃 설정 (10초)
        retry: 2,       // 재시도 설정
        retryDelay: 1000
      });
      
      console.log('여행 계획 저장 성공:', response.data);
      return response.data;
    } catch (error) {
      console.error('여행 계획 저장 실패:', error);
      
      // 오류 상세 로깅
      if (error.response) {
        console.error('저장 실패 - 서버 응답:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('저장 실패 - 응답 없음:', error.request);
      } else {
        console.error('저장 실패 - 요청 오류:', error.message);
      }
      
      throw error;
    }
  },

  // 숙소 검색 함수: POST 요청으로 변경
  searchHotels: async (searchParams) => {
    try {
      console.log('[API] 숙소 검색 요청 (Lambda POST):', searchParams);
      // POST 요청으로 변경하고, searchParams를 요청 본문으로 전달
      const response = await axios.post(SEARCH_HOTELS_URL, searchParams, {
        // POST 요청 시 Content-Type은 기본적으로 application/json으로 설정됨
        // Lambda에서 JSON.parse(event.body)를 사용하므로 별도 헤더 설정 불필요
      });
      console.log('[API] 숙소 검색 응답 (Lambda POST):', response.data);
      return response.data; // Lambda는 Booking.com API 응답을 그대로 body에 넣어 반환
    } catch (error) {
      console.error('숙소 검색 실패 (Lambda POST):', error.response?.data || error.message);
      const errorData = error.response?.data || { message: error.message || '알 수 없는 숙소 검색 오류' };
      throw errorData;
    }
  }
};

export default apiClient;