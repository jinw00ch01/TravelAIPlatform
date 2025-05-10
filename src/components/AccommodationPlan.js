import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  CircularProgress, 
  Paper,
  Modal,
  Grid,
  Rating,
  Divider,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import axios from 'axios';
import SearchPopup from './SearchPopup';
import { Search as SearchIcon, Add as AddIcon, Sort as SortIcon, AttachMoney as AttachMoneyIcon, Star as StarIcon } from '@mui/icons-material';
import HotelMap from './HotelMap';
import { travelApi } from '../services/api';

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

const JPY_TO_KRW = 9.5;    // 1엔 = 9.5원
const USD_TO_KRW = 1350;   // 1달러 = 1350원
const CNY_TO_KRW = 185;    // 1위안 = 185원
function convertToKRW(value, currency) {
  if (currency === 'KRW') return value;
  if (currency === 'JPY') return Math.round(value * JPY_TO_KRW);
  if (currency === 'USD') return Math.round(value * USD_TO_KRW);
  if (currency === 'CNY' || currency === 'RMB') return Math.round(value * CNY_TO_KRW);
  return value;
}

const AccommodationPlan = forwardRef(({ 
  showMap: showMapProp,
  isSearchTab = false, 
  onHotelSelect, 
  onSearchResults, 
  displayInMain = false,
  onPlaceSelect,
  onSearch,
  onOpenSearchPopup,
  formData,
  setFormData,
  travelPlans,
  setTravelPlans
}, ref) => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [sortType, setSortType] = useState('default');
  const [sortedResults, setSortedResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const initialized = useRef(false);
  const [showMap, setShowMap] = useState(true);
  const [addToPlanDialogOpen, setAddToPlanDialogOpen] = useState(false);
  const [hotelToAdd, setHotelToAdd] = useState(null);
  const [latestPlan, setLatestPlan] = useState(null);
  const [daySelectList, setDaySelectList] = useState([]);

  const handleDateChange = (field, date) => {
    console.log(`${field} 날짜 변경:`, date);
    const newFormData = {
      ...formData,
      [field]: date
    };
    setFormData(newFormData);
    console.log('날짜 변경 후 업데이트된 formData:', newFormData);
  };

  const handleAdultsChange = (event) => {
    const value = event.target.value;
    console.log('인원 수 변경:', value);
    
    // 빈 문자열이거나 숫자인 경우 모두 허용
    if (value === '' || /^\d+$/.test(value)) {
      const newFormData = {
        ...formData,
        adults: value
      };
      setFormData(newFormData);
      console.log('인원 수 변경 후 업데이트된 formData:', newFormData);
      
      // 기존 검색 결과가 있는 경우, URL만 업데이트
      if (searchResults.length > 0 && value !== '') {
        const updatedResults = searchResults.map(hotel => ({
          ...hotel,
          url: `https://www.booking.com/hotel.ko.html?hotel_id=${hotel.hotel_id}&checkin=${format(formData.checkIn, 'yyyy-MM-dd')}&checkout=${format(formData.checkOut, 'yyyy-MM-dd')}&group_adults=${value}&no_rooms=1&lang=ko`
        }));
        setSearchResults(updatedResults);
        setSortedResults(sortResults(updatedResults, sortType));
      }
    }
  };

  const handleOpenSearchPopupClick = () => {
    if (onOpenSearchPopup && !displayInMain) {
      onOpenSearchPopup();
      return;
    }
    
    setSearchPopupOpen(true);
  };

  const handlePlaceSelect = async (place) => {
    console.log('선택된 장소:', place);
    
    if (!place.lat || !place.lng) {
      setError('선택한 장소의 위치 정보를 찾을 수 없습니다.');
      return;
    }
    
    const newFormData = {
      ...formData,
      cityName: place.name,
      latitude: place.lat,
      longitude: place.lng
    };
    
    setFormData(newFormData);
    console.log('장소 선택 후 업데이트된 formData:', newFormData);
    
    if (onPlaceSelect && !displayInMain) {
      onPlaceSelect(place);
    }
    
    setSearchPopupOpen(false);
    setIsDialogOpen(false);
  };

  const handleSearch = async () => {
    console.log('검색 시작 - 현재 formData:', formData);
    
    if (!formData.cityName) {
      setError('도시를 선택해주세요.');
      return;
    }

    if (!formData.checkIn || !formData.checkOut) {
      setError('체크인/체크아웃 날짜를 선택해주세요.');
      return;
    }

    if (!formData.adults || parseInt(formData.adults) < 1) {
      setError('인원 수를 입력해주세요.');
      return;
    }

    if (onSearch && !displayInMain) {
      onSearch();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('API 요청 파라미터:', {
        checkin_date: format(formData.checkIn, 'yyyy-MM-dd'),
        checkout_date: format(formData.checkOut, 'yyyy-MM-dd'),
        adults_number: formData.adults,
        latitude: formData.latitude,
        longitude: formData.longitude
      });

      let allResults = [];

      for (let page = 0; page < 3; page++) {
        const searchOptions = {
          method: 'GET',
          url: 'https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates',
          params: {
            units: 'metric',
            room_number: '1',
            checkout_date: format(formData.checkOut, 'yyyy-MM-dd'),
            filter_by_currency: 'KRW',
            locale: 'ko',
            checkin_date: format(formData.checkIn, 'yyyy-MM-dd'),
            adults_number: formData.adults,
            order_by: 'distance',
            latitude: formData.latitude.toString(),
            longitude: formData.longitude.toString(),
            page_number: page.toString(),
            page_size: '25',
            categories_filter_ids: 'class::0,class::1,class::2,class::3,class::4,class::5,class::6,class::7,class::8,class::9',
            filter_by_distance: '5000',
            distance_unit: 'meters',
            include_adjacency: 'false'
          },
          headers: {
            'X-RapidAPI-Key': '346bed33f9msh20822bf5b127c39p1b4e9djsn5f1e4f599f40',
            'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
          }
        };

        console.log(`페이지 ${page + 1} 검색 요청`);
        const response = await axios.request(searchOptions);
        console.log(`페이지 ${page + 1} 검색 결과:`, response.data?.result?.length || 0, '개');
        
        if (response.data && response.data.result) {
          const filteredResults = response.data.result.filter(hotel => {
            const distance = parseFloat(hotel.distance_to_cc);
            const actualDistance = calculateDistance(
              formData.latitude,
              formData.longitude,
              parseFloat(hotel.latitude),
              parseFloat(hotel.longitude)
            );
            return !isNaN(distance) && actualDistance <= 5;
          });

          console.log(`페이지 ${page + 1} 필터링된 결과:`, filteredResults.length, '개');
          allResults = [...allResults, ...filteredResults];
        }
      }

      console.log('전체 검색 결과:', allResults.length, '개');

      if (allResults.length > 0) {
        const processedResults = allResults.map(hotel => {
          let priceDisplay = '가격 정보 없음';
          let originalPrice = null;
          let currency = hotel.composite_price_breakdown?.gross_amount?.currency || 'KRW';
          let value = null;
          if (hotel.composite_price_breakdown?.gross_amount?.value) {
            value = hotel.composite_price_breakdown.gross_amount.value;
          } else if (hotel.composite_price_breakdown?.all_inclusive_amount?.value) {
            value = hotel.composite_price_breakdown.all_inclusive_amount.value;
          } else if (hotel.min_total_price) {
            value = hotel.min_total_price;
          }
          if (value !== null) {
            value = convertToKRW(value, currency);
            priceDisplay = `KRW ${value.toLocaleString()}`;
          }
          if (hotel.composite_price_breakdown?.strikethrough_amount?.value) {
            let originalValue = hotel.composite_price_breakdown.strikethrough_amount.value;
            let originalCurrency = hotel.composite_price_breakdown.strikethrough_amount.currency || currency;
            originalValue = convertToKRW(originalValue, originalCurrency);
            originalPrice = `KRW ${originalValue.toLocaleString()}`;
          }

          const actualDistance = calculateDistance(
            formData.latitude,
            formData.longitude,
            parseFloat(hotel.latitude),
            parseFloat(hotel.longitude)
          );

          let distanceDisplay = '정보 없음';
          if (!isNaN(actualDistance)) {
            distanceDisplay = actualDistance < 1 ? 
              `${Math.round(actualDistance * 1000)}m` : 
              `${actualDistance.toFixed(1)}km`;
          }

          return {
            hotel_id: hotel.hotel_id,
            hotel_name: hotel.hotel_name_trans || hotel.hotel_name,
            original_name: hotel.hotel_name,
            address: hotel.address || '',
            city: hotel.city || '',
            main_photo_url: hotel.max_photo_url,
            review_score: hotel.review_score || 0,
            review_score_word: hotel.review_score_word || '',
            price: priceDisplay !== '가격 정보 없음' ? priceDisplay : priceDisplay,
            original_price: originalPrice ? originalPrice : null,
            distance_to_center: distanceDisplay,
            latitude: hotel.latitude,
            longitude: hotel.longitude,
            url: `https://www.booking.com/hotel.ko.html?hotel_id=${hotel.hotel_id}&checkin=${format(formData.checkIn, 'yyyy-MM-dd')}&checkout=${format(formData.checkOut, 'yyyy-MM-dd')}&group_adults=${formData.adults}&no_rooms=1&lang=ko&selected_currency=KRW`,
            actual_distance: actualDistance,
            accommodation_type: hotel.accommodation_type_name || '숙박시설',
            tax_info: hotel.tax_info || '',
          };
        });

        console.log('처리된 결과:', processedResults.length, '개');
        const processedAndSortedResults = sortByDistance(processedResults);
        setSearchResults(processedAndSortedResults);
        setSortedResults(sortResults(processedAndSortedResults, sortType));
        
        if (onSearchResults) {
          onSearchResults(processedAndSortedResults);
        }
      } else {
        setError(`${formData.cityName} 주변 5km 반경 내에 검색 결과를 찾을 수 없습니다.`);
        setSearchResults([]);
      }
    } catch (err) {
      console.error('검색 오류:', err);
      setError(
        err.response?.data?.message || 
        err.message || 
        '검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

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

  const sortByDistance = (results) => {
    return [...results].sort((a, b) => a.actual_distance - b.actual_distance);
  };

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
      case 'default':
        sorted.sort(() => Math.random() - 0.5);
        break;
    }
    return sorted;
  };

  const handleSortChange = (event, newSortType) => {
    if (newSortType !== null) {
      setSortType(newSortType);
      setSortedResults(sortResults(searchResults, newSortType));
    }
  };

  const handleHotelClick = (hotel) => {
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

  const handleBooking = (event, hotel) => {
    event.stopPropagation();
    console.log('[예약] 현재 formData:', formData);
    console.log('[예약] hotel 정보:', hotel);

    // 체크인/체크아웃 날짜가 Date 객체가 아니면 변환
    let checkInDate = formData.checkIn instanceof Date ? formData.checkIn : new Date(formData.checkIn);
    let checkOutDate = formData.checkOut instanceof Date ? formData.checkOut : new Date(formData.checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      alert('날짜 형식이 올바르지 않습니다.');
      return;
    }

    const adults = parseInt(formData.adults, 10);
    if (isNaN(adults) || adults < 1) {
      alert('인원 수가 올바르지 않습니다.');
      return;
    }

    const formattedCheckIn = checkInDate.toISOString().split('T')[0];
    const formattedCheckOut = checkOutDate.toISOString().split('T')[0];
    const hotelName = encodeURIComponent(hotel.hotel_name);

    const bookingUrl = `https://www.booking.com/searchresults.ko.html?ss=${hotelName}&checkin=${formattedCheckIn}&checkout=${formattedCheckOut}&group_adults=${adults}&no_rooms=1&lang=ko`;
    console.log('[예약] Booking.com 호텔명+날짜+인원 검색 URL:', bookingUrl);
    window.open(bookingUrl, '_blank');
  };

  const handleOpenSearchPopup = () => {
    setIsDialogOpen(true);
  };

  const handleHotelSelect = (hotel) => {
    setSelectedPlace(hotel);
    onHotelSelect(hotel);
    setIsDialogOpen(false);
  };

  const handleAddToPlanClick = async () => {
    if (!travelPlans) {
      alert('일정을 먼저 생성해주세요.');
      return;
    }

    const days = Object.keys(travelPlans).length;
    setDaySelectList(Array.from({ length: days }, (_, idx) => ({
      dayKey: idx,
      title: travelPlans[(idx + 1).toString()]?.title || `${idx + 1}일차`
    })));
    setHotelToAdd(selectedHotel);
    setAddToPlanDialogOpen(true);
  };

  const handleSelectDay = (dayKey) => {
    if (!travelPlans || !setTravelPlans) return;
    const hotel = hotelToAdd;
    // 숙소 이름으로 저장
    const newSchedule = {
      id: `hotel-${hotel.hotel_id}-${Date.now()}`,
      name: hotel.hotel_name, // 숙소 이름!
      time: '체크인',
      address: hotel.address,
      category: '숙소',
      duration: '1박',
      notes: `가격: ${hotel.price}`,
      lat: hotel.latitude,
      lng: hotel.longitude,
      type: 'accommodation'
    };
    // dayKey는 0부터 시작, travelPlans의 키는 1,2,3...이므로 dayKey+1
    const dayNum = (dayKey + 1).toString();
    if (!travelPlans[dayNum]) return;
    if (!travelPlans[dayNum].schedules) travelPlans[dayNum].schedules = [];
    const newPlans = { ...travelPlans };
    newPlans[dayNum].schedules = [...newPlans[dayNum].schedules, newSchedule];
    setTravelPlans(newPlans);
    setAddToPlanDialogOpen(false);
    alert('일정에 추가되었습니다!');
  };

  useImperativeHandle(ref, () => ({
    handlePlaceSelect,
    handleSearch,
    openSearchPopup: () => {
      setSearchPopupOpen(true);
    }
  }));

  useEffect(() => {
    // 컴포넌트 마운트 시 복원
    const savedResults = localStorage.getItem('accommodationSearchResults');
    const savedFormData = localStorage.getItem('accommodationFormData');
    if (savedResults) {
      setSearchResults(JSON.parse(savedResults));
      setSortedResults(sortResults(JSON.parse(savedResults), sortType));
    }
    if (savedFormData) {
      try {
        const parsed = JSON.parse(savedFormData);
        // checkIn/checkOut을 Date 객체로 변환, 유효하지 않으면 기본값
        const checkIn = parsed.checkIn ? new Date(parsed.checkIn) : new Date();
        const checkOut = parsed.checkOut ? new Date(parsed.checkOut) : new Date(new Date().setDate(new Date().getDate() + 1));
        setFormData(prev => ({
          ...prev,
          ...parsed,
          checkIn: isNaN(checkIn.getTime()) ? new Date() : checkIn,
          checkOut: isNaN(checkOut.getTime()) ? new Date(new Date().setDate(new Date().getDate() + 1)) : checkOut,
        }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    // 검색 결과/조건이 바뀔 때마다 저장
    if (searchResults.length > 0) {
      localStorage.setItem('accommodationSearchResults', JSON.stringify(searchResults));
    }
  }, [searchResults]);

  useEffect(() => {
    if (formData) {
      localStorage.setItem('accommodationFormData', JSON.stringify(formData));
    }
  }, [formData]);

  useEffect(() => {
    // travelPlans의 일수가 바뀌면 daySelectList도 최신화
    if (travelPlans) {
      const days = Object.keys(travelPlans).length;
      setDaySelectList(Array.from({ length: days }, (_, idx) => ({
        dayKey: idx,
        title: travelPlans[(idx + 1).toString()]?.title || `${idx + 1}일차`
      })));
    }
  }, [travelPlans]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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

      {displayInMain && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {/* 오른쪽(결과/지도 영역 상단)에만 지도 숨기기/보이기 버튼 */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setShowMap(v => !v)}>
              {showMap ? '지도 숨기기' : '지도 보이기'}
            </Button>
          </Box>
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
          
          {/* 검색 결과와 지도를 포함하는 컨테이너 */}
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: showMap ? '1fr 1fr' : '1fr',
            gap: 2,
            mt: 2
          }}>
            {/* 검색 결과 영역 */}
            <Box sx={{ 
              maxHeight: 'calc(100vh - 200px)',
              overflow: 'auto',
              pr: showMap ? 2 : 0
            }}>
              {searchResults.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      검색 결과 ({searchResults.length}개)
                    </Typography>
                    <ToggleButtonGroup
                      value={sortType}
                      exclusive
                      onChange={handleSortChange}
                      aria-label="정렬 방식"
                    >
                      <ToggleButton value="default">
                        <SortIcon />
                      </ToggleButton>
                      <ToggleButton value="price">
                        <AttachMoneyIcon />
                      </ToggleButton>
                      <ToggleButton value="rating">
                        <StarIcon />
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {(sortType === 'default' ? searchResults : sortedResults).map((hotel) => (
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
                              <Typography variant="h6">
                                {hotel.hotel_name_trans || hotel.hotel_name}
                              </Typography>
                              {hotel.hotel_name_trans && hotel.hotel_name_trans !== hotel.hotel_name && (
                                <Typography variant="body2" color="text.secondary">
                                  {hotel.hotel_name}
                                </Typography>
                              )}
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                {hotel.address}, {hotel.city}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                <Rating value={hotel.review_score / 2} precision={0.5} readOnly size="small" />
                                <Typography variant="body2" sx={{ ml: 1 }}>
                                  {hotel.review_score_word} ({hotel.review_score})
                                </Typography>
                              </Box>
                            </Box>
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={(e) => handleBooking(e, hotel)}
                              startIcon={<OpenInNewIcon />}
                              sx={{ minWidth: '100px' }}
                            >
                              예약하기
                            </Button>
                          </Box>
                          <Box sx={{ mt: 2 }}>
                            {hotel.original_price && (
                              <Typography 
                                variant="body2" 
                                color="text.secondary" 
                                sx={{ 
                                  textDecoration: 'line-through',
                                  display: 'inline-block',
                                  mr: 1
                                }}
                              >
                                {hotel.original_price}
                              </Typography>
                            )}
                            <Typography 
                              variant="h6" 
                              color="primary" 
                              sx={{ display: 'inline-block' }}
                            >
                              {hotel.price}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              실제 결제 금액은 세금/수수료, 환율 변동 등으로 Booking.com에서 달라질 수 있습니다.
                            </Typography>
                            {hotel.tax_info && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {hotel.tax_info}
                              </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              중심지로부터 {hotel.distance_to_center}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </>
              ) : null}
            </Box>

            {/* 지도 영역 */}
            {showMap && (
              <Box sx={{ 
                height: 'calc(100vh - 200px)',
                position: 'sticky',
                top: 0,
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: 1
              }}>
                <HotelMap 
                  hotels={searchResults}
                  center={searchResults.length > 0 
                    ? [parseFloat(searchResults[0].longitude), parseFloat(searchResults[0].latitude)] 
                    : [126.9779692, 37.5662952] // 서울 시청 좌표 (기본값)
                  }
                  zoom={searchResults.length > 0 ? 12 : 10}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}

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
                    variant="outlined"
                    onClick={handleAddToPlanClick}
                    disabled={!selectedHotel}
                  >
                    일정에 추가하기
                  </Button>
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

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    실제 결제 금액은 세금/수수료, 환율 변동 등으로 Booking.com에서 달라질 수 있습니다.
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  {selectedHotel.distance_to_center && (
                    <Typography variant="body1" paragraph>
                      {selectedHotel.distance_to_center}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </>
          )}
        </Box>
      </Modal>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>숙소 검색</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="숙소 이름 또는 지역 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={isSearching}
              startIcon={isSearching ? <CircularProgress size={20} /> : <SearchIcon />}
            >
              검색
            </Button>
          </Box>

          {searchResults.length > 0 && (
            <List>
              {searchResults.map((hotel) => (
                <ListItem key={hotel.hotel_id} button onClick={() => handleHotelSelect(hotel)}>
                  <ListItemText
                    primary={hotel.hotel_name}
                    secondary={`${hotel.address} - ${hotel.price}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleHotelSelect(hotel)}>
                      <AddIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addToPlanDialogOpen} onClose={() => setAddToPlanDialogOpen(false)}>
        <DialogTitle>어느 일차에 추가할까요?</DialogTitle>
        <DialogContent>
          {daySelectList.length === 0 ? (
            <Typography>일정이 없습니다.</Typography>
          ) : (
            daySelectList.map(({ dayKey }) => {
              // checkIn과 dayKey로 날짜 계산
              const baseDate = formData.checkIn ? new Date(formData.checkIn) : new Date();
              const date = new Date(baseDate);
              date.setDate(baseDate.getDate() + dayKey);
              const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
              return (
                <Button
                  key={dayKey}
                  fullWidth
                  sx={{ my: 1 }}
                  onClick={() => handleSelectDay(dayKey)}
                >
                  {dateStr}
                </Button>
              );
            })
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
});

export default AccommodationPlan; 