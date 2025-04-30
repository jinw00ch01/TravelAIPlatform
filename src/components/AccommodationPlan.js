import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  CircularProgress, 
  Container, 
  Paper,
  Modal,
  Grid,
  Rating,
  Divider,
  IconButton,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Dialog
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import axios from 'axios';
import SortIcon from '@mui/icons-material/Sort';
import StarIcon from '@mui/icons-material/Star';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchPopup from './SearchPopup';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 800,
  maxHeight: '90vh',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  overflow: 'auto',
  borderRadius: 2,
};

const AccommodationPlan = forwardRef(({ 
  showMap, 
  isSearchTab = false, 
  onHotelSelect, 
  onSearchResults, 
  displayInMain = false,
  onPlaceSelect,
  onSearch,
  onOpenSearchPopup
}, ref) => {
  // 실제 폼 값들을 단일 상태로 관리
  const [formData, setFormData] = useState({
    cityName: '',
    checkIn: null,
    checkOut: null,
    adults: '1',
    latitude: null,
    longitude: null
  });

  // 폼 데이터를 ref로도 추적하여 최신 상태 유지
  const formDataRef = useRef({
    cityName: '',
    checkIn: null,
    checkOut: null,
    adults: '1',
    latitude: null,
    longitude: null
  });

  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortType, setSortType] = useState('default');
  const [sortedResults, setSortedResults] = useState([]);
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);

  // 폼 데이터 변경 감지 및 ref 업데이트
  useEffect(() => {
    console.log('[useEffect] 폼 데이터 업데이트됨:', formData);
    
    // ref 업데이트 (최신 상태 유지)
    formDataRef.current = { ...formData };
    console.log('[useEffect] formDataRef 업데이트됨:', formDataRef.current);
  }, [formData]);

  // 외부에서 호출할 수 있는 함수들을 노출
  useImperativeHandle(ref, () => ({
    handlePlaceSelect,
    searchCities,
    handleSearch,
    openSearchPopup: () => setSearchPopupOpen(true)
  }));

  // 도시 검색
  const searchCities = async (query) => {
    if (!query) return;
    
    try {
      const options = {
        method: 'GET',
        url: 'https://booking-com.p.rapidapi.com/v1/hotels/locations',
        params: {
          name: query,
          locale: 'ko'
        },
        headers: {
          'X-RapidAPI-Key': '346bed33f9msh20822bf5b127c39p1b4e9djsn5f1e4f599f40',
          'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
        }
      };

      const response = await axios.request(options);
      const cityResults = response.data.filter(item => item.dest_type === 'city');
      setCities(cityResults);
    } catch (err) {
      console.error('City search error:', err);
    }
  };

  const handleHotelClick = async (hotel) => {
    if (onHotelSelect) {
      onHotelSelect(hotel);
    } else {
      setSelectedHotel(hotel);
      setModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedHotel(null);
  };

  // 정렬 함수
  const sortResults = (results, type) => {
    let sorted = [...results];
    switch (type) {
      case 'price':
        sorted.sort((a, b) => {
          const priceA = parseInt(a.price.replace(/[^0-9]/g, '')) || 0;
          const priceB = parseInt(b.price.replace(/[^0-9]/g, '')) || 0;
          return priceA - priceB;
        });
        break;
      case 'rating':
        sorted.sort((a, b) => (b.review_score || 0) - (a.review_score || 0));
        break;
      default:
        return results;
    }
    return sorted;
  };

  // 정렬 타입 변경 핸들러
  const handleSortChange = (event, newSortType) => {
    if (newSortType !== null) {
      setSortType(newSortType);
      const sorted = sortResults(searchResults, newSortType);
      setSortedResults(sorted);
      if (onSearchResults) {
        onSearchResults(sorted);
      }
    }
  };

  // 날짜 변경 핸들러
  const handleDateChange = (field, date) => {
    console.log(`[handleDateChange] ${field} 변경 전:`, formDataRef.current[field]);
    console.log(`[handleDateChange] ${field} 변경 후:`, date);
    
    // formDataRef 직접 업데이트
    formDataRef.current = {
      ...formDataRef.current,
      [field]: date
    };
    
    setFormData(prev => {
      const newState = {
        ...prev,
        [field]: date
      };
      console.log(`[handleDateChange] 새로운 formData:`, newState);
      return newState;
    });
  };

  // 인원 수 변경 핸들러
  const handleAdultsChange = (event) => {
    const value = event.target.value;
    console.log('[handleAdultsChange] 인원 수 변경 전:', formDataRef.current.adults);
    console.log('[handleAdultsChange] 인원 수 변경 후:', value);
    
    if (value && parseInt(value) > 0) {
      // formDataRef 직접 업데이트
      formDataRef.current = {
        ...formDataRef.current,
        adults: value
      };
      
      setFormData(prev => {
        const newState = {
          ...prev,
          adults: value
        };
        console.log('[handleAdultsChange] 새로운 formData:', newState);
        return newState;
      });
    }
  };

  // 장소 선택 핸들러
  const handlePlaceSelect = async (place) => {
    console.log('[handlePlaceSelect] 장소 선택됨:', place);

    if (onPlaceSelect && !displayInMain) {
      onPlaceSelect(place);
      return;
    }

    if (!place.lat || !place.lng) {
      setError('선택한 장소의 위치 정보를 찾을 수 없습니다.');
      return;
    }
    
    // formDataRef 직접 업데이트
    formDataRef.current = {
      ...formDataRef.current,
      cityName: place.name,
      latitude: place.lat,
      longitude: place.lng
    };
    
    setFormData(prev => {
      const newState = {
        ...prev,
        cityName: place.name,
        latitude: place.lat,
        longitude: place.lng
      };
      console.log('[handlePlaceSelect] 새로운 formData:', newState);
      return newState;
    });
    
    setSearchPopupOpen(false);
  };

  // 검색 핸들러
  const handleSearch = async () => {
    console.log('[handleSearch] 검색 버튼 클릭됨');
    console.log('[handleSearch] 현재 formData 상태:', formData);
    console.log('[handleSearch] 현재 formDataRef 상태:', formDataRef.current);
    
    if (onSearch && !displayInMain) {
      onSearch();
      return;
    }

    // 현재 formData의 최신 상태를 사용
    const searchData = { ...formData };
    console.log('[handleSearch] 검색에 사용될 정확한 데이터:', searchData);
    
    // 검색 데이터 유효성 검사
    if (!searchData.cityName) {
      setError('도시를 선택해주세요.');
      return;
    }

    if (!searchData.checkIn || !searchData.checkOut) {
      setError('체크인/체크아웃 날짜를 선택해주세요.');
      return;
    }

    if (!searchData.adults || parseInt(searchData.adults) < 1) {
      setError('인원 수를 입력해주세요.');
      return;
    }

    // 유효한 데이터로 검색 실행
    await executeSearch(searchData);
  };
  
  // 실제 검색 실행 함수
  const executeSearch = async (searchData) => {
    console.log('[executeSearch] 검색 실행 시작, 데이터:', searchData);

    try {
      setLoading(true);
      setError(null);

      let searchOptions;
      
      // 좌표가 있는 경우 (대학교나 특정 장소)
      if (searchData.latitude && searchData.longitude) {
        console.log('[executeSearch] 좌표 기반 검색:', {
          lat: searchData.latitude,
          lng: searchData.longitude
        });
        
        searchOptions = {
          method: 'GET',
          url: 'https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates',
          params: {
            units: 'metric',
            room_number: '1',
            checkout_date: format(searchData.checkOut, 'yyyy-MM-dd'),
            filter_by_currency: 'KRW',
            currency: 'KRW',
            currencies: 'KRW',
            selected_currency: 'KRW',
            locale: 'ko',
            language: 'ko',
            lang: 'ko',
            checkin_date: format(searchData.checkIn, 'yyyy-MM-dd'),
            adults_number: searchData.adults,
            order_by: 'distance',
            latitude: searchData.latitude.toString(),
            longitude: searchData.longitude.toString(),
            page_number: '0',
            page_size: '25',
            categories_filter_ids: 'class::2,class::4,class::5',
            filter_by_distance: '5000',
            distance_unit: 'meters',
            include_adjacency: 'false'
          },
          headers: {
            'X-RapidAPI-Key': '346bed33f9msh20822bf5b127c39p1b4e9djsn5f1e4f599f40',
            'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
          }
        };
      } else {
        // 도시 검색을 먼저 수행하여 dest_id를 가져옵니다
        const citySearchOptions = {
          method: 'GET',
          url: 'https://booking-com.p.rapidapi.com/v1/hotels/locations',
          params: {
            name: searchData.cityName,
            locale: 'ko'
          },
          headers: {
            'X-RapidAPI-Key': '346bed33f9msh20822bf5b127c39p1b4e9djsn5f1e4f599f40',
            'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
          }
        };

        const cityResponse = await axios.request(citySearchOptions);
        const cityResults = cityResponse.data.filter(item => item.dest_type === 'city');
        
        if (cityResults.length === 0) {
          setError('선택한 도시를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        const selectedCity = cityResults[0];

        searchOptions = {
          method: 'GET',
          url: 'https://booking-com.p.rapidapi.com/v1/hotels/search',
          params: {
            units: 'metric',
            room_number: '1',
            checkout_date: format(searchData.checkOut, 'yyyy-MM-dd'),
            filter_by_currency: 'KRW',
            currency: 'KRW',
            currencies: 'KRW',
            selected_currency: 'KRW',
            locale: 'ko',
            language: 'ko',
            lang: 'ko',
            checkin_date: format(searchData.checkIn, 'yyyy-MM-dd'),
            adults_number: searchData.adults,
            dest_type: 'city',
            dest_id: selectedCity.dest_id,
            order_by: 'popularity',
            page_number: '0',
            page_size: '25',
            categories_filter_ids: 'class::2,class::4,class::5',
            include_adjacency: 'true'
          },
          headers: {
            'X-RapidAPI-Key': '346bed33f9msh20822bf5b127c39p1b4e9djsn5f1e4f599f40',
            'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
          }
        };
      }

      console.log('[executeSearch] API 요청 옵션:', {
        url: searchOptions.url,
        params: searchOptions.params
      });

      const response = await axios.request(searchOptions);
      
      if (response.data && response.data.result) {
        const processedResults = response.data.result.map(hotel => {
          // 가격 정보 처리
          let priceDisplay = '가격 정보 없음';
          let priceValue = 0;

          // 가격 정보 처리 로직
          if (hotel.composite_price_breakdown?.all_inclusive_amount?.value) {
            priceValue = hotel.composite_price_breakdown.all_inclusive_amount.value;
          } else if (hotel.composite_price_breakdown?.gross_amount?.value) {
            priceValue = hotel.composite_price_breakdown.gross_amount.value;
          } else if (hotel.min_total_price) {
            priceValue = hotel.min_total_price;
          } else if (hotel.price_breakdown?.gross_price) {
            priceValue = hotel.price_breakdown.gross_price;
          } else if (hotel.price) {
            priceValue = hotel.price;
          }

          // 통화 변환 처리
          const currencyCode = hotel.currency || hotel.currencycode || 'KRW';
          if (currencyCode !== 'KRW') {
            // USD to KRW 환율 (예시 환율, 실제 환율은 API를 통해 가져와야 함)
            const exchangeRate = 1300; // 1 USD = 1300 KRW
            priceValue = priceValue * exchangeRate;
          }

          if (priceValue > 0) {
            priceDisplay = `₩${Math.round(priceValue).toLocaleString('ko-KR')}`;
          }

          // 호텔 이름 처리 - 한글 우선
          let hotelName = '';
          let originalName = hotel.hotel_name || '';

          // 한글 이름 우선순위: translated_name > hotel_name_trans > preferred_name
          if (hotel.translated_name) {
            hotelName = hotel.translated_name;
          } else if (hotel.hotel_name_trans) {
            hotelName = hotel.hotel_name_trans;
          } else if (hotel.preferred_name) {
            hotelName = hotel.preferred_name;
          } else {
            hotelName = originalName;
          }

          // 한글 이름이 있고 원본 이름과 다른 경우에만 원본 이름 정보 유지
          const hasTranslatedName = 
            (hotel.translated_name && hotel.translated_name !== originalName) || 
            (hotel.hotel_name_trans && hotel.hotel_name_trans !== originalName);
          
          const finalOriginalName = hasTranslatedName ? originalName : null;

          return {
            hotel_id: hotel.hotel_id,
            hotel_name: hotelName,
            original_name: finalOriginalName,
            address: hotel.address,
            city: hotel.city,
            main_photo_url: hotel.max_photo_url,
            price: priceDisplay,
            review_score: hotel.review_score,
            review_score_word: hotel.review_score_word,
            distance_to_cc: hotel.distance_to_cc,
            latitude: hotel.latitude,
            longitude: hotel.longitude
          };
        });

        setSearchResults(processedResults);
        setSortedResults(processedResults);
        console.log('검색 결과 처리 완료:', processedResults.length, '개 항목');
      } else {
        console.log('검색 결과 없음');
        setSearchResults([]);
        setSortedResults([]);
      }
    } catch (err) {
      console.error('[executeSearch] 오류 발생:', err);
      setError('검색 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // Haversine formula를 사용한 두 지점 간의 거리 계산 (km)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // 예약 페이지로 이동하는 함수
  const handleBooking = (event, hotel) => {
    event.stopPropagation();
    if (hotel.url) {
      window.open(hotel.url, '_blank');
    } else {
      console.error('예약 URL을 찾을 수 없습니다.');
      const fallbackUrl = `https://www.booking.com/searchresults.ko.html?ss=${encodeURIComponent(hotel.hotel_name)}&checkin=${format(formData.checkIn, 'yyyy-MM-dd')}&checkout=${format(formData.checkOut, 'yyyy-MM-dd')}&group_adults=${formData.adults}&no_rooms=1&lang=ko`;
      window.open(fallbackUrl, '_blank');
    }
  };

  // 검색 팝업 열기
  const handleOpenSearchPopupClick = () => {
    if (onOpenSearchPopup && !displayInMain) {
      onOpenSearchPopup();
      return;
    }
    
    setSearchPopupOpen(true);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 검색 폼 - 메인 컨텐츠 영역이 아닐 때만 표시 (사이드바에서만 표시) */}
      {!displayInMain && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleOpenSearchPopupClick}
            >
              {formData.cityName || '도시 또는 지역 검색'}
            </Button>
        
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
                label="체크인"
                value={formData.checkIn}
                onChange={(date) => handleDateChange('checkIn', date)}
                slotProps={{ 
                  textField: { 
                    fullWidth: true,
                    error: !formData.checkIn && error,
                    helperText: !formData.checkIn && error ? '체크인 날짜를 선택해주세요' : ''
                  } 
                }}
            />
            <DatePicker
                label="체크아웃"
                value={formData.checkOut}
                onChange={(date) => handleDateChange('checkOut', date)}
                minDate={formData.checkIn ? new Date(formData.checkIn) : null}
                slotProps={{ 
                  textField: { 
                    fullWidth: true,
                    error: !formData.checkOut && error,
                    helperText: !formData.checkOut && error ? '체크아웃 날짜를 선택해주세요' : ''
                  } 
                }}
              />
        </LocalizationProvider>

            <TextField
              fullWidth
              label="성인 수"
              type="text"
              value={formData.adults}
              onChange={handleAdultsChange}
              onFocus={e => e.target.select()}
              inputProps={{ 
                inputMode: 'numeric',
                pattern: '[0-9]*',
                min: 1, 
                max: 10 
              }}
              error={!formData.adults && error}
              helperText={!formData.adults && error ? '인원 수를 입력해주세요' : ''}
            />

      <Button
        variant="contained"
        color="primary"
              fullWidth
              size="large"
        onClick={handleSearch}
        disabled={loading}
              sx={{ height: '56px' }}
      >
              {loading ? <CircularProgress size={24} color="inherit" /> : '숙소 검색'}
      </Button>

      {error && (
              <Typography color="error">
          {error}
              </Typography>
            )}
          </Box>
        </Paper>
      )}

      {/* 검색 결과 목록 - 메인 컨텐츠 영역일 때만 표시 */}
      {displayInMain && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
      )}

          {error && (
            <Typography color="error" sx={{ p: 2 }}>
              {error}
            </Typography>
          )}
          
          {!loading && !error && searchResults.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1">
                왼쪽 사이드바에서 숙소를 검색하세요.
              </Typography>
              {!displayInMain && (
                <Button 
                  variant="outlined" 
                  color="primary" 
                  onClick={handleOpenSearchPopupClick} 
                  sx={{ mt: 2 }}
                >
                  위치로 검색하기
                </Button>
              )}
            </Box>
          )}
          
          {searchResults.length > 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  검색 결과 ({searchResults.length}개)
                </Typography>
                <ToggleButtonGroup
                  value={sortType}
                  exclusive
                  onChange={handleSortChange}
                  size="small"
                >
                  <ToggleButton value="default">
                    <Tooltip title="기본 정렬">
                      <SortIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="price">
                    <Tooltip title="가격순 정렬">
                      <AttachMoneyIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="rating">
                    <Tooltip title="평점순 정렬">
                      <StarIcon />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              
              {sortedResults.map((hotel) => (
                <Paper 
                  key={hotel.hotel_id}
                  sx={{
                    p: 2,
                    mb: 2,
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 6
                    }
                  }}
                  onClick={() => handleHotelClick(hotel)}
                >
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      {hotel.main_photo_url && (
                        <Box
                          component="img"
                          src={hotel.main_photo_url}
                          alt={hotel.hotel_name}
                          sx={{
                            width: '100%',
                            height: 150,
                            objectFit: 'cover',
                            borderRadius: 1
                          }}
                        />
                      )}
                    </Grid>
                    <Grid item xs={12} sm={8}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="h6">{hotel.hotel_name}</Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {hotel.address}, {hotel.city}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={(e) => handleBooking(e, hotel)}
                          startIcon={<OpenInNewIcon />}
                          sx={{ minWidth: '100px' }}
                        >
                          선택
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <Rating value={hotel.review_score / 2} precision={0.5} readOnly />
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {hotel.review_score_word} ({hotel.review_score})
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 1 }}>
                        <Typography 
                          variant="h6" 
                          color="primary" 
                          sx={{ display: 'inline-block' }}
                        >
                          {hotel.price}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </>
          )}
        </Box>
      )}

      {/* Modals */}
      <Dialog
        open={searchPopupOpen}
        onClose={() => setSearchPopupOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <SearchPopup
          onSelect={handlePlaceSelect}
          onClose={() => setSearchPopupOpen(false)}
        />
      </Dialog>

      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        aria-labelledby="hotel-detail-modal"
      >
        <Box sx={modalStyle}>
          {selectedHotel && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" component="h2">
                  {selectedHotel.hotel_name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={(e) => handleBooking(e, selectedHotel)}
                    startIcon={<OpenInNewIcon />}
                  >
                    Booking.com에서 예약
                  </Button>
                  <IconButton onClick={handleCloseModal}>
                    <CloseIcon />
                  </IconButton>
                </Box>
              </Box>
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box
                    component="img"
                    src={selectedHotel.main_photo_url}
                    alt={selectedHotel.hotel_name}
                    sx={{
                      width: '100%',
                      height: 400,
                      objectFit: 'cover',
                      borderRadius: 2
                    }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="body1" paragraph>
                    {selectedHotel.address}, {selectedHotel.city}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Rating value={selectedHotel.review_score / 2} precision={0.5} readOnly />
                    <Typography variant="body1" sx={{ ml: 1 }}>
                      {selectedHotel.review_score_word}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" color="primary" sx={{ display: 'inline-block' }}>
                      1박 요금: {selectedHotel.price}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {selectedHotel.distance_to_cc && (
                    <Typography variant="body1" paragraph>
                      {selectedHotel.distance_to_cc}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </>
      )}
        </Box>
      </Modal>
    </Box>
  );
});

export default AccommodationPlan; 