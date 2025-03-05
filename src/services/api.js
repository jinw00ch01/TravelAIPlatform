import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
      // 로그인 안 된 상태라면 그냥 통과
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// API 함수들
export const travelApi = {
  // 여행 계획 생성 요청
  createTravelPlan: async (travelData) => {
    try {
      const response = await apiClient.post('/travel/plan', travelData);
      return response.data;
    } catch (error) {
      console.error('여행 계획 생성 실패:', error);
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
      
      const response = await apiClient.post('/travel/image-search', formData, {
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
      const response = await apiClient.get(`/travel/plan/${planId}`);
      return response.data;
    } catch (error) {
      console.error('여행 계획 조회 실패:', error);
      throw error;
    }
  },
  
  // 사용자의 여행 계획 목록 조회
  getUserTravelPlans: async () => {
    try {
      const response = await apiClient.get('/travel/user-plans');
      return response.data;
    } catch (error) {
      console.error('여행 계획 목록 조회 실패:', error);
      throw error;
    }
  },
  
  // 여행 계획 공유
  shareTravelPlan: async (planId, shareOptions) => {
    try {
      const response = await apiClient.post(`/travel/plan/${planId}/share`, shareOptions);
      return response.data;
    } catch (error) {
      console.error('여행 계획 공유 실패:', error);
      throw error;
    }
  },
  
  // 여행 계획 삭제
  deleteTravelPlan: async (planId) => {
    try {
      const response = await apiClient.delete(`/travel/plan/${planId}`);
      return response.data;
    } catch (error) {
      console.error('여행 계획 삭제 실패:', error);
      throw error;
    }
  },
  
  // 여행 계획 업데이트
  updateTravelPlan: async (planId, updateData) => {
    try {
      const response = await apiClient.put(`/travel/plan/${planId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('여행 계획 업데이트 실패:', error);
      throw error;
    }
  }
};

export default apiClient;