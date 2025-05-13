import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, IconButton, Tabs, Tab, List, ListItem, ListItemText, Divider
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
import AccommodationPlan from '../../components/AccommodationPlan';
import FlightPlanComponent from '../../components/FlightPlan';
import MapboxComponent from '../../components/MapboxComponent';
import SearchPopup from '../../components/SearchPopup';
import {
    formatPrice,
    formatDuration,
    renderFareDetails,
    renderItineraryDetails
} from '../../utils/flightFormatters';

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

const TravelPlanner = () => {
  const { user } = useAuth();
  const {
    travelPlans, setTravelPlans,
    dayOrder, setDayOrder,
    selectedDay, setSelectedDay,
    startDate, setStartDate,
    planId, setPlanId,
    isLoadingPlan, loadTravelPlan,
    loadedFlightInfo,
    isRoundTrip
  } = useTravelPlanLoader(user);

  const {
    flightSearchParams, setFlightSearchParams,
    originCities, destinationCities,
    isLoadingCities, isLoadingFlights,
    flightResults, flightDictionaries, flightError,
    handleCitySearch, handleFlightSearch,
    airportInfoCache, loadingAirportInfo,
    setFlightDictionaries, setAirportInfoCache,
    originSearchQuery, setOriginSearchQuery,
    destinationSearchQuery, setDestinationSearchQuery
  } = useFlightHandlers();

  const {
    getDayTitle: plannerGetDayTitle,
    addDay: plannerAddDay,
    removeDay: plannerRemoveDay,
    handleDateChange: plannerHandleDateChange,
    openSaveDialog,
    closeSaveDialog,
    handleSaveConfirm: plannerHandleSaveConfirm,
    isSaveDialogOpen,
    planTitleForSave,
    setPlanTitleForSave,
    isSaving
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
  const [editSchedule, setEditSchedule] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [isDateEditDialogOpen, setIsDateEditDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(null);
  const [editTitleMode, setEditTitleMode] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  const mainAccommodationPlanRef = useRef(null);
  const sidebarAccommodationPlanRef = useRef(null);

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
  
  const [selectedFlightForPlannerDialog, setSelectedFlightForPlannerDialog] = useState(null);
  const [isPlannerFlightDetailOpen, setIsPlannerFlightDetailOpen] = useState(false);

  const currentPlan = travelPlans[selectedDay] || { title: '', schedules: [] };

  useEffect(() => {
    if (currentPlan && currentPlan.title) {
      setTempTitle(currentPlan.title);
    }
  }, [selectedDay, currentPlan?.title]);

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

  const handleAddPlace = (place) => {
    if (!selectedDay) {
      alert('날짜를 선택해주세요.');
      return;
    }
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
    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: [...(prev[selectedDay]?.schedules || []), newSchedule]
      }
    }));
    setIsSearchOpen(false);
  };

  const handleEditScheduleOpen = (schedule) => {
    setEditSchedule(schedule);
    setEditDialogOpen(true);
  };

  const handleUpdateSchedule = () => {
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
  };

  const handleDeleteSchedule = (scheduleId) => {
    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: prev[selectedDay].schedules.filter(s => s.id !== scheduleId)
      }
    }));
  };

  const handleScheduleDragEnd = (result) => {
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

  const renderScheduleItem = (schedule, index) => {
    const isFlightItem = schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return';
    const isAccommodationItem = schedule.type === 'accommodation';

    return (
      <Draggable key={schedule.id || `${selectedDay}-${index}`} draggableId={schedule.id || `${selectedDay}-${index}`} index={index}>
        {(provided) => (
          <ListItem
            ref={provided.innerRef}
            {...provided.draggableProps}
            onClick={() => isFlightItem && handleOpenPlannerFlightDetail(schedule)}
            sx={{
                p: 2,
                bgcolor: isFlightItem ? '#e3f2fd' : (isAccommodationItem ? '#fff0e6' : 'background.paper'),
                borderRadius: 1, border: 1, borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover', cursor: isFlightItem ? 'pointer' : 'grab' },
            }}
            secondaryAction={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); handleEditScheduleOpen(schedule); }} sx={{ mr: 1 }}>
                        <EditIcon />
                    </IconButton>
                    <IconButton edge="end" aria-label="delete" onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id); }}>
                        <DeleteIcon />
                    </IconButton>
                </Box>
            }
          >
            <div {...provided.dragHandleProps} style={{ marginRight: 8, cursor: isFlightItem ? 'pointer' : 'grab' }}>
              <DragIndicatorIcon color="action" />
            </div>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    {schedule.time}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ ml: 2, color: isFlightItem ? '#0277bd' : 'inherit', fontWeight: isFlightItem ? 'bold' : 'normal' }}>
                    {schedule.name}
                  </Typography>
                </Box>
              }
              secondary={
                <React.Fragment>
                  <Typography component="span" variant="body2" color={isFlightItem ? 'info.main' : 'text.primary'}>
                    {schedule.address}
                  </Typography>
                  <br />
                  <Typography component="span" variant="body2" color="text.secondary">
                    {schedule.category}
                    {schedule.duration && ` • ${schedule.duration}`}
                    {isFlightItem && schedule.flightOfferDetails?.flightOfferData?.price && 
                      ` • ${formatPrice(schedule.flightOfferDetails.flightOfferData.price.grandTotal || 
                      schedule.flightOfferDetails.flightOfferData.price.total, 
                      schedule.flightOfferDetails.flightOfferData.price.currency)}`}
                  </Typography>
                  {(isFlightItem || isAccommodationItem) && schedule.notes && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {schedule.notes}
                    </Typography>
                  )}
                </React.Fragment>
              }
            />
          </ListItem>
        )}
      </Draggable>
    );
  };
  
  const handleAddFlightToSchedule = useCallback((flightOffer, newDictionaries, newAirportCache) => {
    console.log('[TravelPlanner] Adding flight to schedule:', flightOffer, newDictionaries, newAirportCache);
    if (!flightOffer || !flightOffer.itineraries || flightOffer.itineraries.length === 0) {
      console.error('Invalid flightOffer data for adding to schedule');
      return;
    }
    
    if (newDictionaries) {
      setFlightDictionaries(prevDict => ({ ...prevDict, ...newDictionaries }));
    }
    if (newAirportCache) {
      setAirportInfoCache(prevCache => ({ ...prevCache, ...newAirportCache }));
    }
    
    const findExistingFlightSchedule = (plans, flightType) => {
      for (const dayKey of Object.keys(plans)) {
        const daySchedules = plans[dayKey]?.schedules || [];
        const existingFlight = daySchedules.find(s => s.type === flightType);
        if (existingFlight) return existingFlight;
      }
      return null;
    };

    const findDayKeyForSchedule = (plans, scheduleId) => {
      for (const dayKey of Object.keys(plans)) {
        const daySchedules = plans[dayKey]?.schedules || [];
        if (daySchedules.some(s => s.id === scheduleId)) return dayKey;
      }
      return null;
    };

    const existingDepartureSchedule = findExistingFlightSchedule(travelPlans, 'Flight_Departure');
    const existingReturnSchedule = findExistingFlightSchedule(travelPlans, 'Flight_Return');
    
    const newTravelPlans = { ...travelPlans };
    const isRoundTrip = flightOffer.itineraries.length > 1;
    const outboundItinerary = flightOffer.itineraries[0];
    const outboundLastSegment = outboundItinerary.segments[outboundItinerary.segments.length - 1];
    
    const normalizeData = (data) => JSON.parse(JSON.stringify(data, (k, v) => (typeof v === 'number' && !Number.isFinite(v)) ? null : v));

    const departureSchedule = {
      id: existingDepartureSchedule?.id || `flight-departure-${flightOffer.id}-${Date.now()}`,
      name: `${outboundItinerary.segments[0].departure.iataCode} → ${outboundLastSegment.arrival.iataCode} 항공편`,
      time: new Date(outboundLastSegment.arrival.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      address: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.koreanFullName || airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.name || outboundLastSegment.arrival.iataCode,
      category: '항공편', type: 'Flight_Departure', duration: formatDuration(outboundItinerary.duration),
      notes: `가격: ${formatPrice(flightOffer.price.grandTotal || flightOffer.price.total, flightOffer.price.currency)}`,
      lat: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.geoCode?.latitude || flightDictionaries?.locations?.[outboundLastSegment.arrival.iataCode]?.geoCode?.latitude || null,
      lng: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.geoCode?.longitude || flightDictionaries?.locations?.[outboundLastSegment.arrival.iataCode]?.geoCode?.longitude || null,
      flightOfferDetails: {
        flightOfferData: normalizeData(flightOffer),
        departureAirportInfo: normalizeData(airportInfoCache?.[outboundItinerary.segments[0].departure.iataCode]),
        arrivalAirportInfo: normalizeData(airportInfoCache?.[outboundLastSegment.arrival.iataCode]),
      }
    };

    let departureDayKey = dayOrder[0] || '1';
    if (existingDepartureSchedule) {
      const foundDayKey = findDayKeyForSchedule(travelPlans, existingDepartureSchedule.id);
      if (foundDayKey) departureDayKey = foundDayKey;
    }
    const departureDaySchedules = [...(newTravelPlans[departureDayKey]?.schedules || [])];
    const depIndex = departureDaySchedules.findIndex(s => s.id === existingDepartureSchedule?.id);
    if (depIndex !== -1) departureDaySchedules[depIndex] = departureSchedule;
    else departureDaySchedules.unshift(departureSchedule);
    newTravelPlans[departureDayKey] = { ...(newTravelPlans[departureDayKey] || { title: getDayTitle(parseInt(departureDayKey)), schedules: [] }), schedules: departureDaySchedules };

    if (isRoundTrip) {
      const inboundItinerary = flightOffer.itineraries[1];
      const inboundFirstSegment = inboundItinerary.segments[0];
      const inboundLastSegment = inboundItinerary.segments[inboundItinerary.segments.length - 1];
      const returnSchedule = {
        id: existingReturnSchedule?.id || `flight-return-${flightOffer.id}-${Date.now()}`,
        name: `${inboundFirstSegment.departure.iataCode} → ${inboundLastSegment.arrival.iataCode} 항공편`,
        time: new Date(inboundFirstSegment.departure.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        address: airportInfoCache?.[inboundFirstSegment.departure.iataCode]?.koreanFullName || airportInfoCache?.[inboundFirstSegment.departure.iataCode]?.name || inboundFirstSegment.departure.iataCode,
        category: '항공편', type: 'Flight_Return', duration: formatDuration(inboundItinerary.duration),
        notes: `가격: ${formatPrice(flightOffer.price.grandTotal || flightOffer.price.total, flightOffer.price.currency)}`,
        lat: airportInfoCache?.[inboundFirstSegment.departure.iataCode]?.geoCode?.latitude || flightDictionaries?.locations?.[inboundFirstSegment.departure.iataCode]?.geoCode?.latitude || null,
        lng: airportInfoCache?.[inboundFirstSegment.departure.iataCode]?.geoCode?.longitude || flightDictionaries?.locations?.[inboundFirstSegment.departure.iataCode]?.geoCode?.longitude || null,
        flightOfferDetails: {
          flightOfferData: normalizeData(flightOffer),
          departureAirportInfo: normalizeData(airportInfoCache?.[inboundFirstSegment.departure.iataCode]),
          arrivalAirportInfo: normalizeData(airportInfoCache?.[inboundLastSegment.arrival.iataCode]),
        }
      };
      let returnDayKey = dayOrder[dayOrder.length - 1] || '1';
      if (existingReturnSchedule) {
        const foundDayKey = findDayKeyForSchedule(travelPlans, existingReturnSchedule.id);
        if (foundDayKey) returnDayKey = foundDayKey;
      }
      const returnDaySchedules = [...(newTravelPlans[returnDayKey]?.schedules || [])];
      const retIndex = returnDaySchedules.findIndex(s => s.id === existingReturnSchedule?.id);
      if (retIndex !== -1) returnDaySchedules[retIndex] = returnSchedule;
      else returnDaySchedules.push(returnSchedule);
      newTravelPlans[returnDayKey] = { ...(newTravelPlans[returnDayKey] || { title: getDayTitle(parseInt(returnDayKey)), schedules: [] }), schedules: returnDaySchedules };
    }
    
    setTravelPlans(newTravelPlans);
    alert(existingDepartureSchedule || existingReturnSchedule ? '기존 항공편이 새 항공편으로 교체되었습니다!' : '항공편이 여행 계획에 추가되었습니다!');
  }, [travelPlans, dayOrder, setTravelPlans, flightDictionaries, airportInfoCache, setFlightDictionaries, setAirportInfoCache, getDayTitle]);

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

  // 호텔 검색 결과 및 선택 관련 상태 (기존 코드 참고)
  const [hotelSearchResults, setHotelSearchResults] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);

  // 호텔 검색 결과 처리 핸들러 (AccommodationPlan으로부터 받음)
  const handleHotelSearchResults = useCallback((results) => {
    setHotelSearchResults(results);
  }, []);

  // 호텔 선택 처리 핸들러 (AccommodationPlan으로부터 받음)
  const handleHotelSelect = useCallback((hotel) => {
    setSelectedHotel(hotel);
    
    // 선택된 호텔을 현재 선택된 날짜의 일정에 추가 (기존 로직 참고)
    if (selectedDay && hotel) {
      const newSchedule = {
        id: `hotel-${hotel.hotel_id || hotel.id}-${Date.now()}`,
        name: hotel.hotel_name || hotel.name,
        time: '체크인', // 기본값 또는 호텔 정보에서 가져오기
        address: hotel.address,
        category: '숙소',
        duration: '1박', // 기본값
        notes: hotel.price ? `가격: ${hotel.price}` : (hotel.composite_price_breakdown?.gross_amount_per_night?.value ? `1박 평균: ${Math.round(hotel.composite_price_breakdown.gross_amount_per_night.value).toLocaleString()} ${hotel.composite_price_breakdown.gross_amount_per_night.currency}` : ''),
        lat: hotel.latitude,
        lng: hotel.longitude,
        type: 'accommodation', // 타입 명시
        hotelDetails: { ...hotel } // 호텔 상세 정보 복사해서 저장
      };

      setTravelPlans(prevTravelPlans => {
        const currentSchedules = prevTravelPlans[selectedDay]?.schedules || [];
        // 이미 동일한 호텔이 있는지 확인 (선택적)
        // const hotelExists = currentSchedules.some(s => s.type === 'accommodation' && s.hotelDetails?.hotel_id === hotel.hotel_id);
        // if (hotelExists) {
        //   alert('이미 추가된 숙소입니다.');
        //   return prevTravelPlans;
        // }
        return {
          ...prevTravelPlans,
          [selectedDay]: {
            ...(prevTravelPlans[selectedDay] || { title: getDayTitle(selectedDay), schedules: [] }),
            schedules: [...currentSchedules, newSchedule]
          }
        };
      });
      alert('숙소가 선택한 날짜의 일정에 추가되었습니다.');
    } else if (!selectedDay) {
      alert('숙소를 추가할 날짜를 먼저 선택해주세요.');
    }
  }, [selectedDay, setTravelPlans, getDayTitle]);

  // travelPlans, airportInfoCache, 또는 loadedFlightInfo가 변경될 때 항공편 스케줄의 상세 정보 업데이트
  useEffect(() => {
    // 기본 조건: travelPlans, airportInfoCache, loadedFlightInfo 중 하나라도 없으면 실행 안 함
    if (!travelPlans || Object.keys(travelPlans).length === 0 || 
        !airportInfoCache || Object.keys(airportInfoCache).length === 0 || 
        !loadedFlightInfo) {
      return;
    }

    let plansUpdated = false;
    // travelPlans를 직접 수정하지 않기 위해 깊은 복사 사용
    const updatedTravelPlans = JSON.parse(JSON.stringify(travelPlans));

    Object.keys(updatedTravelPlans).forEach(dayKey => {
      const dayPlan = updatedTravelPlans[dayKey];
      if (dayPlan && dayPlan.schedules && Array.isArray(dayPlan.schedules)) {
        dayPlan.schedules.forEach((schedule, index) => {
          if (schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return') {
            const offerDetails = schedule.flightOfferDetails;
            // offerDetails와 그 내부의 flightOfferData, itineraries가 모두 존재해야 함
            if (offerDetails && offerDetails.flightOfferData?.itineraries) {
              const itinerary = schedule.type === 'Flight_Departure' 
                ? offerDetails.flightOfferData.itineraries[0]
                : (offerDetails.flightOfferData.itineraries.length > 1 ? offerDetails.flightOfferData.itineraries[1] : offerDetails.flightOfferData.itineraries[0]);

              if (itinerary && itinerary.segments && itinerary.segments.length > 0) {
                const firstSegment = itinerary.segments[0];
                const lastSegment = itinerary.segments[itinerary.segments.length - 1];
                
                const departureAirportCode = firstSegment.departure?.iataCode;
                const arrivalAirportCode = lastSegment.arrival?.iataCode;

                // airportInfoCache에서 공항 정보 가져오기
                const departureAirport = departureAirportCode ? airportInfoCache[departureAirportCode] : null;
                const arrivalAirport = arrivalAirportCode ? airportInfoCache[arrivalAirportCode] : null;

                let changedInEffect = false;
                // 귀국편: 출발 공항 정보 기준 (주소, 위경도)
                if (departureAirport && schedule.type === 'Flight_Return') { 
                  if (schedule.address !== (departureAirport.koreanName || departureAirport.name)) {
                    updatedTravelPlans[dayKey].schedules[index].address = departureAirport.koreanName || departureAirport.name || departureAirportCode;
                    changedInEffect = true;
                  }
                  if (schedule.lat !== departureAirport.geoCode?.latitude) {
                    updatedTravelPlans[dayKey].schedules[index].lat = departureAirport.geoCode?.latitude || null;
                    changedInEffect = true;
                  }
                  if (schedule.lng !== departureAirport.geoCode?.longitude) {
                    updatedTravelPlans[dayKey].schedules[index].lng = departureAirport.geoCode?.longitude || null;
                    changedInEffect = true;
                  }
                  // flightOfferDetails 내 공항 정보도 업데이트 (없거나 비어있을 경우)
                  if (!offerDetails.departureAirportInfo || Object.keys(offerDetails.departureAirportInfo).length === 0) {
                     updatedTravelPlans[dayKey].schedules[index].flightOfferDetails.departureAirportInfo = departureAirport;
                     changedInEffect = true;
                  }
                  if (arrivalAirport && (!offerDetails.arrivalAirportInfo || Object.keys(offerDetails.arrivalAirportInfo).length === 0) ){
                     updatedTravelPlans[dayKey].schedules[index].flightOfferDetails.arrivalAirportInfo = arrivalAirport;
                     changedInEffect = true;
                  }
                // 출발편: 도착 공항 정보 기준 (주소, 위경도)
                } else if (arrivalAirport && schedule.type === 'Flight_Departure') { 
                  if (schedule.address !== (arrivalAirport.koreanName || arrivalAirport.name)) {
                    updatedTravelPlans[dayKey].schedules[index].address = arrivalAirport.koreanName || arrivalAirport.name || arrivalAirportCode;
                    changedInEffect = true;
                  }
                  if (schedule.lat !== arrivalAirport.geoCode?.latitude) {
                    updatedTravelPlans[dayKey].schedules[index].lat = arrivalAirport.geoCode?.latitude || null;
                    changedInEffect = true;
                  }
                  if (schedule.lng !== arrivalAirport.geoCode?.longitude) {
                    updatedTravelPlans[dayKey].schedules[index].lng = arrivalAirport.geoCode?.longitude || null;
                    changedInEffect = true;
                  }
                  // flightOfferDetails 내 공항 정보도 업데이트
                  if (departureAirport && (!offerDetails.departureAirportInfo || Object.keys(offerDetails.departureAirportInfo).length === 0)){
                     updatedTravelPlans[dayKey].schedules[index].flightOfferDetails.departureAirportInfo = departureAirport;
                     changedInEffect = true;
                  }
                   if (!offerDetails.arrivalAirportInfo || Object.keys(offerDetails.arrivalAirportInfo).length === 0) {
                     updatedTravelPlans[dayKey].schedules[index].flightOfferDetails.arrivalAirportInfo = arrivalAirport;
                     changedInEffect = true;
                  }
                }
                if (changedInEffect) plansUpdated = true;
              }
            }
          }
        });
      }
    });

    if (plansUpdated) {
      console.log('[TravelPlanner] useEffect updated flight schedule details:', updatedTravelPlans);
      setTravelPlans(updatedTravelPlans); // 실제 변경이 있을 때만 호출
    }
  }, [travelPlans, airportInfoCache, loadedFlightInfo]); // setTravelPlans 의존성 제거

  if (!user && !process.env.REACT_APP_SKIP_AUTH) {
    return <Typography>로그인이 필요합니다.</Typography>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
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
                      onClick={openSaveDialog}
                    >
                      저장
                    </Button>
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
                  onAddFlightToSchedule={handleAddFlightToSchedule}
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
            <Typography variant="h6">
              {sidebarTab === 'schedule' ? '여행 일정' :
               sidebarTab === 'accommodation' ? '숙소 검색 결과' :
               '항공편 검색 결과'}
            </Typography>
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
                    <Button variant={showAllMarkers ? "contained" : "outlined"} onClick={() => setShowAllMarkers(!showAllMarkers)}>
                      {showAllMarkers ? "현재 날짜 마커만" : "전체 날짜 마커"}
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => setShowMap(v => !v)}>
                      {showMap ? '지도 숨기기' : '지도 보이기'}
                    </Button>
                    <Button variant="contained" startIcon={<SearchIcon />} onClick={() => setIsSearchOpen(true)}>
                      장소 검색
                    </Button>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: showMap ? { xs: '1fr', md: '1fr 1fr' } : '1fr', gap: 2, overflow: 'hidden' }}>
                  <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, p: 2, overflow: 'auto' }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>일정 목록</Typography>
                    <DragDropContext onDragEnd={handleScheduleDragEnd}>
                      <StrictModeDroppable droppableId="schedules-main">
                        {(providedList) => (
                          <List ref={providedList.innerRef} {...providedList.droppableProps} sx={{ minHeight: '100px', bgcolor: providedList.isDraggingOver ? 'action.hover' : 'transparent', transition: 'background-color 0.2s ease', '& > *:not(:last-child)': { mb: 1 } }}>
                            {currentPlan.schedules?.map((schedule, index) => renderScheduleItem(schedule, index))}
                            {providedList.placeholder}
                          </List>
                        )}
                      </StrictModeDroppable>
                    </DragDropContext>
                  </Box>
                  {showMap && (
                    <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, overflow: 'hidden', height: '100%' }}>
                      <MapboxComponent travelPlans={travelPlans} selectedDay={selectedDay} showAllMarkers={showAllMarkers} />
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
                travelPlans={travelPlans}
                setTravelPlans={setTravelPlans}
                onSearchResults={handleHotelSearchResults}
                onHotelSelect={handleHotelSelect}
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
                onAddFlightToSchedule={handleAddFlightToSchedule}
              />
            )}
          </Box>
        </Box>

        <Dialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>장소 검색</DialogTitle>
          <DialogContent><SearchPopup onSelect={handleAddPlace} onClose={() => setIsSearchOpen(false)} /></DialogContent>
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
    </Box>
    </LocalizationProvider>
  );
};

export default TravelPlanner;
