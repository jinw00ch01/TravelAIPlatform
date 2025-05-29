import axios from 'axios';

// API Gateway 엔드포인트 URL
const AIRPORT_CITY_SEARCH_URL = 'https://9b5hbw9u25.execute-api.ap-northeast-2.amazonaws.com/Stage/amadeus/Airport_CitySearch';
const FLIGHT_OFFERS_SEARCH_URL = 'https://9b5hbw9u25.execute-api.ap-northeast-2.amazonaws.com/Stage/amadeus/FlightOffersSearch';
// GetAirportInfo Lambda의 URL (Lambda 함수 이름은 GetAirportInfo이지만, API Gateway 경로는 유지하거나 변경 가능)
// 여기서는 기존 AeroDataBox용으로 사용하던 경로를 그대로 사용한다고 가정합니다. (필요시 변경)
const GET_AIRPORT_DETAILS_URL = 'https://9b5hbw9u25.execute-api.ap-northeast-2.amazonaws.com/Stage/AeroDataBox'; 

/**
 * Amadeus 관련 API Gateway 엔드포인트를 호출하는 클래스
 */
class AmadeusApi {
  constructor() {
    // ✅ 중복 요청 방지를 위한 캐시 및 진행 중인 요청 추적
    this.searchCache = new Map(); // 검색 결과 캐시
    this.pendingRequests = new Map(); // 진행 중인 요청 추적
    this.cacheTimeout = 30000; // 30초 캐시 유지
  }

  /**
   * 키워드를 사용하여 도시 또는 공항 정보를 검색합니다. (API Gateway 호출)
   * @param {string} keyword - 검색할 키워드 (2자 이상)
   * @returns {Promise<object>} - Amadeus API의 locations 응답 데이터 (Lambda에서 body를 그대로 반환한다고 가정)
   * @throws {Error} - API 호출 실패 시 오류 발생
   */
  async searchCities(keyword) {
    if (!keyword || keyword.length < 2) {
      console.warn('Search keyword must be at least 2 characters long.');
      return { data: [] }; // 빈 배열 반환 또는 오류 처리 선택
    }

    // ✅ 캐시 키 생성
    const cacheKey = `cities_${keyword.toLowerCase().trim()}`;
    
    // ✅ 캐시에서 결과 확인
    const cachedResult = this.searchCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < this.cacheTimeout) {
      console.log(`[AmadeusApi] Using cached result for: ${keyword}`);
      return cachedResult.data;
    }

