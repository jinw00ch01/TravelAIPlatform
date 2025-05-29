import { useState, useCallback } from 'react';
import { format as formatDateFns } from 'date-fns';
import { sortSchedulesByTime } from '../utils/scheduleUtils';

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
  const addAccommodationToSchedule = useCallback((hotelToAdd, getDayTitle, setTravelPlans, startDate, dayOrder, setLoadedAccommodationInfo, isAutoConversion = false) => {
    if (!hotelToAdd) {
      console.error('[useAccommodationHandlers] 호텔 정보가 없습니다.');
      if (!isAutoConversion) alert('호텔 정보가 없습니다.');
      return false;
    }

    // 날짜 파싱 함수 (로컬 시간대 기준)
    const parseDate = (dateInput) => {
      if (dateInput instanceof Date) return dateInput;
      
      // YYYY-MM-DD 형식의 문자열인 경우 로컬 시간대로 파싱
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [year, month, day] = dateInput.split('-').map(Number);
        return new Date(year, month - 1, day); // 월은 0부터 시작
      }
      
      return new Date(dateInput);
    };

    let checkInDate = parseDate(hotelToAdd.checkIn);
    let checkOutDate = parseDate(hotelToAdd.checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      console.error('[useAccommodationHandlers] 잘못된 날짜 형식');
      if (!isAutoConversion) alert('체크인 또는 체크아웃 날짜가 올바르지 않습니다.');
      return false;
    }

    // 날짜를 0시로 맞추는 함수 (로컬 시간대 기준)
    function toZeroTime(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    // 날짜를 YYYY-MM-DD 형식으로 변환 (로컬 시간대 기준)
    function formatDateLocal(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const baseStart = toZeroTime(startDate);
    const checkInDateZero = toZeroTime(checkInDate);
    const checkOutDateZero = toZeroTime(checkOutDate);

    // 1. 모든 날짜에 dayKey가 있는지 먼저 검사 (자동 변환이 아닌 경우에만)
    if (!isAutoConversion) {
      let allDaysExist = true;
      let missingDay = null;
      let checkDate = new Date(checkInDateZero);
      while (checkDate < checkOutDateZero) {
        const diff = Math.round((checkDate - baseStart) / (1000 * 60 * 60 * 24));
        const dayKey = dayOrder[diff];
        if (!dayKey) {
          allDaysExist = false;
          missingDay = formatDateLocal(checkDate);
          break;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
      const diffOut = Math.round((checkOutDateZero - baseStart) / (1000 * 60 * 60 * 24));
      const dayKeyOut = dayOrder[diffOut];
      if (!dayKeyOut && allDaysExist) {
        allDaysExist = false;
        missingDay = formatDateLocal(checkOutDateZero);
      }
      if (!allDaysExist) {
        alert(`${missingDay} 날짜에 일정을 먼저 추가하세요.`);
        return false;
      }
    }

    // hotelToAdd에 roomList가 없으면 빈 배열로 보장
    const hotelWithRoomList = {
      ...hotelToAdd,
      roomList: hotelToAdd.roomList || [],
      // 호텔 정보 정규화
      hotel_id: hotelToAdd.hotel?.hotel_id || hotelToAdd.hotel_id || hotelToAdd.id,
      hotel_name: hotelToAdd.hotel?.hotel_name || hotelToAdd.hotel_name || hotelToAdd.name,
      hotel_name_trans: hotelToAdd.hotel?.hotel_name_trans || hotelToAdd.hotel_name_trans,
      address: hotelToAdd.hotel?.address || hotelToAdd.address,
      checkIn: formatDateLocal(checkInDateZero),
      checkOut: formatDateLocal(checkOutDateZero),
      // 위도/경도 정보 추가
      lat: hotelToAdd.hotel?.latitude || hotelToAdd.lat || hotelToAdd.latitude || null,
      lng: hotelToAdd.hotel?.longitude || hotelToAdd.lng || hotelToAdd.longitude || null,
      latitude: hotelToAdd.hotel?.latitude || hotelToAdd.lat || hotelToAdd.latitude || null,
      longitude: hotelToAdd.hotel?.longitude || hotelToAdd.lng || hotelToAdd.longitude || null
    };

    // 가격 정보를 여러 필드에서 추출하는 함수
    const extractPrice = (hotelData) => {
      // 다양한 가격 필드에서 가격 추출 시도
      const priceFields = [
        hotelData.price,
        hotelData.hotel?.price,
        hotelData.room?.price,
        hotelData.hotelDetails?.hotel?.price,
        hotelData.composite_price_breakdown?.gross_amount?.value,
        hotelData.hotel?.composite_price_breakdown?.gross_amount?.value,
        hotelData.cost
      ];

      for (const priceField of priceFields) {
        if (priceField !== null && priceField !== undefined && priceField !== '') {
          return priceField;
        }
      }
      return null;
    };

    const extractedPrice = extractPrice(hotelToAdd);
    console.log(`[useAccommodationHandlers] 가격 추출 결과:`, {
      hotelName: hotelWithRoomList.hotel_name,
      extractedPrice: extractedPrice,
      originalPrice: hotelToAdd.price,
      hotelPrice: hotelToAdd.hotel?.price,
      roomPrice: hotelToAdd.room?.price
    });

    console.log(`[useAccommodationHandlers] 숙소 추가 ${isAutoConversion ? '(자동 변환)' : '(수동 추가)'}:`, hotelWithRoomList.hotel_name);

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
      
      // dayKey가 없으면 스킵 (자동 변환의 경우)
      if (!dayKey) {
        console.warn(`[useAccommodationHandlers] Day key not found for date: ${formatDateLocal(currentDate)}`);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      let time = '숙박';
      if (currentDate.getTime() === checkInDateZero.getTime()) time = '체크인';
      
      // 숙박편 일정 (주황색 카드)
      const newSchedule = {
        id: `hotel-${hotelWithRoomList.hotel_id}-${dayKey}`,
        name: hotelWithRoomList.hotel_name_trans || hotelWithRoomList.hotel_name,
        time,
        address: hotelWithRoomList.address,
        category: '숙소',
        duration: '1박',
        notes: extractedPrice ? `가격: ${extractedPrice}` : (hotelWithRoomList.composite_price_breakdown?.gross_amount ? `가격: ${hotelWithRoomList.composite_price_breakdown.gross_amount} ${hotelWithRoomList.composite_price_breakdown.currency}` : ''),
        type: 'accommodation',
        hotelDetails: hotelWithRoomList,
        lat: hotelWithRoomList.lat || hotelWithRoomList.latitude,
        lng: hotelWithRoomList.lng || hotelWithRoomList.longitude
      };
      
      // 일반 일정 추가 (자동/수동 추가 모두, 중복 방지)
      let generalSchedule = null;
      generalSchedule = {
        id: `hotel-general-${hotelWithRoomList.hotel_id}-${dayKey}`,
        name: hotelWithRoomList.hotel_name_trans || hotelWithRoomList.hotel_name,
        time: time === '체크인' ? '14:00' : '숙박',
        address: hotelWithRoomList.address,
        category: '숙소',
        duration: time === '체크인' ? '체크인' : '숙박',
        notes: extractedPrice ? `가격: ${extractedPrice}` : (hotelWithRoomList.composite_price_breakdown?.gross_amount ? `가격: ${hotelWithRoomList.composite_price_breakdown.gross_amount} ${hotelWithRoomList.composite_price_breakdown.currency}` : ''),
        lat: hotelWithRoomList.lat || hotelWithRoomList.latitude,
        lng: hotelWithRoomList.lng || hotelWithRoomList.longitude
      };
      
      setTravelPlans(prevTravelPlans => {
        const updatedPlans = { ...prevTravelPlans };
        if (!updatedPlans[dayKey]) {
          updatedPlans[dayKey] = { title: getDayTitle(parseInt(dayKey)), schedules: [] };
        }
        
        // 숙박편 일정 추가 (중복 방지)
        if (!updatedPlans[dayKey].schedules.some(s => s.id === newSchedule.id)) {
          updatedPlans[dayKey].schedules.push(newSchedule);
        }
        
        // 일반 일정 추가 (자동/수동 추가 모두, 중복 방지)
        if (generalSchedule && !updatedPlans[dayKey].schedules.some(s => s.id === generalSchedule.id)) {
          updatedPlans[dayKey].schedules.push(generalSchedule);
        }
        
        // ✅ 숙소 추가 후 시간순으로 정렬
        updatedPlans[dayKey].schedules = sortSchedulesByTime(updatedPlans[dayKey].schedules);
        
        return updatedPlans;
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 체크아웃날 블록 추가
    const diffOut = Math.round((checkOutDateZero - baseStart) / (1000 * 60 * 60 * 24));
    const dayKeyOut = dayOrder[diffOut];
    
    console.log(`[useAccommodationHandlers] 체크아웃날 계산:`, {
      checkOutDateZero: checkOutDateZero.toISOString().split('T')[0],
      baseStart: baseStart.toISOString().split('T')[0],
      diffOut: diffOut,
      dayKeyOut: dayKeyOut,
      dayOrderLength: dayOrder.length,
      dayOrder: dayOrder,
      isAutoConversion: isAutoConversion
    });
    
    if (dayKeyOut) {
      console.log(`[useAccommodationHandlers] 체크아웃 일정 추가 시작 (Day ${dayKeyOut})`);
      // 숙박편 일정 (주황색 카드)
      const outSchedule = {
        id: `hotel-${hotelWithRoomList.hotel_id}-${dayKeyOut}-out`,
        name: hotelWithRoomList.hotel_name_trans || hotelWithRoomList.hotel_name,
        time: '체크아웃',
        address: hotelWithRoomList.address,
        category: '숙소',
        duration: '',
        notes: extractedPrice ? `가격: ${extractedPrice}` : (hotelWithRoomList.composite_price_breakdown?.gross_amount ? `가격: ${hotelWithRoomList.composite_price_breakdown.gross_amount} ${hotelWithRoomList.composite_price_breakdown.currency}` : ''),
        type: 'accommodation',
        hotelDetails: hotelWithRoomList,
        lat: hotelWithRoomList.lat || hotelWithRoomList.latitude,
        lng: hotelWithRoomList.lng || hotelWithRoomList.longitude
      };
      
      // 일반 일정 추가 (자동/수동 추가 모두, 중복 방지)
      let generalOutSchedule = null;
      generalOutSchedule = {
        id: `hotel-general-${hotelWithRoomList.hotel_id}-${dayKeyOut}-out`,
        name: hotelWithRoomList.hotel_name_trans || hotelWithRoomList.hotel_name,
        time: '11:00',
        address: hotelWithRoomList.address,
        category: '숙소',
        duration: '체크아웃',
        notes: extractedPrice ? `가격: ${extractedPrice}` : (hotelWithRoomList.composite_price_breakdown?.gross_amount ? `가격: ${hotelWithRoomList.composite_price_breakdown.gross_amount} ${hotelWithRoomList.composite_price_breakdown.currency}` : ''),
        lat: hotelWithRoomList.lat || hotelWithRoomList.latitude,
        lng: hotelWithRoomList.lng || hotelWithRoomList.longitude
      };

      setTravelPlans(prevTravelPlans => {
        const updatedPlans = { ...prevTravelPlans };
        if (!updatedPlans[dayKeyOut]) {
          updatedPlans[dayKeyOut] = { title: getDayTitle(parseInt(dayKeyOut)), schedules: [] };
        }
        
        // 숙박편 일정 추가 (중복 방지)
        if (!updatedPlans[dayKeyOut].schedules.some(s => s.id === outSchedule.id)) {
          updatedPlans[dayKeyOut].schedules.push(outSchedule);
          console.log(`[useAccommodationHandlers] 체크아웃 숙박편 일정 추가 완료 (Day ${dayKeyOut})`);
        } else {
          console.log(`[useAccommodationHandlers] 체크아웃 숙박편 일정 중복으로 스킵 (Day ${dayKeyOut})`);
        }
        
        // 일반 일정 추가 (자동/수동 추가 모두, 중복 방지)
        if (generalOutSchedule && !updatedPlans[dayKeyOut].schedules.some(s => s.id === generalOutSchedule.id)) {
          updatedPlans[dayKeyOut].schedules.push(generalOutSchedule);
          console.log(`[useAccommodationHandlers] 체크아웃 일반 일정 추가 완료 (Day ${dayKeyOut})`);
        } else {
          console.log(`[useAccommodationHandlers] 체크아웃 일반 일정 중복으로 스킵 (Day ${dayKeyOut})`);
        }
        
        // ✅ 체크아웃 숙소 추가 후 시간순으로 정렬
        updatedPlans[dayKeyOut].schedules = sortSchedulesByTime(updatedPlans[dayKeyOut].schedules);
        
        return updatedPlans;
      });
    } else {
      console.warn(`[useAccommodationHandlers] 체크아웃날에 해당하는 dayKey를 찾을 수 없음:`, {
        diffOut: diffOut,
        dayOrderLength: dayOrder.length,
        checkOutDate: formatDateLocal(checkOutDateZero),
        travelStartDate: formatDateLocal(baseStart),
        isAutoConversion: isAutoConversion
      });
      
      // 자동 변환이 아닌 경우, 즉 수동으로 숙소를 추가하는 경우에만 경고
      if (!isAutoConversion) {
        console.error(`[useAccommodationHandlers] 체크아웃 날짜(${formatDateLocal(checkOutDateZero)})가 여행 일정 범위를 벗어났습니다.`);
      }
    }
    return true;
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