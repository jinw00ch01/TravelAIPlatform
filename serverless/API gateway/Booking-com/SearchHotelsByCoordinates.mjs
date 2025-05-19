import axios from 'axios';

const getCorsHeaders = (allowedMethods = 'OPTIONS,GET,POST') => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-RapidAPI-Key,X-RapidAPI-Host',
    'Access-Control-Allow-Methods': allowedMethods
});

// FALLBACK_EXCHANGE_RATES (기존 EXCHANGE_RATES 대신 사용될 기본 환율)
const FALLBACK_EXCHANGE_RATES = {
    KRW: 1,
    USD: 1350,    // 1 USD = 1,350 KRW
    JPY: 9,       // 1 JPY = 9 KRW
    EUR: 1450,    // 1 EUR = 1,450 KRW
    CNY: 185      // 1 CNY = 185 KRW
};

let cachedExchangeRates = null;
let lastFetchedTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1시간 (밀리초 단위)

async function getLiveExchangeRates() {
    const now = Date.now();
    if (cachedExchangeRates && (now - lastFetchedTime < CACHE_DURATION)) {
        console.log('[ExchangeRates] Using cached rates.');
        return cachedExchangeRates;
    }

    try {
        console.log('[ExchangeRates] Fetching new rates from open.er-api.com for KRW base.');
        // KRW를 기준으로 하는 환율 API 호출
        const response = await axios.get('https://open.er-api.com/v6/latest/KRW');
        const apiRates = response.data.rates; // 응답 형식: { "USD": 0.00073, "JPY": 0.11, ... } (1 KRW 당 각 통화의 가치)

        // 필요한 형식으로 변환: 1 FOREIGN_CURRENCY = X KRW
        // 즉, 1 / apiRates.FOREIGN_CURRENCY
        const liveRates = {
            KRW: 1,
            USD: apiRates.USD && apiRates.USD > 0 ? Math.round(1 / apiRates.USD) : FALLBACK_EXCHANGE_RATES.USD,
            JPY: apiRates.JPY && apiRates.JPY > 0 ? Math.round(1 / apiRates.JPY) : FALLBACK_EXCHANGE_RATES.JPY,
            EUR: apiRates.EUR && apiRates.EUR > 0 ? Math.round(1 / apiRates.EUR) : FALLBACK_EXCHANGE_RATES.EUR,
            CNY: apiRates.CNY && apiRates.CNY > 0 ? Math.round(1 / apiRates.CNY) : FALLBACK_EXCHANGE_RATES.CNY
        };
        
        // 모든 주요 통화에 대한 환율을 성공적으로 가져왔는지 부분적으로 확인
        // 일부 통화만 실패한 경우, 해당 통화만 fallback 사용

        cachedExchangeRates = liveRates;
        lastFetchedTime = now;
        console.log('[ExchangeRates] Successfully fetched and cached new rates:', liveRates);
        return liveRates;
    } catch (error) {
        console.error('[ExchangeRates] Failed to fetch live exchange rates. Using fallback rates.', error.message);
        // 실패 시 마지막으로 성공했던 캐시된 값 또는 fallback 사용
        // 여기서는 실패 시 항상 FALLBACK_EXCHANGE_RATES를 사용하고 캐시를 초기화하여 다음 시도를 유도
        cachedExchangeRates = null; 
        lastFetchedTime = 0; 
        return FALLBACK_EXCHANGE_RATES;
    }
}

// 가격을 원화로 변환하는 함수
function convertToKRW(value, currency, exchangeRatesToUse) {
    if (!value || !currency) return null;
    if (currency === 'KRW') return value;
    const rate = exchangeRatesToUse[currency];
    if (!rate) { 
        console.warn(`[ConvertToKRW] Exchange rate not found for currency: ${currency} in provided rates. Returning original value. Rates: ${JSON.stringify(exchangeRatesToUse)}`);
        return value; 
    }
    return Math.round(value * rate);
}

