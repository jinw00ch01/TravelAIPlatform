import { useCallback } from 'react';
import { format as formatDateFns } from 'date-fns';
import { travelApi } from '../../services/api';

const usePlannerActions = ({
  travelPlans, setTravelPlans,
  dayOrder, setDayOrder,
  selectedDay, setSelectedDay,
  startDate, planId, setPlanId
}) => {

  const getDayTitle = (dayNumber) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayNumber - 1);
    return formatDateFns(date, 'M/d');
  };

  const addDay = () => {
    const newDayNumber = Math.max(...Object.keys(travelPlans).map(Number)) + 1;
    const newPlans = {
      ...travelPlans,
      [newDayNumber]: {
        title: getDayTitle(newDayNumber),
        schedules: []
      }
    };
    setTravelPlans(newPlans);
    setDayOrder(prev => [...prev, newDayNumber.toString()]);
  };

  const removeDay = (dayToRemove) => {
    if (Object.keys(travelPlans).length <= 1) {
      alert('최소 하루는 남아있어야 합니다.');
      return;
    }

    const remainingDays = Object.keys(travelPlans).filter(d => d !== String(dayToRemove)).map(Number).sort((a, b) => a - b);
    const newPlans = {};
    remainingDays.forEach((day, index) => {
      newPlans[index + 1] = {
        ...travelPlans[day],
        title: getDayTitle(index + 1)
      };
    });

    setTravelPlans(newPlans);
    setDayOrder(Object.keys(newPlans));
    if (selectedDay === dayToRemove) {
      setSelectedDay(Math.min(dayToRemove, Object.keys(newPlans).length));
    } else if (selectedDay > dayToRemove) {
      setSelectedDay(selectedDay - 1);
    }
  };

  const handleDateChange = (newDate) => {
    const newPlans = {};
    Object.keys(travelPlans).forEach((day, index) => {
      const date = new Date(newDate);
      date.setDate(date.getDate() + index);
      const detail = travelPlans[day].title.replace(/^[0-9]{1,2}\/[^ ]*:?/, '').trim();
      const newTitle = detail ? `${formatDateFns(date, 'M/d')} ${detail}` : formatDateFns(date, 'M/d');
      newPlans[day] = {
        ...travelPlans[day],
        title: newTitle
      };
    });
    setTravelPlans(newPlans);
  };

  const handleSaveConfirm = async (planTitle) => {
    if (!planTitle.trim()) {
      alert('여행 계획 제목을 입력해주세요.');
      return;
    }

    try {
      const planData = {
        title: planTitle,
        days: Object.keys(travelPlans).map(day => ({
          day: parseInt(day),
          title: travelPlans[day].title,
          schedules: travelPlans[day].schedules || []
        })),
        startDate: formatDateFns(startDate, 'yyyy-MM-dd')
      };

      const response = await travelApi.savePlan(planData);
      if (response?.success && response.plan_id) {
        setPlanId(response.plan_id);
        alert('저장 완료!');
      } else {
        alert('저장 실패');
      }
    } catch (err) {
      console.error('저장 실패:', err);
      alert('저장 중 오류 발생');
    }
  };

  return {
    addDay,
    removeDay,
    handleDateChange,
    handleSaveConfirm
  };
};

export default usePlannerActions;
