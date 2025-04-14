import React, { useState } from 'react';
import { TextField, Button, CircularProgress, Autocomplete } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import amadeusApi from '../utils/amadeusApi';

const FlightPlan = () => {
  const [loading, setLoading] = useState(false);
  const [originSearch, setOriginSearch] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [departureDate, setDepartureDate] = useState(null);
  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);
  const [flights, setFlights] = useState([]);
  const [error, setError] = useState(null);

  const handleCitySearch = async (value, type) => {
    if (!value || value.length < 2) return;
    
    try {
      setLoading(true);
      const response = await amadeusApi.searchCities(value);
      if (type === 'origin') {
        setOriginCities(response.data);
      } else {
        setDestinationCities(response.data);
      }
    } catch (err) {
      setError('도시 검색 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedOrigin || !selectedDestination || !departureDate) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await amadeusApi.searchFlights(
        selectedOrigin.iataCode,
        selectedDestination.iataCode,
        departureDate.toISOString().split('T')[0]
      );
      setFlights(response.data);
    } catch (err) {
      setError('항공편 검색 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(price);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">비행 계획</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Autocomplete
          options={originCities}
          getOptionLabel={(option) => `${option.name} (${option.iataCode})`}
          onChange={(_, value) => setSelectedOrigin(value)}
          onInputChange={(_, value) => {
            setOriginSearch(value);
            handleCitySearch(value, 'origin');
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="출발지"
              variant="outlined"
              error={!!error && !selectedOrigin}
              helperText={error && !selectedOrigin ? '출발지를 선택해주세요' : ''}
            />
          )}
        />
        
        <Autocomplete
          options={destinationCities}
          getOptionLabel={(option) => `${option.name} (${option.iataCode})`}
          onChange={(_, value) => setSelectedDestination(value)}
          onInputChange={(_, value) => {
            setDestinationSearch(value);
            handleCitySearch(value, 'destination');
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="도착지"
              variant="outlined"
              error={!!error && !selectedDestination}
              helperText={error && !selectedDestination ? '도착지를 선택해주세요' : ''}
            />
          )}
        />
        
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="출발 날짜"
            value={departureDate}
            onChange={setDepartureDate}
            renderInput={(params) => <TextField {...params} fullWidth />}
            minDate={new Date()}
          />
        </LocalizationProvider>
      </div>

      <Button
        variant="contained"
        color="primary"
        onClick={handleSearch}
        disabled={loading}
        className="w-full"
      >
        {loading ? <CircularProgress size={24} /> : '항공편 검색'}
      </Button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {flights.length > 0 && (
        <div className="mt-8 space-y-4">
          {flights.map((flight) => (
            <div
              key={flight.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {flight.itineraries[0].segments[0].departure.iataCode} →{' '}
                      {flight.itineraries[0].segments[0].arrival.iataCode}
                    </h3>
                    <p className="text-gray-600">
                      {new Date(flight.itineraries[0].segments[0].departure.at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      {formatPrice(flight.price.total)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {flight.itineraries[0].duration}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <p>항공사: {flight.validatingAirlineCodes[0]}</p>
                  <p>좌석 등급: {flight.travelerPricings[0].fareDetailsBySegment[0].cabin}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlightPlan; 