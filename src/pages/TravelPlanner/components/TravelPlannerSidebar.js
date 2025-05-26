import React from 'react';
import {
  Box, Button, Typography, Tabs, Tab, Paper, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import AccommodationPlan from '../../../components/AccommodationPlan';
import FlightPlanComponent from '../../../components/FlightPlan';

const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
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

const TravelPlannerSidebar = ({
  isSidebarOpen,
  sidebarTab,
  setSidebarTab,
  dayOrder,
  travelPlans,
  selectedDay,
  setSelectedDay,
  getDayTitle,
  plannerAddDay,
  plannerRemoveDay,
  handleOpenDateEditDialog,
  handleDayDragEnd,
  handleSaveOrUpdate,
  isSaving,
  saveError,
  planId,
  // 숙소 관련 props
  sidebarAccommodationPlanRef,
  accommodationFormData,
  setAccommodationFormData,
  handleSidebarPlaceSelect,
  handleSidebarSearch,
  handleSidebarOpenSearchPopup,
  handleHotelSearchResults,
  handleHotelSelect,
  onAddAccommodationToSchedule,
  dayOrderLength,
  forceRefreshSelectedDay,
  // 유효성 검사를 위한 추가 props
  startDate,
  // 항공편 관련 props
  flightSearchParams,
  setFlightSearchParams,
  originCities,
  destinationCities,
  originSearchQuery,
  setOriginSearchQuery,
  destinationSearchQuery,
  setDestinationSearchQuery,
  handleCitySearch,
  flightResults,
  flightDictionaries,
  airportInfoCache,
  loadingAirportInfo,
  isLoadingCities,
  isLoadingFlights,
  flightError,
  handleFlightSearch,
  onAddFlightToSchedule
}) => {
  return (
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
              dayOrderLength={dayOrderLength}
              onForceRefreshDay={forceRefreshSelectedDay}
              isSidebarOpen={isSidebarOpen}
              // 유효성 검사를 위한 추가 props
              dayOrder={dayOrder}
              startDate={startDate}
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
              // 검증을 위한 추가 props
              travelPlans={travelPlans}
              dayOrder={dayOrder}
              startDate={startDate}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default TravelPlannerSidebar; 