// 호텔 데이터 처리 함수
function processHotelData(hotel, liveExchangeRates, sourceCurrencyIfKnown = 'KRW') {
    let priceDisplay = '가격 정보 없음';
    let originalPrice = null;
    let priceValue = null;
    let currentCurrency = sourceCurrencyIfKnown;

    // 가격 정보 추출 및 통화 확인
    if (hotel.composite_price_breakdown?.gross_amount?.value) {
        priceValue = hotel.composite_price_breakdown.gross_amount.value;
        currentCurrency = hotel.composite_price_breakdown.gross_amount.currency;
    } else if (hotel.composite_price_breakdown?.all_inclusive_amount?.value) {
        priceValue = hotel.composite_price_breakdown.all_inclusive_amount.value;
        currentCurrency = hotel.composite_price_breakdown.all_inclusive_amount.currency;
    } else if (hotel.min_total_price) {
        priceValue = hotel.min_total_price;
        // min_total_price의 경우, API 요청 시 filter_by_currency에 설정된 통화로 가정합니다.
        // sourceCurrencyIfKnown 파라미터를 통해 이 통화를 전달받습니다.
        currentCurrency = sourceCurrencyIfKnown; 
    }

    // 원화로 변환
    if (priceValue !== null) {
        const priceInKRW = convertToKRW(priceValue, currentCurrency, liveExchangeRates);
        if (priceInKRW !== null && (!isNaN(priceInKRW) || currentCurrency === 'KRW')) {
            priceDisplay = `KRW ${priceInKRW.toLocaleString()}`;
            // 원래 통화가 KRW가 아니고, 변환된 가격이 원래 가격과 다를 경우에만 originalPrice 설정
            if (currentCurrency !== 'KRW' && priceValue !== priceInKRW) {
                originalPrice = `${priceValue.toLocaleString()} ${currentCurrency}`;
            } else {
                originalPrice = null; // 이미 KRW거나 변환해도 값이 같으면 originalPrice는 불필요
            }
        } else {
            priceDisplay = '가격 변환 오류'; // 변환 실패 또는 결과가 NaN인 경우
            originalPrice = `${priceValue.toLocaleString()} ${currentCurrency}`;
        }
    }

    return {
        hotel_id: hotel.hotel_id,
        hotel_name: hotel.hotel_name_trans || hotel.hotel_name,
        address: hotel.address || '',
        city: hotel.city || '',
        main_photo_url: hotel.max_photo_url || hotel.main_photo_url,
        review_score: hotel.review_score || 0,
        review_score_word: hotel.review_score_word || '',
        price: priceDisplay, // KRW로 변환된 가격
        original_price: originalPrice, // 원래 가격과 통화 (KRW가 아니거나 변환 결과가 다를 경우)
        currency: 'KRW', // price 필드의 통화는 항상 KRW
        distance_to_center: hotel.distance_to_cc_formatted || '정보 없음',
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        actual_distance: hotel.distance_to_cc,
        accommodation_type: hotel.accommodation_type_name || '숙박시설',
        checkin_from: hotel.checkin?.from || '정보 없음',
        checkin_until: hotel.checkin?.until || '정보 없음',
        checkout_from: hotel.checkout?.from || '정보 없음',
        checkout_until: hotel.checkout?.until || '정보 없음',
        review_nr: hotel.review_nr
    };
}

// 호텔 객실 정보를 가져오는 함수
async function getRoomList(hotelId, checkin_date, checkout_date, adults_number, RAPIDAPI_KEY) {
    console.log('[RoomList] 요청 파라미터:', {
        hotelId,
        checkin_date,
        checkout_date,
        adults_number,
        RAPIDAPI_KEY: '***'
    });

    const options = {
        method: 'GET',
        url: 'https://booking-com.p.rapidapi.com/v1/hotels/room-list',
        params: {
            hotel_id: hotelId,
            checkin_date: checkin_date,
            checkout_date: checkout_date,
            adults_number_by_rooms: adults_number,
            currency: 'KRW',
            units: 'metric',
            locale: 'ko'
        },
        headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        console.log(`[RoomList] 호텔 ${hotelId}의 응답:`, {
            status: response.status,
            data: response.data
        });
        return response.data;
    } catch (error) {
        console.error(`[RoomList] 호텔 ${hotelId} 조회 실패:`, error);
        throw error;
    }
}

// 추천 호텔 정보를 가져오는 함수
async function getPreferredHotels(city, RAPIDAPI_KEY, liveExchangeRates) {
    console.log('[PreferredHotels] 요청 파라미터:', {
        city,
        RAPIDAPI_KEY: '***'
    });

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const options = {
        method: 'GET',
        url: 'https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates',
        params: {
            latitude: city.latitude,
            longitude: city.longitude,
            checkin_date: today.toISOString().split('T')[0],
            checkout_date: tomorrow.toISOString().split('T')[0],
            adults_number: '2',
            room_number: '1',
            filter_by_currency: city.currency,
            locale: 'ko',
            units: 'metric',
            order_by: 'popularity'
        },
        headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        console.log(`[PreferredHotels] ${city.name} 응답:`, {
            status: response.status,
            // data: response.data // 너무 클 수 있으므로 전체 데이터 로깅은 주의
        });
        
        // 호텔 데이터 처리 시 liveExchangeRates와 API 응답에 사용된 city.currency를 전달
        const processedHotels = response.data.result.map(hotel => 
            processHotelData(hotel, liveExchangeRates, city.currency) 
        );
        
        return {
            ...response.data,
            result: processedHotels
        };
    } catch (error) {
        console.error(`[PreferredHotels] ${city.name} 조회 실패:`, error);
        throw error;
    }
}

