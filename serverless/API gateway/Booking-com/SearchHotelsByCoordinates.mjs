import axios from 'axios';

const getCorsHeaders = (allowedMethods = 'OPTIONS,GET,POST') => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-RapidAPI-Key,X-RapidAPI-Host', // RapidAPI 헤더 허용
    'Access-Control-Allow-Methods': allowedMethods
});

export const handler = async (event) => {
    console.log('SearchHotelsByCoordinates Lambda event:', JSON.stringify(event, null, 2));

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: getCorsHeaders(), body: 'CORS preflight OK' };
    }

    try {
        const RAPIDAPI_KEY = process.env.BOOKING_RAPIDAPI_KEY; // Lambda 환경 변수에서 키 가져오기
        if (!RAPIDAPI_KEY) {
            console.error('Missing Booking.com RapidAPI Key');
            return { statusCode: 500, headers: getCorsHeaders('POST'), body: JSON.stringify({ error: 'Server configuration error' }) };
        }

        // POST 요청이므로 event.body에서 파라미터 추출
        let receivedParams = {};
        if (typeof event.body === 'string') {
            try {
                receivedParams = JSON.parse(event.body);
            } catch (e) {
                console.error('Failed to parse event.body:', e);
                return { statusCode: 400, headers: getCorsHeaders('POST'), body: JSON.stringify({ error: 'Invalid request body.' }) };
            }
        } else if (typeof event.body === 'object' && event.body !== null) {
            receivedParams = event.body; // 이미 객체인 경우 (예: Lambda 콘솔 테스트)
        } 
        
        console.log('Received body parameters:', receivedParams);

        const {
            checkin_date,
            checkout_date,
            adults_number,
            latitude,
            longitude,
            order_by = 'distance',
            page_number = '0',
            units = 'metric',
            room_number = '1',
            filter_by_currency = 'KRW',
            locale = 'ko',
            categories_filter_ids = 'class::0,class::1,class::2,class::3,class::4,class::5,class::6,class::7,class::8,class::9',
            include_adjacency = 'false',
            filter_by_distance, // 이 두 값은 조건부로 params에 추가
            distance_unit 
        } = receivedParams;

        if (!checkin_date || !checkout_date || !adults_number || !latitude || !longitude) {
            console.error('Missing required parameters for hotel search in body.');
            return {
                statusCode: 400,
                headers: getCorsHeaders('POST'),
                body: JSON.stringify({ error: 'Missing required parameters in request body.' })
            };
        }

        const bookingApiParams = {
            units,
            room_number,
            checkout_date,
            filter_by_currency,
            locale,
            checkin_date,
            adults_number,
            order_by,
            latitude,
            longitude,
            page_number,
            include_adjacency,
            categories_filter_ids,
        };
        
        if (filter_by_distance) {
            bookingApiParams.filter_by_distance = filter_by_distance;
            bookingApiParams.distance_unit = distance_unit || 'meters';
        } else {
            bookingApiParams.filter_by_distance = '5000';
            bookingApiParams.distance_unit = 'meters';
        }

        const searchOptions = {
            method: 'GET', // Booking.com API는 GET 유지
            url: 'https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates',
            params: bookingApiParams, // 구성된 파라미터 사용
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
            }
        };
        
        console.log('Calling Booking.com API with options:', JSON.stringify(searchOptions, null, 2));
        const response = await axios.request(searchOptions);
        console.log('Booking.com API Response Status:', response.status);
        console.log('Booking.com API Response Data (Full):', JSON.stringify(response.data, null, 2));

        return {
            statusCode: 200,
            headers: getCorsHeaders('POST'), // 응답 헤더에도 POST 명시
            body: JSON.stringify(response.data)
        };

    } catch (error) {
        console.error('Error in SearchHotelsByCoordinates Lambda:', error.response?.data || error.message, error.stack);
        const errorStatus = error.response?.status || 500;
        const errorMessage = error.response?.data?.message || error.message || 'Failed to search hotels.';
        return {
            statusCode: errorStatus,
            headers: getCorsHeaders('POST'),
            body: JSON.stringify({ error: errorMessage })
        };
    }
};
