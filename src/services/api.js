import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL 환경 변수에서 가져오기
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const IS_LOCAL = process.env.NODE_ENV === 'development' && API_URL.includes('localhost');

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 로컬 개발용 모의 데이터
const mockData = {
  plans: [
    {
      id: 'mock-plan-1',
      title: '서울 여행 계획',
      destination: '서울',
      startDate: '2024-05-15',
      endDate: '2024-05-18',
      itinerary: [
        {
          day: 1,
          date: '2024-05-15',
          activities: [
            { time: '09:00', description: '경복궁 관람' },
            { time: '12:00', description: '인사동에서 점심 식사' },
            { time: '14:00', description: '북촌 한옥마을 방문' },
            { time: '18:00', description: '명동에서 저녁 식사' }
          ]
        },
        {
          day: 2,
          date: '2024-05-16',
          activities: [
            { time: '10:00', description: '남산 서울타워 방문' },
            { time: '13:00', description: '이태원에서 점심 식사' },
            { time: '15:00', description: '한강공원 산책' },
            { time: '19:00', description: '홍대 거리 탐험' }
          ]
        }
      ],
      createdAt: '2024-04-20T10:30:00Z',
      userId: 'user-123'
    },
    {
      id: 'mock-plan-2',
      title: '부산 여행 계획',
      destination: '부산',
      startDate: '2024-06-05',
      endDate: '2024-06-08',
      itinerary: [
        {
          day: 1,
          date: '2024-06-05',
          activities: [
            { time: '10:00', description: '해운대 해변 방문' },
            { time: '13:00', description: '부산 국제시장에서 점심 식사' },
            { time: '15:00', description: '감천문화마을 탐방' },
            { time: '19:00', description: '서면에서 저녁 식사' }
          ]
        }
      ],
      createdAt: '2024-04-21T14:15:00Z',
      userId: 'user-123'
    }
  ]
};

// 요청 인터셉터 - 인증 토큰 추가
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Amplify 세션에서 JWT 토큰 가져오기
      const { tokens } = await fetchAuthSession();
      const token = tokens.idToken.toString();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      // 로그인 안 된 상태에서 로컬 개발 환경인 경우 테스트용 토큰 추가
      if (IS_LOCAL) {
        config.headers.Authorization = 'Bearer test-token';
      }
      // 그 외에는 그냥 통과
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
      if (IS_LOCAL) {
        // 로컬 환경에서는 모의 응답 반환
        const newPlan = {
          id: `mock-plan-${Date.now()}`,
          ...travelData,
          createdAt: new Date().toISOString(),
          userId: 'user-123'
        };
        mockData.plans.push(newPlan);
        return { success: true, plan: newPlan };
      }

      const response = await apiClient.post('/api/travel/plan', travelData);
      return response.data;
    } catch (error) {
      console.error('여행 계획 생성 실패:', error);
      throw error;
    }
  },
  
  // 이미지로 여행지 검색
  searchByImage: async (imageFile, preferences) => {
    try {
      if (IS_LOCAL) {
        // 로컬 환경에서는 모의 응답 반환
        return {
          success: true,
          locations: [
            { name: '경복궁', description: '조선시대 궁궐', score: 0.95 },
            { name: '남산 서울타워', description: '서울의 랜드마크', score: 0.85 },
            { name: '명동', description: '서울의 쇼핑 중심지', score: 0.75 }
          ]
        };
      }

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
      if (IS_LOCAL) {
        // 로컬 환경에서는 모의 데이터에서 해당 ID의 계획 찾기
        const plan = mockData.plans.find(p => p.id === planId);
        if (plan) {
          return { success: true, plan };
        }
        throw new Error('여행 계획을 찾을 수 없습니다');
      }

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
      if (IS_LOCAL) {
        // 로컬 환경에서는 모의 데이터 반환
        return { success: true, plans: mockData.plans };
      }

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
      if (IS_LOCAL) {
        // 로컬 환경에서는 성공 응답만 반환
        return { 
          success: true, 
          message: '여행 계획이 공유되었습니다',
          shareUrl: `http://localhost:3000/shared/${planId}`
        };
      }

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
      if (IS_LOCAL) {
        // 로컬 환경에서는 모의 데이터에서 해당 ID의 계획 제거
        const index = mockData.plans.findIndex(p => p.id === planId);
        if (index !== -1) {
          mockData.plans.splice(index, 1);
          return { success: true, message: '여행 계획이 삭제되었습니다' };
        }
        throw new Error('여행 계획을 찾을 수 없습니다');
      }

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
      if (IS_LOCAL) {
        // 로컬 환경에서는 모의 데이터 업데이트
        const index = mockData.plans.findIndex(p => p.id === planId);
        if (index !== -1) {
          mockData.plans[index] = { ...mockData.plans[index], ...updateData };
          return { success: true, plan: mockData.plans[index] };
        }
        throw new Error('여행 계획을 찾을 수 없습니다');
      }

      const response = await apiClient.put(`/api/travel/plan/${planId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('여행 계획 업데이트 실패:', error);
      throw error;
    }
  }
};

export default apiClient;