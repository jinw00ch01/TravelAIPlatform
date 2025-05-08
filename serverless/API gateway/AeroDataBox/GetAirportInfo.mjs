import axios from 'axios';
// AWS Translate SDK 추가
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

// Translate 클라이언트 인스턴스 생성 (Lambda 실행 환경의 리전 사용)
const translateClient = new TranslateClient({ region: process.env.AWS_REGION });

// 공통 CORS 헤더를 반환하는 헬퍼 함수
const getCorsHeaders = (allowedMethods = 'OPTIONS,GET') => ({
    'Access-Control-Allow-Origin': '*', // 실제 운영 환경에서는 특정 도메인으로 제한하는 것이 좋습니다.
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-RapidAPI-Key,X-RapidAPI-Host',
    'Access-Control-Allow-Methods': allowedMethods
});

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        // RapidAPI Key (환경 변수에서 가져옴)
        const RAPIDAPI_KEY = process.env.AERODATABOX_RAPIDAPI_KEY;

        if (!RAPIDAPI_KEY) {
            console.error('Missing RapidAPI Key in environment variables');
            return {
                statusCode: 500,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Server configuration error: API key missing.' })
            };
        }

        // 클라이언트에서 전달된 쿼리 스트링 파라미터 추출
        const queryParams = event.queryStringParameters || {};
        console.log('Received query parameters:', queryParams);

        const { iataCode } = queryParams; // 공항 IATA 코드를 쿼리 파라미터로 받음

        // 필수 파라미터 확인 (IATA 코드)
        if (!iataCode || typeof iataCode !== 'string' || iataCode.length !== 3) {
            console.error('Missing or invalid required parameter: iataCode');
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Missing or invalid required query parameter: iataCode (must be a 3-letter IATA code).' })
            };
        }

        // --- 1. AeroDataBox API 호출 --- 
        const options = {
            method: 'GET',
            url: `https://aerodatabox.p.rapidapi.com/airports/iata/${iataCode.toUpperCase()}`,
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'aerodatabox.p.rapidapi.com'
            },
            params: { }
        };

        console.log(`Calling AeroDataBox Get Airport API for ${iataCode.toUpperCase()}`);
        const aeroResponse = await axios.request(options);
        console.log('AeroDataBox API Response Status:', aeroResponse.status);
        
        // 원본 데이터 저장
        const aeroData = aeroResponse.data;
        console.log('AeroDataBox API Original Response Data:', JSON.stringify(aeroData, null, 2));

        // --- 2. AWS Translate 호출 (필요한 필드 번역) --- 
        const textsToTranslate = [
            { key: 'fullName', text: aeroData.fullName },
            { key: 'municipalityName', text: aeroData.municipalityName },
            { key: 'countryName', text: aeroData.country?.name }
        ].filter(item => item.text); // 텍스트가 있는 항목만 필터링

        if (textsToTranslate.length > 0) {
            try {
                console.log('Attempting to translate:', textsToTranslate.map(t => t.text));
                const translatePromises = textsToTranslate.map(item => 
                    translateClient.send(new TranslateTextCommand({
                        Text: item.text,
                        SourceLanguageCode: 'en', // 영어에서
                        TargetLanguageCode: 'ko'  // 한국어로 번역
                    })).then(result => ({ 
                        key: item.key, // 원래 필드 키 저장
                        translatedText: result.TranslatedText 
                    }))
                );

                const translateResults = await Promise.all(translatePromises);
                console.log('Translation results (raw):', translateResults);

                // 번역 결과를 원본 데이터에 korean*** 필드로 추가
                translateResults.forEach(result => {
                    if (result.key === 'fullName') {
                        aeroData.koreanFullName = result.translatedText || aeroData.fullName;
                    } else if (result.key === 'municipalityName') {
                        aeroData.koreanMunicipalityName = result.translatedText || aeroData.municipalityName;
                    } else if (result.key === 'countryName') {
                        if (!aeroData.koreanCountry) aeroData.koreanCountry = {};
                        aeroData.koreanCountry.name = result.translatedText || aeroData.country.name;
                    }
                });
                 console.log('Data with translations:', JSON.stringify(aeroData, null, 2));

            } catch (translateError) {
                console.warn('AWS Translate failed, returning original names:', translateError);
                // 번역 실패 시 경고만 로깅하고 진행 (원본 데이터만 반환됨)
            }
        }

        // --- 3. 최종 결과 반환 --- 
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify(aeroData, null, 2) // 한국어 필드가 추가되었거나 없는 원본 데이터
        };

    } catch (error) {
        console.error('Error in GetAirportInfo:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        
        const errorStatus = error.response?.status || 500;
        const errorMessage = error.response?.data?.message || error.message || 'Failed to get airport information.';

        return {
            statusCode: errorStatus,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: errorMessage }, null, 2)
        };
    }
};
