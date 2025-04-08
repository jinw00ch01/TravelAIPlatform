import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL 환경 변수에서 가져오기
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

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
      // 로그인 안 된 상태에서 로컬 개발 환경인 경우 테스트용 토큰 추가
      if (process.env.NODE_ENV === 'development' && API_URL.includes('localhost')) {
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
    console.log('여행 계획 생성 요청 데이터:', travelData);
    
    // 요청 데이터 준비
    const requestData = {
      query: travelData.query || "도쿄 1일 여행 계획을 만들어주세요. 예산은 10만원입니다.",
      preferences: {
        accommodation: travelData.preferences?.accommodation || "게스트하우스",
        transportation: travelData.preferences?.transportation || "대중교통",
        activities: travelData.preferences?.activities || ["관광"]
      }
    };
    
    console.log('전송할 최종 요청 데이터:', JSON.stringify(requestData));
    
    try {
      // 새로운 Python Lambda 함수 엔드포인트 사용
      const response = await axios({
        method: 'post',
        url: 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/prod/api/travel/python-plan',
        data: requestData,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        timeout: 30000
      });
      
      console.log('여행 계획 API 응답:', response.data);
      return response.data;
    } catch (error) {
      console.error('여행 계획 생성 실패:', error);
      console.error('오류 타입:', error.name);
      console.error('오류 메시지:', error.message);
      
      if (error.response) {
        // 서버에서 응답이 왔지만 2xx 응답이 아닌 경우
        console.error('오류 응답 데이터:', error.response.data);
        console.error('오류 상태 코드:', error.response.status);
        console.error('오류 응답 헤더:', error.response.headers);
      } else if (error.request) {
        // 요청은 전송되었지만 응답을 받지 못한 경우
        console.error('응답을 받지 못한 요청:', error.request);
      } else {
        // 요청 설정 중에 오류가 발생한 경우
        console.error('요청 설정 중 오류:', error.config);
      }
      
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