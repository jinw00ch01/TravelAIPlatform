import axios from 'axios';
//  AWS SDK v3 Translate 클라이언트 임포트
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

// Translate 클라이언트 인스턴스 생성 (리전 설정 필요할 수 있음)
// Lambda 실행 환경의 리전을 자동으로 사용하거나, 명시적으로 지정 가능
const translateClient = new TranslateClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });

// 공통 CORS 헤더를 반환하는 헬퍼 함수
const getCorsHeaders = (allowedMethods = 'OPTIONS,GET') => ({
    'Access-Control-Allow-Origin': '*', // 실제 운영 환경에서는 특정 도메인으로 제한하는 것이 좋습니다.
    'Access-Control-Allow-Headers': 'Content-Type,Authorization', // Authorization 헤더 허용 추가 (필요시)
    'Access-Control-Allow-Methods': allowedMethods
});

// Axios paramsSerializer 함수
const serializeParams = params => {
    const parts = [];
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
            value.forEach(val => {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
            });
        } else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
    });
    return parts.join('&');
};

// ⭐️ 텍스트 번역 함수 (한국어 -> 영어)
const translateKoreanToEnglish = async (text) => {
    // 간단한 한국어 감지 로직 (정규식 사용)
    const isKorean = /[\u3131-\uD79D]/.test(text); // 한글 자모 및 완성형 한글 감지

    if (!isKorean) {
        console.log(`Keyword "${text}" is not Korean, skipping translation.`);
        return text; // 한국어가 아니면 그대로 반환
    }

    console.log(`Korean keyword "${text}" detected, attempting translation...`);
    try {
        const command = new TranslateTextCommand({
            Text: text,
            SourceLanguageCode: 'ko',
            TargetLanguageCode: 'en'
        });
        const response = await translateClient.send(command);
        const translatedText = response.TranslatedText;
        console.log(`Translation successful: "${text}" -> "${translatedText}"`);
        return translatedText;
    } catch (error) {
        console.error(`Error translating text "${text}":`, error);
        // 번역 실패 시 원본 텍스트 사용 또는 오류 처리 선택
        console.warn('Translation failed, using original keyword.');
        return text;
    }
};

export const handler = async (event) => {
    try {
        // Amadeus API 인증 정보
        const API_KEY = process.env.AMADEUS_API_KEY;
        const API_SECRET = process.env.AMADEUS_API_SECRET;

        // 인증 토큰 획득 (Production URL)
        const authResponse = await axios({
            method: 'POST',
            url: 'https://api.amadeus.com/v1/security/oauth2/token', // Production URL로 변경
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: `grant_type=client_credentials&client_id=${API_KEY}&client_secret=${API_SECRET}`
        });

        const token = authResponse.data.access_token;

        // 클라이언트에서 전달된 쿼리 스트링 파라미터 추출
        const queryParams = event.queryStringParameters || {};
        console.log('Received query parameters:', queryParams); // 수신된 파라미터 로깅

        const {
            subType: subTypeString, // 변수명 변경 (원본 문자열)
            keyword: originalKeyword, // 원본 키워드 변수명 변경
            countryCode,
            'page[limit]': pageLimit,
            'page[offset]': pageOffset,
            sort,
            view
        } = queryParams;

        // 필수 파라미터 확인
        if (!subTypeString || !originalKeyword) {
            console.error('Missing required parameters');
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Missing required query parameters: subType and keyword.' })
            };
        }

        // ⭐️ 키워드 번역 (한국어인 경우 영어로)
        const keywordForApi = await translateKoreanToEnglish(originalKeyword);
        console.log(`Keyword used for Amadeus API: ${keywordForApi}`); // ⭐️ API 호출 키워드 로깅

        // ⭐️ subType 결정 로직 수정
        let subTypeArray;
        if (keywordForApi.toLowerCase() === 'incheon') {
            console.log('Keyword is Incheon, forcing subType to AIRPORT.');
            subTypeArray = ['AIRPORT']; // 인천/Incheon 검색 시 AIRPORT만 검색
        } else {
            subTypeArray = subTypeString.split(','); // 그 외에는 전달된 subType 사용
        }

        // API 호출 파라미터 구성 (번역된 키워드 및 조정된 subType 사용)
        const apiParams = {
            subType: subTypeArray, // 조정된 subType 배열 사용
            keyword: keywordForApi,
            ...(countryCode && { countryCode }),
            ...(pageLimit && { 'page[limit]': pageLimit }),
            ...(pageOffset && { 'page[offset]': pageOffset }),
            ...(sort && { sort }),
            ...(view && { view })
        };

        // ⭐️ 호출할 최종 URL 로깅 추가
        const requestConfig = {
            method: 'GET',
            url: 'https://api.amadeus.com/v1/reference-data/locations',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: apiParams,
            paramsSerializer: serializeParams // 정의된 serializer 사용
        };
        
        // axios.getUri()는 라이브러리 버전에 따라 없을 수 있으므로, 수동으로 구성하거나 axios 요청 직전에 로깅
        const finalUrl = `${requestConfig.url}?${serializeParams(requestConfig.params)}`;
        console.log('Calling Amadeus API with URL:', finalUrl); 

        // Airport & City Search API 호출
        const response = await axios(requestConfig);

        console.log('Amadeus API Response Status:', response.status);

        // ⭐️ Amadeus 전체 응답 로깅
        console.log('Amadeus Full Response Data:', JSON.stringify(response.data, null, 2));

        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify(response.data, null, 2)
        };

    } catch (error) {
        console.error('에러 발생:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        const errorData = error.response?.data;
        const detailedError = errorData?.errors?.[0];
        
        // 어떤 파라미터에서 오류가 발생했는지 확인 시도
        if (detailedError?.source?.parameter) {
             console.error(`Error source parameter: ${detailedError.source.parameter}`);
        }

        return {
            statusCode: error.response?.status || detailedError?.status || 500,
            headers: getCorsHeaders(),
            body: JSON.stringify(errorData || { error: error.message }, null, 2)
        };
    }
};
