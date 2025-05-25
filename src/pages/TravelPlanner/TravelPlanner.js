import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import { 
  Box, Typography, Paper, Grid, IconButton
} from '@mui/material';
import { Draggable } from 'react-beautiful-dnd';
import { format as formatDateFns } from 'date-fns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import useTravelPlanLoader from './hooks/useTravelPlanLoader';
import useFlightHandlers from './hooks/useFlightHandlers';
import usePlannerActions from './hooks/usePlannerActions';
import useAccommodationHandlers from './hooks/useAccommodationHandlers';
import useAIMessageHandler from './hooks/useAIMessageHandler';
import useDialogHandlers from './hooks/useDialogHandlers';
import TravelPlannerSidebar from './components/TravelPlannerSidebar';
import TravelPlannerHeader from './components/TravelPlannerHeader';
import TravelPlannerMainContent from './components/TravelPlannerMainContent';
import TravelPlannerDialogs from './components/TravelPlannerDialogs';
import AIChatWidget from './components/AIChatWidget';
import { useParams } from 'react-router-dom';


const TravelPlanner = ({ loadMode }) => {
  const { user } = useAuth();
  const { planId: planIdFromUrl } = useParams();

  const {
    travelPlans, setTravelPlans,
    dayOrder, setDayOrder,
    selectedDay, setSelectedDay,
    startDate, setStartDate,
    planId, setPlanId,
    planName, setPlanName,
    loadedFlightInfo,
    loadedFlightInfos, // 다중 항공편
    isRoundTrip,
    loadedAccommodationInfos // 다중 숙박편
  } = useTravelPlanLoader(user, planIdFromUrl, loadMode);

  const {
    flightSearchParams, setFlightSearchParams,
    originCities, destinationCities,
    isLoadingCities, isLoadingFlights,
    flightResults, flightDictionaries, flightError,
    handleCitySearch, handleFlightSearch,
    airportInfoCache, loadingAirportInfo,
    originSearchQuery, setOriginSearchQuery,
    destinationSearchQuery, setDestinationSearchQuery,
    handleAddFlightToSchedule,
    updateFlightScheduleDetails
  } = useFlightHandlers();

  const {
    accommodationFormData,
    setAccommodationFormData,
    handleHotelSearchResults,
    handleHotelSelect,
    addAccommodationToSchedule
  } = useAccommodationHandlers();

  const {
    getDayTitle: plannerGetDayTitle,
    addDay: plannerAddDay,
    removeDay: plannerRemoveDay,
    handleDateChange: plannerHandleDateChange,
    openSaveDialog,
    closeSaveDialog,
    handleSaveConfirm: plannerHandleSaveConfirm,
    handleImmediateUpdate: plannerHandleImmediateUpdate,
    handleUpdatePlanTitle: plannerHandleUpdatePlanTitle,
    handleSharePlan: plannerHandleSharePlan,
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
  } = usePlannerActions({
    travelPlans, setTravelPlans,
    dayOrder, setDayOrder,
    selectedDay, setSelectedDay,
    startDate,
    setStartDate,
    planId, setPlanId
  });

  // UI 상태들
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState('schedule');
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [hideFlightMarkers, setHideFlightMarkers] = useState(true);
  const [editTitleMode, setEditTitleMode] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [loadedAccommodationInfo, setLoadedAccommodationInfo] = useState(null);
  const [mapResizeTrigger, setMapResizeTrigger] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // 계획 제목 관리를 위한 상태
  const [planTitle, setPlanTitle] = useState('');
  const [isEditingPlanTitle, setIsEditingPlanTitle] = useState(false);
  const [tempPlanTitle, setTempPlanTitle] = useState('');

  // refs
  const mainAccommodationPlanRef = useRef(null);
  const sidebarAccommodationPlanRef = useRef(null);

  // 다이얼로그 핸들러 훅
  const dialogHandlers = useDialogHandlers();

  const currentPlan = travelPlans[selectedDay] || { title: '', schedules: [] };

  // planId 변경 시 계획 제목 설정
  useEffect(() => {
    if (planName) {
      // 로드된 실제 계획 제목이 있으면 사용
      setPlanTitle(planName);
    } else if (planId && !isNaN(Number(planId))) {
      // planId만 있으면 기본 형식 사용
      setPlanTitle(`여행 계획 #${planId}`);
    } else {
      // 아무것도 없으면 새 계획
      setPlanTitle('새 여행 계획');
    }
  }, [planId, planName]);

  const accommodationsToShow = useMemo(() => {
    console.log('Calculating accommodationsToShow with:', {
      travelPlans,
      dayOrder,
      selectedDay,
      currentPlan,
      loadedAccommodationInfos
    });
    
    if (!selectedDay || !startDate) {
      console.log('No accommodations to show - missing selectedDay or startDate');
      return [];
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

    // 현재 선택된 날짜 계산
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + parseInt(selectedDay) - 1);
    currentDate.setHours(0, 0, 0, 0);
    
    const accommodationsForDay = [];
    const addedAccommodationKeys = new Set(); // 중복 방지를 위한 Set
    
    // 1. travelPlans에서 직접 추가된 숙박편들 확인 (우선순위)
    dayOrder.forEach(dayKey => {
      const dayPlan = travelPlans[dayKey];
      if (dayPlan?.schedules) {
        dayPlan.schedules.forEach(schedule => {
          if (schedule.type === 'accommodation' && schedule.hotelDetails) {
            const checkInDate = parseDate(schedule.hotelDetails.checkIn);
            const checkOutDate = parseDate(schedule.hotelDetails.checkOut);
            checkInDate.setHours(0, 0, 0, 0);
            checkOutDate.setHours(0, 0, 0, 0);
            
            // 현재 날짜가 체크인 날짜부터 체크아웃 날짜까지의 기간에 포함되는지 확인
            const isInStayPeriod = currentDate.getTime() >= checkInDate.getTime() && 
                                  currentDate.getTime() <= checkOutDate.getTime();
            
            if (isInStayPeriod) {
              // 중복 방지를 위한 고유 키 생성
              const hotelId = schedule.hotelDetails.hotel?.hotel_id || 
                             schedule.hotelDetails.hotel_id || 
                             schedule.hotelDetails.id ||
                             schedule.hotelDetails.hotel?.hotel_name ||
                             schedule.hotelDetails.hotel_name ||
                             schedule.name;
              const checkIn = schedule.hotelDetails.checkIn || schedule.hotelDetails.hotel?.checkIn;
              const checkOut = schedule.hotelDetails.checkOut || schedule.hotelDetails.hotel?.checkOut;
              const accommodationKey = `${hotelId}-${checkIn}-${checkOut}`;
              
              console.log('[accommodationsToShow] 숙박편 날짜 검사:', {
                dayKey,
                currentDate: currentDate.toISOString().split('T')[0],
                checkInDate: checkInDate.toISOString().split('T')[0],
                checkOutDate: checkOutDate.toISOString().split('T')[0],
                isInStayPeriod,
                hotelName: schedule.hotelDetails.hotel?.hotel_name || schedule.hotelDetails.hotel_name,
                accommodationKey
              });
              
              // 이미 추가된 숙박편인지 확인
              if (!addedAccommodationKeys.has(accommodationKey)) {
                addedAccommodationKeys.add(accommodationKey);
                accommodationsForDay.push({
                  ...schedule.hotelDetails,
                  id: `accommodation-schedule-${schedule.id}-${selectedDay}`,
                  source: 'travelPlans' // 출처 표시
                });
                console.log('[accommodationsToShow] 숙박편 추가:', accommodationKey);
              } else {
                console.log('[accommodationsToShow] 중복 숙박편 스킵:', accommodationKey);
              }
            }
          }
        });
      }
    });
    
    // 2. loadedAccommodationInfos에서 추가 숙박편 확인 (기존 로직 유지)
    if (loadedAccommodationInfos && loadedAccommodationInfos.length > 0) {
      // travelPlans에서 실제로 존재하는 숙박편들만 확인
      const existingAccommodationIds = new Set();
      dayOrder.forEach(dayKey => {
        const dayPlan = travelPlans[dayKey];
        if (dayPlan?.schedules) {
          dayPlan.schedules.forEach(schedule => {
            if (schedule.type === 'accommodation' && schedule.hotelDetails) {
              const hotelId = schedule.hotelDetails.hotel?.hotel_id || schedule.hotelDetails.hotel_id;
              const checkIn = schedule.hotelDetails.checkIn;
              const checkOut = schedule.hotelDetails.checkOut;
              if (hotelId && checkIn && checkOut) {
                existingAccommodationIds.add(`${hotelId}-${checkIn}-${checkOut}`);
              }
            }
          });
        }
      });
      
      // 모든 숙박편을 확인하여 현재 날짜가 숙박 기간에 포함되고 travelPlans에 존재하는지 확인
      loadedAccommodationInfos.forEach((accommodation, index) => {
        if (!accommodation.checkIn || !accommodation.checkOut) return;
        
        const hotelId = accommodation.hotel?.hotel_id || accommodation.hotel_id;
        const accommodationKey = `${hotelId}-${accommodation.checkIn}-${accommodation.checkOut}`;
        
        // travelPlans에서 삭제된 숙박편은 제외
        if (!existingAccommodationIds.has(accommodationKey)) {
          console.log('Accommodation deleted from travelPlans, skipping:', accommodationKey);
          return;
        }
        
        // 이미 추가된 숙박편인지 확인 (중복 방지)
        if (addedAccommodationKeys.has(accommodationKey)) {
          console.log('[accommodationsToShow] loadedAccommodationInfos에서 중복 숙박편 스킵:', accommodationKey);
          return;
        }
        
        const checkInDate = parseDate(accommodation.checkIn);
        const checkOutDate = parseDate(accommodation.checkOut);
        checkInDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(0, 0, 0, 0);
        
        // 현재 날짜가 체크인 날짜부터 체크아웃 날짜까지의 기간에 포함되는지 확인
        const isInStayPeriod = currentDate.getTime() >= checkInDate.getTime() && 
                              currentDate.getTime() <= checkOutDate.getTime();
        
        if (isInStayPeriod) {
          // 중복 방지 키 추가
          addedAccommodationKeys.add(accommodationKey);
          accommodationsForDay.push({
            ...accommodation,
            id: `accommodation-loaded-${index}-${selectedDay}`,
            source: 'loadedAccommodationInfos' // 출처 표시
          });
          console.log('[accommodationsToShow] loadedAccommodationInfos에서 숙박편 추가:', accommodationKey);
        }
      });
    }
    
    console.log('[accommodationsToShow] 최종 결과:', {
      selectedDay,
      currentDate: currentDate.toISOString().split('T')[0],
      totalFound: accommodationsForDay.length,
      accommodations: accommodationsForDay.map(acc => ({
        id: acc.id,
        name: acc.hotel?.hotel_name || acc.hotel_name,
        checkIn: acc.checkIn,
        checkOut: acc.checkOut,
        source: acc.source
      })),
      addedKeys: Array.from(addedAccommodationKeys)
    });
    return accommodationsForDay;
  }, [currentPlan.schedules, dayOrder, travelPlans, selectedDay, startDate, loadedAccommodationInfos]);

  useEffect(() => {
    if (currentPlan && currentPlan.title) {
      setTempTitle(currentPlan.title);
    }
  }, [selectedDay, currentPlan?.title]);

  useEffect(() => {
    const updatedPlans = updateFlightScheduleDetails(travelPlans, airportInfoCache, loadedFlightInfo);
    if (updatedPlans) {
      console.log('[TravelPlanner] useEffect updated flight schedule details');
      setTravelPlans(updatedPlans);
    }
  }, [travelPlans, airportInfoCache, loadedFlightInfo, updateFlightScheduleDetails, setTravelPlans]);

  // travelPlans가 변경될 때마다 loadedAccommodationInfo 업데이트
  useEffect(() => {
    console.log('Updating loadedAccommodationInfo. Current travelPlans:', travelPlans);
    
    // 전체 일정에서 체크인 정보 찾기
    for (const dayKey of dayOrder) {
      const dayPlan = travelPlans[dayKey];
      if (dayPlan?.schedules) {
        const checkIn = dayPlan.schedules.find(
          s => s.type === 'accommodation' && s.time === '체크인'
        );
        if (checkIn?.hotelDetails) {
          console.log('Setting loadedAccommodationInfo from check-in:', checkIn.hotelDetails);
          setLoadedAccommodationInfo(checkIn.hotelDetails);
          return;
        }
      }
    }
    
    // 체크인이 없으면 현재 날짜의 숙소 정보 사용
    if (currentPlan?.schedules) {
      const accommodation = currentPlan.schedules.find(s => s.type === 'accommodation');
      if (accommodation?.hotelDetails) {
        console.log('Setting loadedAccommodationInfo from current day:', accommodation.hotelDetails);
        setLoadedAccommodationInfo(accommodation.hotelDetails);
      } else {
        console.log('No accommodation found, setting loadedAccommodationInfo to null');
        setLoadedAccommodationInfo(null);
      }
    }
  }, [currentPlan?.schedules, dayOrder, travelPlans, selectedDay]);

  /* ---------- 날짜 동기화 ---------- */
  useEffect(() => {
    if (!startDate) return;

    // 체크아웃 = 시작일 + (일정 일수 - 1)
    const calcCheckOut = () => {
      const days = dayOrder?.length || 1;
      const d = startDate instanceof Date ? new Date(startDate) : (startDate ? new Date(startDate) : new Date());
      if (isNaN(d.getTime())) return new Date();
      d.setDate(d.getDate() + Math.max(days - 1, 0));
      return d;
    };

    // 숙소 계획 폼 날짜 동기화
    setAccommodationFormData(prev => {
      if (!prev) return prev;
      const newCheckIn = prev.checkIn instanceof Date ? prev.checkIn : (prev.checkIn ? new Date(prev.checkIn) : startDate);
      const newCheckOut = prev.checkOut instanceof Date ? prev.checkOut : (prev.checkOut ? new Date(prev.checkOut) : calcCheckOut());
      if (isNaN(newCheckIn.getTime())) return prev;
      if (isNaN(newCheckOut.getTime())) return prev;
      const baseStart = startDate instanceof Date ? startDate : (startDate ? new Date(startDate) : new Date());
      if (isNaN(baseStart.getTime())) return prev;
      const needUpdate = newCheckIn.getTime() !== baseStart.getTime() || newCheckOut.getTime() !== calcCheckOut().getTime();
      if (!needUpdate) return prev;
      return { ...prev, checkIn: baseStart, checkOut: calcCheckOut() };
    });

    // 비행 검색 파라미터 날짜 동기화
    setFlightSearchParams(prev => {
      if (!prev) return prev;
      const newDeparture = prev.departureDate instanceof Date ? prev.departureDate : (prev.departureDate ? new Date(prev.departureDate) : null);
      const newReturn = prev.returnDate instanceof Date ? prev.returnDate : (prev.returnDate ? new Date(prev.returnDate) : null);
      if (newDeparture && isNaN(newDeparture.getTime())) return prev;
      if (newReturn && isNaN(newReturn.getTime())) return prev;
      const baseStart = startDate instanceof Date ? startDate : (startDate ? new Date(startDate) : new Date());
      if (isNaN(baseStart.getTime())) return prev;
      const targetReturn = dayOrder.length > 1 ? calcCheckOut() : null;
      const needUpdate = !newDeparture || newDeparture.getTime() !== baseStart.getTime() || (
        (targetReturn && !newReturn) || (targetReturn && newReturn && newReturn.getTime() !== targetReturn.getTime()) || (!targetReturn && newReturn)
      );
      if (!needUpdate) return prev;
      return { ...prev, departureDate: baseStart, returnDate: targetReturn };
    });
  }, [startDate, dayOrder, setAccommodationFormData, setFlightSearchParams]);

  // 여행 계획이 최소 1박 2일(2일치 dayOrder와 travelPlans)로 생성되도록 보장
  useEffect(() => {
    if (startDate && dayOrder.length < 2) {
      // 최소 2일이 되도록 dayOrder와 travelPlans를 확장
      const newDayOrder = dayOrder.length === 0 ? ['1', '2'] : (dayOrder.length === 1 ? [dayOrder[0], (parseInt(dayOrder[0]) + 1).toString()] : dayOrder);
      const newTravelPlans = { ...travelPlans };
      newDayOrder.forEach((dayKey, idx) => {
        if (!newTravelPlans[dayKey]) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + idx);
          newTravelPlans[dayKey] = {
            title: `${date.getMonth() + 1}/${date.getDate()}`,
            schedules: []
          };
        }
      });
      setDayOrder(newDayOrder);
      setTravelPlans(newTravelPlans);
    }
  }, [startDate, dayOrder, travelPlans, setDayOrder, setTravelPlans]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const getDayTitle = useCallback((dayNumber) => {
    return plannerGetDayTitle(dayNumber);
  }, [plannerGetDayTitle]);
  
    const handleDayDragEnd = (result) => {
    if (!result.destination) return;

    const newDayOrder = Array.from(dayOrder);
    const [reorderedDayKey] = newDayOrder.splice(result.source.index, 1);
    newDayOrder.splice(result.destination.index, 0, reorderedDayKey);

    const newTravelPlans = {};
    newDayOrder.forEach((dayKey, index) => {
      const originalPlan = travelPlans[dayKey];
      if (originalPlan) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + index);
        newTravelPlans[(index + 1).toString()] = {
          ...originalPlan,
          title: formatDateFns(date, 'M/d') + (originalPlan.title.replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim() ? ` ${originalPlan.title.replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim()}` : '')
        };
      }
    });
    setDayOrder(Object.keys(newTravelPlans));
    setTravelPlans(newTravelPlans);
    setSelectedDay(result.destination.index + 1);
  };

  const handleScheduleClick = (schedule) => {
    if (schedule.lat && schedule.lng) {
      setSelectedLocation({
        lat: schedule.lat,
        lng: schedule.lng
      });
    }
  };

  const renderScheduleItem = (schedule, index) => {
    const dragHandleStyle = { 
        display:'flex', 
        alignItems:'center', 
        marginRight: '8px',
        cursor:'grab' 
    };

    // 숙박 일정인 경우 다른 스타일 적용
    if (schedule.type === 'accommodation') {
      return (
        <Draggable key={schedule.id || `${selectedDay}-${index}`} draggableId={schedule.id || `${selectedDay}-${index}`} index={index}>
          {(provided) => (
            <Box
              ref={provided.innerRef}
              {...provided.draggableProps}
              sx={{ 
                display: 'flex', 
                alignItems: 'stretch', 
                mb: 1 
              }}
            >
              <div {...provided.dragHandleProps} style={dragHandleStyle}>
                <DragIndicatorIcon color="action" />
              </div>
              <Paper
                sx={{ 
                  p: 1.5, 
                  flexGrow: 1, 
                  border: 1, borderColor: 'divider', borderRadius: 1,
                  bgcolor: '#fff0e6',
                  '&:hover': { boxShadow: 3, borderColor: 'primary.main' },
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (schedule.hotelDetails) {
                    // 현재 날짜 계산
                    const currentDate = new Date(startDate);
                    currentDate.setDate(currentDate.getDate() + selectedDay - 1);
                    
                    // 같은 날의 다른 숙박편들 찾기
                    const sameDayAccommodations = findSameDayAccommodations(currentDate);
                    
                    // 다중 숙박편 정보가 있으면 함께 전달
                    const accommodationToShow = {
                      ...schedule.hotelDetails,
                      sameDayAccommodations: sameDayAccommodations.length > 1 ? sameDayAccommodations : null
                    };
                    
                    dialogHandlers.handleOpenAccommodationDetail(accommodationToShow);
                  } else {
                    handleScheduleClick(schedule);
                  }
                }}
              >
                <Grid container spacing={1} alignItems="center" sx={{ height: '100%' }}>
                  <Grid item xs sm={8} md={9}> 
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#5D4037' }}>
                      {schedule.time} {schedule.name}
                    </Typography>
                    {schedule.address && (
                      <Typography variant="body2" color="text.primary" sx={{fontSize: '0.8rem'}}>
                        {schedule.address}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{fontSize: '0.8rem'}}>
                      {schedule.category}
                      {schedule.duration && ` • ${schedule.duration}`}
                    </Typography>
                    {schedule.notes && (
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5, whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                        📝 {schedule.notes}
                      </Typography>
                    )}
                    {/* roomList 표시 */}
                    {schedule.hotelDetails?.roomList && schedule.hotelDetails.roomList.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>객실 목록</Typography>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {schedule.hotelDetails.roomList.map((room, idx) => (
                            <li key={room.id || idx} style={{ fontSize: '0.8rem' }}>
                              {room.name} {room.price ? `- ${room.price}${room.currency ? ` ${room.currency}` : ''}` : ''}
                            </li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </Grid>
                  <Grid item xs="auto" sm={4} md={3} sx={{ textAlign: 'right' }}> 
                    <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); handleEditScheduleOpen(schedule); }} sx={{ mb: 0.5, p:0.5 }}>
                      <EditIcon fontSize="small"/>
                    </IconButton>
                    <IconButton edge="end" aria-label="delete" onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id); }} sx={{p:0.5}}>
                      <DeleteIcon fontSize="small"/>
                    </IconButton>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          )}
        </Draggable>
      );
    }

    // 일반 일정 항목 (Paper와 Grid 사용)
    return (
      <Draggable key={schedule.id || `${selectedDay}-${index}`} draggableId={schedule.id || `${selectedDay}-${index}`} index={index}>
        {(provided) => (
          <Box // Draggable 루트 요소
            ref={provided.innerRef}
            {...provided.draggableProps}
            sx={{ 
              display: 'flex', 
              alignItems: 'stretch', 
              mb: 1 
            }}
          >
            <div {...provided.dragHandleProps} style={dragHandleStyle}>
              <DragIndicatorIcon color="action" />
            </div>
            <Paper // 일반 일정 콘텐츠 영역
              sx={{ 
                p: 1.5, 
                flexGrow: 1, 
                border: 1, borderColor: 'divider', borderRadius: 1,
                bgcolor: 'background.paper',
                '&:hover': { boxShadow: 3, borderColor: 'primary.main' },
                // 일반 일정은 Paper 전체 클릭 이벤트 없음 (필요 시 추가)
              }}
            >
              <Grid container spacing={1} alignItems="center" sx={{ height: '100%' }}>
                <Grid item xs sm={8} md={9}> 
                  <Typography variant="subtitle1" sx={{ fontWeight: schedule.category === 'UserAdded' || schedule.type === 'custom' ? 'normal': 'bold' }}>
                    {schedule.time} {schedule.name}
                  </Typography>
                  {schedule.address && (
                      <Typography variant="body2" color="text.primary" sx={{fontSize: '0.8rem'}}>
                          {schedule.address}
                      </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{fontSize: '0.8rem'}}>
                    {schedule.category}
                    {schedule.duration && ` • ${schedule.duration}`}
                  </Typography>
                  {schedule.notes && (
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5, whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                      📝 {schedule.notes}
                      </Typography>
                  )}
                </Grid>
                <Grid item xs="auto" sm={4} md={3} sx={{ textAlign: 'right' }}> 
                  <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); handleEditScheduleOpen(schedule); }} sx={{ mb: 0.5, p:0.5 }}>
                      <EditIcon fontSize="small"/>
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id); }} sx={{p:0.5}}>
                      <DeleteIcon fontSize="small"/>
                  </IconButton>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        )}
      </Draggable>
    );
  };
  
  const onAddFlightToSchedule = useCallback((flightOffer, newDictionaries, newAirportCache) => {
    handleAddFlightToSchedule(flightOffer, newDictionaries, newAirportCache, travelPlans, dayOrder, getDayTitle, setTravelPlans);
  }, [handleAddFlightToSchedule, travelPlans, dayOrder, getDayTitle, setTravelPlans]);

  const onAddPlace = useCallback((place) => {
    handleAddPlace(place);
    dialogHandlers.setIsSearchOpen(false);
  }, [handleAddPlace, dialogHandlers]);



  // 같은 날에 체크아웃과 체크인이 있는 숙박편들을 찾는 함수
  const findSameDayAccommodations = useCallback((targetDate) => {
    if (!loadedAccommodationInfos || loadedAccommodationInfos.length <= 1) {
      return [];
    }

    const targetDateStr = targetDate.toISOString().split('T')[0];
    const sameDayAccommodations = [];

    loadedAccommodationInfos.forEach(accommodation => {
      const checkInDate = new Date(accommodation.checkIn);
      const checkOutDate = new Date(accommodation.checkOut);
      const checkInDateStr = checkInDate.toISOString().split('T')[0];
      const checkOutDateStr = checkOutDate.toISOString().split('T')[0];

      // 해당 날짜에 체크인 또는 체크아웃이 있는 숙박편 찾기
      if (checkInDateStr === targetDateStr || checkOutDateStr === targetDateStr) {
        sameDayAccommodations.push({
          ...accommodation,
          isCheckIn: checkInDateStr === targetDateStr,
          isCheckOut: checkOutDateStr === targetDateStr
        });
      }
    });

    return sameDayAccommodations;
  }, [loadedAccommodationInfos]);

  // 사이드바 <-> 메인 AccommodationPlan 연동 핸들러
  const handleSidebarPlaceSelect = useCallback((place) => {
    if (mainAccommodationPlanRef.current && typeof mainAccommodationPlanRef.current.handlePlaceSelect === 'function') {
      mainAccommodationPlanRef.current.handlePlaceSelect(place);
      // 장소 선택 후 숙소 탭으로 자동 전환 및 검색 실행 고려 (기존 코드 참고)
      setSidebarTab('accommodation'); // 사용자가 숙소 관련 액션을 했으므로 숙소 탭으로 이동
      // 필요하다면, 여기서 바로 검색을 트리거하거나, 사용자가 검색 버튼을 누르도록 유도할 수 있습니다.
      // 예: mainAccommodationPlanRef.current.handleSearch(); 
    } else {
      console.warn('mainAccommodationPlanRef.current.handlePlaceSelect is not a function or ref is not set');
    }
  }, []);

  const handleSidebarSearch = useCallback(() => {
    if (mainAccommodationPlanRef.current && typeof mainAccommodationPlanRef.current.handleSearch === 'function') {
      mainAccommodationPlanRef.current.handleSearch();
    } else {
      console.warn('mainAccommodationPlanRef.current.handleSearch is not a function or ref is not set');
    }
  }, []);

  const handleSidebarOpenSearchPopup = useCallback(() => {
    if (mainAccommodationPlanRef.current && typeof mainAccommodationPlanRef.current.openSearchPopup === 'function') {
      mainAccommodationPlanRef.current.openSearchPopup();
    } else {
      console.warn('mainAccommodationPlanRef.current.openSearchPopup is not a function or ref is not set');
    }
  }, []);

  // 실제 숙소를 일정에 추가하는 함수 (useAccommodationHandlers 훅 사용)
  const onAddAccommodationToSchedule = useCallback((hotelToAdd) => {
    console.log('[TravelPlanner] 숙박편 추가 시작:', hotelToAdd);
    
    addAccommodationToSchedule(
      hotelToAdd,
      getDayTitle,
      (updater) => {
        setTravelPlans(prev => {
          const updated = typeof updater === 'function' ? updater(prev) : updater;
          console.log('[TravelPlanner] 숙박편 추가 후 travelPlans 업데이트:', updated);
          
          // 상태 업데이트 후 즉시 리렌더링 트리거
          setTimeout(() => {
            setSelectedDay(prev => prev); // 같은 값으로 set해도 리렌더링 트리거
            console.log('[TravelPlanner] 숙박편 추가 후 selectedDay 리렌더링 트리거');
          }, 0);
          
          return updated;
        });
      },
      startDate,
      dayOrder,
      setLoadedAccommodationInfo
    );
  }, [addAccommodationToSchedule, getDayTitle, setTravelPlans, startDate, dayOrder, setLoadedAccommodationInfo]);

  // AI 메시지 핸들러 (useAIMessageHandler 훅 사용)
  const handleAISendMessage = useAIMessageHandler(
    {
      planId,
      dayOrder,
      travelPlans,
      startDate,
      loadedFlightInfo,
      loadedFlightInfos, // 다중 항공편
      isRoundTrip,
      loadedAccommodationInfos // 다중 숙박편
    },
    {
      setPlanId,
      setTravelPlans,
      setDayOrder
    }
  );

  const forceRefreshSelectedDay = useCallback(() => {
    setSelectedDay(prev => prev); // 같은 값으로 set해도 리렌더링 트리거
  }, [setSelectedDay]);

  useEffect(() => {
    if (sidebarTab === 'schedule') {
      const prev = selectedDay;
      setSelectedDay(null);
      setTimeout(() => setSelectedDay(prev), 0);
    }
  }, [sidebarTab]);

  useEffect(() => {
    setMapResizeTrigger(v => v + 1);
  }, [isSidebarOpen]);

  // 저장/수정 버튼 클릭 핸들러
  const handleSaveOrUpdate = useCallback(async () => {
    if (planId && !isNaN(Number(planId))) {
      // 수정 모드: 다이얼로그 없이 바로 수정
      const success = await plannerHandleImmediateUpdate();
      if (success) {
        // 성공 메시지 표시
        alert('여행 계획이 성공적으로 수정되었습니다!');
        console.log('[TravelPlanner] 여행 계획이 성공적으로 수정되었습니다.');
      }
    } else {
      // 새로 저장 모드: 다이얼로그 열기
      openSaveDialog();
    }
  }, [planId, plannerHandleImmediateUpdate, openSaveDialog]);

  // 숙박편 삭제 핸들러
  const handleDeleteAccommodation = useCallback((accommodation) => {
    console.log('[TravelPlanner] 숙박편 삭제:', accommodation);
    
    // 삭제할 숙박편의 고유 식별자 확인
    const targetHotelId = accommodation.hotel?.hotel_id || 
                         accommodation.hotel_id ||
                         accommodation.id;
    
    const targetCheckIn = accommodation.checkIn;
    const targetCheckOut = accommodation.checkOut;
    
    console.log('[TravelPlanner] 삭제 대상:', { targetHotelId, targetCheckIn, targetCheckOut });
    
    // 모든 날짜에서 해당 숙박편과 관련된 일정 제거
    const updatedTravelPlans = { ...travelPlans };
    
    dayOrder.forEach(dayKey => {
      if (updatedTravelPlans[dayKey] && updatedTravelPlans[dayKey].schedules) {
        updatedTravelPlans[dayKey].schedules = updatedTravelPlans[dayKey].schedules.filter(schedule => {
          // 숙박 타입이면서 같은 호텔이고 같은 체크인/체크아웃 날짜인 경우 제거
          if (schedule.type === 'accommodation') {
            const scheduleHotelId = schedule.hotelDetails?.hotel?.hotel_id || 
                                   schedule.hotelDetails?.hotel_id ||
                                   schedule.hotelId;
            const scheduleCheckIn = schedule.hotelDetails?.checkIn;
            const scheduleCheckOut = schedule.hotelDetails?.checkOut;
            
            // 같은 호텔이고 같은 체크인/체크아웃 날짜인 경우 제거
            const isSameAccommodation = scheduleHotelId === targetHotelId &&
                                       scheduleCheckIn === targetCheckIn &&
                                       scheduleCheckOut === targetCheckOut;
            
            console.log('[TravelPlanner] 일정 비교:', {
              scheduleHotelId, scheduleCheckIn, scheduleCheckOut,
              isSameAccommodation
            });
            
            return !isSameAccommodation;
          }
          return true;
        });
      }
    });
    
    setTravelPlans(updatedTravelPlans);
    console.log('[TravelPlanner] 숙박편 삭제 완료');
  }, [travelPlans, dayOrder, setTravelPlans]);

  // 항공편 삭제 핸들러
  const handleDeleteFlight = useCallback((flightSchedule) => {
    console.log('[TravelPlanner] 항공편 삭제:', flightSchedule);
    
    // 해당 항공편 일정을 삭제
    handleDeleteSchedule(flightSchedule.id);
    console.log('[TravelPlanner] 항공편 삭제 완료');
  }, [handleDeleteSchedule]);



  if (!user && !process.env.REACT_APP_SKIP_AUTH) {
    return <Typography>로그인이 필요합니다.</Typography>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', position: 'relative' }}>
        <TravelPlannerSidebar
          isSidebarOpen={isSidebarOpen}
          sidebarTab={sidebarTab}
          setSidebarTab={setSidebarTab}
          dayOrder={dayOrder}
          travelPlans={travelPlans}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          getDayTitle={getDayTitle}
          plannerAddDay={plannerAddDay}
          plannerRemoveDay={plannerRemoveDay}
          handleOpenDateEditDialog={() => dialogHandlers.handleOpenDateEditDialog(startDate)}
          handleDayDragEnd={handleDayDragEnd}
          handleSaveOrUpdate={handleSaveOrUpdate}
          isSaving={isSaving}
          saveError={saveError}
          planId={planId}
          // 숙소 관련 props
          sidebarAccommodationPlanRef={sidebarAccommodationPlanRef}
          accommodationFormData={accommodationFormData}
          setAccommodationFormData={setAccommodationFormData}
          handleSidebarPlaceSelect={handleSidebarPlaceSelect}
          handleSidebarSearch={handleSidebarSearch}
          handleSidebarOpenSearchPopup={handleSidebarOpenSearchPopup}
          handleHotelSearchResults={handleHotelSearchResults}
          handleHotelSelect={handleHotelSelect}
          onAddAccommodationToSchedule={onAddAccommodationToSchedule}
          dayOrderLength={dayOrder.length}
          forceRefreshSelectedDay={forceRefreshSelectedDay}
          // 유효성 검사를 위한 추가 props
          startDate={startDate}
          // 항공편 관련 props
          flightSearchParams={flightSearchParams}
          setFlightSearchParams={setFlightSearchParams}
          originCities={originCities}
          destinationCities={destinationCities}
          originSearchQuery={originSearchQuery}
          setOriginSearchQuery={setOriginSearchQuery}
          destinationSearchQuery={destinationSearchQuery}
          setDestinationSearchQuery={setDestinationSearchQuery}
          handleCitySearch={handleCitySearch}
          flightResults={flightResults}
          flightDictionaries={flightDictionaries}
          airportInfoCache={airportInfoCache}
          loadingAirportInfo={loadingAirportInfo}
          isLoadingCities={isLoadingCities}
          isLoadingFlights={isLoadingFlights}
          flightError={flightError}
          handleFlightSearch={handleFlightSearch}
          onAddFlightToSchedule={onAddFlightToSchedule}
        />

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TravelPlannerHeader
            toggleSidebar={toggleSidebar}
            sidebarTab={sidebarTab}
            isEditingPlanTitle={isEditingPlanTitle}
            setIsEditingPlanTitle={setIsEditingPlanTitle}
            tempPlanTitle={tempPlanTitle}
            setTempPlanTitle={setTempPlanTitle}
            planTitle={planTitle}
            setPlanTitle={setPlanTitle}
            setPlanName={setPlanName}
            planId={planId}
            plannerHandleUpdatePlanTitle={plannerHandleUpdatePlanTitle}
          />

          <TravelPlannerMainContent
            sidebarTab={sidebarTab}
            currentPlan={currentPlan}
            editTitleMode={editTitleMode}
            setEditTitleMode={setEditTitleMode}
            tempTitle={tempTitle}
            setTempTitle={setTempTitle}
            setTravelPlans={setTravelPlans}
            selectedDay={selectedDay}
            showAllMarkers={showAllMarkers}
            setShowAllMarkers={setShowAllMarkers}
            showMap={showMap}
            setShowMap={setShowMap}
            handleOpenShareDialog={dialogHandlers.handleOpenShareDialog}
            setIsSearchOpen={dialogHandlers.setIsSearchOpen}
            accommodationsToShow={accommodationsToShow}
            findSameDayAccommodations={findSameDayAccommodations}
            handleOpenAccommodationDetail={dialogHandlers.handleOpenAccommodationDetail}
            handleScheduleDragEnd={handleScheduleDragEnd}
            renderScheduleItem={renderScheduleItem}
            hideFlightMarkers={hideFlightMarkers}
            selectedLocation={selectedLocation}
            mapResizeTrigger={mapResizeTrigger}
            // 삭제 핸들러
            handleDeleteAccommodation={handleDeleteAccommodation}
            handleDeleteFlight={handleDeleteFlight}
            // 숙소 관련 props
            mainAccommodationPlanRef={mainAccommodationPlanRef}
            accommodationFormData={accommodationFormData}
            setAccommodationFormData={setAccommodationFormData}
            handleHotelSearchResults={handleHotelSearchResults}
            handleHotelSelect={handleHotelSelect}
            onAddAccommodationToSchedule={onAddAccommodationToSchedule}
            dayOrder={dayOrder}
            forceRefreshSelectedDay={forceRefreshSelectedDay}
            isSidebarOpen={isSidebarOpen}
            // 유효성 검사를 위한 추가 props
            startDate={startDate}
            travelPlans={travelPlans}
            // 항공편 관련 props
            flightSearchParams={flightSearchParams}
            setFlightSearchParams={setFlightSearchParams}
            originCities={originCities}
            destinationCities={destinationCities}
            originSearchQuery={originSearchQuery}
            setOriginSearchQuery={setOriginSearchQuery}
            destinationSearchQuery={destinationSearchQuery}
            setDestinationSearchQuery={setDestinationSearchQuery}
            handleCitySearch={handleCitySearch}
            flightResults={flightResults}
            flightDictionaries={flightDictionaries}
            airportInfoCache={airportInfoCache}
            loadingAirportInfo={loadingAirportInfo}
            isLoadingCities={isLoadingCities}
            isLoadingFlights={isLoadingFlights}
            flightError={flightError}
            handleFlightSearch={handleFlightSearch}
            onAddFlightToSchedule={onAddFlightToSchedule}
            handleOpenPlannerFlightDetail={dialogHandlers.handleOpenPlannerFlightDetail}
          />
        </Box>

        <TravelPlannerDialogs
          // 검색 다이얼로그
          isSearchOpen={dialogHandlers.isSearchOpen}
          setIsSearchOpen={dialogHandlers.setIsSearchOpen}
          onAddPlace={onAddPlace}
          // 일정 수정 다이얼로그
          editDialogOpen={editDialogOpen}
          setEditDialogOpen={setEditDialogOpen}
          editSchedule={editSchedule}
          setEditSchedule={setEditSchedule}
          handleUpdateSchedule={handleUpdateSchedule}
          // 날짜 수정 다이얼로그
          isDateEditDialogOpen={dialogHandlers.isDateEditDialogOpen}
          setIsDateEditDialogOpen={dialogHandlers.setIsDateEditDialogOpen}
          tempStartDate={dialogHandlers.tempStartDate}
          handleTempDateChange={dialogHandlers.handleTempDateChange}
          handleConfirmDateChange={() => dialogHandlers.handleConfirmDateChange(plannerHandleDateChange)}
          // 저장 다이얼로그
          isSaveDialogOpen={isSaveDialogOpen}
          closeSaveDialog={closeSaveDialog}
          planTitleForSave={planTitleForSave}
          setPlanTitleForSave={setPlanTitleForSave}
          isSaving={isSaving}
          plannerHandleSaveConfirm={plannerHandleSaveConfirm}
          // 항공편 상세 다이얼로그
          isPlannerFlightDetailOpen={dialogHandlers.isPlannerFlightDetailOpen}
          handleClosePlannerFlightDetail={dialogHandlers.handleClosePlannerFlightDetail}
          selectedFlightForPlannerDialog={dialogHandlers.selectedFlightForPlannerDialog}
          flightDictionaries={flightDictionaries}
          airportInfoCache={airportInfoCache}
          loadingAirportInfo={loadingAirportInfo}
          // 숙박 상세 다이얼로그
          isAccommodationDetailOpen={dialogHandlers.isAccommodationDetailOpen}
          handleCloseAccommodationDetail={dialogHandlers.handleCloseAccommodationDetail}
          selectedAccommodationForDialog={dialogHandlers.selectedAccommodationForDialog}
          // 공유 다이얼로그
          isShareDialogOpen={dialogHandlers.isShareDialogOpen}
          handleCloseShareDialog={dialogHandlers.handleCloseShareDialog}
          sharedEmail={dialogHandlers.sharedEmail}
          setSharedEmail={dialogHandlers.setSharedEmail}
          shareMessage={dialogHandlers.shareMessage}
          isSharing={dialogHandlers.isSharing}
          handleSharePlan={() => dialogHandlers.handleSharePlan(plannerHandleSharePlan, planId)}
        />

        <AIChatWidget onSendMessage={handleAISendMessage} />
      </Box>
    </LocalizationProvider>
  );
};

export default TravelPlanner;
