import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, IconButton, Tabs, Tab, List, ListItem, ListItemText, Divider,
  Grid, Rating
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { format as formatDateFns } from 'date-fns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import useTravelPlanLoader from './hooks/useTravelPlanLoader';
import useFlightHandlers from './hooks/useFlightHandlers';
import usePlannerActions from './hooks/usePlannerActions';
import useAccommodationHandlers from './hooks/useAccommodationHandlers';
import useAIMessageHandler from './hooks/useAIMessageHandler';
import AccommodationPlan from '../../components/AccommodationPlan';
import FlightPlanComponent from '../../components/FlightPlan';
import MapboxComponent from '../../components/MapboxComponent';
import SearchPopup from '../../components/SearchPopup';
import {
    formatPrice,
    renderFareDetails,
    renderItineraryDetails
} from '../../utils/flightFormatters';
import AIChatWidget from './components/AIChatWidget';
import { useParams } from 'react-router-dom';

const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props}>{children}</Droppable>;
};

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
    isLoadingPlan,
    loadedFlightInfo,
    loadedFlightInfos, // 다중 항공편
    isRoundTrip,
    loadError,
    loadedAccommodationInfos // 다중 숙박편
  } = useTravelPlanLoader(user, planIdFromUrl, loadMode);

  const {
    flightSearchParams, setFlightSearchParams,
    originCities, destinationCities,
    isLoadingCities, isLoadingFlights,
    flightResults, flightDictionaries, flightError,
    handleCitySearch, handleFlightSearch,
    airportInfoCache, loadingAirportInfo,
    setFlightDictionaries, setAirportInfoCache,
    originSearchQuery, setOriginSearchQuery,
    destinationSearchQuery, setDestinationSearchQuery,
    handleAddFlightToSchedule,
    updateFlightScheduleDetails
  } = useFlightHandlers();

  const {
    accommodationFormData,
    setAccommodationFormData,
    hotelSearchResults,
    setHotelSearchResults,
    selectedHotel,
    setSelectedHotel,
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState('schedule');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [hideFlightMarkers, setHideFlightMarkers] = useState(true);
  const [isDateEditDialogOpen, setIsDateEditDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(null);
  const [editTitleMode, setEditTitleMode] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [loadedAccommodationInfo, setLoadedAccommodationInfo] = useState(null);
  const [mapResizeTrigger, setMapResizeTrigger] = useState(0);

  const mainAccommodationPlanRef = useRef(null);
  const sidebarAccommodationPlanRef = useRef(null);
  
  const [selectedFlightForPlannerDialog, setSelectedFlightForPlannerDialog] = useState(null);
  const [isPlannerFlightDetailOpen, setIsPlannerFlightDetailOpen] = useState(false);

  // 숙박 상세 팝업용 상태 추가
  const [selectedAccommodationForDialog, setSelectedAccommodationForDialog] = useState(null);
  const [isAccommodationDetailOpen, setIsAccommodationDetailOpen] = useState(false);

  // 계획 제목 관리를 위한 상태 추가
  const [planTitle, setPlanTitle] = useState('');
  const [isEditingPlanTitle, setIsEditingPlanTitle] = useState(false);
  const [tempPlanTitle, setTempPlanTitle] = useState('');

  // 플랜 공유 관련 상태 추가
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [sharedEmail, setSharedEmail] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);

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

  const accommodationToShow = useMemo(() => {
    console.log('Calculating accommodationToShow with:', {
      travelPlans,
      dayOrder,
      selectedDay,
      currentPlan
    });
    
    // 전체 일정에서 체크인 정보 찾기
    for (const dayKey of dayOrder) {
      const dayPlan = travelPlans[dayKey];
      if (dayPlan?.schedules) {
        // 체크인 정보 찾기
        const checkIn = dayPlan.schedules.find(
          s => s.type === 'accommodation' && s.time === '체크인'
        );
        if (checkIn) {
          console.log('Found check-in accommodation:', checkIn);
          return checkIn;
        }
      }
    }
    
    // 체크인이 없으면 현재 날짜의 숙소 정보 반환
    if (Array.isArray(currentPlan.schedules)) {
      const accommodation = currentPlan.schedules.find(s => s.type === 'accommodation');
      console.log('Found current day accommodation:', accommodation);
      return accommodation;
    }
    console.log('No accommodation found');
    return null;
  }, [currentPlan.schedules, dayOrder, travelPlans, selectedDay]);

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
  
  const handleOpenDateEditDialog = () => {
    setTempStartDate(startDate);
    setIsDateEditDialogOpen(true);
  };

  const handleTempDateChange = (newDate) => {
    setTempStartDate(newDate);
  };

  const handleConfirmDateChange = () => {
    if (tempStartDate) {
      plannerHandleDateChange(tempStartDate);
    }
    setIsDateEditDialogOpen(false);
  };
  
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

  const [selectedLocation, setSelectedLocation] = useState(null);

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
                    
                    handleOpenAccommodationDetail(accommodationToShow);
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
    setIsSearchOpen(false);
  }, [handleAddPlace, setIsSearchOpen]);

  const handleOpenPlannerFlightDetail = useCallback((flightScheduleItem) => {
    if (flightScheduleItem?.flightOfferDetails?.flightOfferData) {
      setSelectedFlightForPlannerDialog(flightScheduleItem.flightOfferDetails);
      setIsPlannerFlightDetailOpen(true);
    } else {
      console.warn('Flight detail not found in schedule item:', flightScheduleItem);
    }
  }, []);
  
  const handleClosePlannerFlightDetail = useCallback(() => {
    setIsPlannerFlightDetailOpen(false);
    setSelectedFlightForPlannerDialog(null);
  }, []);

  // 숙박 상세 팝업 핸들러 추가
  const handleOpenAccommodationDetail = useCallback((accommodationData = null) => {
    // 특정 숙박편 데이터가 전달된 경우 해당 데이터 사용
    if (accommodationData) {
      setSelectedAccommodationForDialog(accommodationData);
      setIsAccommodationDetailOpen(true);
      return;
    }
    
    // 기본 동작: 현재 로드된 숙박편 정보 사용
    if (loadedAccommodationInfo) {
      setSelectedAccommodationForDialog(loadedAccommodationInfo);
      setIsAccommodationDetailOpen(true);
    }
  }, [loadedAccommodationInfo]);

  const handleCloseAccommodationDetail = useCallback(() => {
    setIsAccommodationDetailOpen(false);
    setSelectedAccommodationForDialog(null);
  }, []);

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
    addAccommodationToSchedule(
      hotelToAdd,
      getDayTitle,
      (updater) => {
        setTravelPlans(prev => {
          const updated = typeof updater === 'function' ? updater(prev) : updater;
          setTimeout(() => setSelectedDay(selectedDay), 0);
          return updated;
        });
      },
      startDate,
      dayOrder,
      setLoadedAccommodationInfo
    );
  }, [addAccommodationToSchedule, getDayTitle, setTravelPlans, startDate, dayOrder, setLoadedAccommodationInfo, selectedDay]);

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

  // 플랜 공유 핸들러
  const handleOpenShareDialog = useCallback(() => {
    setIsShareDialogOpen(true);
    setShareMessage('');
  }, []);

  const handleCloseShareDialog = useCallback(() => {
    setIsShareDialogOpen(false);
    setSharedEmail('');
    setShareMessage('');
  }, []);

  const handleSharePlan = useCallback(async () => {
    if (!sharedEmail.trim()) {
      setShareMessage('공유할 이메일을 입력해주세요.');
      return;
    }

    if (!planId || planId === 'new') {
      setShareMessage('저장된 계획만 공유할 수 있습니다. 먼저 계획을 저장해주세요.');
      return;
    }

    setIsSharing(true);
    setShareMessage('');

    try {
      // 새로운 공유 전용 함수 사용 (기존 계획의 shared_email만 업데이트)
      const result = await plannerHandleSharePlan(sharedEmail.trim());
      
      if (result.success) {
        setShareMessage(result.message);
        setTimeout(() => {
          handleCloseShareDialog();
        }, 2000);
      } else {
        setShareMessage(result.message);
      }
    } catch (error) {
      console.error('플랜 공유 실패:', error);
      setShareMessage('플랜 공유 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSharing(false);
    }
  }, [sharedEmail, planId, plannerHandleSharePlan]);

  if (!user && !process.env.REACT_APP_SKIP_AUTH) {
    return <Typography>로그인이 필요합니다.</Typography>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', position: 'relative' }}>
        <Box
          sx={{
            width: isSidebarOpen ? '350px' : '0px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            overflowX: 'hidden',
            transition: 'width 0.3s ease',
            bgcolor: 'background.paper',
            boxShadow: 2,
            display: 'flex',
            flexDirection: 'column',
            visibility: isSidebarOpen ? 'visible' : 'hidden',
          }}
        >
          <Box sx={{ width: '350px', display: 'flex', flexDirection: 'column', height: '100%'}}>
            <Box sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Typography variant="h6" noWrap>여행 플래너</Typography>
            </Box>

            <Tabs
              value={sidebarTab}
              onChange={(e, newValue) => setSidebarTab(newValue)}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
            >
              <Tab label="여행 계획" value="schedule" />
              <Tab label="숙소 계획" value="accommodation" />
              <Tab label="비행 계획" value="flight" />
            </Tabs>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {sidebarTab === 'schedule' && (
                <>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={plannerAddDay}
                      fullWidth
                    >
                      날짜 추가
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleOpenDateEditDialog}
                    >
                      시작일 수정
                    </Button>
                  </Box>
                  <DragDropContext onDragEnd={handleDayDragEnd}>
                    <StrictModeDroppable droppableId="days-droppable-sidebar">
          {(provided) => (
                        <Box ref={provided.innerRef} {...provided.droppableProps} sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
              {dayOrder.map((dayKey, index) => {
                            const dayPlan = travelPlans[dayKey];
                            if (!dayPlan) return null;
                return (
                              <Draggable key={`day-${dayKey}`} draggableId={`day-${dayKey}`} index={index}>
                                {(providedDraggable) => (
                      <Paper
                                    ref={providedDraggable.innerRef}
                                    {...providedDraggable.draggableProps}
                                    {...providedDraggable.dragHandleProps}
                                    sx={{
                                      p: 1.5, cursor: 'pointer',
                                      bgcolor: selectedDay === parseInt(dayKey) ? 'primary.light' : 'background.paper',
                                      border: selectedDay === parseInt(dayKey) ? 2 : 1,
                                      borderColor: selectedDay === parseInt(dayKey) ? 'primary.main' : 'divider',
                                      boxShadow: providedDraggable.isDragging ? 6 : 1,
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}
                                    onClick={() => setSelectedDay(parseInt(dayKey))}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                      <DragIndicatorIcon sx={{ mr: 1, color: 'action.active' }} />
                                      <Typography variant="subtitle1">{dayPlan.title || getDayTitle(parseInt(dayKey))}</Typography>
                          </Box>
                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); plannerRemoveDay(parseInt(dayKey)); }}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                      </Paper>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
                        </Box>
                      )}
                    </StrictModeDroppable>
                  </DragDropContext>
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={handleSaveOrUpdate}
                      disabled={isSaving}
                    >
                      {isSaving 
                        ? (planId && !isNaN(Number(planId)) ? '수정 중...' : '저장 중...') 
                        : (planId && !isNaN(Number(planId)) ? '수정' : '저장')
                      }
                    </Button>
                    {saveError && (
                      <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                        {saveError}
                      </Typography>
                    )}
                  </Box>
                </>
              )}
              {sidebarTab === 'accommodation' && (
                <AccommodationPlan
                  ref={sidebarAccommodationPlanRef}
                  formData={accommodationFormData}
                  setFormData={setAccommodationFormData}
                  onPlaceSelect={handleSidebarPlaceSelect}
                  onSearch={handleSidebarSearch}
                  onOpenSearchPopup={handleSidebarOpenSearchPopup}
                  onSearchResults={handleHotelSearchResults}
                  onHotelSelect={handleHotelSelect}
                  travelPlans={travelPlans}
                  onAddToSchedule={onAddAccommodationToSchedule}
                  displayInMain={false}
                  dayOrderLength={dayOrder.length}
                  onForceRefreshDay={forceRefreshSelectedDay}
                  isSidebarOpen={isSidebarOpen}
                />
              )}
              {sidebarTab === 'flight' && (
                <FlightPlanComponent
                  fullWidth={false}
                  searchParams={flightSearchParams}
                  setSearchParams={setFlightSearchParams}
                  originCities={originCities}
                  destinationCities={destinationCities}
                  originSearchQuery={originSearchQuery}
                  setOriginSearchQuery={setOriginSearchQuery}
                  destinationSearchQuery={destinationSearchQuery}
                  setDestinationSearchQuery={setDestinationSearchQuery}
                  handleCitySearch={handleCitySearch}
                  flights={flightResults}
                  dictionaries={flightDictionaries}
                  airportInfoCache={airportInfoCache}
                  loadingAirportInfo={loadingAirportInfo}
                  isLoadingCities={isLoadingCities}
                  isLoadingFlights={isLoadingFlights}
                  error={flightError}
                  handleFlightSearch={handleFlightSearch}
                  onAddFlightToSchedule={onAddFlightToSchedule}
                />
              )}
            </Box>
          </Box>
        </Box>

        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Box sx={{
            bgcolor: 'background.paper',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider'
          }}>
            <Button
              variant="outlined"
              onClick={toggleSidebar}
              startIcon={<span className="text-xl">☰</span>}
              sx={{ mr: 2 }}
            >
              메뉴
            </Button>
            {sidebarTab === 'schedule' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                {isEditingPlanTitle ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      value={tempPlanTitle}
                      onChange={e => setTempPlanTitle(e.target.value)}
                      size="small"
                      autoFocus
                      onBlur={async () => {
                        if (planId && !isNaN(Number(planId))) {
                          const success = await plannerHandleUpdatePlanTitle(tempPlanTitle);
                          if (success) {
                            setPlanTitle(tempPlanTitle);
                            setPlanName(tempPlanTitle);
                          }
                        } else {
                          setPlanTitle(tempPlanTitle);
                        }
                        setIsEditingPlanTitle(false);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          if (planId && !isNaN(Number(planId))) {
                            const success = await plannerHandleUpdatePlanTitle(tempPlanTitle);
                            if (success) {
                              setPlanTitle(tempPlanTitle);
                              setPlanName(tempPlanTitle);
                            }
                          } else {
                            setPlanTitle(tempPlanTitle);
                          }
                          setIsEditingPlanTitle(false);
                        } else if (e.key === 'Escape') {
                          setTempPlanTitle(planTitle);
                          setIsEditingPlanTitle(false);
                        }
                      }}
                    />
                    <Button
                      size="small"
                      onClick={async () => {
                        if (planId && !isNaN(Number(planId))) {
                          const success = await plannerHandleUpdatePlanTitle(tempPlanTitle);
                          if (success) {
                            setPlanTitle(tempPlanTitle);
                            setPlanName(tempPlanTitle);
                          }
                        } else {
                          setPlanTitle(tempPlanTitle);
                        }
                        setIsEditingPlanTitle(false);
                      }}
                    >
                      저장
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setTempPlanTitle(planTitle);
                        setIsEditingPlanTitle(false);
                      }}
                    >
                      취소
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">{planTitle}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setTempPlanTitle(planTitle);
                        setIsEditingPlanTitle(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography variant="h6">
                {sidebarTab === 'accommodation' ? '숙소 검색 결과' : '항공편 검색 결과'}
              </Typography>
            )}
          </Box>

          <Box sx={{ flex: 1, p: 2, overflow: 'hidden', bgcolor: '#f4f6f8' }}>
            {sidebarTab === 'schedule' && currentPlan && (
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {editTitleMode ? (
                      <TextField
                        value={tempTitle}
                        onChange={e => setTempTitle(e.target.value)}
                        onBlur={() => {
                          setTravelPlans(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], title: tempTitle }}));
                          setEditTitleMode(false);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            setTravelPlans(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], title: tempTitle }}));
                            setEditTitleMode(false);
                          }
                        }}
                        size="small" autoFocus
                      />
                    ) : (
                      <>
                        <Typography variant="h5" sx={{ mr: 1 }}>{currentPlan.title}</Typography>
                        <IconButton size="small" onClick={() => setEditTitleMode(true)}><EditIcon fontSize="small" /></IconButton>
                      </>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setShowAllMarkers(v => !v)}
                    >
                      {showAllMarkers ? '선택 일정만 보기' : '모든 일정 보기'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setShowMap(v => !v)}
                    >
                      {showMap ? '지도 숨기기' : '지도 보이기'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleOpenShareDialog()}
                      color="primary"
                    >
                      플랜 공유
                    </Button>
                    <Button variant="contained" startIcon={<SearchIcon />} onClick={() => setIsSearchOpen(true)}>
                      장소 검색
                    </Button>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: showMap ? { xs: '1fr', md: '1fr 1fr' } : '1fr', gap: 2, overflow: 'hidden' }}>
                  <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, p: 2, overflow: 'auto' }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>일정 목록</Typography>
                    


                    {/* 고정된 숙박 정보 박스 */}
                    {accommodationToShow && accommodationToShow.hotelDetails && (
                      <Paper 
                        elevation={1}
                        sx={{ 
                          p: 1.5, 
                          mb: 1, 
                          bgcolor: '#fff0e6', 
                          border: 1, borderColor: 'divider', borderRadius: 1,      
                          cursor: 'pointer',
                          '&:hover': { boxShadow: 3, borderColor: 'primary.main' }
                        }}
                        onClick={() => {
                          // 현재 날짜 계산
                          const currentDate = new Date(startDate);
                          currentDate.setDate(currentDate.getDate() + selectedDay - 1);
                          
                          // 같은 날의 다른 숙박편들 찾기
                          const sameDayAccommodations = findSameDayAccommodations(currentDate);
                          
                          // 다중 숙박편 정보가 있으면 함께 전달
                          const accommodationData = {
                            ...accommodationToShow.hotelDetails,
                            sameDayAccommodations: sameDayAccommodations.length > 1 ? sameDayAccommodations : null
                          };
                          
                          handleOpenAccommodationDetail(accommodationData);
                        }}
                      >
                        <Grid container spacing={1} alignItems="center">
                          {(accommodationToShow.hotelDetails.hotel?.main_photo_url || accommodationToShow.hotelDetails.main_photo_url) && (
                            <Grid item xs={12} sm={3}>
                              <Box
                                component="img"
                                src={accommodationToShow.hotelDetails.hotel?.main_photo_url || accommodationToShow.hotelDetails.main_photo_url}
                                alt={accommodationToShow.hotelDetails.hotel?.hotel_name_trans || accommodationToShow.hotelDetails.hotel?.hotel_name || accommodationToShow.hotelDetails.hotel_name_trans || accommodationToShow.hotelDetails.hotel_name || '숙소 이미지'}
                                sx={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 1 }}
                              />
                            </Grid>
                          )}
                          <Grid item xs sm={(accommodationToShow.hotelDetails.hotel?.main_photo_url || accommodationToShow.hotelDetails.main_photo_url) ? 9 : 12}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#5D4037', fontSize: '0.9rem' }}>
                              {accommodationToShow.hotelDetails.hotel?.hotel_name_trans || accommodationToShow.hotelDetails.hotel?.hotel_name || accommodationToShow.hotelDetails.hotel_name_trans || accommodationToShow.hotelDetails.hotel_name || '숙소 정보'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom sx={{fontSize: '0.8rem'}}>
                              {accommodationToShow.hotelDetails.hotel?.address || accommodationToShow.hotelDetails.hotel?.address_trans || accommodationToShow.hotelDetails.address || accommodationToShow.hotelDetails.address_trans || '주소 정보 없음'}
                            </Typography>
                            {(accommodationToShow.hotelDetails.hotel?.checkIn || accommodationToShow.hotelDetails.checkIn || accommodationToShow.hotelDetails.hotel?.checkOut || accommodationToShow.hotelDetails.checkOut) && (
                                <Typography component="div" variant="body2" color="text.secondary" sx={{mt: 0.5, fontSize: '0.8rem'}}>
                                  체크인: {accommodationToShow.hotelDetails.hotel?.checkIn || accommodationToShow.hotelDetails.checkIn ? formatDateFns(new Date(accommodationToShow.hotelDetails.hotel?.checkIn || accommodationToShow.hotelDetails.checkIn), 'MM/dd') : '-'}
                                  {' ~ '}
                                  체크아웃: {accommodationToShow.hotelDetails.hotel?.checkOut || accommodationToShow.hotelDetails.checkOut ? formatDateFns(new Date(accommodationToShow.hotelDetails.hotel?.checkOut || accommodationToShow.hotelDetails.checkOut), 'MM/dd') : '-'}
                                </Typography>
                            )}
                            {(accommodationToShow.hotelDetails.hotel?.room?.name || accommodationToShow.hotelDetails.room?.name) && (
                                <Typography component="div" variant="body2" color="text.secondary" sx={{mt: 0.5, fontSize: '0.8rem'}}>
                                객실: {accommodationToShow.hotelDetails.hotel?.room?.name || accommodationToShow.hotelDetails.room?.name}
                                </Typography>
                            )}
                            {(accommodationToShow.hotelDetails.hotel?.price || accommodationToShow.hotelDetails.price) && (
                                <Typography variant="subtitle2" color="primary" sx={{ mt: 0.5, fontWeight: 'bold', fontSize: '0.9rem' }}>
                                {accommodationToShow.hotelDetails.hotel?.price || accommodationToShow.hotelDetails.price}
                                </Typography>
                            )}
                          </Grid>
                        </Grid>
                      </Paper>
                    )}

                    {/* 고정된 항공편 정보 박스 */}
                    {currentPlan.schedules
                      .filter(schedule => schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return' || schedule.type === 'Flight_OneWay')
                      .map((flightSchedule, index) => (
                        <Paper
                          key={`fixed-flight-${flightSchedule.id || index}`}
                          elevation={1}
                          sx={{
                            p: 1.5,
                            mb: 1,
                            bgcolor: '#e3f2fd', // 항공편 배경색
                            border: 1, borderColor: 'divider', borderRadius: 1,
                            cursor: 'pointer',
                            '&:hover': { boxShadow: 3, borderColor: 'primary.main' }
                          }}
                          onClick={() => flightSchedule.flightOfferDetails && handleOpenPlannerFlightDetail(flightSchedule)} // flightSchedule 객체를 그대로 전달
                        >
                          <Grid container spacing={1} alignItems="center">
                            <Grid item xs={12}>
                                                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0277bd' }}>
                              {flightSchedule.time} {flightSchedule.name}
                              {flightSchedule.type === 'Flight_OneWay' && (
                                <span style={{ fontSize: '0.8rem', marginLeft: '8px', color: '#ff9800' }}>(편도)</span>
                              )}
                            </Typography>
                              <Typography variant="body2" color="info.main" sx={{fontSize: '0.8rem'}}>
                                {flightSchedule.address} {/* 출발지 -> 도착지 공항 코드 등 */}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{fontSize: '0.8rem'}}>
                                {flightSchedule.category} {/* 항공사 및 편명 */}
                                {flightSchedule.flightOfferDetails?.flightOfferData?.price && 
                                  ` • ${formatPrice(flightSchedule.flightOfferDetails.flightOfferData.price.grandTotal || 
                                  flightSchedule.flightOfferDetails.flightOfferData.price.total, 
                                  flightSchedule.flightOfferDetails.flightOfferData.price.currency)}`}
                              </Typography>
                              {flightSchedule.notes && (
                                <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5, whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                                  {flightSchedule.notes}
                                </Typography>
                              )}
                            </Grid>
                          </Grid>
                        </Paper>
                      ))
                    }

                    <DragDropContext onDragEnd={handleScheduleDragEnd}>
                      <StrictModeDroppable droppableId="schedules-main">
                        {(providedList) => (
                          <List 
                            ref={providedList.innerRef} 
                            {...providedList.droppableProps} 
                            sx={{ 
                              minHeight: '100px', // 드롭 영역 확보
                              bgcolor: providedList.isDraggingOver ? 'action.hover' : 'transparent', 
                              transition: 'background-color 0.2s ease', 
                              // '& > *:not(:last-child)': { mb: 1 } // 각 Draggable 항목에서 mb로 처리
                            }}
                          >
                            {currentPlan.schedules
                              .filter(schedule => 
                                schedule.type !== 'Flight_Departure' && 
                                schedule.type !== 'Flight_Return' && 
                                schedule.type !== 'Flight_OneWay' && // 편도 항공편 제외
                                schedule.type !== 'accommodation'  // 숙소 일정 제외
                              )
                              .map((schedule, index) => renderScheduleItem(schedule, index))}
                            {providedList.placeholder}
                          </List>
                        )}
                      </StrictModeDroppable>
                    </DragDropContext>
                  </Box>
                  {showMap && (
                    <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, overflow: 'hidden', height: '100%' }}>
                      <MapboxComponent 
                        travelPlans={travelPlans} 
                        selectedDay={selectedDay} 
                        showAllMarkers={showAllMarkers}
                        hideFlightMarkers={hideFlightMarkers}
                        selectedLocation={selectedLocation}
                        resizeTrigger={mapResizeTrigger}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            )}
            {sidebarTab === 'accommodation' && (
              <AccommodationPlan
                displayInMain={true}
                ref={mainAccommodationPlanRef}
                formData={accommodationFormData}
                setFormData={setAccommodationFormData}
                onSearchResults={handleHotelSearchResults}
                onHotelSelect={handleHotelSelect}
                onAddToSchedule={onAddAccommodationToSchedule}
                travelPlans={travelPlans}
                dayOrderLength={dayOrder.length}
                onForceRefreshDay={forceRefreshSelectedDay}
                isSidebarOpen={isSidebarOpen}
              />
            )}
            {sidebarTab === 'flight' && (
              <FlightPlanComponent
                fullWidth={true}
                searchParams={flightSearchParams}
                setSearchParams={setFlightSearchParams}
                originCities={originCities}
                destinationCities={destinationCities}
                originSearchQuery={originSearchQuery}
                setOriginSearchQuery={setOriginSearchQuery}
                destinationSearchQuery={destinationSearchQuery}
                setDestinationSearchQuery={setDestinationSearchQuery}
                handleCitySearch={handleCitySearch}
                flights={flightResults}
                dictionaries={flightDictionaries}
                airportInfoCache={airportInfoCache}
                loadingAirportInfo={loadingAirportInfo}
                isLoadingCities={isLoadingCities}
                isLoadingFlights={isLoadingFlights}
                error={flightError}
                handleFlightSearch={handleFlightSearch}
                onAddFlightToSchedule={onAddFlightToSchedule}
              />
            )}
          </Box>
        </Box>

        <Dialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>장소 검색</DialogTitle>
          <DialogContent><SearchPopup onSelect={onAddPlace} onClose={() => setIsSearchOpen(false)} /></DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>일정 수정</DialogTitle>
          <DialogContent>
            {editSchedule && ( <Box sx={{ pt: 2 }}>
              <TextField fullWidth label="이름" value={editSchedule.name} onChange={e => setEditSchedule({ ...editSchedule, name: e.target.value })} sx={{ mb: 2 }} />
              <TextField fullWidth label="주소" value={editSchedule.address} onChange={e => setEditSchedule({ ...editSchedule, address: e.target.value })} sx={{ mb: 2 }} />
              <TextField fullWidth label="카테고리" value={editSchedule.category} onChange={e => setEditSchedule({ ...editSchedule, category: e.target.value })} sx={{ mb: 2 }} />
              <TextField fullWidth label="시간" value={editSchedule.time} onChange={e => setEditSchedule({ ...editSchedule, time: e.target.value })} sx={{ mb: 2 }} />
              <TextField fullWidth label="소요 시간" value={editSchedule.duration} onChange={e => setEditSchedule({ ...editSchedule, duration: e.target.value })} sx={{ mb: 2 }} />
              <TextField fullWidth multiline rows={4} label="메모" value={editSchedule.notes} onChange={e => setEditSchedule({ ...editSchedule, notes: e.target.value })} />
            </Box> )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
            <Button onClick={handleUpdateSchedule} variant="contained">저장</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={isDateEditDialogOpen} onClose={() => setIsDateEditDialogOpen(false)}>
          <DialogTitle>여행 시작일 수정</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <DatePicker
                label="시작일"
                value={tempStartDate}
                onChange={handleTempDateChange}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsDateEditDialogOpen(false)}>취소</Button>
            <Button onClick={handleConfirmDateChange} variant="contained">확인</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={isSaveDialogOpen} onClose={closeSaveDialog}>
        <DialogTitle>여행 계획 저장</DialogTitle>
        <DialogContent>
            <Box sx={{ pt: 2 }}>
          <TextField
                autoFocus
            fullWidth
                label="여행 계획 제목"
                value={planTitleForSave}
                onChange={e => setPlanTitleForSave(e.target.value)}
                placeholder="예: 3박 4일 도쿄 여행"
                sx={{ mb: 2 }}
                disabled={isSaving}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeSaveDialog} disabled={isSaving}>취소</Button>
            <Button
              onClick={async () => {
                const success = await plannerHandleSaveConfirm(planTitleForSave);
              }}
              variant="contained"
              disabled={isSaving || !planTitleForSave?.trim()}
            >
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogActions>
        </Dialog>

        {selectedFlightForPlannerDialog && (
           <Dialog 
               open={isPlannerFlightDetailOpen} 
               onClose={handleClosePlannerFlightDetail} 
               fullWidth 
               maxWidth="md"
               scroll="paper"
           >
               <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   항공편 상세 정보 (여행 계획)
                   <IconButton aria-label="close" onClick={handleClosePlannerFlightDetail} sx={{ position: 'absolute', right: 8, top: 8 }}>
                       <CloseIcon />
                   </IconButton>
               </DialogTitle>
               <DialogContent dividers>
                   {selectedFlightForPlannerDialog.flightOfferData.itineraries.map((itinerary, index) => (
                       <React.Fragment key={`planner-detail-itinerary-${index}`}>
                           {index > 0 && <Divider sx={{ my:2 }} />}
                           {renderItineraryDetails(
                               itinerary, 
                               selectedFlightForPlannerDialog.flightOfferData.id, 
                               flightDictionaries, 
                               selectedFlightForPlannerDialog.flightOfferData.itineraries.length > 1 ? (index === 0 ? "가는 여정" : "오는 여정") : "여정 상세 정보", 
                               airportInfoCache, 
                               loadingAirportInfo
                           )}
                       </React.Fragment>
                   ))}
                   <Divider sx={{ my: 2 }} />
                   <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt:2 }}>가격 및 요금 정보</Typography>
                   <Typography variant="caption" display="block">총액 (1인): {formatPrice(selectedFlightForPlannerDialog.flightOfferData.price.grandTotal || selectedFlightForPlannerDialog.flightOfferData.price.total, selectedFlightForPlannerDialog.flightOfferData.price.currency)}</Typography>
                   <Typography variant="caption" display="block">기본 운임: {formatPrice(selectedFlightForPlannerDialog.flightOfferData.price.base, selectedFlightForPlannerDialog.flightOfferData.price.currency)}</Typography>
                   {selectedFlightForPlannerDialog.flightOfferData.price.fees && selectedFlightForPlannerDialog.flightOfferData.price.fees.length > 0 && (
                       <Typography variant="caption" display="block">수수료: 
                           {selectedFlightForPlannerDialog.flightOfferData.price.fees.map(fee => `${fee.type}: ${formatPrice(fee.amount, selectedFlightForPlannerDialog.flightOfferData.price.currency)}`).join(', ')}
                       </Typography>
                   )}
                   {selectedFlightForPlannerDialog.flightOfferData.price.taxes && selectedFlightForPlannerDialog.flightOfferData.price.taxes.length > 0 && (
                           <Typography variant="caption" display="block">세금: 
                           {selectedFlightForPlannerDialog.flightOfferData.price.taxes.map(tax => `${tax.code}: ${formatPrice(tax.amount, selectedFlightForPlannerDialog.flightOfferData.price.currency)}`).join(', ')}
                       </Typography>
                   )}
                    <Typography variant="caption" display="block">
                       마지막 발권일: {selectedFlightForPlannerDialog.flightOfferData.lastTicketingDate ? new Date(selectedFlightForPlannerDialog.flightOfferData.lastTicketingDate).toLocaleDateString('ko-KR') : '-'}
                       , 예약 가능 좌석: {selectedFlightForPlannerDialog.flightOfferData.numberOfBookableSeats || '-'}석
                   </Typography>
                   {renderFareDetails(selectedFlightForPlannerDialog.flightOfferData.travelerPricings, flightDictionaries)}
        </DialogContent>
        <DialogActions>
                   <Button onClick={handleClosePlannerFlightDetail}>닫기</Button>
        </DialogActions>
      </Dialog>
        )}

        {/* 숙박 상세 정보 팝업 추가 */}
        {selectedAccommodationForDialog && (
          <Dialog 
            open={isAccommodationDetailOpen} 
            onClose={handleCloseAccommodationDetail} 
            fullWidth 
            maxWidth="md"
            scroll="paper"
          >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              숙소 상세 정보
              <IconButton aria-label="close" onClick={handleCloseAccommodationDetail} sx={{ position: 'absolute', right: 8, top: 8 }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {/* 같은 날 다중 숙박편이 있는 경우 표시 */}
              {selectedAccommodationForDialog.sameDayAccommodations && (
                <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: '#1976d2' }}>
                    같은 날 숙박편 ({selectedAccommodationForDialog.sameDayAccommodations.length}개)
                  </Typography>
                  {selectedAccommodationForDialog.sameDayAccommodations.map((accommodation, index) => {
                    const hotel = accommodation.hotel || {};
                    const room = accommodation.room || {};
                    
                    return (
                      <Box key={index} sx={{ mb: 2, p: 1.5, bgcolor: 'white', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {accommodation.isCheckOut && accommodation.isCheckIn ? '체크아웃 → 체크인' : 
                           accommodation.isCheckOut ? '체크아웃' : '체크인'}: {hotel.hotel_name_trans || hotel.hotel_name || '호텔'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          객실: {room.name || '정보 없음'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          주소: {hotel.address || hotel.address_trans || '주소 정보 없음'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          체크인: {accommodation.checkIn ? new Date(accommodation.checkIn).toLocaleDateString('ko-KR') : '-'} | 
                          체크아웃: {accommodation.checkOut ? new Date(accommodation.checkOut).toLocaleDateString('ko-KR') : '-'}
                        </Typography>
                        {room.price && (
                          <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mt: 1 }}>
                            가격: {room.price.toLocaleString()} {room.currency || 'KRW'}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                  <Divider sx={{ my: 2 }} />
                </Box>
              )}

              {/* 메인 호텔 정보 */} 
              <Typography variant="h6" gutterBottom>
                {selectedAccommodationForDialog.hotel?.hotel_name_trans || selectedAccommodationForDialog.hotel?.hotel_name || '호텔 이름 정보 없음'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                주소: {selectedAccommodationForDialog.hotel?.address || selectedAccommodationForDialog.hotel?.address_trans || '주소 정보 없음'}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                도시: {selectedAccommodationForDialog.hotel?.city_trans || selectedAccommodationForDialog.hotel?.city || '도시 정보 없음'}
                 ({selectedAccommodationForDialog.hotel?.countrycode || '국가 코드 없음'})
              </Typography>
              {selectedAccommodationForDialog.hotel?.checkin_from && (
                <Typography variant="body2" color="text.secondary">
                  체크인 시간: {selectedAccommodationForDialog.hotel.checkin_from}
                  {selectedAccommodationForDialog.hotel.checkin_until && selectedAccommodationForDialog.hotel.checkin_until !== "00:00" ? ` ~ ${selectedAccommodationForDialog.hotel.checkin_until}` : ''}
                </Typography>
              )}
              {selectedAccommodationForDialog.hotel?.checkout_until && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  체크아웃 시간: {selectedAccommodationForDialog.hotel.checkout_from && selectedAccommodationForDialog.hotel.checkout_from !== "00:00" ? `${selectedAccommodationForDialog.hotel.checkout_from} ~ ` : ''}
                  {selectedAccommodationForDialog.hotel.checkout_until}
                </Typography>
              )}
              {selectedAccommodationForDialog.hotel?.hotel_description && (
                <Box sx={{my: 2}}>
                  <Typography variant="subtitle2" sx={{fontWeight: 'bold'}}>호텔 설명</Typography>
                  <Typography variant="body2" paragraph sx={{whiteSpace: 'pre-line'}}>
                    {selectedAccommodationForDialog.hotel.hotel_description}
                  </Typography>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* 객실 정보 */} 
              <Typography variant="h6" gutterBottom>선택된 객실 정보</Typography>
              {selectedAccommodationForDialog.room ? (
                <Box>
                  <Typography variant="subtitle1">{selectedAccommodationForDialog.room.name || '객실 이름 정보 없음'}</Typography>
                  {selectedAccommodationForDialog.room.price && selectedAccommodationForDialog.room.currency && (
                     <Typography variant="body1" sx={{fontWeight: 'bold', color: 'primary.main'}}>
                       가격: {formatPrice(selectedAccommodationForDialog.room.price, selectedAccommodationForDialog.room.currency)}
                     </Typography>
                  )}
                  {selectedAccommodationForDialog.room.bed_configurations && selectedAccommodationForDialog.room.bed_configurations.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      침대: {selectedAccommodationForDialog.room.bed_configurations.map(bc => `${bc.count} ${bc.name}(s)`).join(', ')}
                    </Typography>
                  )}
                  {selectedAccommodationForDialog.room.room_surface_in_m2 && (
                     <Typography variant="body2" color="text.secondary">크기: {selectedAccommodationForDialog.room.room_surface_in_m2} m²</Typography>
                  )}
                  {selectedAccommodationForDialog.room.description && (
                    <Typography variant="body2" paragraph sx={{whiteSpace: 'pre-line', mt:1}}>
                      {selectedAccommodationForDialog.room.description}
                    </Typography>
                  )}
                  {/* 추가적인 객실 편의시설 등 표시 가능 */}
                </Box>
              ) : (
                <Typography>선택된 객실 정보가 없습니다.</Typography>
              )}

              {accommodationToShow.hotelDetails.roomList && accommodationToShow.hotelDetails.roomList.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>객실 목록</Typography>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {accommodationToShow.hotelDetails.roomList.map((room, idx) => (
                      <li key={room.id || idx} style={{ fontSize: '0.85rem' }}>
                        {room.name} {room.price ? `- ${room.price}${room.currency ? ` ${room.currency}` : ''}` : ''}
                      </li>
                    ))}
                  </ul>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseAccommodationDetail}>닫기</Button>
            </DialogActions>
          </Dialog>
        )}

        <AIChatWidget onSendMessage={handleAISendMessage} />

        <Dialog open={isShareDialogOpen} onClose={handleCloseShareDialog}>
          <DialogTitle>플랜 공유</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                autoFocus
                fullWidth
                label="공유할 이메일 주소"
                type="email"
                value={sharedEmail}
                onChange={e => setSharedEmail(e.target.value)}
                placeholder="example@email.com"
                sx={{ mb: 2 }}
                disabled={isSharing}
              />
              {shareMessage && (
                <Typography 
                  variant="body2" 
                  color={shareMessage.includes('성공') ? 'success.main' : 'error.main'}
                  sx={{ mt: 1 }}
                >
                  {shareMessage}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseShareDialog} disabled={isSharing}>
              취소
            </Button>
            <Button 
              onClick={handleSharePlan} 
              variant="contained" 
              disabled={isSharing || !sharedEmail.trim()}
            >
              {isSharing ? '공유 중...' : '공유하기'}
            </Button>
          </DialogActions>
        </Dialog>

    </Box>
    </LocalizationProvider>
  );
};

export default TravelPlanner;
