import React from 'react';
import {
  TextField, Button, CircularProgress, Autocomplete, Box, Typography, Paper,
  MenuItem, Checkbox, FormControlLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';

const formatPrice = (priceString, currency = 'KRW') => {
  const price = parseFloat(priceString);
  if (isNaN(price)) {
    return '-';
  }
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currency
  }).format(price);
};

const formatDuration = (durationString) => {
  if (!durationString) return '';
  const match = durationString.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return durationString;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  let formatted = '';
  if (hours > 0) formatted += `${hours}시간 `;
  if (minutes > 0) formatted += `${minutes}분`;
  return formatted.trim();
};

const FlightPlan = ({
  fullWidth = false,
  searchParams,
  setSearchParams,
  originCities,
  destinationCities,
  handleCitySearch,
  flights,
  isLoadingCities,
  isLoadingFlights,
  error,
  handleFlightSearch
}) => {
  const handleParamChange = (paramName, value) => {
    setSearchParams(prev => ({ ...prev, [paramName]: value }));
  };

  const formatDate = (date) => {
    return date ? date.toISOString().split('T')[0] : null;
  };

  const renderSearchForm = () => (
    <Box className="p-4">
      <Typography variant="h6" component="h2" className="font-bold mb-4">비행 계획</Typography>

      <Box className="flex flex-col gap-3 mb-4">
        <Autocomplete
          options={originCities}
          getOptionLabel={(option) => `${option.name} (${option.iataCode})`}
          filterOptions={(x) => x}
          value={searchParams.selectedOrigin || null}
          onChange={(_, value) => handleParamChange('selectedOrigin', value)}
          inputValue={searchParams.originSearch || ''}
          onInputChange={(_, value, reason) => {
            handleParamChange('originSearch', value);
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

        <Autocomplete
          options={destinationCities}
          getOptionLabel={(option) => `${option.name} (${option.iataCode})`}
          filterOptions={(x) => x}
          value={searchParams.selectedDestination || null}
          onChange={(_, value) => handleParamChange('selectedDestination', value)}
          inputValue={searchParams.destinationSearch || ''}
          onInputChange={(_, value, reason) => {
            handleParamChange('destinationSearch', value);
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
            label="오는 날 (왕복 시)"
            value={searchParams.returnDate || null}
            onChange={(newValue) => handleParamChange('returnDate', newValue)}
            minDate={searchParams.departureDate || new Date()}
            disabled={!searchParams.departureDate}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
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
          {flights.map((flight) => (
            <Paper
              key={flight.id}
              elevation={1}
              className="overflow-hidden rounded-md"
            >
              <Box className="p-3">
                <Box className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
                  <Box className="mb-2 md:mb-0">
                    <Typography variant="body1" component="h3" className="font-semibold">
                      {flight.itineraries[0].segments[0].departure.iataCode} →{' '}
                      {flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival.iataCode}
                      <Typography variant="caption" sx={{ ml: 1 }}>({flight.itineraries[0].segments.length - 1}회 경유)</Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(flight.itineraries[0].segments[0].departure.at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival.at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      <Typography variant="caption" sx={{ ml: 1 }}>({formatDuration(flight.itineraries[0].duration)})</Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      항공사: {flight.validatingAirlineCodes?.join(', ')}
                    </Typography>
                  </Box>
                  <Box className="text-left md:text-right">
                    <Typography variant="h6" className="font-bold text-blue-600">
                      {formatPrice(flight.price.total, flight.price.currency)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      (1인 총액)
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );

  return fullWidth ? renderSearchResults() : renderSearchForm();
};

export default FlightPlan; 