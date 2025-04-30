const axios = require('axios');

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': '*',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const { cityCode, checkInDate, checkOutDate, adults } = JSON.parse(event.body);
    console.log('Request params:', { cityCode, checkInDate, checkOutDate, adults });

    const options = {
      method: 'GET',
      url: 'https://booking-com.p.rapidapi.com/v2/hotels/search',
      params: {
        order_by: 'popularity',
        adults_number: adults,
        checkin_date: checkInDate,
        checkout_date: checkOutDate,
        filter_by_currency: 'KRW',
        dest_id: cityCode,
        locale: 'ko',
        dest_type: 'city',
        room_number: '1',
        units: 'metric',
        include_adjacency: 'true'
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
      }
    };

    console.log('Calling Booking.com API...');
    const response = await axios.request(options);
    console.log('Booking.com API response status:', response.status);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: response.data.results || []
      })
    };
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to search hotels',
        message: error.message
      })
    };
  }
}; 