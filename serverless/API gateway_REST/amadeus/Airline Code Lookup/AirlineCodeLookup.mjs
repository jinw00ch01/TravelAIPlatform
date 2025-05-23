import axios from 'axios';

// 공통 CORS 헤더를 반환하는 헬퍼 함수
const getCorsHeaders = (allowedMethods = 'OPTIONS,GET') => ({
    'Access-Control-Allow-Origin': '*', // 실제 운영 환경에서는 특정 도메인으로 제한하는 것이 좋습니다.
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': allowedMethods
});

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        // Amadeus API 인증 정보 (환경 변수에서 가져옴)
        const API_KEY = process.env.AMADEUS_API_KEY;
        const API_SECRET = process.env.AMADEUS_API_SECRET;

        if (!API_KEY || !API_SECRET) {
            console.error('Missing Amadeus API credentials in environment variables');
            return {
                statusCode: 500,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Server configuration error: API credentials missing.' })
            };
        }

        // 클라이언트에서 전달된 쿼리 스트링 파라미터 추출
        const queryParams = event.queryStringParameters || {};
        console.log('Received query parameters:', queryParams);

        const { airlineCodes } = queryParams;

        // 필수 파라미터 확인
        if (!airlineCodes) {
            console.error('Missing required parameter: airlineCodes');
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Missing required query parameter: airlineCodes.' })
            };
        }

        // 1. 인증 토큰 획득 (Production URL 사용)
        const authResponse = await axios({
            method: 'POST',
            url: 'https://api.amadeus.com/v1/security/oauth2/token',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: `grant_type=client_credentials&client_id=${API_KEY}&client_secret=${API_SECRET}`
        });
        const token = authResponse.data.access_token;
        console.log('Successfully obtained Amadeus token.');

        // 2. Airline Code Lookup API 호출 (GET 요청)
        const requestConfig = {
            method: 'GET',
            url: 'https://api.amadeus.com/v1/reference-data/airlines',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: {
                airlineCodes: airlineCodes // 콤마로 구분된 문자열 그대로 전달
            }
        };

        // 최종 요청 URL 로깅 (디버깅용)
        const finalUrl = `${requestConfig.url}?airlineCodes=${encodeURIComponent(airlineCodes)}`;
        console.log('Calling Amadeus Airline Code Lookup API with URL:', finalUrl);

        const response = await axios(requestConfig);
        console.log('Amadeus API Response Status:', response.status);
        console.log('Amadeus API Response Data:', JSON.stringify(response.data, null, 2));

        // 3. 클라이언트에 응답 반환
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            // Amadeus 응답의 data 필드를 그대로 body에 담아 반환
            body: JSON.stringify(response.data, null, 2)
        };

    } catch (error) {
        console.error('Error in AirlineCodeLookup:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        const errorData = error.response?.data;
        const detailedError = errorData?.errors?.[0];

        // 어떤 파라미터에서 오류가 발생했는지 확인 시도
        if (detailedError?.source?.parameter) {
             console.error(`Error source parameter: ${detailedError.source.parameter}`);
        }

        return {
            // Amadeus 에러 응답의 상태 코드를 사용하거나 기본 500 에러
            statusCode: error.response?.status || detailedError?.status || 500,
            headers: getCorsHeaders(),
            body: JSON.stringify(errorData || { error: 'Failed to lookup airline codes.', details: error.message }, null, 2)
        };
    }
};
