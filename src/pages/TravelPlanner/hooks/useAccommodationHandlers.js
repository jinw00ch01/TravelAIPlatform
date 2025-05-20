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
  const addAccommodationToSchedule = useCallback((hotelToAdd, getDayTitle, setTravelPlans, startDate, dayOrder) => {
    if (!hotelToAdd) {
      alert('호텔 정보가 없습니다.');
      return;
    }

    let checkInDate = hotelToAdd.checkIn instanceof Date ? hotelToAdd.checkIn : new Date(hotelToAdd.checkIn);
    let checkOutDate = hotelToAdd.checkOut instanceof Date ? hotelToAdd.checkOut : new Date(hotelToAdd.checkOut);

    console.log('[숙소추가] checkInDate:', checkInDate, 'checkOutDate:', checkOutDate);
    console.log('[숙소추가] startDate:', startDate, 'dayOrder:', dayOrder);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      alert('체크인 또는 체크아웃 날짜가 올바르지 않습니다.');
      return;
    }

    const baseStart = startDate instanceof Date ? startDate : new Date(startDate);
    const currentDate = new Date(checkInDate);
    while (currentDate <= checkOutDate) {
      const diff = Math.round((currentDate - baseStart) / (1000 * 60 * 60 * 24));
      const dayKey = dayOrder[diff] || (diff + 1).toString();

      let time = '숙박';
      if (currentDate.getTime() === checkInDate.getTime()) time = '체크인';
      else if (currentDate.getTime() === checkOutDate.getTime()) time = '체크아웃';

      const newSchedule = {
        id: `hotel-${hotelToAdd.hotel_id || hotelToAdd.id}-${dayKey}`,
        name: hotelToAdd.hotel_name || hotelToAdd.name,
        time,
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
        const currentSchedules = prevTravelPlans[dayKey]?.schedules || [];
        return {
          ...prevTravelPlans,
          [dayKey]: {
            ...(prevTravelPlans[dayKey] || { title: getDayTitle(dayKey), schedules: [] }),
            schedules: [...currentSchedules, newSchedule]
          }
        };
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    alert('숙소가 체크인부터 체크아웃까지의 일정에 추가되었습니다.');
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