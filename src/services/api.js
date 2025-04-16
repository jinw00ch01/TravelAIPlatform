import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL 환경 변수에서 가져오기 (문제가 해결될 때까지 임시로 직접 지정)
const API_URL = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage';

// CORS 프록시 서버 URL 삭제

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
  createTravelPlan: async (travelData) => {
    try {
      const response = await axios.post(`${API_URL}/api/travel/python-plan`, {
        query: travelData.prompt
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('여행 계획 생성 실패:', error);
      throw error;
    }
  },
  
  // 최신 여행 계획 또는 조건에 맞는 계획 불러오기
  loadPlan: async (params = { newest: true }) => {
    try {
      console.log('여행 계획 불러오기 시도 - URL:', `${API_URL}/api/travel/load`, 'Params:', params);
      
      const response = await axios.post(`${API_URL}/api/travel/load`, params, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('여행 계획 불러오기 실패:', error);
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
  }
};

export default apiClient;