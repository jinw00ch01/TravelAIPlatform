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

  const getDayTitle = useCallback((dayNumber) => {
    const date = new Date(startDate);
    if (isNaN(date.getTime())) return `Day ${dayNumber}`;
    date.setDate(date.getDate() + dayNumber - 1);
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

  const handleSaveConfirm = useCallback(async (titleToSave) => {
    if (!titleToSave || !titleToSave.trim()) {
      setSaveError('여행 계획 제목을 입력해주세요.');
      return false;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const planData = {
        title: titleToSave,
        days: Object.keys(travelPlans).map(day => ({
          day: parseInt(day),
          title: travelPlans[day].title,
          schedules: travelPlans[day].schedules?.map(schedule => {
            const baseSchedule = { ...schedule };
            if (baseSchedule.flightOfferDetails?.flightOfferData) {
              baseSchedule.flightOfferDetails.flightOfferData = 
                JSON.parse(JSON.stringify(baseSchedule.flightOfferDetails.flightOfferData, (k,v) => typeof v === 'number' && !isFinite(v) ? null : v));
            }
            return baseSchedule;
          }) || []
        })),
        startDate: formatDateFns(startDate, 'yyyy-MM-dd')
      };

      const response = await travelApi.savePlan(planData);
      if (response?.success && response.plan_id) {
        setPlanId(response.plan_id);
        setIsSaveDialogOpen(false);
        return true;
      } else {
        setSaveError(response?.message || '저장 중 알 수 없는 오류가 발생했습니다.');
        return false;
      }
    } catch (err) {
      console.error('저장 실패:', err);
      setSaveError(`저장 중 오류 발생: ${err.message || '네트워크 오류일 수 있습니다.'}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [travelPlans, startDate, setPlanId]);

  return {
    getDayTitle,
    addDay,
    removeDay,
    handleDateChange,
    openSaveDialog,
    closeSaveDialog,
    handleSaveConfirm,
    isSaveDialogOpen,
    planTitleForSave,
    setPlanTitleForSave,
    isSaving,
    saveError
  };
};

export default usePlannerActions;
