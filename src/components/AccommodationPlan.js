import React, { useState } from 'react';
import { Box, TextField, Button, Typography, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import amadeusApi from '../utils/amadeusApi';

const AccommodationPlan = ({ showMap, isSearchTab = false }) => {
  const [searchParams, setSearchParams] = useState({
    location: '',
    checkIn: null,
    checkOut: null,
    guests: ''
  });
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = () => {
    // TODO: API 호출 구현
    console.log('Searching with params:', searchParams);
    // 임시 테스트 데이터
    setSearchResults([
      { id: 1, name: '그랜드 하얏트 서울', price: '350,000', rating: 4.5 },
      { id: 2, name: '롯데호텔 서울', price: '280,000', rating: 4.3 },
      // ... 더 많은 테스트 데이터
    ]);
  };

  if (isSearchTab) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>숙소 검색</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="목적지"
            value={searchParams.location}
            onChange={(e) => setSearchParams({ ...searchParams, location: e.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="체크인"
              value={searchParams.checkIn}
              onChange={(date) => setSearchParams({ ...searchParams, checkIn: date })}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
            <DatePicker
              label="체크아웃"
              value={searchParams.checkOut}
              onChange={(date) => setSearchParams({ ...searchParams, checkOut: date })}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </LocalizationProvider>
          <TextField
            fullWidth
            label="투숙객"
            type="number"
            value={searchParams.guests}
            onChange={(e) => setSearchParams({ ...searchParams, guests: e.target.value })}
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleSearch}
            sx={{ mt: 2 }}
          >
            숙소 검색
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {searchResults.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {searchResults.map((hotel) => (
            <Box
              key={hotel.id}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                '&:hover': {
                  boxShadow: 1,
                }
              }}
            >
              <Typography variant="h6">{hotel.name}</Typography>
              <Typography variant="body1">₩{hotel.price}/박</Typography>
              <Typography variant="body2">평점: {hotel.rating}</Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography variant="body1" color="text.secondary" align="center">
          검색 결과가 없습니다. 검색을 진행해주세요.
        </Typography>
      )}
    </Box>
  );
};

export default AccommodationPlan; 