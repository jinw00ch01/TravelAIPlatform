import axios from 'axios';

// 공통 CORS 헤더를 반환하는 헬퍼 함수
const getCorsHeaders = (allowedMethods = 'OPTIONS,GET') => ({
    'Access-Control-Allow-Origin': '*', // 실제 운영 환경에서는 특정 도메인으로 제한하는 것이 좋습니다.
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': allowedMethods
});

export const handler = async (event) => {
    try {
        // Amadeus API 인증 정보
        const API_KEY = process.env.AMADEUS_API_KEY;
        const API_SECRET = process.env.AMADEUS_API_SECRET;

        // 인증 토큰 획득
        const authResponse = await axios({
            method: 'POST',
            url: 'https://api.amadeus.com/v1/security/oauth2/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: `grant_type=client_credentials&client_id=${API_KEY}&client_secret=${API_SECRET}`
        });

        const token = authResponse.data.access_token;

        // ✅ 클라이언트에서 전달된 JSON 파라미터 파싱
        // FlightOffersSearch 결과에서 받은 flightOffers 배열을 포함해야 함
        // 예: { "data": { "type": "flight-offers-pricing", "flightOffers": [ ...flightOfferFromSearch ] } }
        const priceRequestData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

        // 필수 데이터 구조 확인 (간단하게)
        if (!priceRequestData || !priceRequestData.data || !priceRequestData.data.flightOffers) {
             return {
                statusCode: 400,
                headers: getCorsHeaders('OPTIONS,POST'), // 헬퍼 함수 사용 (POST 허용)
                body: JSON.stringify({ error: 'Invalid request body structure for Flight Offers Price.' })
             };
        }

        // Flight Offers Price API 호출
        const response = await axios({
            method: 'POST',
            url: 'https://api.amadeus.com/v1/shopping/flight-offers/pricing',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                 // Amadeus 가이드에 따라 GET 오버라이드 헤더 추가 가능성 있음 (필요 시)
                 // 'X-HTTP-Method-Override': 'GET'
            },
            data: priceRequestData
             // 필요 시 쿼리 파라미터 추가 (예: include=bags,detailed-fare-rules)
             // params: {
             //   include: 'bags,detailed-fare-rules'
             // }
        });

        return {
            statusCode: 200,
            headers: getCorsHeaders('OPTIONS,POST'), // 헬퍼 함수 사용 (POST 허용)
            body: JSON.stringify(response.data, null, 2)
        };

    } catch (error) {
        console.error('에러 발생:', error.response ? error.response.data : error.message);
        const errorBody = error.response ? error.response.data : { error: error.message };
        // Amadeus 오류 메시지에 errors 배열이 포함될 수 있음
        const detailedError = errorBody.errors || errorBody;

        return {
            statusCode: error.response ? error.response.status : 500,
            headers: getCorsHeaders('OPTIONS,POST'), // 헬퍼 함수 사용 (POST 허용)
            body: JSON.stringify(detailedError, null, 2)
        };
    }
};
