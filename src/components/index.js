// (roomlist 관련 기능이 현재 코드에 포함되어 있지 않습니다. 만약 roomlist와 관련된 함수, 변수, API 파라미터, 또는 UI 요소가 있다면 모두 삭제해야 합니다.)

import axios from 'axios';

const getCorsHeaders = (allowedMethods = 'OPTIONS,GET,POST') => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-RapidAPI-Key,X-RapidAPI-Host',
    'Access-Control-Allow-Methods': allowedMethods
});

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

        // 호텔 검색인지 객실 조회인지 확인
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

        return {
            statusCode: 200,
            headers: getCorsHeaders('POST'),
            body: JSON.stringify({
                result: hotels
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
