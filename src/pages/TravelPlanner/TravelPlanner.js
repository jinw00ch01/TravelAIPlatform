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
import useAccommodationHandlers from './hooks/useAccommodationHandlers';
import AccommodationPlan from '../../components/AccommodationPlan';
import FlightPlanComponent from '../../components/FlightPlan';
import MapboxComponent from '../../components/MapboxComponent';
import SearchPopup from '../../components/SearchPopup';
import {
    formatPrice,
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
    isRoundTrip,
    loadError
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
    isSaveDialogOpen,
    planTitleForSave,
    setPlanTitleForSave,
    isSaving,
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

  const mainAccommodationPlanRef = useRef(null);
  const sidebarAccommodationPlanRef = useRef(null);
  
  const [selectedFlightForPlannerDialog, setSelectedFlightForPlannerDialog] = useState(null);
  const [isPlannerFlightDetailOpen, setIsPlannerFlightDetailOpen] = useState(false);

  const currentPlan = travelPlans[selectedDay] || { title: '', schedules: [] };

  useEffect(() => {
    if (currentPlan && currentPlan.title) {
      setTempTitle(currentPlan.title);
    }
  }, [selectedDay, currentPlan?.title]);

  // travelPlans, airportInfoCache, 또는 loadedFlightInfo가 변경될 때 항공편 스케줄의 상세 정보 업데이트
  useEffect(() => {
    const updatedPlans = updateFlightScheduleDetails(travelPlans, airportInfoCache, loadedFlightInfo);
    if (updatedPlans) {
      console.log('[TravelPlanner] useEffect updated flight schedule details');
      setTravelPlans(updatedPlans);
    }
  }, [travelPlans, airportInfoCache, loadedFlightInfo, updateFlightScheduleDetails, setTravelPlans]);

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
  const onAddAccommodationToSchedule = useCallback((hotelToAdd, dayKey) => {
    addAccommodationToSchedule(hotelToAdd, dayKey, getDayTitle, setTravelPlans);
  }, [addAccommodationToSchedule, getDayTitle, setTravelPlans]);

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
                  travelPlans={travelPlans}
                  onAddToSchedule={onAddAccommodationToSchedule}
                  displayInMain={false}
                  dayOrderLength={dayOrder.length}
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
                      onClick={() => setHideFlightMarkers(v => !v)}
                      color={hideFlightMarkers ? "primary" : "inherit"}
                    >
                      {hideFlightMarkers ? '항공편 표시' : '항공편 숨기기'}
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
                      <MapboxComponent 
                        travelPlans={travelPlans} 
                        selectedDay={selectedDay} 
                        showAllMarkers={showAllMarkers}
                        hideFlightMarkers={hideFlightMarkers} 
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
    </Box>
    </LocalizationProvider>
  );
};

export default TravelPlanner;
