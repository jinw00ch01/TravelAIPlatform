import axios from 'axios';

class AmadeusApi {
  constructor() {
    this.apiKey = process.env.REACT_APP_AMADEUS_API_KEY;
    this.apiSecret = process.env.REACT_APP_AMADEUS_API_SECRET;
    this.baseURL = `https://${process.env.REACT_APP_AMADEUS_API_BASE_URL}`;
    this.token = null;
    this.tokenExpiration = null;
  }

  async getAccessToken() {
    if (this.token && this.tokenExpiration > Date.now()) {
      return this.token;
    }

    try {
      console.log('Requesting access token...');
      const response = await axios.post(
        'https://test.api.amadeus.com/v1/security/oauth2/token',
        `grant_type=client_credentials&client_id=${this.apiKey}&client_secret=${this.apiSecret}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      console.log('Access token response:', response.data);
      if (!response.data.access_token) {
        throw new Error('Access token not received');
      }

      this.token = response.data.access_token;
      this.tokenExpiration = Date.now() + (response.data.expires_in * 1000);
      return this.token;
    } catch (error) {
      console.error('Failed to get Amadeus access token:', error.response?.data || error.message);
      throw new Error('인증 토큰을 가져오는데 실패했습니다. API 키를 확인해주세요.');
    }
  }

  async searchHotels(cityCode, checkInDate, checkOutDate) {
    const token = await this.getAccessToken();
    try {
      console.log('Searching hotels with params:', { cityCode, checkInDate, checkOutDate });
      const response = await axios.get(`${this.baseURL}/shopping/hotel-offers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          cityCode,
          checkInDate,
          checkOutDate,
          roomQuantity: 1,
          adults: 2,
          radius: 5,
          radiusUnit: 'KM',
          paymentPolicy: 'NONE',
          includeClosed: false,
          bestRateOnly: true,
          view: 'FULL',
          sort: 'PRICE'
        },
      });
      console.log('Hotel search response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to search hotels:', error.response?.data || error.message);
      throw new Error('호텔 검색에 실패했습니다. 다시 시도해주세요.');
    }
  }

  async searchFlights(originCode, destinationCode, departureDate, adults = 1) {
    const token = await this.getAccessToken();
    try {
      console.log('Searching flights with params:', { originCode, destinationCode, departureDate, adults });
      const response = await axios.get(`${this.baseURL}/shopping/flight-offers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          originLocationCode: originCode,
          destinationLocationCode: destinationCode,
          departureDate,
          adults,
          max: 10,
          currencyCode: 'KRW',
          nonStop: false
        },
      });
      console.log('Flight search response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to search flights:', error.response?.data || error.message);
      throw new Error('항공편 검색에 실패했습니다. 다시 시도해주세요.');
    }
  }

  async searchCities(keyword) {
    const token = await this.getAccessToken();
    try {
      console.log('Searching cities with keyword:', keyword);
      const response = await axios.get(`${this.baseURL}/reference-data/locations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          keyword,
          subType: 'CITY,AIRPORT',
          'page[limit]': 10,
          'page[offset]': 0,
          sort: 'analytics.travelers.score',
          view: 'FULL'
        },
      });
      console.log('City search response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to search cities:', error.response?.data || error.message);
      throw new Error('도시 검색에 실패했습니다. 다시 시도해주세요.');
    }
  }
}

export default new AmadeusApi(); 