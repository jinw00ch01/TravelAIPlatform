import axios from 'axios';

const getCorsHeaders = (allowedMethods = 'OPTIONS,GET,POST') => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-RapidAPI-Key,X-RapidAPI-Host',
    'Access-Control-Allow-Methods': allowedMethods
});

// 환율 정보 (2024년 3월 기준)
const EXCHANGE_RATES = {
    KRW: 1,
    USD: 1350,    // 1 USD = 1,350 KRW
    JPY: 9,       // 1 JPY = 9 KRW
    EUR: 1450,    // 1 EUR = 1,450 KRW
    CNY: 185      // 1 CNY = 185 KRW
};

// 가격을 원화로 변환하는 함수
function convertToKRW(value, currency) {
    if (!value || !currency) return null;
    if (currency === 'KRW') return value;
    const rate = EXCHANGE_RATES[currency];
    if (!rate) return value;
    return Math.round(value * rate);
}

// 호텔 데이터 처리 함수
function processHotelData(hotel, currency = 'KRW') {
    let priceDisplay = '가격 정보 없음';
    let originalPrice = null;
    let priceValue = null;

    // 가격 정보 추출
    if (hotel.composite_price_breakdown?.gross_amount?.value) {
        priceValue = hotel.composite_price_breakdown.gross_amount.value;
        currency = hotel.composite_price_breakdown.gross_amount.currency;
    } else if (hotel.composite_price_breakdown?.all_inclusive_amount?.value) {
        priceValue = hotel.composite_price_breakdown.all_inclusive_amount.value;
        currency = hotel.composite_price_breakdown.all_inclusive_amount.currency;
    } else if (hotel.min_total_price) {
        priceValue = hotel.min_total_price;
    }

    // 원화로 변환
    if (priceValue !== null) {
        const priceInKRW = convertToKRW(priceValue, currency);
        priceDisplay = `KRW ${priceInKRW.toLocaleString()}`;
        originalPrice = `${priceValue.toLocaleString()} ${currency}`;
    }

    return {
        hotel_id: hotel.hotel_id,
        hotel_name: hotel.hotel_name_trans || hotel.hotel_name,
        address: hotel.address || '',
        city: hotel.city || '',
        main_photo_url: hotel.max_photo_url || hotel.main_photo_url,
        review_score: hotel.review_score || 0,
        review_score_word: hotel.review_score_word || '',
        price: priceDisplay,
        original_price: originalPrice,
        currency: currency,
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
async function getPreferredHotels(city, RAPIDAPI_KEY) {
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
            data: response.data
        });
        
        // 호텔 데이터 처리
        const processedHotels = response.data.result.map(hotel => 
            processHotelData(hotel, city.currency)
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

        // 호텔 객실 조회인 경우
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

            const hotelsData = await getPreferredHotels(city, RAPIDAPI_KEY);

            return {
                statusCode: 200,
                headers: getCorsHeaders('POST'),
                body: JSON.stringify({
                    result: hotelsData.result
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
            filter_by_currency: 'KRW',
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

        // 호텔 데이터 처리
        const processedHotels = hotels.map(hotel => processHotelData(hotel));

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
