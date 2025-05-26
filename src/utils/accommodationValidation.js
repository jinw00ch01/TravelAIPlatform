/**
 * 숙박편 날짜 유효성 검사 유틸리티
 */

/**
 * 날짜 문자열을 Date 객체로 변환 (로컬 시간대 기준)
 * @param {string|Date} dateInput - 날짜 입력
 * @returns {Date} Date 객체
 */
export const parseDate = (dateInput) => {
  if (dateInput instanceof Date) return dateInput;
  
  // YYYY-MM-DD 형식의 문자열인 경우 로컬 시간대로 파싱
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day); // 월은 0부터 시작
  }
  
  return new Date(dateInput);
};

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환 (로컬 시간대 기준)
 * @param {string|Date} dateInput - 날짜 입력
 * @returns {string} YYYY-MM-DD 형식 문자열
 */
export const formatDateString = (dateInput) => {
  const date = parseDate(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 기존 숙박편 목록에서 날짜 충돌 검사
 * 
 * 연속 숙박 허용 예시:
 * - 기존: A숙소 (7/21~7/24), 새로운: B숙소 (7/24~7/26) ✅ 허용 (연속 숙박)
 * - 기존: A숙소 (7/24~7/26), 새로운: B숙소 (7/21~7/24) ✅ 허용 (연속 숙박)
 * 
 * 충돌 케이스:
 * - 기존: A숙소 (7/21~7/24), 새로운: B숙소 (7/22~7/26) ❌ 충돌 (겹침)
 * - 기존: A숙소 (7/21~7/24), 새로운: B숙소 (7/20~7/23) ❌ 충돌 (겹침)
 * 
 * @param {Object} newAccommodation - 새로 추가할 숙박편
 * @param {Array} existingAccommodations - 기존 숙박편 목록
 * @returns {Object} { isValid: boolean, conflictingAccommodation: Object|null, message: string }
 */
export const checkAccommodationConflicts = (newAccommodation, existingAccommodations) => {
  const newCheckIn = parseDate(newAccommodation.checkIn);
  const newCheckOut = parseDate(newAccommodation.checkOut);
  
  console.log('[숙박편 충돌 검사] 새 숙박편:', {
    checkIn: formatDateString(newCheckIn),
    checkOut: formatDateString(newCheckOut),
    hotel: newAccommodation.hotel?.hotel_name || newAccommodation.hotel_name
  });

  for (const existing of existingAccommodations) {
    const existingCheckIn = parseDate(existing.checkIn);
    const existingCheckOut = parseDate(existing.checkOut);
    
    console.log('[숙박편 충돌 검사] 기존 숙박편:', {
      checkIn: formatDateString(existingCheckIn),
      checkOut: formatDateString(existingCheckOut),
      hotel: existing.hotel?.hotel_name || existing.hotel_name
    });

    // 날짜 겹침 검사 (연속 숙박 허용)
    // 새 숙박편의 체크인이 기존 숙박편의 체크아웃과 같은 날은 허용 (연속 숙박)
    // 새 숙박편의 체크아웃이 기존 숙박편의 체크인과 같은 날은 허용 (연속 숙박)
    
    // 연속 숙박 케이스 확인
    const isConsecutiveCheckout = newCheckIn.getTime() === existingCheckOut.getTime(); // 새 체크인 = 기존 체크아웃
    const isConsecutiveCheckin = newCheckOut.getTime() === existingCheckIn.getTime();  // 새 체크아웃 = 기존 체크인
    
    console.log('[숙박편 충돌 검사] 연속 숙박 확인:', {
      isConsecutiveCheckout,
      isConsecutiveCheckin,
      newCheckIn: formatDateString(newCheckIn),
      existingCheckOut: formatDateString(existingCheckOut),
      newCheckOut: formatDateString(newCheckOut),
      existingCheckIn: formatDateString(existingCheckIn)
    });
    
    // 연속 숙박인 경우 충돌이 아님
    if (isConsecutiveCheckout || isConsecutiveCheckin) {
      console.log('[숙박편 충돌 검사] 연속 숙박으로 허용');
      continue; // 다음 기존 숙박편 검사
    }
    
    // 실제 겹침 검사 (연속 숙박이 아닌 경우만)
    const hasConflict = (
      newCheckIn.getTime() < existingCheckOut.getTime() && 
      newCheckOut.getTime() > existingCheckIn.getTime()
    );

    if (hasConflict) {
      const existingHotelName = existing.hotel?.hotel_name_trans || 
                               existing.hotel?.hotel_name || 
                               existing.hotel_name_trans || 
                               existing.hotel_name || 
                               '기존 숙소';
      
      return {
        isValid: false,
        conflictingAccommodation: existing,
        message: `선택한 날짜가 기존 숙박편과 겹칩니다.\n기존 숙박편: ${existingHotelName}\n(${formatDateString(existingCheckIn)} ~ ${formatDateString(existingCheckOut)})`
      };
    }
  }

  // 연속 숙박이 있는지 확인하여 적절한 메시지 반환
  let hasConsecutiveStay = false;
  for (const existing of existingAccommodations) {
    const existingCheckIn = parseDate(existing.checkIn);
    const existingCheckOut = parseDate(existing.checkOut);
    
    const isConsecutiveCheckout = newCheckIn.getTime() === existingCheckOut.getTime();
    const isConsecutiveCheckin = newCheckOut.getTime() === existingCheckIn.getTime();
    
    if (isConsecutiveCheckout || isConsecutiveCheckin) {
      hasConsecutiveStay = true;
      break;
    }
  }

  return {
    isValid: true,
    conflictingAccommodation: null,
    message: hasConsecutiveStay ? '연속 숙박으로 추가됩니다.' : '날짜 충돌이 없습니다.'
  };
};

/**
 * 여행 기간 내 숙박편 날짜 검사
 * @param {Object} accommodation - 숙박편 정보
 * @param {string|Date} travelStartDate - 여행 시작일
 * @param {Array} dayOrder - 일정 순서 배열
 * @returns {Object} { isValid: boolean, message: string }
 */
export const isWithinTravelPeriod = (accommodation, travelStartDate, dayOrder) => {
  const checkIn = parseDate(accommodation.checkIn);
  const checkOut = parseDate(accommodation.checkOut);
  const startDate = parseDate(travelStartDate);
  
  // 여행 마지막일 계산 (시작일 + 일정 일수 - 1)
  const travelEndDate = new Date(startDate);
  travelEndDate.setDate(startDate.getDate() + (dayOrder.length - 1));
  
  console.log('[여행 기간 검사]', {
    checkIn: formatDateString(checkIn),
    checkOut: formatDateString(checkOut),
    travelStart: formatDateString(startDate),
    travelEnd: formatDateString(travelEndDate),
    dayOrderLength: dayOrder.length
  });

  // 체크인이 여행 시작일보다 빠른 경우
  if (checkIn.getTime() < startDate.getTime()) {
    return {
      isValid: false,
      message: `체크인 날짜가 여행 시작일(${formatDateString(startDate)})보다 빠릅니다.`
    };
  }

  // 체크아웃이 여행 마지막일보다 늦은 경우
  if (checkOut.getTime() > travelEndDate.getTime()) {
    return {
      isValid: false,
      message: `체크아웃 날짜가 여행 마지막일(${formatDateString(travelEndDate)})보다 늦습니다.`
    };
  }

  return {
    isValid: true,
    message: '여행 기간 내 유효한 날짜입니다.'
  };
};

/**
 * 숙박편 추가 전 종합 유효성 검사
 * @param {Object} newAccommodation - 새로 추가할 숙박편
 * @param {Array} existingAccommodations - 기존 숙박편 목록
 * @param {string|Date} travelStartDate - 여행 시작일
 * @param {Array} dayOrder - 일정 순서 배열
 * @returns {Object} { isValid: boolean, message: string, details: Object }
 */
export const validateAccommodationAddition = (newAccommodation, existingAccommodations, travelStartDate, dayOrder) => {
  console.log('[숙박편 종합 유효성 검사] 시작');
  
  // 1. 기본 날짜 유효성 검사
  const checkIn = parseDate(newAccommodation.checkIn);
  const checkOut = parseDate(newAccommodation.checkOut);
  
  if (checkIn.getTime() >= checkOut.getTime()) {
    return {
      isValid: false,
      message: '체크아웃 날짜는 체크인 날짜보다 늦어야 합니다.',
      details: { type: 'INVALID_DATE_RANGE' }
    };
  }

  // 2. 여행 기간 내 검사
  const travelPeriodCheck = isWithinTravelPeriod(newAccommodation, travelStartDate, dayOrder);
  if (!travelPeriodCheck.isValid) {
    return {
      isValid: false,
      message: travelPeriodCheck.message,
      details: { type: 'OUTSIDE_TRAVEL_PERIOD' }
    };
  }

  // 3. 기존 숙박편과의 충돌 검사
  const conflictCheck = checkAccommodationConflicts(newAccommodation, existingAccommodations);
  if (!conflictCheck.isValid) {
    return {
      isValid: false,
      message: conflictCheck.message,
      details: { 
        type: 'DATE_CONFLICT',
        conflictingAccommodation: conflictCheck.conflictingAccommodation
      }
    };
  }

  console.log('[숙박편 종합 유효성 검사] 통과');
  return {
    isValid: true,
    message: '숙박편 추가가 가능합니다.',
    details: { type: 'VALID' }
  };
};

/**
 * 기존 숙박편 목록을 travelPlans에서 추출
 * @param {Object} travelPlans - 여행 계획 객체
 * @param {Array} dayOrder - 일정 순서 배열
 * @returns {Array} 기존 숙박편 목록
 */
export const extractExistingAccommodations = (travelPlans, dayOrder) => {
  const accommodations = [];
  
  dayOrder.forEach(dayKey => {
    const dayPlan = travelPlans[dayKey];
    if (dayPlan?.schedules) {
      dayPlan.schedules.forEach(schedule => {
        if (schedule.type === 'accommodation' && schedule.hotelDetails) {
          accommodations.push({
            checkIn: schedule.hotelDetails.checkIn,
            checkOut: schedule.hotelDetails.checkOut,
            hotel: schedule.hotelDetails.hotel,
            hotel_name: schedule.hotelDetails.hotel?.hotel_name,
            hotel_name_trans: schedule.hotelDetails.hotel?.hotel_name_trans
          });
        }
      });
    }
  });
  
  console.log('[기존 숙박편 추출] 총', accommodations.length, '개 발견');
  return accommodations;
}; 