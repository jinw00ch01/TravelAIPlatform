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
      console.log('[API] 여행 계획 저장 요청 시도 - URL:', `${API_URL}/api/travel/save`);
      console.log('[API] 저장할 데이터:', planData);
      
      // 서버에 맞는 형식으로 데이터 변환
      let serverData = {
        title: planData.title,
        data: planData.days.reduce((obj, day) => {
          obj[day.day] = {
            title: day.title,
            schedules: day.schedules
          };
          return obj;
        }, {})
      };

      // 숙소 정보가 있으면 추가
      if (planData.accommodationInfo) {
        serverData.accommodationInfo = planData.accommodationInfo;
        console.log('[API] 숙소 정보 포함:', serverData.accommodationInfo);
      }
      
      console.log('[API] 변환된 서버 데이터:', serverData);
      
      // apiClient를 사용하여 요청 (인터셉터에서 인증 헤더 자동 추가)
      const response = await apiClient.post('/api/travel/save', serverData, {
        timeout: 10000, // 타임아웃 설정 (10초)
        retry: 2,       // 재시도 설정
        retryDelay: 1000
      });
      
      console.log('[API] 여행 계획 저장 성공:', response.data);
      return response.data;
    } catch (error) {
      console.error('여행 계획 저장 실패:', error);
      throw error;
    }
  },

  // 여행 계획 수정 (UpdateTravelPlan - SavePlanFunction 사용)
  updateTravelPlan: async (planId, updateData, updateType = null) => {
    try {
      console.log('[API] 여행 계획 수정 요청 시도 - URL:', `${API_URL}/api/travel/save`);
      console.log('[API] 수정할 데이터:', { planId, updateData, updateType });
      
      // 기본 수정 데이터 구조
      let serverData = {
        plan_id: planId
      };

      // 수정 타입이 지정된 경우
      if (updateType) {
        serverData.update_type = updateType;
      }

      // 수정 데이터에 따라 적절한 필드 설정
      if (updateData.title) {
        serverData.title = updateData.title;
      }

      if (updateData.data || updateData.itinerary) {
        // 일정 데이터 처리
        const itineraryData = updateData.data || updateData.itinerary;
        
        if (Array.isArray(itineraryData)) {
          // days 배열 형식인 경우 객체로 변환
          serverData.data = itineraryData.reduce((obj, day) => {
            obj[day.day] = {
              title: day.title,
              schedules: day.schedules || []
            };
            return obj;
          }, {});
        } else {
          // 이미 객체 형식인 경우
          serverData.data = itineraryData;
        }
      }

      if (updateData.flightInfo) {
        serverData.flightInfo = updateData.flightInfo;
      }

      if (updateData.accommodationInfo) {
        serverData.accommodationInfo = updateData.accommodationInfo;
      }

      if (updateData.shared_email !== undefined) {
        serverData.shared_email = updateData.shared_email;
      }

      if (updateData.paid_plan !== undefined) {
        serverData.paid_plan = updateData.paid_plan;
      }

      if (updateData.status) {
        // status는 특별히 처리하지 않고 로그만 남김
        console.log('[API] status 필드는 현재 지원되지 않음:', updateData.status);
      }
      
      console.log('[API] 최종 수정 요청 데이터:', serverData);
      
      // apiClient를 사용하여 요청 (인터셉터에서 인증 헤더 자동 추가)
      const response = await apiClient.post('/api/travel/save', serverData, {
        timeout: 15000, // 타임아웃 설정 (15초)
        retry: 2,       // 재시도 설정
        retryDelay: 1000
      });
      
      console.log('[API] 여행 계획 수정 성공:', response.data);
      return response.data;
    } catch (error) {
      console.error('여행 계획 수정 실패:', error);
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

// 날씨 API 관련 함수 추가
export const weatherApi = {
  // AWS Lambda를 통한 날씨 정보 조회
  getWeatherByCoordinates: async (lat, lng) => {
    try {
      console.log(`[API] 날씨 데이터 요청 시작 - 위도: ${lat}, 경도: ${lng}`);
      
      // AWS Lambda 함수 엔드포인트
      const WEATHER_API_URL = `https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/weatherAPI`;
      
      // 요청 데이터 구성
      const requestData = {
        lat: lat,
        lon: lng
      };
      
      console.log(`[API] 날씨 API 요청 URL: ${WEATHER_API_URL}`);
      console.log(`[API] 날씨 API 요청 데이터:`, requestData);
      
      const response = await axios.post(WEATHER_API_URL, requestData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15초 타임아웃
      });
      
      console.log(`[API] 날씨 API 응답 상태: ${response.status}`);
      console.log(`[API] 날씨 API 전체 응답 데이터:`, response.data);
      
      if (response.data && response.data.forecasts) {
        console.log(`[API] 날씨 데이터 응답 성공 - ${response.data.forecasts.length}개 항목`);
        console.log(`[API] 첫 번째 예보 데이터 샘플:`, response.data.forecasts[0]);
        return response.data;
      } else if (response.data && response.data.list) {
        // OpenWeatherMap API 직접 호출 형식으로 받은 경우 처리
        console.log(`[API] OpenWeatherMap 형식으로 받은 날씨 데이터 - ${response.data.list.length}개 항목`);
        console.log(`[API] 첫 번째 예보 데이터 샘플:`, response.data.list[0]);
        return {
          city: response.data.city,
          forecasts: response.data.list
        };
      } else {
        console.error(`[API] 날씨 데이터 형식 오류:`, response.data);
        throw new Error('날씨 데이터 형식이 올바르지 않습니다.');
      }
    } catch (error) {
      console.error(`[API] 날씨 데이터 요청 중 오류:`, error);
      console.error(`[API] 오류 상세:`, error.response?.data || error.message);
      throw error;
    }
  },
  
  // 특정 시간대에 가장 가까운 날씨 정보 찾기
  findClosestForecast: (forecasts, targetTime) => {
    if (!forecasts || !Array.isArray(forecasts) || forecasts.length === 0) {
      return null;
    }
    
    // 목표 시간을 Date 객체로 변환
    const targetDate = new Date(targetTime);
    const targetHour = targetDate.getHours();
    console.log(`[API] 가장 가까운 날씨 예보 찾기 - 목표 시간: ${targetDate.toLocaleString('ko-KR')} (${targetHour}시)`);
    
    // 사용 가능한 예보 시간들 로깅
    const availableForecasts = forecasts.slice(0, 10).map(f => {
      const date = new Date(f.dt * 1000);
      return {
        time: date.toLocaleString('ko-KR'),
        hour: date.getHours(),
        date: date.toISOString().split('T')[0]
      };
    });
    console.log(`[API] 사용 가능한 예보 시간들 (처음 10개):`, availableForecasts);
    
    // OpenWeatherMap API의 3시간 간격 예보 시간: 00, 03, 06, 09, 12, 15, 18, 21
    const forecastHours = [0, 3, 6, 9, 12, 15, 18, 21];
    
    // 일정 시간에 가장 가까운 예보 시간 찾기
    let closestForecastHour = forecastHours.reduce((closest, current) => {
      const currentDiff = Math.abs(current - targetHour);
      const closestDiff = Math.abs(closest - targetHour);
      
      // 더 가까운 시간 선택
      if (currentDiff < closestDiff) {
        return current;
      }
      
      // 거리가 같을 경우 미래 시간 우선 (예: 13시 일정의 경우 12시보다 15시 선택)
      if (currentDiff === closestDiff && current > targetHour) {
        return current;
      }
      
      return closest;
    });
    
    console.log(`[API] 일정 시간 ${targetHour}시 → 선택된 예보 시간: ${closestForecastHour}시`);
    
    // 해당 날짜의 선택된 시간대 예보 찾기
    const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD 형식
    
    console.log(`[API] 찾는 조건: 날짜=${targetDateStr}, 시간=${closestForecastHour}시`);
    
    const matchingForecast = forecasts.find(forecast => {
      const forecastDate = new Date(forecast.dt * 1000);
      const forecastDateStr = forecastDate.toISOString().split('T')[0];
      const forecastHour = forecastDate.getHours();
      
      const isMatch = forecastDateStr === targetDateStr && forecastHour === closestForecastHour;
      
      if (isMatch) {
        console.log(`[API] 정확한 매칭 발견: ${forecastDate.toLocaleString('ko-KR')}`);
      }
      
      return isMatch;
    });
    
    if (matchingForecast) {
      const matchedTime = new Date(matchingForecast.dt * 1000);
      console.log(`[API] 매칭된 예보: ${matchedTime.toLocaleString('ko-KR')} (${matchedTime.getHours()}시)`);
      return matchingForecast;
    }
    
    // 정확한 매칭이 없는 경우 가장 가까운 시간대 선택 (기존 로직)
    console.log(`[API] 정확한 매칭 실패, 가장 가까운 시간대로 대체`);
    
    const targetTimestamp = targetDate.getTime();
    
    const fallbackForecast = forecasts.reduce((closest, current) => {
      const currentTimestamp = new Date(current.dt * 1000).getTime();
      
      if (!closest) return current;
      
      const closestTimestamp = new Date(closest.dt * 1000).getTime();
      const currentDiff = Math.abs(currentTimestamp - targetTimestamp);
      const closestDiff = Math.abs(closestTimestamp - targetTimestamp);
      
      // 현재 검사 중인 예보가 더 가까운 경우
      if (currentDiff < closestDiff) {
        return current;
      }
      
      // 거리가 같을 경우 미래 예보 우선
      if (currentDiff === closestDiff && currentTimestamp > targetTimestamp) {
        return current;
      }
      
      return closest;
    }, null);
    
    if (fallbackForecast) {
      const fallbackTime = new Date(fallbackForecast.dt * 1000);
      console.log(`[API] Fallback 예보 선택: ${fallbackTime.toLocaleString('ko-KR')} (${fallbackTime.getHours()}시)`);
    }
    
    return fallbackForecast;
  },
  
  // 일정에 맞는 날씨 정보 찾기
  getWeatherForSchedules: async (schedules, startDate, selectedDay) => {
    if (!schedules || schedules.length === 0) {
      console.warn('[API] 일정 데이터가 없어 날씨 정보를 가져올 수 없습니다.');
      return {};
    }
    
    try {
      // 첫 번째 유효한 위치(위도/경도) 정보가 있는 일정 찾기
      const locationSchedule = schedules.find(item => item.lat && item.lng);
      
      if (!locationSchedule) {
        console.warn('[API] 날씨 데이터를 가져올 위치 정보가 없습니다.');
        return {};
      }
      
      // 해당 위치의 날씨 정보 요청
      console.log('[API] 날씨 API getWeatherByCoordinates 호출:', {
        lat: locationSchedule.lat,
        lng: locationSchedule.lng
      });
      
      const weatherData = await weatherApi.getWeatherByCoordinates(
        locationSchedule.lat, 
        locationSchedule.lng
      );
      
      if (!weatherData || !weatherData.forecasts) {
        console.warn('[API] 날씨 API에서 유효한 응답이 없습니다.');
        return {};
      }
      
      console.log('[API] 날씨 API 응답 받음, 일정별 매칭 시작');
      console.log('[API] 받은 날씨 데이터 구조:', {
        cityInfo: weatherData.city,
        forecastsCount: weatherData.forecasts.length,
        firstForecast: weatherData.forecasts[0],
        lastForecast: weatherData.forecasts[weatherData.forecasts.length - 1]
      });
      
      // 각 일정별로 가장 가까운 시간대의 날씨 찾기
      const result = {};
      
      schedules.forEach(schedule => {
        if (!schedule.id || !schedule.time) return;
        
        try {
          // 일정 시간 결정을 위한 기준 날짜 설정
          let scheduleDate;
          const dayNumber = parseInt(selectedDay) || 1;
          
          if (startDate) {
            // 기준 날짜(start_date)로부터 일수 계산
            scheduleDate = new Date(startDate);
            scheduleDate.setDate(scheduleDate.getDate() + (dayNumber - 1));
          } else {
            // startDate가 없으면 현재 날짜 사용
            scheduleDate = new Date();
          }
          
          // 시간 문자열 파싱 (예: "14:00", "체크인", "오후 3:30" 등)
          let hours = 12, minutes = 0;
          
          if (schedule.time === '체크인' || schedule.time === '체크아웃') {
            // 체크인/체크아웃은 정오로 설정
            hours = 12;
            minutes = 0;
          } else {
            // 시간 포맷 파싱
            const timeRegex = /(\d{1,2})(?::(\d{1,2}))?(?:\s*(오전|오후))?/;
            const match = schedule.time.match(timeRegex);
            
            if (match) {
              hours = parseInt(match[1]) || 0;
              minutes = parseInt(match[2] || '0');
              
              // 오전/오후 처리
              if (match[3] === '오후' && hours < 12) {
                hours += 12;
              } else if (match[3] === '오전' && hours === 12) {
                hours = 0;
              }
            }
          }
          
          scheduleDate.setHours(hours, minutes, 0, 0);
          
          // 계산된 날짜가 예보 범위 내에 있는지 확인
          const today = new Date();
          const fiveDaysLater = new Date();
          fiveDaysLater.setDate(today.getDate() + 5);
          
          console.log(`[API] 일정 "${schedule.name}" 시간 결정:`, {
            id: schedule.id,
            timeStr: schedule.time,
            parsedTime: `${hours}:${minutes}`,
            scheduleDate: scheduleDate.toISOString(),
            isInForecastRange: scheduleDate >= today && scheduleDate <= fiveDaysLater,
            forecastRangeStart: today.toISOString(),
            forecastRangeEnd: fiveDaysLater.toISOString()
          });
          
          // 예보 범위를 벗어나는 경우 "예측불가" 객체 반환
          if (scheduleDate < today || scheduleDate > fiveDaysLater) {
            console.warn(`[API] 일정 "${schedule.name}" 날짜가 예보 범위를 벗어남, 예측불가로 설정`);
            
            result[schedule.id] = {
              isOutOfRange: true,
              weather: [{
                id: 999,
                main: "예측불가",
                description: "예측불가"
              }],
              main: {
                temp: null
              },
              dt: Math.floor(scheduleDate.getTime() / 1000),
              scheduleTime: scheduleDate.toISOString(),
              forecastTime: scheduleDate.toISOString()
            };
            return; // 다음 일정으로 넘어감
          }
          
          // 예보 범위 내에서만 실제 날씨 예보 찾기
          const closestForecast = weatherApi.findClosestForecast(
            weatherData.forecasts, 
            scheduleDate
          );
          
          if (closestForecast) {
            console.log(`[API] 일정 "${schedule.name}" 매칭된 날씨:`, {
              scheduleTime: scheduleDate.toLocaleString('ko-KR'),
              forecastTime: new Date(closestForecast.dt * 1000).toLocaleString('ko-KR'),
              temp: closestForecast.main.temp,
              weather: closestForecast.weather[0].description
            });
            
            result[schedule.id] = {
              ...closestForecast,
              scheduleTime: scheduleDate.toISOString(),
              forecastTime: new Date(closestForecast.dt * 1000).toISOString()
            };
          }
        } catch (scheduleError) {
          console.error(`[API] 일정 "${schedule.name || schedule.id}" 날씨 처리 중 오류:`, scheduleError);
        }
      });
      
      console.log(`[API] 날씨 정보 매칭 완료: ${Object.keys(result).length}개 일정`);
      console.log(`[API] 최종 결과 데이터:`, result);
      return result;
    } catch (error) {
      console.error('[API] 일정별 날씨 데이터 처리 중 오류:', error);
      return {};
    }
  }
};

export default apiClient;