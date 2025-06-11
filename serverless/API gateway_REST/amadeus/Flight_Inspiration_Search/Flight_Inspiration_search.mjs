import axios from 'axios';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const {
      origin,
      departureDate,     // 예: "2024-07-01" 또는 "2024-07-01--2024-07-15"
      oneWay = false,
      duration,           // 예: "7" 또는 "3-10"
      nonStop,
      maxPrice,
      viewBy = 'DESTINATION'
    } = body;

    const API_KEY = process.env.AMADEUS_API_KEY;
    const API_SECRET = process.env.AMADEUS_API_SECRET;

    // 1. 인증 토큰 발급
    const tokenRes = await axios.post(
      'https://api.amadeus.com/v1/security/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: API_KEY,
        client_secret: API_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;

    // 2. Flight Inspiration Search API 호출
    const response = await axios.get(
      'https://api.amadeus.com/v1/shopping/flight-destinations',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          origin,
          departureDate,
          oneWay,
          duration,
          nonStop,
          maxPrice,
          viewBy
        }
      }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.response?.data || error.message })
    };
  }
};
