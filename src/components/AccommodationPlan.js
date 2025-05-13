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
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import SearchPopup from './SearchPopup';
import { Search as SearchIcon, Add as AddIcon, Sort as SortIcon, AttachMoney as AttachMoneyIcon, Star as StarIcon, Delete as DeleteIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon, LocationOn as LocationOnIcon, Info as InfoIcon } from '@mui/icons-material';
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
  const [showMap, setShowMap] = useState(true);
  const [addToPlanDialogOpen, setAddToPlanDialogOpen] = useState(false);
  const [hotelToAdd, setHotelToAdd] = useState(null);
  const [latestPlan, setLatestPlan] = useState(null);
  const [daySelectList, setDaySelectList] = useState([]);
  const [roomConfig, setRoomConfig] = useState([{ adults: '', children: '' }]); // 기본값을 빈 문자열로 변경
  const [roomData, setRoomData] = useState(null);
  const [selectedHotelId, setSelectedHotelId] = useState(null);

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

      // roomConfig 정보를 API 파라미터로 변환
      const rooms = formData.roomConfig || [{ adults: parseInt(formData.adults) || 2, children: parseInt(formData.children) || 0 }];
      
      // 각 객실별 어린이 나이 정보 생성
      const roomsWithChildrenAges = rooms.map(room => ({
        ...room,
        childrenAges: Array(room.children).fill(7) // 기본값 7세
      }));

      // API 파라미터 구성
      const apiParams = {
        checkin_date: format(formData.checkIn, 'yyyy-MM-dd'),
        checkout_date: format(formData.checkOut, 'yyyy-MM-dd'),
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
        // 각 객실별 상세 정보 추가
        adults_number_by_rooms: rooms.map(room => room.adults.toString()).join(','),
        children_number_by_rooms: rooms.map(room => room.children.toString()).join(','),
        rooms: roomsWithChildrenAges.map((room, index) => ({
          room_number: (index + 1).toString(),
          adults_number: room.adults.toString(),
          children_number: room.children.toString(),
          children_ages: room.childrenAges
        }))
      };

      console.log('[검색] API 요청 파라미터:', apiParams);
      
      const responseData = await travelApi.searchHotels(apiParams);
      console.log('[검색] API 응답:', responseData);

      if (!responseData || !responseData.result) {
        throw new Error('검색 결과를 가져오는데 실패했습니다.');
      }

      // 거리 기준으로 필터링
      const filteredResults = responseData.result.filter(hotel => {
        // 거리 정보 추출
        const distanceValue = parseFloat(hotel.distance_to_cc) || parseFloat(hotel.distance) || calculateDistance(
          formData.latitude,
          formData.longitude,
          parseFloat(hotel.latitude),
          parseFloat(hotel.longitude)
        );

        // 거리 표시 형식 설정
        hotel.distance_to_center = hotel.distance_to_cc_formatted || 
          hotel.distance_formatted || 
          (distanceValue < 1 ? `${(distanceValue * 1000).toFixed(0)}m` : `${distanceValue.toFixed(1)}km`);
        
        // actual_distance 설정
        hotel.actual_distance = distanceValue;

        return distanceValue <= 5;
      });

      if (filteredResults.length === 0) {
        throw new Error(`${formData.cityName} 주변 5km 반경 내에 검색 결과를 찾을 수 없습니다.`);
      }

      setSearchResults(filteredResults);
      setSortedResults(sortResults(filteredResults, sortType));

      // 검색 결과와 formData를 localStorage에 저장
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
    // 같은 버튼을 눌렀을 때 오름차순/내림차순 전환
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
      // roomConfig 정보를 API 파라미터로 변환
      const rooms = formData.roomConfig || [{ adults: parseInt(formData.adults) || 2, children: parseInt(formData.children) || 0 }];

      // 각 객실별 어린이 나이 정보 생성
      const roomsWithChildrenAges = rooms.map(room => ({
        ...room,
        childrenAges: Array(room.children).fill(7) // 기본값 7세
      }));

      const roomListParams = {
        type: 'room_list',
        hotel_id: hotel.hotel_id,
        checkin_date: format(formData.checkIn, 'yyyy-MM-dd'),
        checkout_date: format(formData.checkOut, 'yyyy-MM-dd'),
        room_number: rooms.length.toString(),
        adults_number: rooms.reduce((sum, room) => sum + room.adults, 0).toString(),
        children_number: rooms.reduce((sum, room) => sum + room.children, 0).toString(),
        currency: 'KRW',
        locale: 'ko',
        units: 'metric',
        // 각 객실별 상세 정보 추가
        adults_number_by_rooms: rooms.map(room => room.adults.toString()).join(','),
        children_number_by_rooms: rooms.map(room => room.children.toString()).join(','),
        rooms: roomsWithChildrenAges.map((room, index) => ({
          room_number: (index + 1).toString(),
          adults_number: room.adults.toString(),
          children_number: room.children.toString(),
          children_ages: room.childrenAges
        }))
      };

      console.log('[객실 조회] 요청 파라미터:', roomListParams);
      const response = await travelApi.searchHotels(roomListParams);
      console.log('[객실 조회] 응답:', response);

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

    // 총 가격 계산을 위한 변수
    let totalPrice = 0;
    let totalCurrency = 'KRW';

    const processedRooms = Object.entries(rooms).map(([roomId, room]) => {
      console.log(`[객실 ${roomId}] 상세정보:`, room);
      
      // block 매칭 로직 개선
      const matchingBlocks = blocks.filter(block => {
        const blockRoomId = String(block.room_id || '');
        const currentRoomId = String(roomId);
        
        return blockRoomId === currentRoomId || 
               blockRoomId.includes(currentRoomId) ||
               currentRoomId.includes(blockRoomId);
      });

      console.log(`[객실 ${roomId}] matchingBlocks:`, matchingBlocks);
      const matchingBlock = matchingBlocks[0];

      // 객실 이름 처리 로직 개선
      let roomName = '객실 정보 없음';
      if (room.name) {
        roomName = room.name;
      } else if (matchingBlock && matchingBlock.room_name) {
        roomName = matchingBlock.room_name;
      } else if (room.room_name) {
        roomName = room.room_name;
      }

      console.log(`[객실 ${roomId}] 이름:`, roomName);

      // 가격 정보 추출 로직
      let price = null;
      let currency = 'KRW';
      let priceBreakdown = null;

      const extractPrice = (block) => {
        let extractedPrice = null;
        let extractedCurrency = currency;
        let extractedBreakdown = null;

        // 1. product_price_breakdown에서 가격 확인
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
        
        // 2. min_price에서 가격 확인
        if (extractedPrice === null && block.min_price) {
          extractedPrice = block.min_price.price || block.min_price.value;
          extractedCurrency = block.min_price.currency || extractedCurrency;
        }

        // 3. block_price_breakdown에서 가격 확인
        if (extractedPrice === null && block.block_price_breakdown) {
          if (block.block_price_breakdown.gross_amount) {
            extractedPrice = block.block_price_breakdown.gross_amount.value;
            extractedCurrency = block.block_price_breakdown.gross_amount.currency;
            extractedBreakdown = block.block_price_breakdown;
          }
        }

        // 4. price 필드에서 직접 확인
        if (extractedPrice === null && block.price) {
          extractedPrice = block.price;
          extractedCurrency = block.currency || extractedCurrency;
        }

        // 5. gross_price에서 확인
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

      // 모든 매칭된 블록에서 가격 정보 추출
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

      // 매칭된 블록이 없는 경우 첫 번째 블록 사용
      if (!bestBlock && blocks.length > 0) {
        const extracted = extractPrice(blocks[0]);
        price = extracted.price;
        currency = extracted.currency;
        priceBreakdown = extracted.breakdown;
        bestBlock = blocks[0];
      }

      // 총 가격에 현재 객실 가격 추가
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

    // 객실 구성 정보 가져오기
    const rooms = formData.roomConfig || [{ adults: parseInt(formData.adults) || 2, children: parseInt(formData.children) || 0 }];
    const totalChildren = rooms.reduce((sum, room) => sum + room.children, 0);
    const roomCount = rooms.length;

    const formattedCheckIn = checkInDate.toISOString().split('T')[0];
    const formattedCheckOut = checkOutDate.toISOString().split('T')[0];
    const hotelName = encodeURIComponent(hotel.hotel_name);

    const bookingUrl = `https://www.booking.com/searchresults.ko.html?ss=${hotelName}&checkin=${formattedCheckIn}&checkout=${formattedCheckOut}&group_adults=${adults}&group_children=${totalChildren}&no_rooms=${roomCount}&lang=ko`;
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

    // 숙소 상세 정보를 포함한 캐시 데이터 생성
    const hotelCache = {
      hotel_id: hotel.hotel_id,
      hotel_name: hotel.hotel_name,
      address: hotel.address,
      city: hotel.city,
      main_photo_url: hotel.main_photo_url,
      review_score: hotel.review_score,
      review_score_word: hotel.review_score_word,
      review_nr: hotel.review_nr,
      price: hotel.price,
      original_price: hotel.original_price,
      distance_to_center: hotel.distance_to_center,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      url: hotel.url,
      actual_distance: hotel.actual_distance,
      accommodation_type: hotel.accommodation_type,
      checkin_from: hotel.checkin_from,
      checkin_until: hotel.checkin_until,
      checkout_from: hotel.checkout_from,
      checkout_until: hotel.checkout_until
    };

    // 일정에 표시될 기본 정보
    const newSchedule = {
      id: `hotel-${hotel.hotel_id}-${Date.now()}`,
      name: hotel.hotel_name,
      time: '체크인',
      address: hotel.address,
      category: '숙소',
      duration: '1박',
      notes: `가격: ${hotel.price}`,
      lat: hotel.latitude,
      lng: hotel.longitude,
      type: 'accommodation',
      hotelCache: hotelCache // 캐시 데이터 추가
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

  const handleRoomConfigChange = (index, field, value) => {
    const newConfig = [...roomConfig];
    newConfig[index] = {
      ...newConfig[index],
      [field]: value === '' ? '' : parseInt(value) || 0  // 빈 문자열 허용
    };
    setRoomConfig(newConfig);
    
    // formData 업데이트 - 빈 값은 0으로 처리
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
    if (roomConfig.length < 5) { // 최대 5개 객실까지
      setRoomConfig([...roomConfig, { adults: '', children: '' }]);  // 새 객실도 빈 값으로 초기화
    }
  };

  const removeRoom = (index) => {
    if (roomConfig.length > 1) {
      const newConfig = roomConfig.filter((_, i) => i !== index);
      setRoomConfig(newConfig);
      
      // formData 업데이트
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
    // localStorage에서 이전 검색 결과 불러오기
    const savedResults = localStorage.getItem('accommodationSearchResults');
    if (savedResults) {
      const parsedResults = JSON.parse(savedResults);
      setSearchResults(parsedResults);
      setSortedResults(sortResults(parsedResults, sortType));
    }

    // localStorage에서 이전 formData 불러오기
    const savedFormData = localStorage.getItem('accommodationFormData');
    if (savedFormData) {
      const parsedFormData = JSON.parse(savedFormData);
      // Date 객체로 변환
      if (parsedFormData.checkIn) parsedFormData.checkIn = new Date(parsedFormData.checkIn);
      if (parsedFormData.checkOut) parsedFormData.checkOut = new Date(parsedFormData.checkOut);
      setFormData(parsedFormData);
    } else {
      // 기본 formData 설정
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
        setFormData(prev => ({
          ...prev,
        checkIn: today,
        checkOut: tomorrow,
        adults: '2',
        children: '0'
      }));
    }
  }, []); // 컴포넌트 마운트 시에만 실행

  useEffect(() => {
    if (searchResults.length > 0) {
      localStorage.setItem('accommodationSearchResults', JSON.stringify(searchResults));
      setSortedResults(sortResults(searchResults, sortType));
    }
  }, [searchResults, sortType]);

  useEffect(() => {
    if (formData && Object.keys(formData).length > 0) {
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
                    error: !formData.checkIn && !!error,
                    helperText: !formData.checkIn && error ? '체크인 날짜를 선택해주세요' : ''
                  } 
                }}
            />
            <DatePicker
                label="체크아웃"
                value={formData.checkOut}
                onChange={(date) => handleDateChange('checkOut', date)}
                minDate={formData.checkIn ? new Date(new Date(formData.checkIn).setDate(new Date(formData.checkIn).getDate() + 1)) : new Date(new Date().setDate(new Date().getDate() + 1))}
                slotProps={{ 
                  textField: { 
                    fullWidth: true,
                    error: !formData.checkOut && !!error,
                    helperText: !formData.checkOut && error ? '체크아웃 날짜를 선택해주세요' : ''
                  } 
                }}
              />
            </LocalizationProvider>

            {/* 객실 및 인원 선택 UI */}
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
          {/* 오른쪽(결과/지도 영역 상단)에만 지도 숨기기/보이기 버튼 */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setShowMap(v => !v)}>
              {showMap ? '지도 숨기기' : '지도 보이기'}
            </Button>
          </Box>
          
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
                  selectedHotelId={selectedHotelId}
                  searchLocation={{
                    latitude: formData.latitude,
                    longitude: formData.longitude,
                    name: formData.cityName
                  }}
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

                {/* 객실 정보 섹션 */}
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

                              <Box sx={{ mt: 2 }}>
                                <Button
                                  variant="contained"
                                  color="primary"
                                  onClick={(e) => handleBooking(e, selectedHotel)}
                                  fullWidth
                                >
                                  예약하기
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