    // ✅ 이미 진행 중인 요청이 있는지 확인
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`[AmadeusApi] Request already in progress for: ${keyword}, waiting...`);
      return await this.pendingRequests.get(cacheKey);
    }

    try {
      console.log(`[AmadeusApi] Searching cities/airports via Gateway: ${keyword}`);
      
      // ✅ 새로운 요청 시작 - Promise를 먼저 저장
      const requestPromise = axios.get(AIRPORT_CITY_SEARCH_URL, {
        params: {
          keyword,
          subType: 'CITY,AIRPORT', // 도시와 공항 모두 검색
        },
      }).then(response => {
        console.log('[AmadeusApi] City/Airport search response:', response.data);
        
        // ✅ 결과를 캐시에 저장
        this.searchCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
        
        return response.data;
      }).finally(() => {
        // ✅ 요청 완료 후 진행 중인 요청에서 제거
        this.pendingRequests.delete(cacheKey);
      });

      // ✅ 진행 중인 요청으로 등록
      this.pendingRequests.set(cacheKey, requestPromise);
      
      return await requestPromise;

    } catch (error) {
      // ✅ 오류 발생 시 진행 중인 요청에서 제거
      this.pendingRequests.delete(cacheKey);
      
      console.error('[AmadeusApi] Failed to search cities/airports via Gateway:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || '도시/공항 정보 검색에 실패했습니다.';
      throw new Error(errorMessage);
    }
  }

  /**
   * 주어진 조건으로 항공편을 검색합니다. (API Gateway 호출)
   * @param {object} searchParams - 검색 파라미터 객체
   * @param {string} searchParams.originCode - 출발지 IATA 코드
   * @param {string} searchParams.destinationCode - 도착지 IATA 코드
   * @param {string} searchParams.departureDate - 출발 날짜 (YYYY-MM-DD)
   * @param {string} [searchParams.returnDate] - 귀환 날짜 (YYYY-MM-DD, optional)
   * @param {number} [searchParams.adults=1] - 성인 수
   * @param {number} [searchParams.children=0] - 어린이 수
   * @param {number} [searchParams.infants=0] - 유아 수
   * @param {string} [searchParams.travelClass] - 좌석 등급 (ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST)
   * @param {boolean} [searchParams.nonStop=false] - 직항 여부
   * @param {string} [searchParams.currencyCode='KRW'] - 통화 코드
   * @param {number} [searchParams.maxPrice] - 최대 가격
   * @param {number} [searchParams.max=10] - 최대 결과 수
   * @returns {Promise<object>} - Amadeus API의 flight-offers 응답 데이터 (Lambda가 반환하는 전체 객체)
   * @throws {Error} - API 호출 실패 시 오류 발생
   */
  async searchFlights(searchParams) {
    // 필수 파라미터 검사
    if (!searchParams.originCode || !searchParams.destinationCode || !searchParams.departureDate) {
      throw new Error('출발지, 도착지, 출발 날짜는 필수 입력 항목입니다.');
    }

    // API Gateway로 전달할 파라미터 객체 생성 (값 변환 및 정리)
    const apiGatewayParams = {
      originLocationCode: searchParams.originCode,
      destinationLocationCode: searchParams.destinationCode,
      departureDate: searchParams.departureDate,
      adults: searchParams.adults || 1,
      ...(searchParams.returnDate && { returnDate: searchParams.returnDate }),
      ...(searchParams.children && { children: searchParams.children }),
      ...(searchParams.infants && { infants: searchParams.infants }),
      ...(searchParams.travelClass && { travelClass: searchParams.travelClass }),
      ...(searchParams.nonStop && { nonStop: searchParams.nonStop }), 
      currencyCode: searchParams.currencyCode || 'KRW',
      ...(searchParams.maxPrice && { maxPrice: searchParams.maxPrice }),
      max: searchParams.max || 10,
    };

    try {
      console.log('[AmadeusApi] Searching flights via Gateway with params:', apiGatewayParams);
      // FlightOffersSearch Lambda는 POST 요청을 받음
      const response = await axios.post(FLIGHT_OFFERS_SEARCH_URL, apiGatewayParams);
      console.log('[AmadeusApi] Flight search response:', response.data);
      return response.data; // Lambda 응답 (data와 dictionaries 포함)

    } catch (error) {
      console.error('[AmadeusApi] Failed to search flights via Gateway:', error.response?.data || error.message);
      const detailedError = error.response?.data?.errors?.[0] || error.response?.data;
      const errorMessage = detailedError?.title || detailedError?.message || '항공편 검색에 실패했습니다.';
      const errorDetail = detailedError?.detail ? ` (${detailedError.detail})` : '';
      throw new Error(errorMessage + errorDetail);
    }
  }

  /**
   * IATA 코드로 특정 공항의 상세 정보를 조회합니다. (API Gateway 호출)
   * @param {string} iataCode - 조회할 공항의 3글자 IATA 코드
   * @returns {Promise<object|null>} - Lambda (GetAirportInfo)가 반환하는 공항 상세 정보 (번역 포함) 또는 오류 시 null
   */
  async getAirportDetails(iataCode) {
    if (!iataCode || iataCode.length !== 3) {
      console.warn('[AmadeusApi] Invalid IATA code for getAirportDetails:', iataCode);
      return null;
    }

    try {
      console.log(`[AmadeusApi] Getting airport details via Airport_CitySearch for ${iataCode}...`);
      
      // GetAirportInfo 엔드포인트가 없으므로 Airport_CitySearch를 사용
      const response = await axios.get(AIRPORT_CITY_SEARCH_URL, {
        params: {
          keyword: iataCode.toUpperCase(),
          subType: 'AIRPORT' // 공항만 검색
        }
      });
      
      console.log(`[AmadeusApi] Airport search response for ${iataCode}:`, response.data);
      
      // Airport_CitySearch는 배열을 반환하므로 첫 번째 결과를 사용
      if (response.data && response.data.data && response.data.data.length > 0) {
        const airportData = response.data.data[0];
        
        // GetAirportInfo와 유사한 형식으로 변환
        return {
          iataCode: airportData.iataCode,
          name: airportData.name,
          detailedName: airportData.detailedName,
          cityName: airportData.address?.cityName,
          countryName: airportData.address?.countryName,
          countryCode: airportData.address?.countryCode,
          geoCode: airportData.geoCode,
          timeZoneOffset: airportData.timeZoneOffset,
          // 한국어 번역 정보는 Airport_CitySearch에서 제공하지 않으므로 null
          translations: {
            name_ko: null,
            cityName_ko: null,
            countryName_ko: null
          }
        };
      }
      
      return null;

    } catch (error) {
      console.error(`[AmadeusApi] Failed to get airport details for ${iataCode}:`, error.response?.data || error.message);
      return null;
    }
  }
}

// 클래스의 인스턴스를 내보냅니다.
export default new AmadeusApi(); 