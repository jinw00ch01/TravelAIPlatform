import { useCallback, useState } from 'react';
import { format as formatDateFns } from 'date-fns';
import { travelApi } from '../../../services/api';

const usePlannerActions = ({
  travelPlans, setTravelPlans,
  dayOrder, setDayOrder,
  selectedDay, setSelectedDay,
  startDate, setStartDate,
  planId, setPlanId
}) => {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [planTitleForSave, setPlanTitleForSave] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [editSchedule, setEditSchedule] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // 저장 전 검증 함수
  const validatePlanBeforeSave = useCallback(() => {
    const dayKeys = Object.keys(travelPlans).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (dayKeys.length === 0) {
      return { isValid: false, message: '최소 1일 이상의 여행 계획이 필요합니다.' };
    }

    // 1. 숙박편 커버리지 확인 - 모든 날짜가 숙박편으로 커버되는지 확인
    const accommodationCoverage = new Set(); // 숙박편이 커버하는 날짜들
    
    console.log('[validatePlanBeforeSave] 검증 시작 - 여행 시작일:', startDate);
    console.log('[validatePlanBeforeSave] 시작일 상세:', {
      원본: startDate,
      ISO: startDate.toISOString(),
      로컬날짜: startDate.toLocaleDateString(),
      년월일: `${startDate.getFullYear()}-${(startDate.getMonth()+1).toString().padStart(2,'0')}-${startDate.getDate().toString().padStart(2,'0')}`
    });
    console.log('[validatePlanBeforeSave] 전체 일차:', dayKeys);
    
    // 모든 숙박편의 체크인/체크아웃 날짜를 기반으로 커버리지 계산
    for (const dayKey of dayKeys) {
      const schedules = travelPlans[dayKey]?.schedules || [];
      const accommodationSchedules = schedules.filter(s => s.type === 'accommodation');
      
      console.log(`[validatePlanBeforeSave] ${dayKey}일차 숙박편 개수:`, accommodationSchedules.length);
      
      for (const accommodation of accommodationSchedules) {
        console.log(`[validatePlanBeforeSave] ${dayKey}일차 숙박편:`, {
          name: accommodation.name,
          time: accommodation.time,
          checkIn: accommodation.hotelDetails?.checkIn,
          checkOut: accommodation.hotelDetails?.checkOut
        });
        
        if (accommodation.hotelDetails?.checkIn && accommodation.hotelDetails?.checkOut) {
          // UTC 날짜 문자열을 직접 파싱하여 시간대 문제 해결
          const checkInStr = accommodation.hotelDetails.checkIn.split('T')[0]; // "2025-07-31"
          const checkOutStr = accommodation.hotelDetails.checkOut.split('T')[0]; // "2025-08-02"
          const checkInDate = new Date(checkInStr + 'T12:00:00.000Z'); // 정오로 설정하여 시간대 문제 방지
          const checkOutDate = new Date(checkOutStr + 'T12:00:00.000Z');
          
          console.log(`[validatePlanBeforeSave] 날짜 범위:`, {
            checkIn: checkInStr,
            checkOut: checkOutStr,
            checkInDate: checkInDate.toISOString().split('T')[0],
            checkOutDate: checkOutDate.toISOString().split('T')[0]
          });
          
          // 체크인부터 체크아웃 당일까지 모든 날짜를 커버리지에 추가
          const currentDate = new Date(checkInDate);
          while (currentDate <= checkOutDate) {
            // 시간 정보를 제거하고 날짜만으로 계산
            const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            // startDate를 UTC 기준으로 정규화하여 시간대 문제 해결
            const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            
            // 해당 날짜가 몇 일차인지 계산 (시작일을 1일차로 계산)
            // 시간대 문제를 피하기 위해 UTC 기준으로 계산
            const currentUTC = Date.UTC(currentDateOnly.getFullYear(), currentDateOnly.getMonth(), currentDateOnly.getDate());
            const startUTC = Date.UTC(startDateOnly.getFullYear(), startDateOnly.getMonth(), startDateOnly.getDate());
            const daysDiff = Math.floor((currentUTC - startUTC) / (1000 * 60 * 60 * 24)) + 1;
            
            console.log(`[validatePlanBeforeSave] 날짜 계산:`, {
              currentDate: currentDateOnly.toISOString().split('T')[0],
              startDate: startDateOnly.toISOString().split('T')[0],
              daysDiff: daysDiff,
              accommodation: accommodation.name
            });
            
            if (daysDiff >= 1 && daysDiff <= dayKeys.length) {
              accommodationCoverage.add(daysDiff.toString());
              console.log(`[validatePlanBeforeSave] ${daysDiff}일차 커버리지 추가 (${accommodation.name})`);
            } else {
              console.log(`[validatePlanBeforeSave] 범위 밖 날짜 무시: ${daysDiff}일차 (범위: 1-${dayKeys.length})`);
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else if (accommodation.time === '체크인' || accommodation.time === '체크아웃') {
          // hotelDetails가 없는 경우, 체크인/체크아웃이 있는 날짜를 커버
          accommodationCoverage.add(dayKey);
          console.log(`[validatePlanBeforeSave] ${dayKey}일차 직접 커버리지 추가 (${accommodation.time})`);
        }
      }
    }
    
    console.log('[validatePlanBeforeSave] 최종 커버리지:', Array.from(accommodationCoverage).sort());
    
    // 2. 항공편 검증 로직 제거 (선택 사항으로 변경)

    return { isValid: true, message: '검증 통과' };
  }, [travelPlans]);

  // 숙소 정보 추출 함수 (체크인 날짜 순서로)
  const extractAccommodationInfos = useCallback(() => {
    const accommodations = [];
    const dayKeys = Object.keys(travelPlans).sort((a, b) => parseInt(a) - parseInt(b));
    
    for (const dayKey of dayKeys) {
      const schedules = travelPlans[dayKey]?.schedules || [];
      const checkInSchedules = schedules.filter(s => 
        s.type === 'accommodation' && s.hotelDetails
      );
      
      for (const schedule of checkInSchedules) {
        // 중복 방지를 위한 체크 (같은 호텔, 같은 체크인 날짜)
        const isDuplicate = accommodations.some(acc => 
          acc.hotel?.hotel_id === schedule.hotelDetails.hotel?.hotel_id &&
          acc.checkIn === schedule.hotelDetails.checkIn
        );
        
        if (!isDuplicate) {
          accommodations.push(schedule.hotelDetails);
        }
      }
    }
    
    // 체크인 날짜 순으로 정렬
    accommodations.sort((a, b) => {
      const dateA = new Date(a.checkIn || '1970-01-01');
      const dateB = new Date(b.checkIn || '1970-01-01');
      return dateA.getTime() - dateB.getTime();
    });
    
    return accommodations;
  }, [travelPlans]);

  // 항공편 정보 추출 함수 (날짜 순서로)
  const extractFlightInfos = useCallback(() => {
    const flights = [];
    const dayKeys = Object.keys(travelPlans).sort((a, b) => parseInt(a) - parseInt(b));
    
    for (const dayKey of dayKeys) {
      const schedules = travelPlans[dayKey]?.schedules || [];
      const flightSchedules = schedules.filter(s => 
        (s.type === 'Flight_Departure' || s.type === 'Flight_Return' || s.type === 'Flight_OneWay') &&
        s.flightOfferDetails?.flightOfferData
      );
      
      for (const schedule of flightSchedules) {
        // 중복 방지를 위한 체크 (같은 항공편 ID)
        const flightData = schedule.flightOfferDetails.flightOfferData;
        const isDuplicate = flights.some(flight => flight.id === flightData.id);
        
        if (!isDuplicate) {
          flights.push(flightData);
        }
      }
    }
    
    // 출발 날짜 순으로 정렬
    flights.sort((a, b) => {
      const dateA = new Date(a.itineraries?.[0]?.segments?.[0]?.departure?.at || '1970-01-01');
      const dateB = new Date(b.itineraries?.[0]?.segments?.[0]?.departure?.at || '1970-01-01');
      return dateA.getTime() - dateB.getTime();
    });
    
    return flights;
  }, [travelPlans]);

  const getDayTitle = useCallback((dayNumber) => {
    const base = startDate instanceof Date ? startDate : (startDate ? new Date(startDate) : null);
    if (!base || isNaN(base.getTime())) return `Day ${dayNumber}`;
    const date = new Date(base);
    date.setDate(date.getDate() + dayNumber - 1);
    if (isNaN(date.getTime())) return `Day ${dayNumber}`;
    return formatDateFns(date, 'M/d');
  }, [startDate]);

  const addDay = useCallback(() => {
    const newDayNumber = dayOrder.length > 0 ? Math.max(...dayOrder.map(Number)) + 1 : 1;
    const newPlans = {
      ...travelPlans,
      [newDayNumber]: {
        title: getDayTitle(newDayNumber),
        schedules: []
      }
    };
    setTravelPlans(newPlans);
    setDayOrder(prev => [...prev, newDayNumber.toString()]);
    setSelectedDay(newDayNumber);
  }, [travelPlans, dayOrder, getDayTitle, setTravelPlans, setDayOrder, setSelectedDay]);

  const removeDay = useCallback((dayToRemove) => {
    if (Object.keys(travelPlans).length <= 1) {
      alert('최소 하루는 남아있어야 합니다.');
      return;
    }

    const remainingDays = dayOrder.filter(d => d !== String(dayToRemove));
    const newPlans = {};
    const newDayOrderArray = [];

    remainingDays.forEach((originalDayKey, index) => {
      const newDayNumber = index + 1;
      newDayOrderArray.push(newDayNumber.toString());
      newPlans[newDayNumber.toString()] = {
        ...travelPlans[originalDayKey],
        title: getDayTitle(newDayNumber)
      };
    });

    setTravelPlans(newPlans);
    setDayOrder(newDayOrderArray);

    if (String(selectedDay) === String(dayToRemove)) {
      setSelectedDay(newDayOrderArray.length > 0 ? parseInt(newDayOrderArray[0]) : 1);
    } else {
      const oldSelectedIndex = dayOrder.indexOf(String(selectedDay));
      const removedDayIndex = dayOrder.indexOf(String(dayToRemove));
      if (oldSelectedIndex > removedDayIndex) {
        setSelectedDay(selectedDay -1);
      }
    }
  }, [travelPlans, dayOrder, selectedDay, getDayTitle, setTravelPlans, setDayOrder, setSelectedDay]);

  const handleDateChange = useCallback((newDate) => {
    if (!newDate || isNaN(newDate.getTime())) return;
    setStartDate(newDate);
    const updatedPlans = { ...travelPlans };
    dayOrder.forEach((dayKey, index) => {
      const date = new Date(newDate);
      date.setDate(date.getDate() + index);
      const currentPlan = travelPlans[dayKey];
      if (currentPlan) {
        const detail = currentPlan.title.replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim();
        updatedPlans[dayKey] = {
          ...currentPlan,
          title: detail ? `${formatDateFns(date, 'M/d')} ${detail}` : formatDateFns(date, 'M/d')
        };
      }
    });
    setTravelPlans(updatedPlans);
  }, [travelPlans, dayOrder, setStartDate, setTravelPlans]);

  const openSaveDialog = useCallback(() => {
    setPlanTitleForSave('');
    setIsSaveDialogOpen(true);
    setSaveError(null);
  }, []);

  const closeSaveDialog = useCallback(() => {
    if (!isSaving) {
      setIsSaveDialogOpen(false);
    }
  }, [isSaving]);

  // 즉시 수정 함수 (다이얼로그 없이 바로 수정)
  const handleImmediateUpdate = useCallback(async () => {
    if (!planId || isNaN(Number(planId))) {
      console.error('[usePlannerActions] 즉시 수정: 유효한 planId가 없습니다');
      return false;
    }

    // 저장 전 검증 로직
    const validationResult = validatePlanBeforeSave();
    if (!validationResult.isValid) {
      setSaveError(validationResult.message);
      return false;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // 다중 숙소 정보 추출 (체크인 날짜 순서로)
      const accommodationInfos = extractAccommodationInfos();

      // 다중 항공편 정보 추출 (날짜 순서로)
      const flightInfos = extractFlightInfos();

      // 수정 모드: updateTravelPlan 사용 (plan_data만 수정)
      const updateData = {
        data: Object.keys(travelPlans).reduce((obj, dayKey) => {
          obj[parseInt(dayKey)] = {
            title: travelPlans[dayKey].title,
            schedules: (travelPlans[dayKey].schedules || [])
              .filter(schedule => 
                // ✅ 수정: hotelDetails가 있는 숙박편만 제외, 일반 숙소 일정은 유지
                !(schedule.type === 'accommodation' && schedule.hotelDetails) && 
                schedule.type !== 'Flight_Departure' && 
                schedule.type !== 'Flight_Return' && 
                schedule.type !== 'Flight_OneWay'
              )
              .map(schedule => {
                const { hotelDetails, flightOfferDetails, ...restOfSchedule } = schedule;
                
                console.log(`[usePlannerActions] 💾 저장 Map 처리: ${schedule.name}`, {
                  원본_type: schedule.type,
                  카테고리: schedule.category,
                  최종_type: restOfSchedule.type,
                  최종_카테고리: restOfSchedule.category,
                  최종_시간: restOfSchedule.time
                });
                
                return { ...restOfSchedule };
              })
          };
          return obj;
        }, {}),
        // 다중 숙박편 정보 추가
        accommodationInfos: accommodationInfos,
        // 다중 항공편 정보 추가
        flightInfos: flightInfos,
        // 총 개수 정보 추가
        totalAccommodations: accommodationInfos.length,
        totalFlights: flightInfos.length
      };

      console.log('[usePlannerActions] 즉시 수정 데이터:', updateData);

      const response = await travelApi.updateTravelPlan(planId, updateData, 'plan_data');
      
      if (response?.success) {
        console.log('[usePlannerActions] 계획 즉시 수정 완료:', response);
        return true;
      } else {
        setSaveError(response?.message || '수정 중 알 수 없는 오류가 발생했습니다.');
        return false;
      }
    } catch (err) {
      console.error('[usePlannerActions] 즉시 수정 실패:', err);
      setSaveError(`수정 중 오류 발생: ${err.message || '네트워크 오류일 수 있습니다.'}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [travelPlans, planId]);

  // 계획 제목 업데이트 함수 추가
  const handleUpdatePlanTitle = useCallback(async (newTitle) => {
    if (!planId || isNaN(Number(planId))) {
      console.error('[usePlannerActions] 제목 수정: 유효한 planId가 없습니다');
      return false;
    }

    if (!newTitle || !newTitle.trim()) {
      console.error('[usePlannerActions] 제목 수정: 유효한 제목이 없습니다');
      return false;
    }

    try {
      const response = await travelApi.updateTravelPlan(
        planId, 
        { title: newTitle.trim() },
        'plan_data'
      );

      if (response?.success) {
        console.log('[usePlannerActions] 계획 제목 수정 완료:', response);
        return true;
      } else {
        console.error('[usePlannerActions] 제목 수정 실패:', response?.message);
        return false;
      }
    } catch (err) {
      console.error('[usePlannerActions] 제목 수정 실패:', err);
      return false;
    }
  }, [planId]);

  // 공유 기능을 위한 함수 추가
  const handleSharePlan = useCallback(async (sharedEmail) => {
    if (!planId || isNaN(Number(planId))) {
      console.error('[usePlannerActions] 공유: 유효한 planId가 없습니다');
      return { success: false, message: '저장된 계획만 공유할 수 있습니다.' };
    }

    try {
      // 이메일이 비어있으면 null을 보내서 공유 해제
      const emailToSend = (sharedEmail && sharedEmail.trim()) ? sharedEmail.trim() : null;
      
      console.log('[usePlannerActions] 계획 공유 시작:', { planId, sharedEmail: emailToSend });
      
      const response = await travelApi.updateTravelPlan(
        planId, 
        { shared_email: emailToSend },
        'shared_email'
      );

      if (response?.success) {
        console.log('[usePlannerActions] 계획 공유 완료:', response);
        
        if (emailToSend) {
          return { 
            success: true, 
            message: `${emailToSend}로 플랜이 성공적으로 공유되었습니다!` 
          };
        } else {
          return { 
            success: true, 
            message: '플랜 공유가 해제되었습니다.' 
          };
        }
      } else {
        console.error('[usePlannerActions] 공유 실패:', response?.message);
        return { 
          success: false, 
          message: response?.message || '플랜 공유 중 오류가 발생했습니다.' 
        };
      }
    } catch (err) {
      console.error('[usePlannerActions] 공유 실패:', err);
      return { 
        success: false, 
        message: `플랜 공유 중 오류 발생: ${err.message || '네트워크 오류'}` 
      };
    }
  }, [planId]);

  const handleSaveConfirm = useCallback(async (titleToSave, sharedEmail = '') => {
    if (!titleToSave || !titleToSave.trim()) {
      setSaveError('여행 계획 제목을 입력해주세요.');
      return false;
    }

    // 저장 전 검증 로직
    const validationResult = validatePlanBeforeSave();
    if (!validationResult.isValid) {
      setSaveError(validationResult.message);
      return false;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // 다중 숙소 정보 추출 (체크인 날짜 순서로)
      const accommodationInfos = extractAccommodationInfos();

      // 다중 항공편 정보 추출 (날짜 순서로)
      const flightInfos = extractFlightInfos();

      // 백엔드가 기대하는 data 형태로 변환 (일반 일정에서 숙소 및 항공편 일정 제외)
      const planData = {
        title: titleToSave,
        data: Object.keys(travelPlans).reduce((obj, dayKey) => {
          obj[parseInt(dayKey)] = {
            title: travelPlans[dayKey].title,
            schedules: (travelPlans[dayKey].schedules || [])
              .filter(schedule => 
                // ✅ 수정: hotelDetails가 있는 숙박편만 제외, 일반 숙소 일정은 유지
                !(schedule.type === 'accommodation' && schedule.hotelDetails) && 
                schedule.type !== 'Flight_Departure' && 
                schedule.type !== 'Flight_Return' && 
                schedule.type !== 'Flight_OneWay'
              )
              .map(schedule => {
                const { hotelDetails, flightOfferDetails, ...restOfSchedule } = schedule;
                
                console.log(`[usePlannerActions] 💾 저장 Map 처리: ${schedule.name}`, {
                  원본_type: schedule.type,
                  카테고리: schedule.category,
                  최종_type: restOfSchedule.type,
                  최종_카테고리: restOfSchedule.category,
                  최종_시간: restOfSchedule.time
                });
                
                return { ...restOfSchedule };
              })
          };
          return obj;
        }, {}),
        startDate: formatDateFns(startDate, 'yyyy-MM-dd'),
        // 다중 숙박편 정보 추가
        accommodationInfos: accommodationInfos,
        // 다중 항공편 정보 추가
        flightInfos: flightInfos,
        // 총 개수 정보 추가
        totalAccommodations: accommodationInfos.length,
        totalFlights: flightInfos.length
      };

      // shared_email 정보 추가
      if (sharedEmail && sharedEmail.trim()) {
        planData.shared_email = sharedEmail.trim();
        console.log('[usePlannerActions] 공유 이메일 추가:', planData.shared_email);
      }

      console.log('[usePlannerActions] 저장 전 planData 최종 확인:', {
        일반일정수: Object.keys(planData.data).length,
        일차별일정수: Object.fromEntries(Object.entries(planData.data).map(([day, plan]) => 
          [day, { 제목: plan.title, 일정수: plan.schedules?.length || 0 }]
        )),
        항공편수: planData.flightInfos?.length || 0,
        숙박편수: planData.accommodationInfos?.length || 0
      });
      
      // ✅ 추가: 저장 데이터 구조 상세 로그
      console.log('[usePlannerActions] 💾 저장 데이터 상세 분석:');
      console.log('[usePlannerActions] 📅 일반 일정 (data):', planData.data);
      console.log('[usePlannerActions] ✈️ 항공편 정보 (flightInfos):', planData.flightInfos);
      
      // ✅ 추가: 저장 전 원본 travelPlans 로깅
      console.log('[usePlannerActions] 🔍 저장 전 원본 travelPlans:');
      Object.entries(travelPlans).forEach(([dayKey, dayPlan]) => {
        console.log(`[usePlannerActions] Day ${dayKey} 원본 일정:`, {
          제목: dayPlan.title,
          일정수: dayPlan.schedules?.length || 0,
          전체일정: dayPlan.schedules?.map(s => ({ 
            id: s.id, 
            name: s.name, 
            type: s.type, 
            category: s.category, 
            time: s.time,
            hasHotelDetails: !!s.hotelDetails 
          })) || []
        });
      });
      
      // ✅ 추가: 필터링 과정 상세 로깅
      console.log('[usePlannerActions] 🔧 필터링 과정 상세:');
      Object.entries(travelPlans).forEach(([dayKey, dayPlan]) => {
        const originalSchedules = dayPlan.schedules || [];
        console.log(`[usePlannerActions] Day ${dayKey} 필터링 전:`, originalSchedules.length, '개');
        
        originalSchedules.forEach((schedule, index) => {
          const shouldExclude = schedule.type === 'accommodation' && schedule.hotelDetails;
          const shouldExcludeFlight = schedule.type === 'Flight_Departure' || 
                                    schedule.type === 'Flight_Return' || 
                                    schedule.type === 'Flight_OneWay';
          
          console.log(`[usePlannerActions] Day ${dayKey}-${index}: ${schedule.name}`, {
            type: schedule.type,
            category: schedule.category,
            time: schedule.time,
            hasHotelDetails: !!schedule.hotelDetails,
            shouldExclude: shouldExclude,
            shouldExcludeFlight: shouldExcludeFlight,
            최종포함여부: !shouldExclude && !shouldExcludeFlight
          });
        });
        
        const filteredSchedules = originalSchedules.filter(schedule => 
          !(schedule.type === 'accommodation' && schedule.hotelDetails) && 
          schedule.type !== 'Flight_Departure' && 
          schedule.type !== 'Flight_Return' && 
          schedule.type !== 'Flight_OneWay'
        );
        
        console.log(`[usePlannerActions] Day ${dayKey} 필터링 후:`, filteredSchedules.length, '개');
        filteredSchedules.forEach(s => {
          console.log(`[usePlannerActions] Day ${dayKey} 저장될 일정:`, {
            name: s.name,
            type: s.type,
            category: s.category,
            time: s.time
          });
        });
      });
      
      Object.entries(planData.data).forEach(([dayKey, dayPlan]) => {
        console.log(`[usePlannerActions] Day ${dayKey} 저장될 일반 일정:`, {
          제목: dayPlan.title,
          일정수: dayPlan.schedules?.length || 0,
          일정목록: dayPlan.schedules?.map(s => ({ 
            name: s.name, 
            type: s.type, 
            category: s.category, 
            time: s.time,
            hasType: !!s.type,
            typeString: String(s.type)
          })) || []
        });
      });

      // 새로 저장 모드: savePlan 사용
      console.log('[usePlannerActions] 새로운 계획 저장 모드');

      const response = await travelApi.savePlan(planData);
      
      if (response?.success && response.plan_id) {
        setPlanId(response.plan_id);
        setIsSaveDialogOpen(false);
        console.log('[usePlannerActions] 새 계획 저장 완료 - plan_id:', response.plan_id);
        return true;
      } else {
        setSaveError(response?.message || '저장 중 알 수 없는 오류가 발생했습니다.');
        return false;
      }
    } catch (err) {
      console.error('[usePlannerActions] 저장 실패:', err);
      setSaveError(`저장 중 오류 발생: ${err.message || '네트워크 오류일 수 있습니다.'}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [travelPlans, startDate, setPlanId]);

  const handleAddPlace = useCallback((place) => {
    console.log('handleAddPlace called with:', place);
    
    if (!selectedDay) {
      alert('날짜를 선택해주세요.');
      return;
    }

    // 숙소인 경우 특별 처리
    if (place.type === 'accommodation') {
      console.log('Processing as accommodation');
      
      // ✅ 수정: checkIn/checkOut에 실제 날짜 계산하여 저장
      const checkInDate = new Date(startDate);
      checkInDate.setDate(checkInDate.getDate() + parseInt(selectedDay) - 1);
      const checkInDateStr = checkInDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // 기본적으로 1박으로 설정 (체크아웃은 다음날)
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 1);
      const checkOutDateStr = checkOutDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const hotelDetails = {
        hotel: {
          hotel_id: place.id || Date.now().toString(),
          hotel_name: place.name,
          hotel_name_trans: place.name,
          address: place.address,
          address_trans: place.address,
          latitude: place.lat,
          longitude: place.lng,
          main_photo_url: place.photo_url || '',
          price: place.price || '',
          checkIn: place.checkInTime || '14:00',  // 체크인 시간
          checkOut: place.checkOutTime || '11:00'  // 체크아웃 시간
        },
        // ✅ 추가: 실제 체크인/체크아웃 날짜
        checkIn: checkInDateStr,
        checkOut: checkOutDateStr,
        contact: '',
        notes: place.price ? `가격: ${place.price}` : '',
        lat: place.lat,
        lng: place.lng,
        latitude: place.lat,
        longitude: place.lng
      };
      console.log('Created hotelDetails with dates:', hotelDetails);

      const newSchedule = {
        id: Date.now().toString(),
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        category: '숙소',
        time: '체크인',
        duration: '1박',
        type: 'accommodation',
        hotelDetails: hotelDetails,
        notes: place.price ? `가격: ${place.price}` : ''
      };
      console.log('Created newSchedule for accommodation:', newSchedule);

      setTravelPlans(prev => {
        const updated = {
          ...prev,
          [selectedDay]: {
            ...prev[selectedDay],
            schedules: [...(prev[selectedDay]?.schedules || []), newSchedule]
          }
        };
        console.log('Updated travelPlans:', updated);
        return updated;
      });
      return newSchedule;
    }

    console.log('Processing as regular place');
    // 일반 장소인 경우 기존 로직
    const newSchedule = {
      id: Date.now().toString(),
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      category: place.category,
      time: '09:00',
      duration: '2시간',
      notes: ''
    };
    console.log('Created newSchedule for regular place:', newSchedule);

    setTravelPlans(prev => {
      const updated = {
        ...prev,
        [selectedDay]: {
          ...prev[selectedDay],
          schedules: [...(prev[selectedDay]?.schedules || []), newSchedule]
        }
      };
      console.log('Updated travelPlans:', updated);
      return updated;
    });
    return newSchedule;
  }, [selectedDay, setTravelPlans]);

  const handleEditScheduleOpen = useCallback((schedule) => {
    setEditSchedule(schedule);
    setEditDialogOpen(true);
  }, []);

  const handleUpdateSchedule = useCallback(() => {
    if (!editSchedule) return;
    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: prev[selectedDay].schedules.map(s =>
          s.id === editSchedule.id ? editSchedule : s
        )
      }
    }));
    setEditDialogOpen(false);
    setEditSchedule(null);
  }, [editSchedule, selectedDay, setTravelPlans]);

  const handleDeleteSchedule = useCallback((scheduleId) => {
    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: prev[selectedDay].schedules.filter(s => s.id !== scheduleId)
      }
    }));
  }, [selectedDay, setTravelPlans]);

  const handleScheduleDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (!travelPlans[selectedDay] || !travelPlans[selectedDay].schedules) return;

    // 드래그 가능한 일정들만 필터링 (항공편과 숙박편 제외)
    const allSchedules = travelPlans[selectedDay].schedules;
    const draggableSchedules = allSchedules.filter(schedule => 
      schedule.type !== 'Flight_Departure' && 
      schedule.type !== 'Flight_Return' && 
      schedule.type !== 'Flight_OneWay' && 
      schedule.type !== 'accommodation'
    );
    const fixedSchedules = allSchedules.filter(schedule => 
      schedule.type === 'Flight_Departure' || 
      schedule.type === 'Flight_Return' || 
      schedule.type === 'Flight_OneWay' || 
      schedule.type === 'accommodation'
    );

    // 드래그 가능한 일정들의 순서만 변경
    const reorderedDraggableSchedules = [...draggableSchedules];
    const [movedItem] = reorderedDraggableSchedules.splice(source.index, 1);
    reorderedDraggableSchedules.splice(destination.index, 0, movedItem);

    // 고정 일정들과 재정렬된 일반 일정들을 합쳐서 새 배열 생성
    const newSchedules = [...fixedSchedules, ...reorderedDraggableSchedules];

    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: newSchedules
      }
    }));
  }, [travelPlans, selectedDay, setTravelPlans]);

  return {
    getDayTitle,
    addDay,
    removeDay,
    handleDateChange,
    openSaveDialog,
    closeSaveDialog,
    handleSaveConfirm,
    handleImmediateUpdate,
    handleUpdatePlanTitle,
    handleSharePlan,
    isSaveDialogOpen,
    planTitleForSave,
    setPlanTitleForSave,
    isSaving,
    saveError,
    handleAddPlace,
    handleEditScheduleOpen,
    handleUpdateSchedule,
    handleDeleteSchedule,
    handleScheduleDragEnd,
    editSchedule,
    setEditSchedule,
    editDialogOpen,
    setEditDialogOpen
  };
};

export default usePlannerActions;
