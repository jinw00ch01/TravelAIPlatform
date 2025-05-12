import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL 환경 변수에서 가져오기
const API_URL = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage';

// Booking.com 호텔 검색 Lambda 함수를 위한 API Gateway 엔드포인트 URL
const SEARCH_HOTELS_URL = `${API_URL}/api/Booking-com/SearchHotelsByCoordinates`;

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
  
  // 여행 계획 저장 (SavePlanFunction)
  savePlan: async (planData) => {
    try {
      console.log('여행 계획 저장 요청 시도 - URL:', `${API_URL}/api/travel/save`, 'Data:', planData);
      
      // 서버에 맞는 형식으로 데이터 변환
      // SavePlanFunction에서 기대하는 형식: { title: "제목", data: { ... 일차별 데이터 ... } }
      let serverData;
      
      // planData가 이미 planData와 dynamoDbData로 구조화되어 있는 경우
      if (planData.planData) {
        const innerPlanData = planData.planData;
        serverData = {
          title: innerPlanData.title,
          data: innerPlanData.days.reduce((obj, day) => {
            obj[day.day] = {
              title: day.title,
              schedules: day.schedules
            };
            return obj;
          }, {})
        };
      } else {
        // 기존 형식 (단일 객체)
        serverData = {
          title: planData.title,
          data: planData.days.reduce((obj, day) => {
            obj[day.day] = {
              title: day.title,
              schedules: day.schedules
            };
            return obj;
          }, {})
        };
      }
      
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
      throw errorData;},

      // 인기 여행지 조회
      getPopularDestinations: async (params = { originCityCode: 'ICN', period: '2025-03', max: 10 }) => {
        try {
          const response = await apiClient.post('/api/amadeus/Flight_Most_Traveled_Destinations', params);
          return response.data;
        } catch (error) {
          console.error('인기 여행지 조회 실패:', error);
          throw error;
        }
      },
    };
    
    export const fetchFlightInspiration = async (params) => {
      try {
        const response = await apiClient.post('/api/amadeus/Flight_Inspiration_Search', params);
        return response.data;
      } catch (error) {
        console.error('Flight Inspiration Search API 호출 에러:', error);
        throw error;
    }
  }

};

export default apiClient;