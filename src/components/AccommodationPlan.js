import React, { useState } from 'react';
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

const AccommodationPlan = ({ showMap, isSearchTab = false, onHotelSelect }) => {
  const [searchParams, setSearchParams] = useState({
    cityName: '서울',
    checkIn: new Date(),
    checkOut: new Date(new Date().setDate(new Date().getDate() + 1)),
    adults: '2'
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
      setSortedResults(sortResults(searchResults, newSortType));
    }
  };

  const handlePlaceSelect = async (place) => {
    console.log('Selected place:', place);

    const searchKeywords = place.name.toLowerCase();
    const isUniversity = searchKeywords.includes('대학교') || searchKeywords.includes('university');
    const isStation = searchKeywords.includes('역') || searchKeywords.includes('station');

    if (!place.lat || !place.lng) {
      setError('선택한 장소의 위치 정보를 찾을 수 없습니다.');
      return;
    }

    setSearchParams(prev => ({
      ...prev,
      cityName: place.name,
      latitude: place.lat,
      longitude: place.lng
    }));
    setSearchPopupOpen(false);
    
    try {
      setLoading(true);
      setError(null);

      let allResults = [];

      for (let page = 0; page < 3; page++) {
        const searchOptions = {
          method: 'GET',
          url: 'https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates',
          params: {
            units: 'metric',
            room_number: '1',
            checkout_date: format(searchParams.checkOut, 'yyyy-MM-dd'),
            filter_by_currency: 'KRW',
            locale: 'ko',
            checkin_date: format(searchParams.checkIn, 'yyyy-MM-dd'),
            adults_number: searchParams.adults,
            order_by: 'distance',
            latitude: place.lat.toString(),
            longitude: place.lng.toString(),
            page_number: page.toString(),
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

        const response = await axios.request(searchOptions);
        
        if (response.data && response.data.result) {
          const filteredResults = response.data.result.filter(hotel => {
            const distance = parseFloat(hotel.distance_to_cc);
            const actualDistance = calculateDistance(
              place.lat,
              place.lng,
              parseFloat(hotel.latitude),
              parseFloat(hotel.longitude)
            );
            return !isNaN(distance) && actualDistance <= 5;
          });

          allResults = [...allResults, ...filteredResults];
        }
      }

      if (allResults.length > 0) {
        const processedResults = allResults.map(hotel => {
          let priceDisplay = '가격 정보 없음';
          let originalPrice = null;

          if (hotel.composite_price_breakdown?.gross_amount?.value) {
            priceDisplay = Math.round(hotel.composite_price_breakdown.gross_amount.value).toLocaleString();
          } else if (hotel.composite_price_breakdown?.all_inclusive_amount?.value) {
            priceDisplay = Math.round(hotel.composite_price_breakdown.all_inclusive_amount.value).toLocaleString();
          } else if (hotel.min_total_price) {
            priceDisplay = Math.round(hotel.min_total_price).toLocaleString();
          } else if (hotel.price_breakdown?.gross_price) {
            priceDisplay = Math.round(hotel.price_breakdown.gross_price).toLocaleString();
          }

          if (hotel.composite_price_breakdown?.strikethrough_amount?.value) {
            originalPrice = Math.round(hotel.composite_price_breakdown.strikethrough_amount.value).toLocaleString();
          } else if (hotel.strikethrough_amount) {
            originalPrice = Math.round(hotel.strikethrough_amount).toLocaleString();
          }

          let taxInfo = '';
          if (hotel.composite_price_breakdown?.included_taxes_and_charges?.taxes) {
            const taxes = hotel.composite_price_breakdown.included_taxes_and_charges.taxes;
            if (taxes.length > 0) {
              taxInfo = '세금 및 수수료 포함';
            }
          }

          const actualDistance = calculateDistance(
            place.lat,
            place.lng,
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
            hotel_name: hotel.hotel_name,
            address: hotel.address || '',
            city: hotel.city || '',
            main_photo_url: hotel.max_photo_url,
            review_score: hotel.review_score || 0,
            review_score_word: hotel.review_score_word || '',
            price: priceDisplay !== '가격 정보 없음' ? `KRW ${priceDisplay}` : priceDisplay,
            original_price: originalPrice ? `KRW ${originalPrice}` : null,
            description: hotel.hotel_name_trans || '',
            distance_to_center: distanceDisplay,
            is_free_cancellable: hotel.is_free_cancellable,
            photos: [hotel.max_photo_url],
            facilities: hotel.facilities_block?.facilities || [],
            tax_info: taxInfo,
            latitude: hotel.latitude,
            longitude: hotel.longitude,
            url: `https://www.booking.com/hotel.ko.html?hotel_id=${hotel.hotel_id}&checkin=${format(searchParams.checkIn, 'yyyy-MM-dd')}&checkout=${format(searchParams.checkOut, 'yyyy-MM-dd')}&group_adults=${searchParams.adults}&no_rooms=1&lang=ko`,
            actual_distance: actualDistance
          };
        });

        const sortByDistance = (results) => {
          return [...results].sort((a, b) => a.actual_distance - b.actual_distance);
        };

        const processedAndSortedResults = sortByDistance(processedResults);
        setSearchResults(processedAndSortedResults);
        setSortedResults(sortResults(processedAndSortedResults, sortType));
      } else {
        setError(`${place.name} 주변 5km 반경 내에 검색 결과를 찾을 수 없습니다.`);
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
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
      const fallbackUrl = `https://www.booking.com/searchresults.ko.html?ss=${encodeURIComponent(hotel.hotel_name)}&checkin=${format(searchParams.checkIn, 'yyyy-MM-dd')}&checkout=${format(searchParams.checkOut, 'yyyy-MM-dd')}&group_adults=${searchParams.adults}&no_rooms=1&lang=ko`;
      window.open(fallbackUrl, '_blank');
    }
  };

  const handleSearch = async () => {
    if (!searchParams.cityName) {
      setError('도시를 선택해주세요.');
      return;
    }

    try {
    setLoading(true);
    setError(null);

      const searchOptions = {
        method: 'GET',
        url: 'https://booking-com.p.rapidapi.com/v1/hotels/search',
        params: {
          units: 'metric',
          room_number: '1',
          checkout_date: format(searchParams.checkOut, 'yyyy-MM-dd'),
          filter_by_currency: 'KRW',
          locale: 'ko',
          checkin_date: format(searchParams.checkIn, 'yyyy-MM-dd'),
          adults_number: searchParams.adults,
          dest_type: 'city',
          dest_id: selectedCity?.dest_id || '-1746443', // 서울 기본값
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

      const response = await axios.request(searchOptions);
      
      if (response.data && response.data.result) {
        const processedResults = response.data.result.map(hotel => {
          let priceDisplay = '가격 정보 없음';
          let originalPrice = null;

          if (hotel.composite_price_breakdown?.gross_amount?.value) {
            priceDisplay = Math.round(hotel.composite_price_breakdown.gross_amount.value).toLocaleString();
          } else if (hotel.composite_price_breakdown?.all_inclusive_amount?.value) {
            priceDisplay = Math.round(hotel.composite_price_breakdown.all_inclusive_amount.value).toLocaleString();
          } else if (hotel.min_total_price) {
            priceDisplay = Math.round(hotel.min_total_price).toLocaleString();
          }

          if (hotel.composite_price_breakdown?.strikethrough_amount?.value) {
            originalPrice = Math.round(hotel.composite_price_breakdown.strikethrough_amount.value).toLocaleString();
          }

          return {
            hotel_id: hotel.hotel_id,
            hotel_name: hotel.hotel_name,
            address: hotel.address || '',
            city: hotel.city || '',
            main_photo_url: hotel.max_photo_url,
            price: priceDisplay,
            original_price: originalPrice,
            review_score: hotel.review_score,
            review_score_word: hotel.review_score_word,
            distance_to_cc: hotel.distance_to_cc,
            latitude: hotel.latitude,
            longitude: hotel.longitude
          };
        });

        setSearchResults(processedResults);
        setSortedResults(processedResults);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('검색 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="outlined"
          fullWidth
            onClick={() => setSearchPopupOpen(true)}
          >
            {searchParams.cityName || '도시 또는 지역 검색'}
          </Button>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="체크인"
            value={searchParams.checkIn}
            onChange={(date) => setSearchParams({ ...searchParams, checkIn: date })}
            slotProps={{ textField: { fullWidth: true } }}
          />
          <DatePicker
            label="체크아웃"
            value={searchParams.checkOut}
            onChange={(date) => setSearchParams({ ...searchParams, checkOut: date })}
            slotProps={{ textField: { fullWidth: true } }}
          />
        </LocalizationProvider>

        <TextField
          fullWidth
          label="성인 수"
          type="number"
          value={searchParams.adults}
          onChange={(e) => setSearchParams({ ...searchParams, adults: e.target.value })}
          inputProps={{ min: 1, max: 10 }}
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

      {/* 검색 결과 목록 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {searchResults.length > 0 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2 }}>
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
            <Box sx={{ px: 2 }}>
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
                            KRW {hotel.original_price}
                          </Typography>
                        )}
                        <Typography 
                          variant="h6" 
                          color="primary" 
                          sx={{ display: 'inline-block' }}
                        >
                          {hotel.price === '가격 정보 없음' ? hotel.price : `KRW ${hotel.price}`}
              </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Box>
          </>
        )}
      </Box>

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
                    {selectedHotel.original_price && (
                      <Typography 
                        variant="body1" 
                        color="text.secondary" 
                        sx={{ 
                          textDecoration: 'line-through',
                          display: 'inline-block',
                          mr: 1
                        }}
                      >
                        KRW {parseInt(selectedHotel.original_price).toLocaleString()}
                      </Typography>
                    )}
                    <Typography variant="h6" color="primary" sx={{ display: 'inline-block' }}>
                      1박 요금: {selectedHotel.price === '가격 정보 없음' ? selectedHotel.price : `KRW ${selectedHotel.price}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {selectedHotel.tax_info}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {selectedHotel.description && (
                    <>
                      <Typography variant="h6" gutterBottom>호텔 설명</Typography>
                      <Typography variant="body1" paragraph>
                        {selectedHotel.description}
                      </Typography>
                    </>
                  )}

                  {selectedHotel.facilities && selectedHotel.facilities.length > 0 && (
                    <>
                      <Typography variant="h6" gutterBottom>시설 및 서비스</Typography>
                      <Grid container spacing={1}>
                        {selectedHotel.facilities.map((facility, index) => (
                          <Grid item key={index}>
                            <Typography variant="body2" sx={{ 
                              bgcolor: 'grey.100', 
                              px: 1, 
                              py: 0.5, 
                              borderRadius: 1 
                            }}>
                              {facility}
                            </Typography>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  )}
                </Grid>
              </Grid>
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
};

export default AccommodationPlan; 