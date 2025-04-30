const axios = require('axios');

let cachedToken = null;
let tokenExpiry = null;

const getAmadeusToken = async () => {
  // 토큰이 캐시되어 있고 만료되지 않았다면 캐시된 토큰 반환
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token', 
      `grant_type=client_credentials&client_id=${process.env.AMADEUS_API_KEY}&client_secret=${process.env.AMADEUS_API_SECRET}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // 토큰과 만료 시간 캐시
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);

    return cachedToken;
  } catch (error) {
    console.error('Error getting Amadeus token:', error);
    throw new Error('Failed to get Amadeus token');
  }
};

module.exports = {
  getAmadeusToken
}; 