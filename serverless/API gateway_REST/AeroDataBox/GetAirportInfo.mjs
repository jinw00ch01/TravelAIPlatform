import axios from 'axios';
// AWS Translate SDK 추가
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

// Translate 클라이언트 인스턴스 생성 (Lambda 실행 환경의 리전 사용)
const translateClient = new TranslateClient({ region: process.env.AWS_REGION });

// 공통 CORS 헤더를 반환하는 헬퍼 함수
const getCorsHeaders = (allowedMethods = 'OPTIONS,GET') => ({
    'Access-Control-Allow-Origin': '*', // 실제 운영 환경에서는 특정 도메인으로 제한하는 것이 좋습니다.
    'Access-Control-Allow-Headers': 'Content-Type,Authorization', // RapidAPI 관련 헤더 제거
    'Access-Control-Allow-Methods': allowedMethods
});

// Amadeus 인증 토큰 획득 함수
const getAmadeusToken = async (apiKey, apiSecret) => {
    try {
        const authResponse = await axios({
            method: 'POST',
            url: 'https://api.amadeus.com/v1/security/oauth2/token',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`
        });
        console.log('Successfully obtained Amadeus token.');
        return authResponse.data.access_token;
    } catch (error) {
        console.error('Failed to get Amadeus token:', error.response ? error.response.data : error.message);
        throw new Error('Amadeus authentication failed.');
    }
};

// <<< 특정 IATA 코드에 대한 우선 적용 한글 이름 매핑 >>>
const customKoreanNames = {
    "ICN": {
        koreanFullName: "인천 국제공항",
        koreanMunicipalityName: "서울/인천" // 또는 "인천" 등 원하는 도시 표현
    },
    "GMP": {
        koreanFullName: "김포 국제공항",
        koreanMunicipalityName: "서울/김포"
    },
    "JFK": {
        koreanFullName: "존 F. 케네디 국제공항",
        koreanMunicipalityName: "뉴욕"
    }
    // 필요한 만큼 추가
};

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        // Amadeus API 인증 정보 (환경 변수에서 가져옴)
        const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
        const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET;

        if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
            console.error('Missing Amadeus API credentials in environment variables');
            return {
                statusCode: 500,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Server configuration error: API credentials missing.' })
            };
        }

        const queryParams = event.queryStringParameters || {};
        const { iataCode } = queryParams;

        if (!iataCode || typeof iataCode !== 'string' || iataCode.length !== 3) {
            console.error('Missing or invalid required parameter: iataCode');
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'Missing or invalid required query parameter: iataCode (must be a 3-letter IATA code).' })
            };
        }

        const upperIataCode = iataCode.toUpperCase();
        const token = await getAmadeusToken(AMADEUS_API_KEY, AMADEUS_API_SECRET);

        // --- 1. Amadeus Airport & City Search API 호출 --- 
        const requestConfig = {
            method: 'GET',
            url: 'https://api.amadeus.com/v1/reference-data/locations',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: {
                keyword: upperIataCode,
                subType: 'AIRPORT', // 공항 정보만 검색
                view: 'FULL'       // 상세 정보 요청
            }
        };

        console.log(`Calling Amadeus Airport & City Search API for ${upperIataCode}`);
        const amadeusResponse = await axios.request(requestConfig);
        console.log('Amadeus API Response Status:', amadeusResponse.status);
        
        let airportData = null;
        // Amadeus 응답은 배열이므로, 정확히 일치하는 첫 번째 결과를 찾음
        if (amadeusResponse.data && Array.isArray(amadeusResponse.data.data) && amadeusResponse.data.data.length > 0) {
            airportData = amadeusResponse.data.data.find(loc => loc.iataCode === upperIataCode);
            if (!airportData && amadeusResponse.data.data.length === 1) {
                // 정확히 일치하는 것이 없지만 결과가 하나면 그것을 사용 (예: 일부 공항은 도시 코드로만 검색될 수 있음)
                airportData = amadeusResponse.data.data[0];
            } 
        }

        if (!airportData) {
            console.warn(`No specific airport data found for ${upperIataCode} in Amadeus response. Full response:`, JSON.stringify(amadeusResponse.data, null, 2));
            // 데이터를 찾지 못했어도 200으로 빈 객체를 반환하여 프론트에서 처리하도록 함
            return {
                statusCode: 200, 
                headers: getCorsHeaders(),
                body: JSON.stringify({ iata: upperIataCode, warning: 'Airport details not found in Amadeus' })
            };
        }
        console.log('Amadeus API Original Response Data for Airport:', JSON.stringify(airportData, null, 2));

        // --- 번역 또는 직접 지정 로직 ---
        const customNames = customKoreanNames[upperIataCode];

        if (customNames) {
            console.log(`Using custom Korean names for ${upperIataCode}`);
            airportData.koreanFullName = customNames.koreanFullName;
            airportData.koreanMunicipalityName = customNames.koreanMunicipalityName;
            // 국가 이름은 Amadeus 응답을 사용하거나, 필요시 customNames에 추가 가능
            if (airportData.address?.countryName) {
                 try {
                    const countryTranslateResponse = await translateClient.send(new TranslateTextCommand({
                        Text: airportData.address.countryName,
                        SourceLanguageCode: 'en',
                        TargetLanguageCode: 'ko'
                    }));
                    if (!airportData.koreanAddress) airportData.koreanAddress = {};
                    airportData.koreanAddress.countryName = countryTranslateResponse.TranslatedText || airportData.address.countryName;
                } catch (translateError) {
                    console.warn(`Failed to translate country name for ${upperIataCode}:`, translateError);
                    if (!airportData.koreanAddress) airportData.koreanAddress = {};
                    airportData.koreanAddress.countryName = airportData.address.countryName; // 번역 실패시 영어 이름 사용
                }
            }
        } else {
            // 커스텀 이름이 없을 경우에만 AWS Translate 사용
            const textsToTranslate = [
                { key: 'name', text: airportData.name },
                { key: 'detailedName', text: airportData.detailedName },
                { key: 'addressCityName', text: airportData.address?.cityName },
                { key: 'addressCountryName', text: airportData.address?.countryName }
            ].filter(item => item.text);

            if (textsToTranslate.length > 0) {
                try {
                    console.log('Attempting to translate (non-custom):', textsToTranslate.map(t => t.text));
                    const translatePromises = textsToTranslate.map(item => 
                        translateClient.send(new TranslateTextCommand({
                            Text: item.text,
                            SourceLanguageCode: 'en',
                            TargetLanguageCode: 'ko'
                        })).then(result => ({ 
                            key: item.key,
                            translatedText: result.TranslatedText 
                        }))
                    );
                    const translateResults = await Promise.all(translatePromises);
                    console.log('Translation results (non-custom):', translateResults);

                    translateResults.forEach(result => {
                        if (result.key === 'name') airportData.koreanName = result.translatedText || airportData.name;
                        if (result.key === 'detailedName') airportData.koreanDetailedName = result.translatedText || airportData.detailedName;
                        if (result.key === 'addressCityName') {
                            if (!airportData.koreanAddress) airportData.koreanAddress = {};
                            airportData.koreanAddress.cityName = result.translatedText || airportData.address.cityName;
                        }
                        if (result.key === 'addressCountryName') {
                            if (!airportData.koreanAddress) airportData.koreanAddress = {};
                            airportData.koreanAddress.countryName = result.translatedText || airportData.address.countryName;
                        }
                    });
                } catch (translateError) {
                    console.warn('AWS Translate failed for non-custom names:', translateError);
                }
            }
        }
        console.log('Data with custom/translated names:', JSON.stringify(airportData, null, 2));

        // --- 4. 최종 결과 반환 --- 
        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify(airportData, null, 2)
        };

    } catch (error) {
        console.error('Error in GetAirportInfo (Amadeus):', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        const errorStatus = error.response?.status || 500;
        const errorMessage = error.response?.data?.errors?.[0]?.detail || error.response?.data?.message || error.message || 'Failed to get airport information using Amadeus.';
        return {
            statusCode: errorStatus,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: errorMessage }, null, 2)
        };
    }
};
