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
  ListItemSecondaryAction,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Tooltip,
  Alert,
  AlertTitle
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningIcon from '@mui/icons-material/Warning';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import SearchPopup from './SearchPopup';
import { Search as SearchIcon, Add as AddIcon, Sort as SortIcon, AttachMoney as AttachMoneyIcon, Star as StarIcon, Delete as DeleteIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon, LocationOn as LocationOnIcon, Info as InfoIcon } from '@mui/icons-material';
import HotelMap from './HotelMap';
import { travelApi } from '../services/api';
import { 
  validateAccommodationAddition, 
  extractExistingAccommodations,
  formatDateString 
} from '../utils/accommodationValidation';

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
  onAddToSchedule,
  dayOrderLength,
  onForceRefreshDay,
  isSidebarOpen,
  // 유효성 검사를 위한 추가 props
  dayOrder,
  startDate
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
  const [showMap, setShowMap] = useState(true);
  const [addToPlanDialogOpen, setAddToPlanDialogOpen] = useState(false);
  const [hotelToAdd, setHotelToAdd] = useState(null);
  const [latestPlan, setLatestPlan] = useState(null);
  const [daySelectList, setDaySelectList] = useState([]);
  const [roomConfig, setRoomConfig] = useState([{ adults: '', children: '' }]);
  const [roomData, setRoomData] = useState(null);
  const [selectedHotelId, setSelectedHotelId] = useState(null);
  const [hotelMapResizeTrigger, setHotelMapResizeTrigger] = useState(0);
  const [validationAlert, setValidationAlert] = useState(null);

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
    
    if (value === '' || /^\d+$/.test(value)) {
      const newFormData = {
        ...formData,
        adults: value
      };
      setFormData(newFormData);
      console.log('인원 수 변경 후 업데이트된 formData:', newFormData);
      
      if (searchResults.length > 0 && value !== '') {
        const updatedResults = searchResults.map(hotel => ({
          ...hotel,
          url: `https://www.booking.com/hotel.ko.html?hotel_id=${hotel.hotel_id}&checkin=${format(new Date(formData.checkIn), 'yyyy-MM-dd')}&checkout=${format(new Date(formData.checkOut), 'yyyy-MM-dd')}&group_adults=${value}&no_rooms=1&lang=ko`
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
    console.log('숙소 검색 시작 - 현재 formData:', formData);
    
    if (loading) {
      console.log('[검색] 이미 검색이 진행 중입니다.');
      return;
    }

    setSearchResults([]);
    setSortedResults([]);
    setError(null);
    setLoading(true);

    try {
      if (!formData.cityName) throw new Error('도시를 선택해주세요.');
      if (!formData.checkIn || !formData.checkOut) throw new Error('체크인/체크아웃 날짜를 선택해주세요.');

      const rooms = formData.roomConfig || [{ adults: parseInt(formData.adults) || 2, children: parseInt(formData.children) || 0 }];
      
      const roomsWithChildrenAges = rooms.map(room => ({
        ...room,
        childrenAges: Array(room.children).fill(7)
      }));

      const apiParams = {
        checkin_date: format(new Date(formData.checkIn), 'yyyy-MM-dd'),
        checkout_date: format(new Date(formData.checkOut), 'yyyy-MM-dd'),
        room_number: rooms.length.toString(),
        adults_number: rooms.reduce((sum, room) => sum + room.adults, 0).toString(),
        children_number: rooms.reduce((sum, room) => sum + room.children, 0).toString(),
        latitude: formData.latitude.toString(),
        longitude: formData.longitude.toString(),
        order_by: 'distance',
        page_number: '0',
        locale: 'ko',
        filter_by_currency: 'KRW',
        units: 'metric',
        dest_type: 'city',
        include_adjacency: 'true',
        adults_number_by_rooms: rooms.map(room => room.adults.toString()).join(','),
        children_number_by_rooms: rooms.map(room => room.children.toString()).join(','),
        rooms: roomsWithChildrenAges.map((room, index) => ({
          room_number: (index + 1).toString(),
          adults_number: room.adults.toString(),
          children_number: room.children.toString(),
          children_ages: room.childrenAges
        }))
      };

      
      const responseData = await travelApi.searchHotels(apiParams);

      if (!responseData || !responseData.result) {
        throw new Error('검색 결과를 가져오는데 실패했습니다.');
      }

      const filteredResults = responseData.result.filter(hotel => {
        const distanceValue = parseFloat(hotel.distance_to_cc) || parseFloat(hotel.distance) || calculateDistance(
          formData.latitude,
          formData.longitude,
          parseFloat(hotel.latitude),
          parseFloat(hotel.longitude)
        );

        hotel.distance_to_center = hotel.distance_to_cc_formatted || 
          hotel.distance_formatted || 
          (distanceValue < 1 ? `${(distanceValue * 1000).toFixed(0)}m` : `${distanceValue.toFixed(1)}km`);
        
        hotel.actual_distance = distanceValue;

        return distanceValue <= 5;
      });

      if (filteredResults.length === 0) {
        throw new Error(`${formData.cityName} 주변 5km 반경 내에 검색 결과를 찾을 수 없습니다.`);
      }

      setSearchResults(filteredResults);
      setSortedResults(sortResults(filteredResults, sortType));

      localStorage.setItem('accommodationSearchResults', JSON.stringify(filteredResults));
      localStorage.setItem('accommodationFormData', JSON.stringify(formData));

      if (onSearch) {
        console.log('[검색] onSearch 콜백 호출');
        onSearch(filteredResults);
      }

      if (onSearchResults) {
        console.log('[검색] onSearchResults 콜백 호출');
        onSearchResults(filteredResults);
      }

    } catch (error) {
      console.error('[검색] 오류 발생:', error);
      const errorMessage = error.message || '검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      setError(errorMessage);
      setSearchResults([]);
      setSortedResults([]);
      
      if (onSearch) onSearch([]);
      if (onSearchResults) onSearchResults([]);
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
      case 'price_asc':
        sorted.sort((a, b) => {
          const priceA = parseInt(a.price.replace(/[^0-9]/g, '')) || 0;
          const priceB = parseInt(b.price.replace(/[^0-9]/g, '')) || 0;
          return priceA - priceB;
        });
        break;
      case 'price_desc':
        sorted.sort((a, b) => {
          const priceA = parseInt(a.price.replace(/[^0-9]/g, '')) || 0;
          const priceB = parseInt(b.price.replace(/[^0-9]/g, '')) || 0;
          return priceB - priceA;
        });
        break;
      case 'rating_asc':
        sorted.sort((a, b) => (a.review_score || 0) - (b.review_score || 0));
        break;
      case 'rating_desc':
        sorted.sort((a, b) => (b.review_score || 0) - (a.review_score || 0));
        break;
      case 'distance':
        sorted.sort((a, b) => a.actual_distance - b.actual_distance);
        break;
      case 'default':
        sorted.sort(() => Math.random() - 0.5);
        break;
    }
    return sorted;
  };

  const handleSortChange = (newSortType) => {
    if (newSortType === 'price') {
      if (sortType === 'price_asc') {
        setSortType('price_desc');
        setSortedResults(sortResults(searchResults, 'price_desc'));
      } else {
        setSortType('price_asc');
        setSortedResults(sortResults(searchResults, 'price_asc'));
      }
    } else if (newSortType === 'rating') {
      if (sortType === 'rating_desc') {
        setSortType('rating_asc');
        setSortedResults(sortResults(searchResults, 'rating_asc'));
      } else {
        setSortType('rating_desc');
        setSortedResults(sortResults(searchResults, 'rating_desc'));
      }
    } else {
      setSortType(newSortType);
      setSortedResults(sortResults(searchResults, newSortType));
    }
  };

  const handleHotelClick = async (hotel) => {
    if (onHotelSelect) {
      onHotelSelect(hotel);
    }
    
    setSelectedHotel(hotel);
    setModalOpen(true);

    try {
      setLoading(true);
      const rooms = formData.roomConfig || [{ adults: parseInt(formData.adults) || 2, children: parseInt(formData.children) || 0 }];
      const roomsWithChildrenAges = rooms.map(room => ({
        ...room,
        childrenAges: Array(room.children).fill(7)
      }));
      const roomListParams = {
        type: 'room_list',
        hotel_id: hotel.hotel_id,
        checkin_date: format(new Date(formData.checkIn), 'yyyy-MM-dd'),
        checkout_date: format(new Date(formData.checkOut), 'yyyy-MM-dd'),
        room_number: rooms.length.toString(),
        adults_number: rooms.reduce((sum, room) => sum + room.adults, 0).toString(),
        children_number: rooms.reduce((sum, room) => sum + room.children, 0).toString(),
        currency: 'KRW',
        locale: 'ko',
        units: 'metric',
        adults_number_by_rooms: rooms.map(room => room.adults.toString()).join(','),
        children_number_by_rooms: rooms.map(room => room.children.toString()).join(','),
        rooms: roomsWithChildrenAges.map((room, index) => ({
          room_number: (index + 1).toString(),
          adults_number: room.adults.toString(),
          children_number: room.children.toString(),
          children_ages: room.childrenAges
        }))
      };
      const response = await travelApi.searchHotels(roomListParams);
      const processedRoomData = processRoomData(response, rooms);
      setRoomData(processedRoomData);
    } catch (error) {
      console.error('[객실 조회] 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const processRoomData = (data, requestedRooms) => {
    if (!data || !data.result || !data.result[0]) return null;
    
    const result = data.result[0];
    const rooms = result.rooms;
    const blocks = result.block;

    console.log('[객실 데이터 처리] 전체 응답:', data);
    console.log('[객실 데이터 처리] rooms:', rooms);
    console.log('[객실 데이터 처리] blocks:', blocks);

    let totalPrice = 0;
    let totalCurrency = 'KRW';

    const processedRooms = Object.entries(rooms).map(([roomId, room]) => {
      console.log(`[객실 ${roomId}] 상세정보:`, room);
      
      const matchingBlocks = blocks.filter(block => {
        const blockRoomId = String(block.room_id || '');
        const currentRoomId = String(roomId);
        
        return blockRoomId === currentRoomId || 
               blockRoomId.includes(currentRoomId) ||
               currentRoomId.includes(blockRoomId);
      });

      console.log(`[객실 ${roomId}] matchingBlocks:`, matchingBlocks);
      const matchingBlock = matchingBlocks[0];

      let roomName = '객실 정보 없음';
      if (room.name) {
        roomName = room.name;
      } else if (matchingBlock && matchingBlock.room_name) {
        roomName = matchingBlock.room_name;
      } else if (room.room_name) {
        roomName = room.room_name;
      }

      console.log(`[객실 ${roomId}] 이름:`, roomName);

      let price = null;
      let currency = 'KRW';
      let priceBreakdown = null;

      const extractPrice = (block) => {
        let extractedPrice = null;
        let extractedCurrency = currency;
        let extractedBreakdown = null;

        if (block.product_price_breakdown) {
          if (block.product_price_breakdown.all_inclusive_amount) {
            extractedPrice = block.product_price_breakdown.all_inclusive_amount.value;
            extractedCurrency = block.product_price_breakdown.all_inclusive_amount.currency;
            extractedBreakdown = block.product_price_breakdown;
          } else if (block.product_price_breakdown.gross_amount) {
            extractedPrice = block.product_price_breakdown.gross_amount.value;
            extractedCurrency = block.product_price_breakdown.gross_amount.currency;
            extractedBreakdown = block.product_price_breakdown;
          }
        }
        
        if (extractedPrice === null && block.min_price) {
          extractedPrice = block.min_price.price || block.min_price.value;
          extractedCurrency = block.min_price.currency || extractedCurrency;
        }

        if (extractedPrice === null && block.block_price_breakdown) {
          if (block.block_price_breakdown.gross_amount) {
            extractedPrice = block.block_price_breakdown.gross_amount.value;
            extractedCurrency = block.block_price_breakdown.gross_amount.currency;
            extractedBreakdown = block.block_price_breakdown;
          }
        }

        if (extractedPrice === null && block.price) {
          extractedPrice = block.price;
          extractedCurrency = block.currency || extractedCurrency;
        }

        if (extractedPrice === null && block.gross_price) {
          extractedPrice = block.gross_price;
          extractedCurrency = block.currency || extractedCurrency;
        }

        return { 
          price: extractedPrice, 
          currency: extractedCurrency,
          breakdown: extractedBreakdown
        };
      };

      let bestPrice = null;
      let bestBlock = null;
      
      matchingBlocks.forEach(block => {
        const extracted = extractPrice(block);
        if (bestPrice === null || extracted.price < bestPrice) {
          bestPrice = extracted.price;
          price = extracted.price;
          currency = extracted.currency;
          priceBreakdown = extracted.breakdown;
          bestBlock = block;
        }
      });

      if (!bestBlock && blocks.length > 0) {
        const extracted = extractPrice(blocks[0]);
        price = extracted.price;
        currency = extracted.currency;
        priceBreakdown = extracted.breakdown;
        bestBlock = blocks[0];
      }

      if (price !== null) {
        totalPrice += price;
      }

      return {
        id: roomId,
        name: roomName,
        description: room.description || matchingBlock?.description,
        photos: room.photos,
        facilities: room.facilities,
        price: price,
        currency: currency,
        priceBreakdown: priceBreakdown,
        priceInKRW: price !== null ? price : null,
        bedConfigurations: room.bed_configurations,
        roomSize: room.room_size,
        isRefundable: bestBlock ? !bestBlock.non_refundable : true,
        mealPlan: bestBlock?.mealplan,
        policies: bestBlock?.policies,
        paymentTerms: bestBlock?.payment_terms,
        blockInfo: bestBlock
      };
    });

    return {
      rooms: processedRooms,
      totalPrice: totalPrice,
      totalCurrency: totalCurrency,
      requestedRooms: requestedRooms
    };
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedHotel(null);
  };

  // 날짜를 YYYY-MM-DD 형식으로 변환 (로컬 시간대 기준)
  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleBooking = (event, hotel) => {
    event.stopPropagation();
    console.log('[예약] 현재 formData:', formData);
    console.log('[예약] hotel 정보:', hotel);

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

    const rooms = formData.roomConfig || [{ adults: parseInt(formData.adults) || 2, children: parseInt(formData.children) || 0 }];
    const totalChildren = rooms.reduce((sum, room) => sum + room.children, 0);
    const roomCount = rooms.length;

    const formattedCheckIn = formatDateLocal(checkInDate);
    const formattedCheckOut = formatDateLocal(checkOutDate);
    const hotelName = encodeURIComponent(hotel.hotel_name);

    const bookingUrl = `https://www.booking.com/searchresults.ko.html?ss=${hotelName}&checkin=${formattedCheckIn}&checkout=${formattedCheckOut}&group_adults=${adults}&group_children=${totalChildren}&no_rooms=${roomCount}&lang=ko`;
    console.log('[예약] Booking.com 호텔명+날짜+인원 검색 URL:', bookingUrl);
    window.open(bookingUrl, '_blank');
  };

  const handleOpenSearchPopup = () => {
    setIsDialogOpen(true);
  };

  const handleHotelSelect = (hotel) => {
    setSelectedPlace({
      ...hotel,
      checkIn: formData.checkIn,
      checkOut: formData.checkOut
    });
    onHotelSelect({
      ...hotel,
      checkIn: formData.checkIn,
      checkOut: formData.checkOut
    });
    setIsDialogOpen(false);
  };

  // 숙박편 추가 전 유효성 검사 함수
  const validateAndAddAccommodation = (accommodationToAdd) => {
    console.log('[AccommodationPlan] 숙박편 유효성 검사 시작');
    
    // 필수 데이터 확인
    if (!travelPlans || !dayOrder || !startDate) {
      alert('여행 계획 정보가 부족합니다. 페이지를 새로고침해주세요.');
      return false;
    }

    if (!accommodationToAdd.checkIn || !accommodationToAdd.checkOut) {
      alert('체크인/체크아웃 날짜가 설정되지 않았습니다.');
      return false;
    }

    // 기존 숙박편 목록 추출
    const existingAccommodations = extractExistingAccommodations(travelPlans, dayOrder);
    
    // 유효성 검사 수행
    const validation = validateAccommodationAddition(
      accommodationToAdd,
      existingAccommodations,
      startDate,
      dayOrder
    );

    if (!validation.isValid) {
      // 사용자 친화적인 오류 메시지 표시
      const errorTitle = getValidationErrorTitle(validation.details.type);
      
      // Alert 메시지 설정
      setValidationAlert({
        severity: validation.details.type === 'INVALID_DATE_RANGE' ? 'error' : 'warning',
        title: errorTitle,
        message: validation.message
      });
      
      // 3초 후 Alert 자동 숨김
      setTimeout(() => setValidationAlert(null), 7000);
      
      const confirmMessage = `${errorTitle}\n\n${validation.message}\n\n그래도 추가하시겠습니까?`;
      
      // 심각한 오류의 경우 강제 추가 불허
      if (validation.details.type === 'INVALID_DATE_RANGE') {
        alert(validation.message);
        return false;
      }
      
      // 다른 오류의 경우 사용자 선택 허용
      if (!window.confirm(confirmMessage)) {
        return false;
      }
    } else {
      // 유효성 검사 통과 시 Alert 제거
      setValidationAlert(null);
      
      // 연속 숙박인 경우 정보 메시지 표시
      if (validation.message.includes('연속 숙박')) {
        setValidationAlert({
          severity: 'info',
          title: '✅ 연속 숙박 확인',
          message: validation.message
        });
        
        // 3초 후 Alert 자동 숨김
        setTimeout(() => setValidationAlert(null), 7000);
      }
    }

    return true;
  };

  // 유효성 검사 오류 타입별 제목 반환
  const getValidationErrorTitle = (errorType) => {
    switch (errorType) {
      case 'INVALID_DATE_RANGE':
        return '❌ 잘못된 날짜 범위';
      case 'OUTSIDE_TRAVEL_PERIOD':
        return '⚠️ 여행 기간 초과';
      case 'DATE_CONFLICT':
        return '⚠️ 숙박편 날짜 충돌';
      case 'CONSECUTIVE_STAY':
        return '✅ 연속 숙박 확인';
      default:
        return '⚠️ 유효성 검사 오류';
    }
  };

  const handleRoomSelect = (hotel, room) => {
    if (dayOrderLength === 0) { 
      alert('일정을 먼저 생성해주세요. 사이드바에서 날짜를 추가할 수 있습니다.');
      return;
    }

    if (!travelPlans || Object.keys(travelPlans).length === 0 || Object.keys(travelPlans).length !== dayOrderLength) {
        console.warn('[AccommodationPlan] travelPlans 상태와 dayOrderLength가 일치하지 않거나 travelPlans가 비어있습니다.', travelPlans, dayOrderLength);
    }

    // 체크인/체크아웃 시간 설정 (AccomodationDialog.js와 동일한 로직)
    const combineDateTime = (dateObj, timeStr) => {
      if (!dateObj || !timeStr || timeStr === '정보 없음') return dateObj;
      const [hh, mm] = timeStr.split(':');
      const newDate = new Date(dateObj);
      newDate.setHours(parseInt(hh, 10), parseInt(mm || '0', 10), 0, 0);
      return newDate;
    };

    const checkInWithTime = combineDateTime(formData.checkIn, hotel.checkin_from);
    const checkOutWithTime = combineDateTime(formData.checkOut, hotel.checkout_until);

    // 숙박편 데이터 준비 (AccomodationDialog.js와 동일한 구조)
    const accommodationToAdd = {
      hotel,
      room,
      checkIn: checkInWithTime,
      checkOut: checkOutWithTime,
      adults: parseInt(formData.adults) || 2,
      children: parseInt(formData.children) || 0,
      lat: hotel.latitude,
      lng: hotel.longitude
    };

    // 유효성 검사 수행
    if (!validateAndAddAccommodation(accommodationToAdd)) {
      return;
    }

    // 최종 확인 팝업
    const checkInStr = formatDateString(checkInWithTime);
    const checkOutStr = formatDateString(checkOutWithTime);
    const hotelName = hotel.hotel_name_trans || hotel.hotel_name;
    const roomName = room.name || '선택된 객실';
    
    if (window.confirm(`${hotelName}\n${roomName}\n(${checkInStr} ~ ${checkOutStr})\n\n이 숙소를 일정에 추가하시겠습니까?`)) {
      if (!onAddToSchedule) {
        alert('일정 추가 기능을 사용할 수 없습니다.');
        return;
      }
      
      onAddToSchedule(accommodationToAdd);
      if (onForceRefreshDay) onForceRefreshDay();
      
      // 성공 메시지 표시
      setValidationAlert({
        severity: 'success',
        title: '✅ 숙박편 추가 완료',
        message: `${hotelName} - ${roomName}이(가) 여행 계획에 추가되었습니다.`
      });
      
      // 3초 후 Alert 자동 숨김
      setTimeout(() => setValidationAlert(null), 7000);
      
      // 모달 닫기
      setModalOpen(false);
    }
  };

  const handleRoomConfigChange = (index, field, value) => {
    const newConfig = [...roomConfig];
    newConfig[index] = {
      ...newConfig[index],
      [field]: value === '' ? '' : parseInt(value) || 0
    };
    setRoomConfig(newConfig);
    
    const totalAdults = newConfig.reduce((sum, room) => sum + (room.adults === '' ? 0 : parseInt(room.adults) || 0), 0);
    const totalChildren = newConfig.reduce((sum, room) => sum + (room.children === '' ? 0 : parseInt(room.children) || 0), 0);
    
    setFormData(prev => ({
      ...prev,
      adults: totalAdults.toString(),
      children: totalChildren.toString(),
      roomConfig: newConfig
    }));
  };

  const addRoom = () => {
    if (roomConfig.length < 5) {
      setRoomConfig([...roomConfig, { adults: '', children: '' }]);
    }
  };

  const removeRoom = (index) => {
    if (roomConfig.length > 1) {
      const newConfig = roomConfig.filter((_, i) => i !== index);
      setRoomConfig(newConfig);
      
      const totalAdults = newConfig.reduce((sum, room) => sum + (room.adults === '' ? 0 : parseInt(room.adults) || 0), 0);
      const totalChildren = newConfig.reduce((sum, room) => sum + (room.children === '' ? 0 : parseInt(room.children) || 0), 0);
      
      setFormData(prev => ({
        ...prev,
        adults: totalAdults.toString(),
        children: totalChildren.toString(),
        roomConfig: newConfig
      }));
    }
  };

  const handleHotelCardClick = (hotel) => {
    setSelectedHotelId(hotel.hotel_id === selectedHotelId ? null : hotel.hotel_id);
  };

  const handleDetailClick = (event, hotel) => {
    event.stopPropagation();
    handleHotelClick(hotel);
  };

  useImperativeHandle(ref, () => ({
    handlePlaceSelect,
    handleSearch,
    openSearchPopup: () => {
      setSearchPopupOpen(true);
    }
  }));

  useEffect(() => {
    const savedResults = localStorage.getItem('accommodationSearchResults');
    if (savedResults) {
      const parsedResults = JSON.parse(savedResults);
      setSearchResults(parsedResults);
      setSortedResults(sortResults(parsedResults, sortType));
    }

    const savedFormData = localStorage.getItem('accommodationFormData');
    if (savedFormData) {
      const parsedFormData = JSON.parse(savedFormData);
      if (parsedFormData.checkIn) parsedFormData.checkIn = new Date(parsedFormData.checkIn);
      if (parsedFormData.checkOut) parsedFormData.checkOut = new Date(parsedFormData.checkOut);
      setFormData(prevData => ({
        ...{
          cityName: '',
          checkIn: new Date(),
          checkOut: new Date(new Date().setDate(new Date().getDate() + 1)),
          adults: '2',
          children: '0',
          roomConfig: [{ adults: 2, children: 0 }],
          latitude: null,
          longitude: null,
        },
        ...prevData,
        ...parsedFormData
      }));
    } else if (setFormData) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      setFormData(prev => ({
        ...prev,
        checkIn: prev?.checkIn || today,
        checkOut: prev?.checkOut || tomorrow,
        adults: prev?.adults || '2',
        children: prev?.children || '0',
        roomConfig: prev?.roomConfig || [{ adults: 2, children: 0 }],
        cityName: prev?.cityName || '',
        latitude: prev?.latitude || null,
        longitude: prev?.longitude || null,
      }));
    }
  }, [setFormData]);

  useEffect(() => {
    if (searchResults.length > 0) {
      localStorage.setItem('accommodationSearchResults', JSON.stringify(searchResults));
      setSortedResults(sortResults(searchResults, sortType));
    }
  }, [searchResults, sortType]);

  useEffect(() => {
    if (formData && Object.keys(formData).length > 0 && setFormData) {
      localStorage.setItem('accommodationFormData', JSON.stringify(formData));
    }
  }, [formData, setFormData]);

  useEffect(() => {
    if (travelPlans) {
      const days = Object.keys(travelPlans).length;
      setDaySelectList(Array.from({ length: days }, (_, idx) => ({
        dayKey: (idx + 1).toString(),
        title: travelPlans[(idx + 1).toString()]?.title || `${idx + 1}일차`
      })));
    }
  }, [travelPlans]);

  // AccommodationPlan이 displayInMain으로 메인에 표시될 때, 윈도우 크기/사이드바 등 변동에 따라 트리거 증가
  useEffect(() => {
    if (!displayInMain) return;
    const handleResize = () => setHotelMapResizeTrigger(v => v + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [displayInMain]);

  // 사이드바 열림/닫힘(isSidebarOpen) 변화 시 즉시 + 350ms 후 두 번 트리거
  useEffect(() => {
    if (!displayInMain) return;
    setHotelMapResizeTrigger(v => v + 1);
    const timeout = setTimeout(() => setHotelMapResizeTrigger(v => v + 1), 7000);
    return () => clearTimeout(timeout);
  }, [isSidebarOpen, displayInMain]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 유효성 검사 Alert */}
      {validationAlert && (
        <Alert 
          severity={validationAlert.severity} 
          onClose={() => setValidationAlert(null)}
          sx={{ mb: 2 }}
          icon={<WarningIcon />}
        >
          <AlertTitle>{validationAlert.title}</AlertTitle>
          {validationAlert.message}
        </Alert>
      )}
      
      {!displayInMain && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleOpenSearchPopupClick}
            >
              {formData?.cityName || '도시 또는 지역 검색'}
            </Button>
        
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
                label="체크인"
                value={formData?.checkIn || null}
                onChange={(date) => handleDateChange('checkIn', date)}
                slotProps={{ 
                  textField: { 
                    fullWidth: true,
                    error: !formData?.checkIn && !!error,
                    helperText: !formData?.checkIn && error ? '체크인 날짜를 선택해주세요' : ''
                  } 
                }}
            />
            <DatePicker
                label="체크아웃"
                value={formData?.checkOut || null}
                onChange={(date) => handleDateChange('checkOut', date)}
                minDate={formData?.checkIn ? new Date(new Date(formData.checkIn).setDate(new Date(formData.checkIn).getDate() + 1)) : new Date(new Date().setDate(new Date().getDate() + 1))}
                slotProps={{ 
                  textField: { 
                    fullWidth: true,
                    error: !formData?.checkOut && !!error,
                    helperText: !formData?.checkOut && error ? '체크아웃 날짜를 선택해주세요' : ''
                  } 
                }}
              />
            </LocalizationProvider>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                객실 및 인원
              </Typography>
              {roomConfig.map((room, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ minWidth: 60 }}>
                    객실 {index + 1}
                  </Typography>
            <TextField
                    type="number"
                    label="성인"
                    value={room.adults}
                    onChange={(e) => handleRoomConfigChange(index, 'adults', e.target.value)}
                    inputProps={{ min: 1, max: 4 }}
                    sx={{ width: 100 }}
                    placeholder="성인"
                  />
                  <TextField
                    type="number"
                    label="어린이"
                    value={room.children}
                    onChange={(e) => handleRoomConfigChange(index, 'children', e.target.value)}
                    inputProps={{ min: 0, max: 3 }}
                    sx={{ width: 100 }}
                    placeholder="어린이"
                  />
                  {index > 0 && (
                    <IconButton onClick={() => removeRoom(index)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mb: 1, display: 'block' }}>
                반칸으로 둘 시 성인 2명으로 자동 검색됩니다
              </Typography>
              {roomConfig.length < 5 && (
                <Button
                  startIcon={<AddIcon />}
                  onClick={addRoom}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  객실 추가
                </Button>
              )}
            </Box>

      <Button
        variant="contained"
        color="primary"
              fullWidth
              size="large"
        onClick={handleSearch}
        disabled={loading}
              sx={{ height: '56px', mt: 2 }}
      >
              숙소 검색
      </Button>

      {error && (
              <Typography color="error" sx={{ mt: 1 }}>
          {error}
              </Typography>
            )}
          </Box>
        </Paper>
      )}

      {displayInMain && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setShowMap(v => !v)}>
              {showMap ? '지도 숨기기' : '지도 보이기'}
            </Button>
          </Box>
          
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: showMap ? '1fr 1fr' : '1fr',
            gap: 2,
            mt: 2
          }}>
            <Box sx={{ 
              maxHeight: 'calc(100vh - 200px)',
              overflow: 'auto',
              pr: showMap ? 2 : 0,
              position: 'relative'
            }}>
              {loading ? (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  minHeight: '200px'
                }}>
                  <CircularProgress />
                  <Typography variant="body1" sx={{ ml: 2 }}>
                    숙소를 검색하고 있습니다...
                  </Typography>
                </Box>
              ) : searchResults.length > 0 ? (
                <>
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    mb: 2,
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'background.paper',
                    zIndex: 1,
                    py: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                  }}>
                    <Typography variant="h6">
                      검색 결과 ({searchResults.length}개)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant={sortType.startsWith('price') ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => handleSortChange('price')}
                        startIcon={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AttachMoneyIcon />
                            {sortType === 'price_desc' ? <ArrowDownwardIcon sx={{ fontSize: '0.8rem' }} /> : <ArrowUpwardIcon sx={{ fontSize: '0.8rem' }} />}
                          </Box>
                        }
                      >
                        가격순
                      </Button>
                      <Button
                        variant={sortType.startsWith('rating') ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => handleSortChange('rating')}
                        startIcon={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <StarIcon />
                            {sortType === 'rating_asc' ? <ArrowDownwardIcon sx={{ fontSize: '0.8rem' }} /> : <ArrowUpwardIcon sx={{ fontSize: '0.8rem' }} />}
                          </Box>
                        }
                      >
                        별점순
                      </Button>
                      <Button
                        variant={sortType === 'distance' ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => handleSortChange('distance')}
                        startIcon={<LocationOnIcon />}
                      >
                        거리순
                      </Button>
                    </Box>
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
                        },
                        border: hotel.hotel_id === selectedHotelId ? '2px solid #4169E1' : 'none'
                      }}
                      onClick={() => handleHotelCardClick(hotel)}
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
                                {hotel.review_nr && (
                                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                    • {hotel.review_nr.toLocaleString()}개의 리뷰
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                color="primary"
                                size="small"
                                onClick={(e) => handleDetailClick(e, hotel)}
                                startIcon={<InfoIcon />}
                                sx={{ minWidth: '110px', width: '110px' }}
                              >
                                상세정보
                              </Button>
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={(e) => handleBooking(e, hotel)}
                              startIcon={<OpenInNewIcon />}
                                sx={{ minWidth: '110px', width: '110px' }}
                            >
                              예약하기
                            </Button>
                            </Box>
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
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              체크인: {hotel.checkin_from} ~ {hotel.checkin_until}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              체크아웃: {hotel.checkout_from !== '정보 없음' ? `${hotel.checkout_from} ~ ` : ''}{hotel.checkout_until}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </>
              ) : error ? (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  minHeight: '200px',
                  color: 'error.main'
                }}>
                  <Typography>{error}</Typography>
                </Box>
              ) : null}
            </Box>

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
                  selectedHotelId={selectedHotelId}
                  searchLocation={{
                    latitude: formData?.latitude,
                    longitude: formData?.longitude,
                    name: formData?.cityName
                  }}
                  center={searchResults.length > 0 
                    ? [parseFloat(searchResults[0].longitude), parseFloat(searchResults[0].latitude)] 
                    : [126.9779692, 37.5662952]
                  }
                  zoom={searchResults.length > 0 ? 12 : 10}
                  resizeTrigger={hotelMapResizeTrigger}
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

      {modalOpen && selectedHotel && (
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        aria-labelledby="hotel-detail-modal"
      >
          <Box sx={{
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
            borderRadius: 2
          }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" component="h2">
                  {selectedHotel.hotel_name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
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
                      {selectedHotel.review_score_word} ({selectedHotel.review_score})
                    </Typography>
                    {selectedHotel.review_nr && (
                      <Typography variant="body1" color="text.secondary" sx={{ ml: 1 }}>
                        • {selectedHotel.review_nr.toLocaleString()}개의 리뷰
                      </Typography>
                    )}
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

                  <Typography variant="h6" gutterBottom>체크인 / 체크아웃</Typography>
                  <Typography variant="body1" paragraph>
                    체크인: {selectedHotel.checkin_from} ~ {selectedHotel.checkin_until}
                  </Typography>
                  <Typography variant="body1" paragraph>
                    체크아웃: {selectedHotel.checkout_from !== '정보 없음' ? `${selectedHotel.checkout_from} ~ ` : ''}{selectedHotel.checkout_until}
                  </Typography>

                  {selectedHotel.distance_to_center && (
                    <Typography variant="body1" paragraph>
                    중심가까지 거리: {selectedHotel.distance_to_center}
                    </Typography>
                  )}

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : roomData && roomData.rooms ? (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>객실 정보</Typography>
                    <Box sx={{ mt: 2 }}>
                      {roomData.rooms.map((room, index) => (
                        <Paper key={room.id} sx={{ p: 2, mb: 2 }}>
                          <Grid container spacing={2}>
                            {room.photos && room.photos.length > 0 && (
                              <Grid item xs={12} sm={4}>
                                <Box
                                  component="img"
                                  src={room.photos[0].url_original}
                                  alt={room.name}
                                  sx={{
                                    width: '100%',
                                    height: 150,
                                    objectFit: 'cover',
                                    borderRadius: 1
                                  }}
                                />
                </Grid>
                            )}
                            <Grid item xs={12} sm={room.photos?.length ? 8 : 12}>
                              <Typography variant="h6" gutterBottom>
                                {room.name || '객실 ' + (index + 1)}
                              </Typography>
                              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                                침대 {room.bedConfigurations && room.bedConfigurations.length > 0 
                                  ? room.bedConfigurations[0].bed_types.reduce((sum, bed) => sum + bed.count, 0) 
                                  : '정보 없음'}개
                              </Typography>
                              <Typography variant="body2" color="text.secondary" paragraph>
                                {room.description}
                              </Typography>
                              
                              <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                  <Box sx={{ mt: 1 }}>
                                    {room.roomSize && (
                                      <Typography variant="body2" gutterBottom>
                                        <strong>객실 크기:</strong> {room.roomSize.size} {room.roomSize.unit}
                                      </Typography>
                                    )}
                                    {room.bedConfigurations && room.bedConfigurations.length > 0 && (
                                      <Typography variant="body2" gutterBottom>
                                        <strong>침대 구성:</strong> {room.bedConfigurations[0].bed_types.map(bed => 
                                          `${bed.name} (${bed.count}개)`).join(', ')}
                                      </Typography>
                                    )}
                                  </Box>
              </Grid>
                                <Grid item xs={12} md={6}>
                                  <Box sx={{ mt: 1, textAlign: 'right' }}>
                                    <Typography variant="h6" color="primary" gutterBottom>
                                      {room.price > 0 ? `${Number(room.price).toLocaleString()} ${room.currency}` : '가격 정보 없음'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {room.isRefundable ? '환불 가능' : '환불 불가'}
                                    </Typography>
                                  </Box>
                                </Grid>
                              </Grid>

                              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                <Button
                                  variant="contained"
                                  color="primary"
                                  onClick={() => handleRoomSelect(selectedHotel, room)}
                                  fullWidth
                                >
                                  이 객실로 일정에 추가
                                </Button>
                              </Box>
                            </Grid>
                          </Grid>
                        </Paper>
                      ))}
                    </Box>
                  </>
                ) : (
                  <Typography variant="body1" color="error" align="center">
                    사용 가능한 객실이 없습니다.
                  </Typography>
                )}
              </Grid>
            </Grid>
        </Box>
      </Modal>
      )}

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
              const baseDate = formData?.checkIn ? new Date(formData.checkIn) : new Date();
              const date = new Date(baseDate);
              date.setDate(baseDate.getDate() + dayKey);
              const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
              return (
                <Button
                  key={dayKey}
                  fullWidth
                  sx={{ my: 1 }}
                  onClick={() => {
                    // 이 다이얼로그는 더 이상 사용되지 않으므로 닫기만 함
                    setAddToPlanDialogOpen(false);
                  }}
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