import React, { useState, useEffect } from 'react';
import {
  TextField, Button, CircularProgress, Autocomplete, Box, Typography, Paper,
  MenuItem, Checkbox, FormControlLabel, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import {
  formatPrice,
  airlineKoreanNames,
  renderFareDetails,
  renderItineraryDetails
} from '../utils/flightFormatters';

const FlightPlan = ({
  fullWidth = false,
  searchParams,
  setSearchParams,
  originCities,
  destinationCities,
  originSearchQuery,
  setOriginSearchQuery,
  destinationSearchQuery,
  setDestinationSearchQuery,
  handleCitySearch,
  flights,
  dictionaries,
  airportInfoCache,
  loadingAirportInfo,
  isLoadingCities,
  isLoadingFlights,
  error,
  handleFlightSearch,
  onAddFlightToSchedule,
  // 검증을 위한 추가 props
  travelPlans,
  dayOrder,
  startDate
}) => {
  const [selectedFlightDetails, setSelectedFlightDetails] = useState(null);
  const [isFlightDetailOpen, setIsFlightDetailOpen] = useState(false);
  const [isOneWay, setIsOneWay] = useState(false);

  const handleFlightItemClick = (flight) => {
    setSelectedFlightDetails(flight);
    setIsFlightDetailOpen(true);
  };

  const handleCloseFlightDetail = () => {
    setIsFlightDetailOpen(false);
  };

  const handleAddSelectedFlightToSchedule = () => {
    if (selectedFlightDetails && onAddFlightToSchedule) {
      onAddFlightToSchedule(selectedFlightDetails, dictionaries, airportInfoCache, travelPlans, dayOrder, startDate);
      handleCloseFlightDetail();
    }
  };

  const handleParamChange = (paramName, value) => {
    setSearchParams(prev => ({ ...prev, [paramName]: value }));
  };

  const handleTripTypeChange = (oneWay) => {
    setIsOneWay(oneWay);
    if (oneWay) {
      handleParamChange('returnDate', null);
    }
  };

  // 출발지와 도착지 순서 바꾸기 핸들러
  const handleSwapLocations = () => {
    // 선택된 위치 교환
    const tempOrigin = searchParams.selectedOrigin;
    const tempDestination = searchParams.selectedDestination;
    handleParamChange('selectedOrigin', tempDestination);
    handleParamChange('selectedDestination', tempOrigin);

    // 검색 텍스트도 교환
    const tempOriginSearch = originSearchQuery;
    const tempDestinationSearch = destinationSearchQuery;
    setOriginSearchQuery(tempDestinationSearch);
    setDestinationSearchQuery(tempOriginSearch);
  };

  // 검색 매개변수 동기화
  useEffect(() => {
    if (isOneWay && searchParams.returnDate) {
      handleParamChange('returnDate', null);
    }
  }, [isOneWay, searchParams.returnDate]);


  const renderSearchForm = () => (
    <Box className="p-4">
      <Typography variant="h6" component="h2" className="font-bold mb-4">비행 계획</Typography>

      <Box className="flex flex-col gap-3 mb-4">
        <Autocomplete
          options={originCities || []}
          getOptionLabel={(option) => `${option.name} (${option.iataCode})`}
          filterOptions={(x) => x}
          value={searchParams.selectedOrigin || null}
          onChange={(_, value) => handleParamChange('selectedOrigin', value)}
          inputValue={originSearchQuery}
          onInputChange={(_, value, reason) => {
            setOriginSearchQuery(value);
            if (reason === 'input' && value.length >= 2) {
              handleCitySearch(value, 'origin');
            }
          }}
          loading={isLoadingCities}
          noOptionsText="도시/공항명(영문) 2자 이상 입력"
          renderInput={(params) => (
            <TextField
              {...params}
              label="출발지 (도시 또는 공항) *"
              variant="outlined"
              size="small"
              required
              InputProps={{ ...params.InputProps, endAdornment: (
                <React.Fragment>
                  {isLoadingCities ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              )}}
            />
          )}
        />

        {/* 출발지/도착지 순서 바꾸기 버튼 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
          <IconButton
            onClick={handleSwapLocations}
            sx={{ 
              border: '1px solid #e0e0e0',
              borderRadius: '50%',
              p: 1,
              '&:hover': {
                backgroundColor: '#f5f5f5'
              }
            }}
            title="출발지와 도착지 바꾸기"
          >
            <SwapVertIcon sx={{ color: '#666' }} />
          </IconButton>
        </Box>

        <Autocomplete
          options={destinationCities || []}
          getOptionLabel={(option) => `${option.name} (${option.iataCode})`}
          filterOptions={(x) => x}
          value={searchParams.selectedDestination || null}
          onChange={(_, value) => handleParamChange('selectedDestination', value)}
          inputValue={destinationSearchQuery}
          onInputChange={(_, value, reason) => {
            setDestinationSearchQuery(value);
            if (reason === 'input' && value.length >= 2) {
              handleCitySearch(value, 'destination');
            }
          }}
          loading={isLoadingCities}
          noOptionsText="도시/공항명(영문) 2자 이상 입력"
          renderInput={(params) => (
            <TextField
              {...params}
              label="도착지 (도시 또는 공항) *"
              variant="outlined"
              size="small"
              required
              InputProps={{ ...params.InputProps, endAdornment: (
                <React.Fragment>
                  {isLoadingCities ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              )}}
            />
          )}
        />

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>여행 유형</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              type="button"
              variant={!isOneWay ? "contained" : "outlined"}
              size="small"
              onClick={() => handleTripTypeChange(false)}
              sx={{ 
                flex: 1,
                bgcolor: !isOneWay ? 'primary.main' : 'transparent',
                color: !isOneWay ? 'white' : 'primary.main',
                '&:hover': {
                  bgcolor: !isOneWay ? 'primary.dark' : 'primary.light'
                }
              }}
            >
              왕복
            </Button>
            <Button
              type="button"
              variant={isOneWay ? "contained" : "outlined"}
              size="small"
              onClick={() => handleTripTypeChange(true)}
              sx={{ 
                flex: 1,
                bgcolor: isOneWay ? 'primary.main' : 'transparent',
                color: isOneWay ? 'white' : 'primary.main',
                '&:hover': {
                  bgcolor: isOneWay ? 'primary.dark' : 'primary.light'
                }
              }}
            >
              편도
            </Button>
          </Box>
        </Box>

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
          <DatePicker
            label="가는 날 *"
            value={searchParams.departureDate || null}
            onChange={(newValue) => handleParamChange('departureDate', newValue)}
            minDate={new Date()}
            slotProps={{ textField: { size: 'small', fullWidth: true, required: true } }}
          />
        </LocalizationProvider>

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
          <DatePicker
            label={isOneWay ? "오는 날 (편도 선택됨)" : "오는 날 (왕복 시)"}
            value={searchParams.returnDate || null}
            onChange={(newValue) => handleParamChange('returnDate', newValue)}
            minDate={searchParams.departureDate || new Date()}
            disabled={isOneWay || !searchParams.departureDate}
            slotProps={{ 
              textField: { 
                size: 'small', 
                fullWidth: true,
                disabled: isOneWay,
                helperText: isOneWay ? "편도 항공편을 선택했습니다." : ""
              } 
            }}
          />
        </LocalizationProvider>

        <TextField
          label="성인 (만 12세 이상) *"
          type="number"
          size="small"
          required
          value={searchParams.adults || 1}
          onChange={(e) => handleParamChange('adults', Math.max(1, parseInt(e.target.value) || 1))}
          InputProps={{ inputProps: { min: 1, max: 9 } }}
          variant="outlined"
        />

        <TextField
          label="소아 (만 2-11세)"
          type="number"
          size="small"
          value={searchParams.children || 0}
          onChange={(e) => handleParamChange('children', Math.max(0, parseInt(e.target.value) || 0))}
          InputProps={{ inputProps: { min: 0, max: 8 } }}
          variant="outlined"
        />

        <TextField
          label="유아 (만 2세 미만, 좌석X)"
          type="number"
          size="small"
          value={searchParams.infants || 0}
          onChange={(e) => handleParamChange('infants', Math.max(0, parseInt(e.target.value) || 0))}
          InputProps={{ inputProps: { min: 0 } }}
          variant="outlined"
        />

        <TextField
          select
          label="좌석 등급"
          size="small"
          value={searchParams.travelClass || ''}
          onChange={(e) => handleParamChange('travelClass', e.target.value)}
          variant="outlined"
        >
          <MenuItem value="">모든 등급</MenuItem>
          <MenuItem value="ECONOMY">이코노미</MenuItem>
          <MenuItem value="PREMIUM_ECONOMY">프리미엄 이코노미</MenuItem>
          <MenuItem value="BUSINESS">비즈니스</MenuItem>
          <MenuItem value="FIRST">퍼스트</MenuItem>
        </TextField>

        <TextField
          label="통화 코드 (ISO 4217)"
          size="small"
          value={searchParams.currencyCode || 'KRW'}
          onChange={(e) => handleParamChange('currencyCode', e.target.value.toUpperCase())}
          variant="outlined"
        />

        <TextField
          label="최대 가격 (1인당)"
          type="number"
          size="small"
          value={searchParams.maxPrice || ''}
          onChange={(e) => handleParamChange('maxPrice', parseInt(e.target.value) || '')}
          InputProps={{ inputProps: { min: 0 } }}
          variant="outlined"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={searchParams.nonStop || false}
              onChange={(e) => handleParamChange('nonStop', e.target.checked)}
            />
          }
          label="직항만 검색"
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        onClick={handleFlightSearch}
        disabled={isLoadingFlights}
        className="w-full"
        size="large"
      >
        {isLoadingFlights ? <CircularProgress size={24} color="inherit" /> : '항공편 검색'}
      </Button>

      {error && (
        <Typography color="error" variant="body2" className="mt-2 text-center">
          {error}
        </Typography>
      )}
    </Box>
  );

  const renderSearchResults = () => (
    <Box className="p-2 h-full overflow-y-auto">
      {isLoadingFlights && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>항공편을 검색 중입니다...</Typography>
        </Box>
      )}

      {!isLoadingFlights && error && (
        <Typography color="error" className="mt-4 p-4 bg-red-50 text-red-700 rounded-md text-center">
          {error}
        </Typography>
      )}

      {!isLoadingFlights && !error && flights.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Typography color="text.secondary">검색 결과가 없습니다. 옵션을 확인하고 다시 검색해주세요.</Typography>
        </Box>
      )}

      {!isLoadingFlights && !error && flights.length > 0 && (
        <Box className="space-y-3">
          <Typography variant="h6" className="mb-2 px-2">검색 결과 ({flights.length}건)</Typography>
          {flights.map((flight) => {
            const firstItinerary = flight.itineraries[0];
            const isRoundTrip = flight.itineraries.length > 1;
            const departureItinSummary = firstItinerary.segments[0];
            const arrivalItinSummary = firstItinerary.segments[firstItinerary.segments.length - 1];
            
            const getCarrierSummaryDisplay = (carrierCode) => {
                const koreanName = airlineKoreanNames[carrierCode];
                const englishName = dictionaries?.carriers?.[carrierCode] || carrierCode;
                return koreanName ? `${koreanName} / ${englishName}` : englishName;
            };
            
            const getAirportSummaryDisplay = (iataCode) => {
                const info = airportInfoCache?.[iataCode];
                if (info && Object.keys(info).length > 0 && !info.warning) {
                    return info.koreanFullName || info.koreanName || info.name || iataCode;
                }
                return dictionaries?.locations?.[iataCode]?.name || iataCode;
            };

            return (
              <Paper
                key={flight.id}
                elevation={1}
                className="overflow-hidden rounded-md cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleFlightItemClick(flight)}
                sx={{ p: 2 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Box className="flex flex-col md:flex-row justify-between items-start md:items-center w-full">
                    <Box className="mb-2 md:mb-0">
                        <Typography variant="body1" component="h3" className="font-semibold">
                            {getAirportSummaryDisplay(departureItinSummary.departure.iataCode)} 
                            → 
                            {getAirportSummaryDisplay(arrivalItinSummary.arrival.iataCode)}
                            <Typography variant="caption" sx={{ ml: 1 }}>
                                ({firstItinerary.segments.length -1 === 0 ? '직항' : `${firstItinerary.segments.length - 1}회 경유`})
                                {isRoundTrip ? " (왕복)" : " (편도)"}
                            </Typography>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                        {new Date(departureItinSummary.departure.at).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {isRoundTrip && flight.itineraries[1] && 
                            ` ~ ${new Date(flight.itineraries[1].segments[flight.itineraries[1].segments.length - 1].arrival.at).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric'})}`
                        }
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                        항공사: {getCarrierSummaryDisplay(flight.validatingAirlineCodes?.[0])}
                        {departureItinSummary.operating?.carrierCode && departureItinSummary.operating.carrierCode !== departureItinSummary.carrierCode && 
                            ` (운항: ${getCarrierSummaryDisplay(departureItinSummary.operating.carrierCode)})`}
                        </Typography>
                    </Box>
                    <Box className="text-left md:text-right mt-2 md:mt-0">
                        <Typography variant="h6" className="font-bold text-blue-600">
                        {formatPrice(flight.price.grandTotal || flight.price.total, flight.price.currency)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                        (1인 총액)
                        </Typography>
                    </Box>
                    </Box>
                </Box>
              </Paper>
            )
          })}
        </Box>
      )}
      {selectedFlightDetails && (
        <Dialog 
            open={isFlightDetailOpen} 
            onClose={handleCloseFlightDetail} 
            fullWidth 
            maxWidth="md"
            scroll="paper"
        >
          <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            항공편 상세 정보
            <IconButton aria-label="close" onClick={handleCloseFlightDetail} sx={{ position: 'absolute', right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {selectedFlightDetails.itineraries.map((itinerary, index) => (
                <React.Fragment key={`detail-itinerary-${index}`}>
                    {index > 0 && <Divider sx={{ my:2 }} />}
                    {renderItineraryDetails(
                        itinerary, 
                        selectedFlightDetails.id, 
                        dictionaries, 
                        selectedFlightDetails.itineraries.length > 1 ? (index === 0 ? "가는 여정" : "오는 여정") : "여정 상세 정보", 
                        airportInfoCache,
                        loadingAirportInfo || new Set()
                    )}
                </React.Fragment>
            ))}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt:2 }}>가격 및 요금 정보</Typography>
            <Typography variant="caption" display="block">총액 (1인): {formatPrice(selectedFlightDetails.price.grandTotal || selectedFlightDetails.price.total, selectedFlightDetails.price.currency)}</Typography>
            <Typography variant="caption" display="block">기본 운임: {formatPrice(selectedFlightDetails.price.base, selectedFlightDetails.price.currency)}</Typography>
            {selectedFlightDetails.price.fees && selectedFlightDetails.price.fees.length > 0 && (
                <Typography variant="caption" display="block">수수료: 
                    {selectedFlightDetails.price.fees.map(fee => `${fee.type}: ${formatPrice(fee.amount, selectedFlightDetails.price.currency)}`).join(', ')}
                </Typography>
            )}
            {selectedFlightDetails.price.taxes && selectedFlightDetails.price.taxes.length > 0 && (
                    <Typography variant="caption" display="block">세금: 
                    {selectedFlightDetails.price.taxes.map(tax => `${tax.code}: ${formatPrice(tax.amount, selectedFlightDetails.price.currency)}`).join(', ')}
                </Typography>
            )}
            <Typography variant="caption" display="block">
                마지막 발권일: {selectedFlightDetails.lastTicketingDate ? new Date(selectedFlightDetails.lastTicketingDate).toLocaleDateString('ko-KR') : '-'}
                , 예약 가능 좌석: {selectedFlightDetails.numberOfBookableSeats || '-'}석
            </Typography>
            {renderFareDetails(selectedFlightDetails.travelerPricings, dictionaries)}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between', p: '12px 24px' }}>
            <Button 
              onClick={handleAddSelectedFlightToSchedule} 
              variant="contained" 
              startIcon={<AddCircleOutlineIcon />} 
              color="primary"
              disabled={!onAddFlightToSchedule}
            >
              일정에 추가하기
            </Button>
            <Button onClick={handleCloseFlightDetail} color="inherit">닫기</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );

  return fullWidth ? renderSearchResults() : renderSearchForm();
};

export default FlightPlan; 