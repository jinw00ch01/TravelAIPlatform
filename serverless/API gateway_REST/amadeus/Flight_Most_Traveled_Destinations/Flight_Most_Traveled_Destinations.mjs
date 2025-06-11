// mostTraveledDestinations.mjs
import axios from 'axios';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;

  // ✅ OPTIONS 요청 (CORS Preflight 대응)
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { originCityCode, period, max = 10, sort = 'analytics.travelers.score' } = body;

    const API_KEY = process.env.AMADEUS_API_KEY;
    const API_SECRET = process.env.AMADEUS_API_SECRET;

    // 1. Amadeus 인증 토큰 요청
    const tokenResponse = await axios.post(
      'https://api.amadeus.com/v1/security/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: API_KEY,
        client_secret: API_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2. Most Traveled Destinations API 호출
    const response = await axios.get(
      'https://api.amadeus.com/v1/travel/analytics/air-traffic/traveled',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          originCityCode,
          period,
          max,
          sort
        }
      }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error("Error:", error.response?.data || error.message);

    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.response?.data || error.message })
    };
  }
};