export const handler = async (event) => {
    console.log('[Lambda] Event:', JSON.stringify(event, null, 2));

    if (event.httpMethod === 'OPTIONS') {
        return { 
            statusCode: 200, 
            headers: getCorsHeaders(), 
            body: 'CORS preflight OK' 
        };
    }

    const liveExchangeRates = await getLiveExchangeRates(); // 핸들러 시작 시 환율 정보 가져오기

    try {
        const RAPIDAPI_KEY = process.env.BOOKING_RAPIDAPI_KEY;
        if (!RAPIDAPI_KEY) {
            throw new Error('Missing Booking.com RapidAPI Key');
        }

        let receivedParams = {};
        try {
            receivedParams = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            console.log('[Lambda] Parsed parameters:', receivedParams);
        } catch (e) {
            throw new Error('Invalid request body format');
        }

        // 호텔 객실 조회인 경우 (이 부분은 가격 변환 로직이 직접적으로 없음)
        if (receivedParams.type === 'room_list') {
            const { hotel_id, checkin_date, checkout_date, adults_number } = receivedParams;
            
            if (!hotel_id || !checkin_date || !checkout_date || !adults_number) {
                throw new Error('객실 조회에 필요한 필수 파라미터가 누락되었습니다.');
            }

            const roomListData = await getRoomList(
                hotel_id,
                checkin_date,
                checkout_date,
                adults_number,
                RAPIDAPI_KEY
            );

            return {
                statusCode: 200,
                headers: getCorsHeaders('POST'),
                body: JSON.stringify({
                    result: roomListData
                })
            };
        }

        // 추천 호텔 조회인 경우
        if (receivedParams.type === 'preferred_hotels') {
            const { city } = receivedParams;
            
            if (!city || !city.latitude || !city.longitude || !city.currency) {
                throw new Error('추천 호텔 조회에 필요한 필수 파라미터가 누락되었습니다.');
            }

            // getPreferredHotels 함수에 liveExchangeRates 전달
            const hotelsData = await getPreferredHotels(city, RAPIDAPI_KEY, liveExchangeRates);

            return {
                statusCode: 200,
                headers: getCorsHeaders('POST'),
                body: JSON.stringify({
                    result: hotelsData.result // processedHotels가 이미 result 객체 내에 있음
                })
            };
        }

        // 기존 호텔 검색 로직
        const {
            checkin_date,
            checkout_date,
            adults_number,
            latitude,
            longitude
        } = receivedParams;

        if (!checkin_date || !checkout_date || !latitude || !longitude || !adults_number) {
            throw new Error('Missing required parameters');
        }

        if (isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
            throw new Error('Invalid latitude or longitude values');
        }

        if (isNaN(parseInt(adults_number)) || parseInt(adults_number) < 1) {
            throw new Error('Invalid adults number');
        }

        const apiParams = {
            checkin_date,
            checkout_date,
            adults_number,
            latitude,
            longitude,
            locale: 'ko',
            filter_by_currency: 'KRW', // API 요청 시 KRW로 가격 요청
            order_by: 'distance',
            units: 'metric',
            room_number: '1'
        };

        const searchOptions = {
            method: 'GET',
            url: 'https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates',
            params: apiParams,
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
            }
        };

        console.log('[Lambda] Making API request to:', searchOptions.url);
        const response = await axios.request(searchOptions);
        console.log('[Lambda] API response status:', response.status);

        const hotels = response.data.result || [];
        console.log(`[Lambda] Found ${hotels.length} hotels`);

        // 호텔 데이터 처리 시 liveExchangeRates 전달, API가 KRW로 응답했으므로 sourceCurrencyIfKnown은 'KRW'
        const processedHotels = hotels.map(hotel => processHotelData(hotel, liveExchangeRates, 'KRW'));

        return {
            statusCode: 200,
            headers: getCorsHeaders('POST'),
            body: JSON.stringify({
                result: processedHotels
            })
        };

    } catch (error) {
        console.error('[Lambda] Error:', error.message);
        if (error.response) {
            console.error('[Lambda] API Error Response:', {
                status: error.response.status,
                data: error.response.data
            });
        }

        return {
            statusCode: error.response?.status || 500,
            headers: getCorsHeaders('POST'),
            body: JSON.stringify({
                error: error.message || 'Internal server error',
                details: error.response?.data
            })
        };
    }
};
