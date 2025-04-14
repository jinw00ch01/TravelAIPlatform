import axios from 'axios';

class AmadeusApi {
  constructor() {
    this.apiKey = process.env.REACT_APP_AMADEUS_API_KEY;
    this.baseURL = process.env.REACT_APP_AMADEUS_API_BASE_URL;
    this.token = null;
    this.tokenExpiration = null;
  }

  async getAccessToken() {
    if (this.token && this.tokenExpiration > Date.now()) {
      return this.token;
    }

    try {
      const response = await axios.post(
        'https://test.api.amadeus.com/v1/security/oauth2/token',
        `grant_type=client_credentials&client_id=${this.apiKey}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.token = response.data.access_token;
      this.tokenExpiration = Date.now() + (response.data.expires_in * 1000);
      return this.token;
    } catch (error) {
      console.error('Failed to get Amadeus access token:', error);
      throw error;
    }
  }

  async searchHotels(cityCode, checkInDate, checkOutDate) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.get(`${this.baseURL}/reference-data/locations/hotels/by-city`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          cityCode,
          radius: 5,
          radiusUnit: 'KM',
          ratings: '3,4,5',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to search hotels:', error);
      throw error;
    }
  }

  async searchFlights(originCode, destinationCode, departureDate, adults = 1) {
    const token = await this.getAccessToken();
    try {
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
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to search flights:', error);
      throw error;
    }
  }

  async searchCities(keyword) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.get(`${this.baseURL}/reference-data/locations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          keyword,
          subType: 'CITY',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to search cities:', error);
      throw error;
    }
  }
}

export default new AmadeusApi(); 