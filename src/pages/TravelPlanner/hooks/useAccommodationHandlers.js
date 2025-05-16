import { useState, useCallback } from 'react';

const useAccommodationHandlers = () => {
  const [accommodationFormData, setAccommodationFormData] = useState({
    cityName: '',
    checkIn: new Date(),
    checkOut: new Date(new Date().setDate(new Date().getDate() + 1)),
    adults: '2',
    children: '0',
    roomConfig: [{ adults: 2, children: 0 }],
    latitude: null,
    longitude: null,
  });
  
  const [hotelSearchResults, setHotelSearchResults] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  
  // 호텔 검색 결과 처리 핸들러
  const handleHotelSearchResults = useCallback((results) => {
    setHotelSearchResults(results);
  }, []);

  // 호텔 선택 처리 핸들러
  const handleHotelSelect = useCallback((hotel) => {
    console.log('[AccommodationHandlers] Hotel selected for viewing details:', hotel);
    setSelectedHotel(hotel);
  }, []);

  // 숙소를 일정에 추가하는 함수
  const addAccommodationToSchedule = useCallback((hotelToAdd, dayKey, getDayTitle, setTravelPlans) => {
    if (!dayKey || !hotelToAdd) {
      alert('숙소를 추가할 날짜 또는 호텔 정보가 없습니다.');
      return;
    }
    
    const newSchedule = {
      id: `hotel-${hotelToAdd.hotel_id || hotelToAdd.id}-${Date.now()}`,
      name: hotelToAdd.hotel_name || hotelToAdd.name,
      time: '체크인', 
      address: hotelToAdd.address,
      category: '숙소',
      duration: '1박', 
      notes: hotelToAdd.price ? `가격: ${hotelToAdd.price}` : (hotelToAdd.composite_price_breakdown?.gross_amount_per_night?.value ? `1박 평균: ${Math.round(hotelToAdd.composite_price_breakdown.gross_amount_per_night.value).toLocaleString()} ${hotelToAdd.composite_price_breakdown.gross_amount_per_night.currency}` : ''),
      lat: hotelToAdd.latitude,
      lng: hotelToAdd.longitude,
      type: 'accommodation', 
      hotelDetails: { ...hotelToAdd }
    };

    setTravelPlans(prevTravelPlans => {
      const targetDayKey = dayKey.toString();
      const currentSchedules = prevTravelPlans[targetDayKey]?.schedules || [];
      return {
        ...prevTravelPlans,
        [targetDayKey]: {
          ...(prevTravelPlans[targetDayKey] || { title: getDayTitle(parseInt(targetDayKey)), schedules: [] }),
          schedules: [...currentSchedules, newSchedule]
        }
      };
    });
    
    alert('숙소가 선택한 날짜의 일정에 추가되었습니다.');
  }, []);

  return {
    accommodationFormData,
    setAccommodationFormData,
    hotelSearchResults,
    setHotelSearchResults,
    selectedHotel,
    setSelectedHotel,
    handleHotelSearchResults,
    handleHotelSelect,
    addAccommodationToSchedule
  };
};

export default useAccommodationHandlers; 