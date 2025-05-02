import axios from 'axios';

// 공통 CORS 헤더를 반환하는 헬퍼 함수
const getCorsHeaders = (allowedMethods = 'OPTIONS,GET') => ({
    'Access-Control-Allow-Origin': '*', // 실제 운영 환경에서는 특정 도메인으로 제한하는 것이 좋습니다.
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': allowedMethods
});

// Axios paramsSerializer 함수 (배열 처리 포함)
const serializeParams = params => {
    const parts = [];
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return; // 빈 값도 제외
        if (Array.isArray(value)) {
            value.forEach(val => {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
            });
        } else {
            // boolean 값은 문자열로 변환
            const encodedValue = typeof value === 'boolean' ? String(value) : encodeURIComponent(value);
            parts.push(`${encodeURIComponent(key)}=${encodedValue}`);
        }
    });
    return parts.join('&');
};

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        // Amadeus API 인증 정보
        const API_KEY = process.env.AMADEUS_API_KEY;
        const API_SECRET = process.env.AMADEUS_API_SECRET;

        // 인증 토큰 획득 (Production URL)
        const authResponse = await axios({
            method: 'POST',
            url: 'https://api.amadeus.com/v1/security/oauth2/token',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: `grant_type=client_credentials&client_id=${API_KEY}&client_secret=${API_SECRET}`
        });
        const token = authResponse.data.access_token;

        // ⭐️ 요청 본문에서 파라미터 추출 (POST 요청)
        const bodyParams = JSON.parse(event.body || '{}');
        console.log('Received body parameters:', bodyParams); // 수신된 파라미터 로깅

        const {
            originLocationCode, destinationLocationCode, departureDate, // 필수
            returnDate, adults = '1', children, infants, // 승객 및 날짜
            travelClass, // 항공편 옵션
            nonStop, currencyCode = 'KRW', maxPrice, max = '10' // 기타 옵션
        } = bodyParams; // ⭐️ bodyParams에서 추출하도록 변경

        // 필수 파라미터 확인
        if (!originLocationCode || !destinationLocationCode || !departureDate) {
            console.error('Missing required flight search parameters in body');
            return {
                statusCode: 400,
                headers: getCorsHeaders('POST'), // POST 허용
                body: JSON.stringify({ error: 'Missing required parameters in request body: originLocationCode, destinationLocationCode, departureDate.' })
            };
        }

        // API 호출을 위한 파라미터 객체 생성 (값이 있는 것만 포함)
        const apiParams = {
            originLocationCode,
            destinationLocationCode,
            departureDate,
            adults: parseInt(adults, 10),
            ...(returnDate && { returnDate }),
            ...(children && { children: parseInt(children, 10) }),
            ...(infants && { infants: parseInt(infants, 10) }),
            ...(travelClass && { travelClass }),
            ...(nonStop === 'true' && { nonStop: true }), 
            ...(currencyCode && { currencyCode }),
            ...(maxPrice && { maxPrice: parseInt(maxPrice, 10) }),
            ...(max && { max: parseInt(max, 10) })
        };

        // 숫자 파라미터 유효성 검사 (NaN 방지)
        if (isNaN(apiParams.adults)) apiParams.adults = 1;
        if (apiParams.children !== undefined && isNaN(apiParams.children)) delete apiParams.children;
        if (apiParams.infants !== undefined && isNaN(apiParams.infants)) delete apiParams.infants;
        if (apiParams.maxPrice !== undefined && isNaN(apiParams.maxPrice)) delete apiParams.maxPrice;
        if (apiParams.max !== undefined && isNaN(apiParams.max)) apiParams.max = 10;
        
        // infants 수는 adults 수보다 많을 수 없음
        if (apiParams.infants > apiParams.adults) {
            console.error('Number of infants cannot exceed number of adults.');
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Number of infants cannot exceed number of adults.' })
            };
        }

        // Flight Offers Search API 호출 (Production URL)
        const requestConfig = {
            method: 'GET',
            url: 'https://api.amadeus.com/v2/shopping/flight-offers',
            headers: { 'Authorization': `Bearer ${token}` },
            params: apiParams,
            paramsSerializer: serializeParams
        };

        const finalUrl = `${requestConfig.url}?${serializeParams(requestConfig.params)}`;
        console.log('Calling Amadeus Flight Offers Search with URL:', finalUrl);

        const response = await axios(requestConfig);
        console.log('Amadeus API Response Status:', response.status);

        // ⭐️ Amadeus 응답 데이터 로깅 추가
        console.log('Amadeus API Response Data:', JSON.stringify(response.data, null, 2));

        return {
            statusCode: 200,
            headers: getCorsHeaders('POST'), // POST 허용
            body: JSON.stringify(response.data, null, 2)
        };

    } catch (error) {
        console.error('Error in FlightOffersSearch:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        const errorData = error.response?.data;
        const detailedError = errorData?.errors?.[0];
        
        if (detailedError?.source?.parameter) {
             console.error(`Error source parameter: ${detailedError.source.parameter}`);
        }

        return {
            statusCode: error.response?.status || detailedError?.status || 500,
            headers: getCorsHeaders('POST'), // POST 허용
            body: JSON.stringify(errorData || { error: error.message }, null, 2)
        };
    }
};
