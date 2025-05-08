import React from 'react';
import {
  TextField, Button, CircularProgress, Autocomplete, Box, Typography, Paper,
  MenuItem, Checkbox, FormControlLabel, Accordion, AccordionSummary, AccordionDetails, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

const renderFareDetails = (travelerPricings, dictionaries) => {
  if (!travelerPricings || travelerPricings.length === 0) return null;
  return travelerPricings.map((travelerPricing, tpIndex) => (
    <Box key={`tp-${tpIndex}`} sx={{ mb: 1, borderBottom: '1px solid #eee', pb: 1 }}>
      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
        승객 {travelerPricing.travelerId} ({travelerPricing.travelerType}) - 요금 옵션: {travelerPricing.fareOption}
      </Typography>
      {travelerPricing.fareDetailsBySegment.map((fareDetail, fdIndex) => (
        <Box key={`fd-${tpIndex}-${fdIndex}`} sx={{ pl: 1 }}>
          <Typography variant="caption" display="block">
            - 구간 {fareDetail.segmentId}: {fareDetail.cabin} ({fareDetail.class}), 운임 기준: {fareDetail.fareBasis}
            {fareDetail.brandedFare && `, 브랜드: ${fareDetail.brandedFare}`}
          </Typography>
          {fareDetail.includedCheckedBags && (
            <Typography variant="caption" display="block" sx={{ pl: 2 }}>
              포함 수하물: 
              {fareDetail.includedCheckedBags.quantity ? ` ${fareDetail.includedCheckedBags.quantity}개` : ''}
              {fareDetail.includedCheckedBags.weight ? ` (개당 ${fareDetail.includedCheckedBags.weight}${fareDetail.includedCheckedBags.weightUnit || 'KG'})` : ''}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  ));
};

// 한 여정(편도 또는 왕복의 한 방향)의 상세 정보를 렌더링하는 함수
const renderItineraryDetails = (itinerary, flightId, dictionaries, itineraryTitle) => {
  if (!itinerary) return null;
  return (
    <Box sx={{ mb: 2 }}>
      {itineraryTitle && 
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          {itineraryTitle}
        </Typography>
      }
      {itinerary.segments.map((segment, index) => (
        <Box key={`segment-${flightId}-${segment.id || index}`} sx={{ mb: 1.5, pl:1, borderLeft: '2px solid #1976d2', ml:1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
            구간 {index + 1}: {segment.departure.iataCode} ({dictionaries?.locations?.[segment.departure.iataCode]?.cityCode || segment.departure.iataCode}) → {segment.arrival.iataCode} ({dictionaries?.locations?.[segment.arrival.iataCode]?.cityCode || segment.arrival.iataCode})
          </Typography>
          <Typography variant="caption" display="block">
            출발: {new Date(segment.departure.at).toLocaleString('ko-KR', { year:'numeric', month:'short', day:'numeric', hour: '2-digit', minute: '2-digit', timeZoneName:'short' })} (터미널: {segment.departure.terminal || '-'})
          </Typography>
          <Typography variant="caption" display="block">
            도착: {new Date(segment.arrival.at).toLocaleString('ko-KR', { year:'numeric', month:'short', day:'numeric', hour: '2-digit', minute: '2-digit', timeZoneName:'short' })} (터미널: {segment.arrival.terminal || '-'})
          </Typography>
          <Typography variant="caption" display="block">
            항공편: {dictionaries?.carriers?.[segment.carrierCode] || segment.carrierCode} {segment.number}
            {segment.operating?.carrierCode && segment.operating.carrierCode !== segment.carrierCode && 
              ` (운항: ${dictionaries?.carriers?.[segment.operating.carrierCode] || segment.operating.carrierCode})`}
          </Typography>
          <Typography variant="caption" display="block">
            기종: {segment.aircraft?.code ? (dictionaries?.aircraft?.[segment.aircraft.code] || segment.aircraft.code) : '-'}
            , 소요시간: {formatDuration(segment.duration)}
            {segment.numberOfStops > 0 && `, 경유 ${segment.numberOfStops}회`}
          </Typography>
          {segment.stops && segment.stops.length > 0 && (
            <Box sx={{pl: 2, mt:0.5}}>
              {segment.stops.map((stop, stopIndex) => (
                  <Typography variant="caption" display="block" key={`stop-${flightId}-${segment.id || index}-${stopIndex}`}>
                    경유지 {stopIndex+1}: {stop.iataCode} ({dictionaries?.locations?.[stop.iataCode]?.cityCode || stop.iataCode}) - {formatDuration(stop.duration)} 체류
                    <br/>
                    도착: {new Date(stop.arrivalAt).toLocaleTimeString('ko-KR')} / 출발: {new Date(stop.departureAt).toLocaleTimeString('ko-KR')}
                  </Typography>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

const FlightPlan = ({
  fullWidth = false,
  searchParams,
  setSearchParams,
  originCities,
  destinationCities,
  handleCitySearch,
  flights,
  dictionaries,
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
          {flights.map((flight) => {
            const firstItinerary = flight.itineraries[0];
            // 왕복 여정인지 확인 (itineraries가 2개 이상이면 왕복으로 간주)
            // Amadeus API는 때로 편도 조합을 위해 여러 one-way 오퍼를 반환할 수 있으나,
            // 현재 로직에서는 itineraries 배열 길이가 2개 이상일 때 두 번째를 귀국편으로 가정합니다.
            // 더 정확하게는 flight.oneWay 플래그나, 각 itinerary의 segment ID 순서 등을 확인해야 할 수 있습니다.
            const isRoundTrip = flight.itineraries.length > 1; 
            const secondItinerary = isRoundTrip ? flight.itineraries[1] : null;

            const departureItinSummary = firstItinerary.segments[0];
            const arrivalItinSummary = firstItinerary.segments[firstItinerary.segments.length - 1];

            // 고유한 키를 위해 segment.id가 있으면 사용, 없으면 index 사용
            const departureSegmentKey = departureItinSummary.id || 'dep-summary';

            return (
              <Paper
                key={flight.id}
                elevation={1}
                className="overflow-hidden rounded-md"
              >
                <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } }}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls={`panel${flight.id}-content`}
                    id={`panel${flight.id}-header`}
                    sx={{ '& .MuiAccordionSummary-content': { margin: '12px 0' } }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                       <Box className="flex flex-col md:flex-row justify-between items-start md:items-center w-full">
                        <Box className="mb-2 md:mb-0">
                          <Typography variant="body1" component="h3" className="font-semibold">
                            {departureItinSummary.departure.iataCode} → {arrivalItinSummary.arrival.iataCode}
                            <Typography variant="caption" sx={{ ml: 1 }}>
                                ({firstItinerary.segments.length -1 === 0 ? '직항' : `${firstItinerary.segments.length - 1}회 경유`})
                                {isRoundTrip && " (왕복)"}
                            </Typography>
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(departureItinSummary.departure.at).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {isRoundTrip && secondItinerary && 
                                ` ~ ${new Date(secondItinerary.segments[secondItinerary.segments.length - 1].arrival.at).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric'})}`
                            }
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            항공사: {flight.validatingAirlineCodes?.join(', ')}
                            {departureItinSummary.operating?.carrierCode && departureItinSummary.operating.carrierCode !== departureItinSummary.carrierCode && 
                                ` (운항: ${dictionaries?.carriers?.[departureItinSummary.operating.carrierCode] || departureItinSummary.operating.carrierCode})`}
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
                  </AccordionSummary>
                  <AccordionDetails sx={{ borderTop: '1px solid #eee', pt: 2 }}>
                    {renderItineraryDetails(firstItinerary, flight.id, dictionaries, isRoundTrip ? "가는 여정" : "여정 상세 정보")}
                    
                    {isRoundTrip && secondItinerary && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        {renderItineraryDetails(secondItinerary, flight.id, dictionaries, "오는 여정")}
                      </>
                    )}
                    
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt:2 }}>가격 및 요금 정보</Typography>
                    <Typography variant="caption" display="block">총액 (1인): {formatPrice(flight.price.grandTotal || flight.price.total, flight.price.currency)}</Typography>
                    <Typography variant="caption" display="block">기본 운임: {formatPrice(flight.price.base, flight.price.currency)}</Typography>
                    {flight.price.fees && flight.price.fees.length > 0 && (
                        <Typography variant="caption" display="block">수수료: 
                            {flight.price.fees.map(fee => `${fee.type}: ${formatPrice(fee.amount, flight.price.currency)}`).join(', ')}
                        </Typography>
                    )}
                    {flight.price.taxes && flight.price.taxes.length > 0 && (
                         <Typography variant="caption" display="block">세금: 
                            {flight.price.taxes.map(tax => `${tax.code}: ${formatPrice(tax.amount, flight.price.currency)}`).join(', ')}
                        </Typography>
                    )}
                    <Typography variant="caption" display="block">
                        마지막 발권일: {flight.lastTicketingDate ? new Date(flight.lastTicketingDate).toLocaleDateString('ko-KR') : '-'}
                        , 예약 가능 좌석: {flight.numberOfBookableSeats || '-'}석
                    </Typography>

                    {renderFareDetails(flight.travelerPricings, dictionaries)}

                  </AccordionDetails>
                </Accordion>
              </Paper>
            )
          })}
        </Box>
      )}
    </Box>
  );

  return fullWidth ? renderSearchResults() : renderSearchForm();
};

export default FlightPlan; 