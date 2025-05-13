export const searchHotels = async (params) => {
  try {
    console.log('[API] 숙소 검색 요청 (Lambda POST):', params);
    const response = await axios.post(
      `${LAMBDA_API_URL}/api/Booking-com/SearchHotelsByCoordinates`,
      params
    );
    console.log('[API] 숙소 검색 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error(' 숙소 검색 실패 (Lambda POST):', error.response?.data || error);
    throw error;
  }
}; 