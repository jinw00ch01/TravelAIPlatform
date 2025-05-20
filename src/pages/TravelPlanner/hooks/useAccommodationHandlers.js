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
  const handleHotelSelect = useCallback((hotel, room) => {
    setSelectedHotel({
      ...hotel,
      room: room || null,
      roomList: hotel.roomList || []
    });
  }, []);

  // 숙소를 일정에 추가하는 함수
  const addAccommodationToSchedule = useCallback((hotelToAdd, getDayTitle, setTravelPlans, startDate, dayOrder, setLoadedAccommodationInfo) => {
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

    // 날짜를 0시로 맞추는 함수
    function toZeroTime(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    const baseStart = toZeroTime(startDate);
    const checkInDateZero = toZeroTime(checkInDate);
    const checkOutDateZero = toZeroTime(checkOutDate);

    // 1. 모든 날짜에 dayKey가 있는지 먼저 검사
    let allDaysExist = true;
    let missingDay = null;
    let checkDate = new Date(checkInDateZero);
    while (checkDate < checkOutDateZero) {
      const diff = Math.round((checkDate - baseStart) / (1000 * 60 * 60 * 24));
      const dayKey = dayOrder[diff];
      if (!dayKey) {
        allDaysExist = false;
        missingDay = checkDate.toISOString().split('T')[0];
        break;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
    const diffOut = Math.round((checkOutDateZero - baseStart) / (1000 * 60 * 60 * 24));
    const dayKeyOut = dayOrder[diffOut];
    if (!dayKeyOut && allDaysExist) {
      allDaysExist = false;
      missingDay = checkOutDateZero.toISOString().split('T')[0];
    }
    if (!allDaysExist) {
      alert(`${missingDay} 날짜에 일정을 먼저 추가하세요.`);
      return;
    }

    // hotelToAdd에 roomList가 없으면 빈 배열로 보장
    const hotelWithRoomList = {
      ...hotelToAdd,
      roomList: hotelToAdd.roomList || []
    };

    // loadedAccommodationInfo 업데이트
    setLoadedAccommodationInfo({
      hotel: hotelWithRoomList,
      checkIn: checkInDateZero,
      checkOut: checkOutDateZero,
      room: hotelWithRoomList.room || null
    });

    // 2. 실제로 일정 추가 로직 실행 (이제는 모든 날짜가 보장됨)
    let currentDate = new Date(checkInDateZero);
    while (currentDate < checkOutDateZero) { // 체크아웃 전날까지만!
      const diff = Math.round((currentDate - baseStart) / (1000 * 60 * 60 * 24));
      const dayKey = dayOrder[diff];
      let time = '숙박';
      if (currentDate.getTime() === checkInDateZero.getTime()) time = '체크인';
      const newSchedule = {
        id: `hotel-${hotelWithRoomList.hotel_id || hotelWithRoomList.id}-${dayKey}`,
        name: hotelWithRoomList.hotel_name || hotelWithRoomList.name,
        time,
        address: hotelWithRoomList.address,
        category: '숙소',
        duration: '1박',
        notes: hotelWithRoomList.price ? `가격: ${hotelWithRoomList.price}` : (hotelWithRoomList.composite_price_breakdown?.gross_amount ? `가격: ${hotelWithRoomList.composite_price_breakdown.gross_amount} ${hotelWithRoomList.composite_price_breakdown.currency}` : ''),
        type: 'accommodation',
        hotelDetails: hotelWithRoomList
      };
      setTravelPlans(prevTravelPlans => {
        const updatedPlans = { ...prevTravelPlans };
        if (!updatedPlans[dayKey]) {
          updatedPlans[dayKey] = { title: getDayTitle(parseInt(dayKey)), schedules: [] };
        }
        if (!updatedPlans[dayKey].schedules.some(s => s.id === newSchedule.id)) {
          updatedPlans[dayKey].schedules.push(newSchedule);
        }
        return updatedPlans;
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    // 체크아웃날 블록 추가
    if (dayKeyOut) {
      const outSchedule = {
        id: `hotel-${hotelWithRoomList.hotel_id || hotelWithRoomList.id}-${dayKeyOut}-out`,
        name: hotelWithRoomList.hotel_name || hotelWithRoomList.name,
        time: '체크아웃',
        address: hotelWithRoomList.address,
        category: '숙소',
        duration: '',
        notes: hotelWithRoomList.price ? `가격: ${hotelWithRoomList.price}` : (hotelWithRoomList.composite_price_breakdown?.gross_amount ? `가격: ${hotelWithRoomList.composite_price_breakdown.gross_amount} ${hotelWithRoomList.composite_price_breakdown.currency}` : ''),
        type: 'accommodation',
        hotelDetails: hotelWithRoomList
      };
      setTravelPlans(prevTravelPlans => {
        const updatedPlans = { ...prevTravelPlans };
        if (!updatedPlans[dayKeyOut]) {
          updatedPlans[dayKeyOut] = { title: getDayTitle(parseInt(dayKeyOut)), schedules: [] };
        }
        if (!updatedPlans[dayKeyOut].schedules.some(s => s.id === outSchedule.id)) {
          updatedPlans[dayKeyOut].schedules.push(outSchedule);
        }
        return updatedPlans;
      });
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