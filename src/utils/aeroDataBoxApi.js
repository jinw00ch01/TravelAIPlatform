import axios from 'axios';
// AWS Translate SDK 임포트 제거
// import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

// API Gateway 엔드포인트 URL
const GET_AIRPORT_INFO_URL = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/AeroDataBox/GetAirportInfo';

// Translate 클라이언트 인스턴스 생성 제거
// const translateClient = new TranslateClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });

class AeroDataBoxApi {
  /**
   * IATA 코드로 공항 정보를 조회합니다. (API Gateway 호출)
   * @param {string} iataCode - 조회할 공항의 3글자 IATA 코드
   * @returns {Promise<object|null>} - Lambda 함수가 반환하는 공항 정보 (번역 포함) 또는 오류 시 null
   */
  async getAirportInfoByIata(iataCode) {
    if (!iataCode || iataCode.length !== 3) {
      console.warn('[AeroDataBoxApi] Invalid IATA code:', iataCode);
      return null;
    }

    try {
      console.log(`[AeroDataBoxApi] Getting airport info via Gateway for ${iataCode}...`);
      // API Gateway 호출 (Lambda 함수 트리거)
      const response = await axios.get(GET_AIRPORT_INFO_URL, {
        params: {
          iataCode: iataCode.toUpperCase() // IATA 코드를 쿼리 파라미터로 전달
        }
        // 클라이언트 측 헤더 설정은 일반적으로 필요 없음 (API Key 등은 Lambda에서 처리)
      });
      
      // Lambda 응답 본문(JSON 문자열)을 파싱할 필요 없음, axios가 자동으로 처리
      console.log(`[AeroDataBoxApi] Airport info response for ${iataCode} (from Lambda):`, response.data);
      return response.data; // Lambda가 반환한 객체(번역 포함)를 그대로 반환

    } catch (error) {
      console.error(`[AeroDataBoxApi] Failed to get airport info for ${iataCode} via Gateway:`, error.response?.data || error.message);
      // 오류 발생 시 null 반환
      return null;
    }
  }
}

export default new AeroDataBoxApi();
// 이전에 추가된 번역 관련 로직은 모두 제거됨
