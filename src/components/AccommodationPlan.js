import React, { useState } from 'react';
import { TextField, Button, CircularProgress, Autocomplete } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import amadeusApi from '../utils/amadeusApi';

const AccommodationPlan = () => {
  const [loading, setLoading] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [selectedCity, setSelectedCity] = useState(null);
  const [checkInDate, setCheckInDate] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState(null);
  const [cities, setCities] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [error, setError] = useState(null);

  const handleCitySearch = async (value) => {
    if (!value || value.length < 2) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await amadeusApi.searchCities(value);
      if (response && response.data) {
        setCities(response.data);
      } else {
        setError('검색 결과가 없습니다.');
      }
    } catch (err) {
      setError(err.message || '도시 검색 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedCity || !checkInDate || !checkOutDate) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await amadeusApi.searchHotels(
        selectedCity.iataCode,
        checkInDate.toISOString().split('T')[0],
        checkOutDate.toISOString().split('T')[0]
      );
      if (response && response.data) {
        setHotels(response.data);
      } else {
        setError('검색 결과가 없습니다.');
      }
    } catch (err) {
      setError(err.message || '호텔 검색 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">숙소 계획</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Autocomplete
          options={cities}
          getOptionLabel={(option) => option.name || ''}
          onChange={(_, value) => setSelectedCity(value)}
          onInputChange={(_, value) => {
            setCitySearch(value);
            handleCitySearch(value);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="도시 검색"
              variant="outlined"
              error={!!error && !selectedCity}
              helperText={error && !selectedCity ? '도시를 선택해주세요' : ''}
            />
          )}
        />
        
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="체크인 날짜"
              value={checkInDate}
              onChange={setCheckInDate}
              renderInput={(params) => <TextField {...params} />}
              minDate={new Date()}
            />
            <DatePicker
              label="체크아웃 날짜"
              value={checkOutDate}
              onChange={setCheckOutDate}
              renderInput={(params) => <TextField {...params} />}
              minDate={checkInDate || new Date()}
            />
          </div>
        </LocalizationProvider>
      </div>

      <Button
        variant="contained"
        color="primary"
        onClick={handleSearch}
        disabled={loading}
        className="w-full"
      >
        {loading ? <CircularProgress size={24} /> : '숙소 검색'}
      </Button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {hotels.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotels.map((hotel) => (
            <div
              key={hotel.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2">{hotel.hotel.name}</h3>
                <p className="text-gray-600 mb-2">{hotel.hotel.address.lines.join(', ')}</p>
                <p className="text-sm text-gray-500 mb-2">
                  {hotel.hotel.rating}성급
                </p>
                {hotel.offers && hotel.offers[0] && (
                  <div className="mt-2">
                    <p className="text-lg font-bold text-primary">
                      {new Intl.NumberFormat('ko-KR', {
                        style: 'currency',
                        currency: hotel.offers[0].price.currency
                      }).format(hotel.offers[0].price.total)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {hotel.offers[0].room.typeEstimated.category}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccommodationPlan; 