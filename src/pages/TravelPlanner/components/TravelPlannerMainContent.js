import React from 'react';
import {
  Box, Button, Typography, TextField, IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AccommodationPlan from '../../../components/AccommodationPlan';
import FlightPlanComponent from '../../../components/FlightPlan';
import ScheduleList from './ScheduleList';
import MapboxComponent from '../../../components/MapboxComponent';

const TravelPlannerMainContent = ({
  sidebarTab,
  currentPlan,
  editTitleMode,
  setEditTitleMode,
  tempTitle,
  setTempTitle,
  setTravelPlans,
  selectedDay,
  showAllMarkers,
  setShowAllMarkers,
  showMap,
  setShowMap,
  handleOpenShareDialog,
  setIsSearchOpen,
  setIsCustomAccommodationOpen,
  accommodationsToShow,
  findSameDayAccommodations,
  handleOpenAccommodationDetail,
  startDate,
  handleScheduleDragEnd,
  renderScheduleItem,
  travelPlans,
  hideFlightMarkers,
  selectedLocation,
  mapResizeTrigger,
  // 삭제 핸들러
  handleDeleteAccommodation,
  handleDeleteFlight,
  // 숙소 관련 props
  mainAccommodationPlanRef,
  accommodationFormData,
  setAccommodationFormData,
  handleHotelSearchResults,
  handleHotelSelect,
  onAddAccommodationToSchedule,
  dayOrder,
  forceRefreshSelectedDay,
  isSidebarOpen,
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
  onAddFlightToSchedule,
  handleOpenPlannerFlightDetail,
  // 저장된 계획에서 로드된 다중 정보
  loadedFlightInfos,
  loadedAccommodationInfos
}) => {
  return (
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
                onClick={handleOpenShareDialog}
                color="primary"
              >
                플랜 공유
              </Button>
            </Box>
          </Box>
          <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: showMap ? { xs: '1fr', md: '1fr 1fr' } : '1fr', gap: 2, overflow: 'hidden' }}>
            <ScheduleList
              accommodationsToShow={accommodationsToShow}
              findSameDayAccommodations={findSameDayAccommodations}
              handleOpenAccommodationDetail={handleOpenAccommodationDetail}
              startDate={startDate}
              selectedDay={selectedDay}
              currentPlan={currentPlan}
              handleScheduleDragEnd={handleScheduleDragEnd}
              renderScheduleItem={renderScheduleItem}
              handleOpenPlannerFlightDetail={handleOpenPlannerFlightDetail}
              handleDeleteAccommodation={handleDeleteAccommodation}
              handleDeleteFlight={handleDeleteFlight}
              setIsSearchOpen={setIsSearchOpen}
              setIsCustomAccommodationOpen={setIsCustomAccommodationOpen}
            />
            {showMap && (
              <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, overflow: 'hidden', height: '100%' }}>
                <MapboxComponent 
                  travelPlans={travelPlans} 
                  selectedDay={selectedDay} 
                  showAllMarkers={showAllMarkers}
                  hideFlightMarkers={true}
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
          // 유효성 검사를 위한 추가 props
          dayOrder={dayOrder}
          startDate={startDate}
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
          // 검증을 위한 추가 props
          travelPlans={travelPlans}
          dayOrder={dayOrder}
          startDate={startDate}
        />
      )}
    </Box>
  );
};

export default TravelPlannerMainContent; 