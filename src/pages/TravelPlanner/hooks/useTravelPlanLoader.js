// useTravelPlanLoader.js
import { useState, useEffect } from 'react';
import { format as formatDateFns } from 'date-fns';
import { travelApi } from '../../services/api';

// JSON 파싱 + 레거시 포맷 처리 함수
const processNewDaysFormat = (daysData) => {
  if (!daysData) return null;

  if (Array.isArray(daysData)) return daysData;
  if (daysData.days && Array.isArray(daysData.days)) return daysData.days;

  const result = [];
  const dayKeys = Object.keys(daysData).filter(key => /^day_\d+$/.test(key)).sort((a, b) => {
    const dayA = parseInt(a.split('_')[1]);
    const dayB = parseInt(b.split('_')[1]);
    return dayA - dayB;
  });

  dayKeys.forEach(dayKey => {
    const day = parseInt(dayKey.split('_')[1]);
    const dayData = daysData[dayKey];
    result.push({
      day,
      title: dayData.title || `${day}일차`,
      date: dayData.date,
      hotel: dayData.hotel,
      places: dayData.places || []
    });
  });

  return result;
};

const convertFromDynamoDBFormat = (dynamoData) => {
  if (!dynamoData) return {};
  const result = {};

  Object.keys(dynamoData).forEach(dayKey => {
    if (dynamoData[dayKey] && dynamoData[dayKey].M) {
      const dayData = dynamoData[dayKey].M;
      const title = dayData.title?.S || `${dayKey}일차`;
      let schedules = [];
      if (dayData.schedules?.L) {
        schedules = dayData.schedules.L.map(scheduleItem => {
          const schedule = scheduleItem.M;
          const base = {
            id: schedule.id?.S || `${dayKey}-${Math.random().toString(36).substring(7)}`,
            name: schedule.name?.S || '',
            time: schedule.time?.S || '00:00',
            address: schedule.address?.S || '',
            category: schedule.category?.S || '',
            duration: schedule.duration?.S || '1시간',
            notes: schedule.notes?.S || '',
            lat: schedule.lat?.N ? parseFloat(schedule.lat.N) : null,
            lng: schedule.lng?.N ? parseFloat(schedule.lng.N) : null
          };

          if (schedule.type?.S) base.type = schedule.type.S;
          return base;
        });
      }
      result[dayKey] = { title, schedules };
    }
  });

  return result;
};

const useTravelPlanLoader = (user) => {
  const [travelPlans, setTravelPlans] = useState({ 1: { title: '1일차', schedules: [] } });
  const [dayOrder, setDayOrder] = useState(['1']);
  const [selectedDay, setSelectedDay] = useState(1);
  const [startDate, setStartDate] = useState(new Date());
  const [planId, setPlanId] = useState(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);

  const loadTravelPlan = async (params = { newest: true }) => {
    setIsLoadingPlan(true);
    try {
      const data = await travelApi.loadPlan(params);

      if (data?.plannerData && Object.keys(data.plannerData).length > 0) {
        setTravelPlans(data.plannerData);
        setDayOrder(Object.keys(data.plannerData));
        setSelectedDay(Object.keys(data.plannerData)[0]);
        if (data.plan?.[0]?.id) setPlanId(data.plan[0].id);
        setIsLoadingPlan(false);
        return;
      }

      if (data?.plan?.[0]?.plan_data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = data.plan[0].plan_data.candidates[0].content.parts[0].text;
        const match = text.match(/```json\n([\s\S]*?)\n```/);
        if (match && match[1]) {
          const parsed = JSON.parse(match[1]);
          if (parsed.days || parsed.itinerary) {
            const dayList = parsed.days || parsed.itinerary;
            const formatted = {};
            dayList.forEach((dayPlan, index) => {
              const day = (dayPlan.day || index + 1).toString();
              const date = new Date(startDate);
              date.setDate(date.getDate() + index);
              const dateStr = formatDateFns(date, 'M/d');
              const detail = (dayPlan.title || '').replace(/^[0-9]{1,2}\/[^ ]*:?/, '').trim();
              const fullTitle = detail ? `${dateStr} ${detail}` : dateStr;
              const schedules = dayPlan.schedules || [];
              formatted[day] = { title: fullTitle, schedules };
            });
            setTravelPlans(formatted);
            setDayOrder(Object.keys(formatted));
            setSelectedDay(Object.keys(formatted)[0]);
            return;
          }
        }
      }

      setTravelPlans({ 1: { title: '1일차', schedules: [] } });
      setDayOrder(['1']);
      setSelectedDay(1);

    } catch (e) {
      console.error('loadTravelPlan 오류:', e);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  useEffect(() => {
    if (user) loadTravelPlan();
  }, [user]);

  return {
    travelPlans, setTravelPlans,
    dayOrder, setDayOrder,
    selectedDay, setSelectedDay,
    startDate, setStartDate,
    planId, setPlanId,
    isLoadingPlan,
    loadTravelPlan
  };
};

export default useTravelPlanLoader;
