import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL 환경 변수에서 가져오기
const API_URL = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage';

// Amadeus API 설정
const AMADEUS_API_KEY = process.env.REACT_APP_AMADEUS_API_KEY;
const AMADEUS_API_SECRET = process.env.REACT_APP_AMADEUS_API_SECRET;


// axios 재시도 로직 구현
axios.interceptors.response.use(null, async (error) => {
  const config = error.config;
  
  if (config.retry && (!config._retryCount || config._retryCount < config.retry)) {
    config._retryCount = config._retryCount ? config._retryCount + 1 : 1;
    const delay = config.retryDelay || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return axios(config);
  }
  
  return Promise.reject(error);
});

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false
});

// 요청 인터셉터 - 인증 토큰 추가
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const { tokens } = await fetchAuthSession();
      const token = tokens.idToken.toString();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        config.headers.Authorization = 'Bearer test-token';
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 응답 로깅
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API 오류:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Amadeus API 토큰 발급 함수
const getAmadeusToken = async () => {
  try {
    console.log('Amadeus 토큰 발급 시도...');
    console.log('API Key 확인:', !!AMADEUS_API_KEY);
    console.log('API Secret 확인:', !!AMADEUS_API_SECRET);

    const response = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token', 
      `grant_type=client_credentials&client_id=${AMADEUS_API_KEY}&client_secret=${AMADEUS_API_SECRET}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    console.log('토큰 발급 성공:', response.data);
    return response.data.access_token;
  } catch (error) {
    console.error('Amadeus 토큰 발급 실패:', error.response?.data || error.message);
    throw new Error('Amadeus API 인증에 실패했습니다.');
  }
};

// Amadeus API 람다 함수 호출
export const searchFlights = async (origin, destination, departureDate, returnDate, adults, children, infants, max = 20) => {
  try {
    if (!origin || !destination) {
      throw new Error('출발지와 목적지 공항 코드는 필수입니다.');
    }

    // Amadeus 토큰 발급
    const token = await getAmadeusToken();
    
    const response = await apiClient.post('api/amadeus/FlightOffersSearch', {
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: departureDate,
      returnDate: returnDate || null,
      adults: parseInt(adults) || 1,
      children: parseInt(children) || 0,
      infants: parseInt(infants) || 0,
      currencyCode: 'KRW',
      max: parseInt(max) || 20,
      nonStop: false,
      amadeusToken: token  // 토큰 추가
    });

    // API 응답 구조 로깅
    console.log('API 응답 구조:', {
      hasData: !!response.data,
      responseKeys: Object.keys(response.data || {}),
      rawResponse: response.data
    });

    return response.data;
  } catch (error) {
    if (error.response?.data?.errors) {
      const apiError = error.response.data.errors[0];
      throw new Error(apiError.detail || apiError.title || '항공편 검색 중 오류가 발생했습니다.');
    }
    console.error('항공편 검색 실패:', error);
    throw error;
  }
};

// 공항 검색 함수
export const searchAirports = async (keyword) => {
  try {
    const response = await apiClient.post('api/amadeus/FlightOffersSearch', {
      subType: 'AIRPORT',
      keyword: keyword,
      page: {
        limit: 10
      }
    });

    return response.data;
  } catch (error) {
    console.error('공항 검색 실패:', error);
    throw error;
  }
};

// API 함수들
export const travelApi = {
  // 여행 계획 생성 요청
  createTravelPlan: async (planDetails) => {
    try {
      const response = await apiClient.post('/api/travel/python-plan', planDetails, {
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // 최신 여행 계획 또는 조건에 맞는 계획 불러오기
  loadPlan: async (params = { newest: true }) => {
    try {
      const response = await apiClient.post('/api/travel/load', params, {
        timeout: 8000,
        retry: 2,
        retryDelay: 1000
      });
      return response.data;
    } catch (error) {
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
      throw error;
    }
  },
  
  // 여행 계획 상세 조회
  getTravelPlan: async (planId) => {
    try {
      const response = await apiClient.get(`/api/travel/plan/${planId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // 사용자의 여행 계획 목록 조회
  getUserTravelPlans: async () => {
    try {
      const response = await apiClient.get('/api/travel/user-plans');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // 여행 계획 공유
  shareTravelPlan: async (planId, shareOptions) => {
    try {
      const response = await apiClient.post(`/api/travel/plan/${planId}/share`, shareOptions);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // 여행 계획 삭제
  deleteTravelPlan: async (planId) => {
    try {
      const response = await apiClient.delete(`/api/travel/plan/${planId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // 여행 계획 업데이트
  updateTravelPlan: async (planId, updateData) => {
    try {
      const response = await apiClient.put(`/api/travel/plan/${planId}`, updateData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default apiClient;