import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// API_URL 환경 변수에서 가져오기
const API_URL = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage';

// Booking.com 호텔 검색 Lambda 함수를 위한 API Gateway 엔드포인트 URL
const SEARCH_HOTELS_URL = `${API_URL}/api/Booking-com/SearchHotelsByCoordinates`;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1초

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

// API 함수들
export const travelApi = {
  // 여행 계획 생성 요청
  createTravelPlan: async (planDetails) => {
    try {
      const response = await apiClient.post('/api/travel/python-plan', planDetails, {
        timeout: 150000,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // 최신 여행 계획 또는 조건에 맞는 계획 불러오기
  loadPlan: async (params = { newest: true }) => {
    try {
      // planId가 유효한 숫자인지 확인하고 적절한 API 엔드포인트 선택
      const hasPlanId = params.planId !== undefined && params.planId !== null;
      
      // planId가 숫자인지 확인
      const isNumericId = hasPlanId && !isNaN(Number(params.planId)) && params.planId !== 'newest';
      
      // 요청 본문 준비
      let requestParams = { ...params };

      // API 엔드포인트 결정 (planId가 숫자면 checkplan, 그 외에는 LoadPlanFunction_NEW)
      let endpoint = 'api/travel/LoadPlanFunction_NEW';
      
      // planId가 숫자인 경우 checkplan API 사용 (키 이름도 plan_id로 변환)
      if (isNumericId) {
        endpoint = 'api/travel/checkplan';
        // planId를 plan_id로 변환 (스네이크 케이스로 변경)
        requestParams = {
          ...requestParams,
          plan_id: requestParams.planId
        };
        // 원래 planId 필드는 제거 (중복 방지)
        delete requestParams.planId;
        
        console.log(`특정 계획(ID: ${requestParams.plan_id}) 불러오기 - URL: ${API_URL}/${endpoint}`);
      } 
      // planId가 'newest'인 경우나 다른 경우는 LoadPlanFunction_NEW 사용
      else {
        // planId가 'newest'인 경우 이를 newest=true로 변환
        if (hasPlanId && params.planId === 'newest') {
          requestParams = {
            ...requestParams,
            newest: true
          };
          // 원래 planId 필드는 제거
          delete requestParams.planId;
          
          console.log(`최신 계획 불러오기 - URL: ${API_URL}/${endpoint}`);
        } else {
          console.log(`여행 계획 불러오기 - URL: ${API_URL}/${endpoint}`);
        }
      }
      
      console.log('요청 파라미터:', requestParams);
      
      // API 호출
      const response = await apiClient.post(endpoint, requestParams, {
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

  // 투어/액티비티 조회 함수 추가
  getToursAndActivities: async (params) => {
    try {
      const response = await apiClient.post('api/amadeus/Tours_and_Activities', params, {
        timeout: 10000,
        retry: 2,
        retryDelay: 1000
      });
      return response.data;
    } catch (error) {
      console.error('getToursAndActivities API 오류:', error);
      throw error;
    }
  },

  // 숙소 검색 함수: POST 요청으로 변경
  searchHotels: async (searchParams) => {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        console.log(`[API] 숙소 검색 요청 (Lambda POST) - 시도 ${retries + 1}:`, searchParams);
        
        const response = await axios.post(
          `${SEARCH_HOTELS_URL}`,
          searchParams,
          {
            timeout: 10000, // 10초 타임아웃
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('[API] 숙소 검색 응답:', response.data);
        return response.data;
      } catch (error) {
        retries++;
        console.error(`[API] 숙소 검색 실패 (시도 ${retries}/${MAX_RETRIES}):`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          error: error.message,
          details: error.response?.data
        });

        if (retries === MAX_RETRIES) {
          const errorMessage = {
            error: error.message,
            details: error.response?.data,
            message: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'
          };
          throw errorMessage;
        }

        // 재시도 전 대기
        await sleep(RETRY_DELAY * retries);
      }
    }
  }
};

export default apiClient;