import axios from 'axios';

// 공통 CORS 헤더를 반환하는 헬퍼 함수
const getCorsHeaders = (allowedMethods = 'OPTIONS,GET,POST') => ({
    'Access-Control-Allow-Origin': '*', // 실제 운영 환경에서는 특정 도메인으로 제한하는 것이 좋습니다.
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': allowedMethods
});

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
            returnDate, adults = 1, children = 0, infants = 0, // 승객 및 날짜 (기본값 설정 및 타입 변환 고려)
            travelClass, // 항공편 옵션
            nonStop, currencyCode = 'KRW', maxPrice, max = 10 // 기타 옵션 (기본값 설정 및 타입 변환 고려)
        } = bodyParams;

        // 필수 파라미터 확인
        if (!originLocationCode || !destinationLocationCode || !departureDate) {
            console.error('Missing required flight search parameters in body');
            return {
                statusCode: 400,
                headers: getCorsHeaders('POST'),
                body: JSON.stringify({ error: 'Missing required parameters in request body: originLocationCode, destinationLocationCode, departureDate.' })
            };
        }
        
        const numAdults = parseInt(adults, 10);
        const numChildren = parseInt(children, 10) || 0; // children이 없을 경우 0
        const numInfants = parseInt(infants, 10) || 0; // infants가 없을 경우 0

        // 숫자 파라미터 유효성 검사
        if (isNaN(numAdults) || numAdults <= 0) {
            console.error('Invalid adults count');
            return { statusCode: 400, headers: getCorsHeaders('POST'), body: JSON.stringify({ error: 'Adults must be at least 1.'})};
        }
        if (isNaN(numChildren) || numChildren < 0) {
            console.error('Invalid children count');
            // 기본값으로 0을 사용했으므로, 오류 대신 경고만 로깅하거나 그대로 진행
        }
        if (isNaN(numInfants) || numInfants < 0) {
            console.error('Invalid infants count');
            // 기본값으로 0을 사용했으므로, 오류 대신 경고만 로깅하거나 그대로 진행
        }
        
        if (numInfants > numAdults) {
            console.error('Number of infants cannot exceed number of adults.');
            return {
                statusCode: 400,
                headers: getCorsHeaders('POST'), // POST 허용된 헤더 사용
                body: JSON.stringify({ error: 'Number of infants cannot exceed number of adults.' })
            };
        }

        // API 호출을 위한 파라미터 객체 생성 (getFlightOffersQuery 모델 기반)
        const originDestinations = [
            {
                id: "1", // 순차적 ID
                originLocationCode: originLocationCode,
                destinationLocationCode: destinationLocationCode,
                departureDateTimeRange: {
                    date: departureDate // YYYY-MM-DD 형식
                    // time: "10:00:00" // 필요시 추가
                }
            }
        ];

        if (returnDate) {
            originDestinations.push({
                id: "2",
                originLocationCode: destinationLocationCode, // 도착지가 출발지가 됨
                destinationLocationCode: originLocationCode, // 출발지가 도착지가 됨
                departureDateTimeRange: {
                    date: returnDate // YYYY-MM-DD 형식
                }
            });
        }

        const travelers = [];
        let travelerIdCounter = 1;
        for (let i = 0; i < numAdults; i++) {
            travelers.push({ id: travelerIdCounter.toString(), travelerType: 'ADULT' });
            travelerIdCounter++;
        }
        // Children과 Infants는 수가 0 이상일 때만 추가
        if (numChildren > 0) {
            for (let i = 0; i < numChildren; i++) {
                travelers.push({ id: travelerIdCounter.toString(), travelerType: 'CHILD' });
                travelerIdCounter++;
            }
        }
        if (numInfants > 0) {
            for (let i = 0; i < numInfants; i++) {
                // 각 유아는 순서대로 성인에게 할당 (1번 유아 -> 1번 성인 ID ...)
                const adultIdForInfant = (i + 1).toString(); 
                travelers.push({ id: travelerIdCounter.toString(), travelerType: 'HELD_INFANT', associatedAdultId: adultIdForInfant });
                travelerIdCounter++;
            }
        }
        
        const parsedMax = parseInt(max, 10);
        const searchCriteria = {
            maxFlightOffers: isNaN(parsedMax) || parsedMax <=0 ? 10 : parsedMax, // 기본값 또는 유효한 값
        };

        if (maxPrice) {
            const parsedMaxPrice = parseInt(maxPrice, 10);
            if (!isNaN(parsedMaxPrice) && parsedMaxPrice > 0) {
                searchCriteria.maxPrice = parsedMaxPrice;
            }
        }

        searchCriteria.flightFilters = {}; // flightFilters 객체 초기화

        if (travelClass && typeof travelClass === 'string' && travelClass.trim() !== '') {
            searchCriteria.flightFilters.cabinRestrictions = [
                {
                    cabin: travelClass.toUpperCase(), // ENUM 값으로 변환
                    coverage: 'MOST_SEGMENTS', // API 가이드에 따른 기본값 또는 적절한 값
                    originDestinationIds: originDestinations.map(od => od.id) // 모든 여정 ID 포함
                }
            ];
        }

        // nonStop이 boolean true로 전달될 때만 직항(maxNumberOfConnections: 0) 설정
        if (nonStop === true) { 
            searchCriteria.flightFilters.connectionRestriction = {
                maxNumberOfConnections: 0
            };
        }
        // nonStop이 false이거나 명시되지 않으면 connectionRestriction을 설정하지 않아 기본 동작(경유 포함)
        
        const amadeusApiRequestBody = {
            currencyCode: currencyCode || 'KRW',
            originDestinations,
            travelers,
            sources: ["GDS"], // API 문서에 따름
            searchCriteria
        };
        
        console.log('Constructed Amadeus API Request Body:', JSON.stringify(amadeusApiRequestBody, null, 2));

        // Flight Offers Search API 호출 (POST 방식)
        const requestConfig = {
            method: 'POST',
            url: 'https://api.amadeus.com/v2/shopping/flight-offers',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json', // POST 요청 시 Content-Type 지정
                'X-HTTP-Method-Override': 'GET'     // API 가이드에 따른 헤더 (필수)
            },
            data: amadeusApiRequestBody // 요청 본문
        };
        
        console.log('Calling Amadeus Flight Offers Search with URL (POST):', requestConfig.url);
        // console.log('Calling Amadeus Flight Offers Search with Headers:', JSON.stringify(requestConfig.headers, null, 2)); // 토큰 포함될 수 있어 주석 처리
        // console.log('Calling Amadeus Flight Offers Search with Body:', JSON.stringify(requestConfig.data, null, 2)); // 위에서 이미 로깅


        const response = await axios(requestConfig);
        console.log('Amadeus API Response Status:', response.status);

        // ⭐️ Amadeus 응답 데이터 로깅 추가
        console.log('Amadeus API Response Data:', JSON.stringify(response.data, null, 2)); // 아래 return에서 이미 stringify하므로 중복

        return {
            statusCode: 200,
            headers: getCorsHeaders('POST'),
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
            headers: getCorsHeaders('POST'),
            body: JSON.stringify(errorData || { error: error.message }, null, 2)
        };
    }
};
