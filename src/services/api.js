import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL 환경 변수에서 가져오기 (문제가 해결될 때까지 임시로 직접 지정)
const API_URL = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage';

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
  
  // 이미지로 여행지 검색
  searchByImage: async (imageFile, preferences) => {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      if (preferences) {
        formData.append('preferences', JSON.stringify(preferences));
      }
      
      const response = await apiClient.post('/api/travel/image-search', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('이미지 검색 실패:', error);
      throw error;
    }
  },
  
  // 여행 계획 상세 조회
  getTravelPlan: async (planId) => {
    try {
      const response = await apiClient.get(`/api/travel/plan/${planId}`);
      return response.data;
    } catch (error) {
      console.error('여행 계획 조회 실패:', error);
      throw error;
    }
  },
  
  // 사용자의 여행 계획 목록 조회
  getUserTravelPlans: async () => {
    try {
      const response = await apiClient.get('/api/travel/user-plans');
      return response.data;
    } catch (error) {
      console.error('여행 계획 목록 조회 실패:', error);
      throw error;
    }
  },
  
  // 여행 계획 공유
  shareTravelPlan: async (planId, shareOptions) => {
    try {
      const response = await apiClient.post(`/api/travel/plan/${planId}/share`, shareOptions);
      return response.data;
    } catch (error) {
      console.error('여행 계획 공유 실패:', error);
      throw error;
    }
  },
  
  // 여행 계획 삭제
  deleteTravelPlan: async (planId) => {
    try {
      const response = await apiClient.delete(`/api/travel/plan/${planId}`);
      return response.data;
    } catch (error) {
      console.error('여행 계획 삭제 실패:', error);
      throw error;
    }
  },
  
  // 여행 계획 업데이트
  updateTravelPlan: async (planId, updateData) => {
    try {
      const response = await apiClient.put(`/api/travel/plan/${planId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('여행 계획 업데이트 실패:', error);
      throw error;
    }
  },

  // 숙소 검색
  searchHotels: async (searchParams) => {
    try {
      const response = await apiClient.post('/api/travel/hotels', searchParams);
      return response.data;
    } catch (error) {
      console.error('숙소 검색 실패:', error);
      throw error;
    }
  }
};

export default apiClient;