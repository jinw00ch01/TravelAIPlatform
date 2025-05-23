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

// 인증 토큰 가져오기 함수
const getTokenForAPI = async () => {
  try {
    // 로컬스토리지에서 먼저 시도
    const localToken = localStorage.getItem('idToken');
    if (localToken) {
      console.log('[API] 로컬스토리지 토큰 사용');
      return localToken;
    }

    // Amplify 세션에서 추출 시도
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      console.log('[API] Amplify 세션 토큰 사용');
      return idToken;
    }

    // 개발 환경에서는 test-token 사용
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] 개발 환경: 테스트 토큰 사용');
      return 'test-token';
    }

    throw new Error('인증 토큰을 가져올 수 없습니다.');
  } catch (error) {
    console.error('[API] 인증 토큰 가져오기 실패:', error);
    
    // 개발 환경에서는 test-token 사용
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] 개발 환경: 테스트 토큰 사용');
      return 'test-token';
    }
    
    throw new Error('인증 토큰을 가져올 수 없습니다: ' + error.message);
  }
};

// 요청 인터셉터 - 인증 토큰 추가
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getTokenForAPI();
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
  },

  // 전체 여행 계획 목록 불러오기
  getTravelPlans: async () => {
    try {
      const response = await apiClient.post('/api/travel/LoadPlanFunction_NEW', {}, {
        timeout: 10000,
        retry: 2,
        retryDelay: 1000,
        withCredentials: false,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('여행 계획 목록 불러오기 실패:', error);
      if (error.response) {
        // 서버가 응답을 반환한 경우
        console.error('서버 응답:', error.response.data);
        throw new Error(error.response.data.message || '서버 오류가 발생했습니다.');
      } else if (error.request) {
        // 요청은 보냈지만 응답을 받지 못한 경우
        console.error('요청 실패:', error.request);
        throw new Error('서버에 연결할 수 없습니다.');
      } else {
        // 요청 설정 중 오류가 발생한 경우
        console.error('요청 설정 오류:', error.message);
        throw new Error('요청을 처리할 수 없습니다.');
      }
    }
  },

  // invokeChecklist: checklistfunction 직접 호출
  invokeChecklist: async () => {
    try {
      console.log('[API] invokeChecklist 호출 시작');
      
      // 인증 토큰 가져오기
      const token = await getTokenForAPI();
      
      // fetch를 사용하여 API 호출
      const response = await fetch(`${API_URL}/api/travel/checklist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mode: 'list' })
      });
      
      // 응답 확인
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[API] invokeChecklist 응답:', data);
      return data;
    } catch (error) {
      console.error('[API] invokeChecklist 오류:', error.message);
      throw error;
    }
  },

  // invokeCheckplan: checkplanfunction 직접 호출
  invokeCheckplan: async (planId) => {
    if (planId === undefined || planId === null || isNaN(Number(planId))) {
      const errorMsg = 'invokeCheckplan: 유효한 planId (숫자)가 필요합니다.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    try {
      console.log(`[API] invokeCheckplan 호출 시작 (planId: ${planId})`);
      
      // 인증 토큰 가져오기
      const token = await getTokenForAPI();
      
      // fetch를 사용하여 API 호출
      const response = await fetch(`${API_URL}/api/travel/checkplan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan_id: planId.toString(), mode: 'detail' })
      });
      
      // 응답 확인
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`[API] invokeCheckplan 응답 (planId: ${planId}):`, data);
      return data;
    } catch (error) {
      console.error(`[API] invokeCheckplan 오류 (planId: ${planId}):`, error.message);
      throw error;
    }
  },

  // invokeCheckplans: 여러 계획을 한 번에 조회하는 함수
  invokeCheckplans: async (planIds) => {
    if (!Array.isArray(planIds) || planIds.length === 0) {
      const errorMsg = 'invokeCheckplans: 유효한 planIds 배열이 필요합니다.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    try {
      console.log(`[API] invokeCheckplans 호출 시작 (planIds: ${planIds.join(', ')})`);
      
      // 인증 토큰 가져오기
      const token = await getTokenForAPI();
      
      // 모든 plan_id를 숫자 문자열로 변환
      const normalizedPlanIds = planIds.map(id => id.toString());
      
      // fetch를 사용하여 API 호출
      const response = await fetch(`${API_URL}/api/travel/checkplan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          plan_ids: normalizedPlanIds,
          mode: 'detail'
        })
      });
      
      // 응답 확인
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`[API] invokeCheckplans 응답 (총 ${data.plans?.length || 0}개 계획):`, data);
      return data;
    } catch (error) {
      console.error(`[API] invokeCheckplans 오류:`, error.message);
      throw error;
    }
  },
};

export default apiClient;