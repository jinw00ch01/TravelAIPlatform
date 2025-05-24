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

    setIsSaving(true);
    setSaveError(null);
    try {
      // 숙소 정보 추출
      let accommodationInfo = null;
      for (const dayKey of Object.keys(travelPlans)) {
        const schedules = travelPlans[dayKey].schedules || [];
        const checkInSchedule = schedules.find(s => s.type === 'accommodation' && s.time === '체크인');
        if (checkInSchedule?.hotelDetails) {
          accommodationInfo = checkInSchedule.hotelDetails;
          console.log('[usePlannerActions] 숙소 정보 추출:', accommodationInfo);
          break;
        }
      }

      // 수정 모드: updateTravelPlan 사용 (plan_data만 수정)
      const updateData = {
        data: Object.keys(travelPlans).reduce((obj, dayKey) => {
          obj[parseInt(dayKey)] = {
            title: travelPlans[dayKey].title,
            schedules: (travelPlans[dayKey].schedules || [])
              .filter(schedule => schedule.type !== 'accommodation')
              .map(schedule => {
                const { hotelDetails, ...restOfSchedule } = schedule;
                const baseSchedule = { ...restOfSchedule };
                if (baseSchedule.flightOfferDetails?.flightOfferData) {
                  baseSchedule.flightOfferDetails.flightOfferData = 
                    JSON.parse(JSON.stringify(baseSchedule.flightOfferDetails.flightOfferData, (k,v) => typeof v === 'number' && !isFinite(v) ? null : v));
                }
                return baseSchedule;
              })
          };
          return obj;
        }, {})
      };

      // 숙소 정보가 있으면 추가
      if (accommodationInfo) {
        updateData.accommodationInfo = accommodationInfo;
      }

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

  const handleSaveConfirm = useCallback(async (titleToSave, sharedEmail = '') => {
    if (!titleToSave || !titleToSave.trim()) {
      setSaveError('여행 계획 제목을 입력해주세요.');
      return false;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      // 숙소 정보 추출
      let accommodationInfo = null;
      for (const dayKey of Object.keys(travelPlans)) {
        const schedules = travelPlans[dayKey].schedules || [];
        const checkInSchedule = schedules.find(s => s.type === 'accommodation' && s.time === '체크인');
        if (checkInSchedule?.hotelDetails) {
          accommodationInfo = checkInSchedule.hotelDetails;
          console.log('[usePlannerActions] 숙소 정보 추출:', accommodationInfo);
          break;
        }
      }

      // 일반 일정에서 숙소 일정 제외
      const planData = {
        title: titleToSave,
        days: Object.keys(travelPlans).map(day => ({
          day: parseInt(day),
          title: travelPlans[day].title,
          schedules: (travelPlans[day].schedules || [])
            .filter(schedule => schedule.type !== 'accommodation')
            .map(schedule => {
              const { hotelDetails, ...restOfSchedule } = schedule;
              const baseSchedule = { ...restOfSchedule };
              if (baseSchedule.flightOfferDetails?.flightOfferData) {
                baseSchedule.flightOfferDetails.flightOfferData = 
                  JSON.parse(JSON.stringify(baseSchedule.flightOfferDetails.flightOfferData, (k,v) => typeof v === 'number' && !isFinite(v) ? null : v));
              }
              return baseSchedule;
            })
        })),
        startDate: formatDateFns(startDate, 'yyyy-MM-dd')
      };

      // 숙소 정보가 있으면 추가
      if (accommodationInfo) {
        planData.accommodationInfo = accommodationInfo;
        console.log('[usePlannerActions] 저장할 planData에 숙소 정보 추가:', planData.accommodationInfo);
      }

      // shared_email 정보 추가
      if (sharedEmail && sharedEmail.trim()) {
        planData.shared_email = sharedEmail.trim();
        console.log('[usePlannerActions] 공유 이메일 추가:', planData.shared_email);
      }

      console.log('[usePlannerActions] 최종 저장 데이터:', planData);

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
    if (place.category === '숙소' || place.type === 'accommodation') {
      console.log('Processing as accommodation');
      
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
          checkIn: place.checkInTime || '14:00',
          checkOut: place.checkOutTime || '11:00'
        }
      };
      console.log('Created hotelDetails:', hotelDetails);

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

    const daySchedules = [...travelPlans[selectedDay].schedules];
    const [reorderedItem] = daySchedules.splice(source.index, 1);
    daySchedules.splice(destination.index, 0, reorderedItem);

    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: daySchedules
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
