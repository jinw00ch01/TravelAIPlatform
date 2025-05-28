import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Loader2, MapPin, Hotel, ExternalLink } from "lucide-react";
import { travelApi } from "../../services/api";
import { Modal, Box, Typography, Rating, Button, IconButton, Grid, Divider, CircularProgress, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// 도시코드 → 한글명 매핑
const cityCodeToKorean = {
  CJU: '제주도',
  OSA: '오사카',
  TYO: '도쿄',
  ULN: '울란바토르',
  BKK: '방콕',
  PAR: '파리',
  BCN: '바르셀로나',
  DPS: '발리',
  SPK: '삿포로',
  FUK: '후쿠오카',
  LAX: '로스앤젤레스'
};

// 주요 도시 좌표 정보
const CITIES = [
  { name: "서울", latitude: "37.5662952", longitude: "126.9779692", currency: "KRW" },
  { name: "부산", latitude: "35.1795543", longitude: "129.0756416", currency: "KRW" },
  { name: "도쿄", latitude: "35.6761919", longitude: "139.6503106", currency: "JPY" },
  { name: "오사카", latitude: "34.6937378", longitude: "135.5021651", currency: "JPY" },
  { name: "뉴욕", latitude: "40.7127753", longitude: "-74.0059728", currency: "USD" },
  { name: "파리", latitude: "48.8566969", longitude: "2.3514616", currency: "EUR" },
  { name: "상하이", latitude: "31.2303904", longitude: "121.4737021", currency: "CNY" }
];

// 인기 여행지 데이터를 가져오는 함수
const fetchPopularDestinations = async () => {
  try {
    //console.log('인기 여행지 데이터 요청 시작');
    const response = await fetch('https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/amadeus/Flight_Most_Traveled_Destinations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originCityCode: 'SEL',
        period: '2023-07',
        max: 10
      })
    });

    if (!response.ok) {
      throw new Error('인기 여행지 데이터를 가져오는데 실패했습니다.');
    }

    const data = await response.json();
    //console.log('API 응답 데이터:', data);
    return data;
  } catch (error) {
    //console.error('인기 여행지 데이터 조회 실패:', error);
    return [];
  }
};

// Travel information section containing popular destinations, airlines and hotels
const TravelInfoSection = () => {
  // Loading and tab state
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("destinations");
  const [selectedCity, setSelectedCity] = useState("all"); // 도시 필터링을 위한 상태

  // API 데이터 관련 상태
  const [popularDestinations, setPopularDestinations] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [allHotels, setAllHotels] = useState([]); // 모든 호텔 데이터 저장

  const scrollRef = useRef(); // 스크롤 컨테이너 참조 추가

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        // 인기 여행지 데이터 가져오기
        const destinationsData = await fetchPopularDestinations();
        //console.log('받아온 여행지 데이터:', destinationsData);
        
        const dataArray = destinationsData.data;

        if (dataArray && Array.isArray(dataArray)) {
          const mappedDestinations = dataArray.map((dest, index) => {
            const code = dest.destination || dest.name;
            const cityName = cityCodeToKorean[code] || code;
            return {
              id: index + 1,
              code, // 도시코드
              name: cityName,
              image: `/city-images/${code}.jpg`,
              description: `${index + 1}위`
            };
          });
          //console.log('매핑된 여행지 데이터:', mappedDestinations);
          setPopularDestinations(mappedDestinations);
        } else {
          //console.log('유효한 여행지 데이터가 없습니다');
          setPopularDestinations([]);
        }
      } catch (error) {
        //console.error('데이터 로딩 중 오류 발생:', error);
        setPopularDestinations([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, []);

  // 호텔 상세 정보 관련 상태
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(false);

  // 호텔 상세 정보 조회 함수
  const handleHotelClick = async (hotel) => {
    setSelectedHotel(hotel);
    setModalOpen(true);
    setLoading(true);

    try {
      const roomListParams = {
        type: 'room_list',
        hotel_id: hotel.hotel_id,
        checkin_date: new Date().toISOString().split('T')[0],
        checkout_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        adults_number: '2'
      };

      //console.log('객실 조회 요청:', roomListParams);

      const roomListResponse = await travelApi.searchHotels(roomListParams);
      //console.log('객실 조회 응답:', roomListResponse);
      
      setRoomData(processRoomData(roomListResponse));
    } catch (error) {
      //console.error('객실 정보 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 선호 호텔 데이터 가져오기
  const fetchPreferredHotels = async () => {
    try {
      setIsLoadingData(true);
      
      // 도시들을 3개씩 그룹화
      const cityGroups = [];
      for (let i = 0; i < CITIES.length; i += 3) {
        cityGroups.push(CITIES.slice(i, i + 3));
      }

      const allHotelsData = [];
      
      // 각 그룹별로 처리
      for (const cityGroup of cityGroups) {
        const groupPromises = cityGroup.map(async (city) => {
          try {
            const preferredResponse = await travelApi.searchHotels({
              type: 'preferred_hotels',
              city: {
                name: city.name,
                latitude: city.latitude,
                longitude: city.longitude,
                currency: city.currency
              }
            });

            //console.log(`[${city.name}] 호텔 응답:`, preferredResponse);

            if (preferredResponse && preferredResponse.result) {
              return preferredResponse.result
                .filter(hotel => hotel.preferred || true)
                .slice(0, 3)
                .map(hotel => ({
                  id: hotel.hotel_id,
                  name: hotel.hotel_name_trans || hotel.hotel_name,
                  address: hotel.address || '',
                  city: city.name,
                  main_photo_url: hotel.max_photo_url || hotel.main_photo_url,
                  review_score: hotel.review_score || 0,
                  review_score_word: hotel.review_score_word || '',
                  price: hotel.price || "가격 정보 없음",
                  original_price: hotel.original_price,
                  currency: city.currency,
                  distance_to_center: hotel.distance_to_cc_formatted || hotel.distance || '정보 없음',
                  latitude: hotel.latitude,
                  longitude: hotel.longitude,
                  actual_distance: hotel.distance_to_cc || hotel.distance || 0,
                  accommodation_type: hotel.accommodation_type_name || '숙박시설',
                  checkin_from: hotel.checkin?.from || '정보 없음',
                  checkin_until: hotel.checkin?.until || '정보 없음',
                  checkout_from: hotel.checkout?.from || '정보 없음',
                  checkout_until: hotel.checkout?.until || '정보 없음',
                  review_nr: hotel.review_nr,
                  hotel_id: hotel.hotel_id
                }));
            }
            return [];
          } catch (error) {
            //console.error(`${city.name} 호텔 데이터 가져오기 실패:`, error);
            return [];
          }
        });

        const groupResults = await Promise.all(groupPromises);
        allHotelsData.push(...groupResults.flat());

        // 다음 그룹 처리 전 0.1초 대기
        if (cityGroups.indexOf(cityGroup) < cityGroups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      //console.log('처리된 호텔 데이터:', allHotelsData);
      
      if (allHotelsData.length === 0) {
        throw new Error('호텔 데이터를 가져올 수 없습니다.');
      }

      setAllHotels(allHotelsData);
      setHotels(allHotelsData);
    } catch (error) {
      //console.error('선호 호텔 데이터 가져오기 실패:', error);
      setHotels([
        { id: 1, name: "데이터를 불러올 수 없습니다", location: "오류", rating: "-", price: "-", image: "https://via.placeholder.com/500x300" }
      ]);
    } finally {
      setIsLoadingData(false);
    }
  };

  // 도시별 필터링 함수
  const filterHotelsByCity = (cityName) => {
    setSelectedCity(cityName);
    if (cityName === "all") {
      setHotels(allHotels);
    } else {
      setHotels(allHotels.filter(hotel => hotel.city === cityName));
    }
  };

  // 객실 데이터 처리 함수
  const processRoomData = (data) => {
    if (!data || !data.result || !data.result[0]) return null;
    
    const result = data.result[0];
    const rooms = result.rooms;
    const blocks = result.block;

    const processedRooms = Object.entries(rooms).map(([roomId, room]) => {
      const matchingBlock = blocks.find(block => String(block.room_id) === String(roomId));
      
      let price = null;
      let currency = 'KRW';
      
      if (matchingBlock?.product_price_breakdown?.gross_amount) {
        price = matchingBlock.product_price_breakdown.gross_amount.value;
        currency = matchingBlock.product_price_breakdown.gross_amount.currency;
      }

      return {
        id: roomId,
        name: room.name || matchingBlock?.room_name || '객실 정보 없음',
        description: room.description,
        photos: room.photos,
        facilities: room.facilities,
        price: price,
        currency: currency,
        bedConfigurations: room.bed_configurations,
        roomSize: room.room_size,
        isRefundable: matchingBlock ? !matchingBlock.non_refundable : true
      };
    });

    return {
      rooms: processedRooms
    };
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedHotel(null);
    setRoomData(null);
  };

  const handleBooking = (event, hotel) => {
    event.stopPropagation();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formattedCheckIn = today.toISOString().split('T')[0];
    const formattedCheckOut = tomorrow.toISOString().split('T')[0];
    const hotelName = encodeURIComponent(hotel.name);

    const bookingUrl = `https://www.booking.com/searchresults.ko.html?ss=${hotelName}&checkin=${formattedCheckIn}&checkout=${formattedCheckOut}&group_adults=2&no_rooms=1&lang=ko`;
    window.open(bookingUrl, '_blank');
  };

  useEffect(() => {
    if (activeTab === "hotels") {
      fetchPreferredHotels();
    } else {
      // 다른 데이터 로딩
      const timer = setTimeout(() => {
        // 더미 데이터 세팅 부분 삭제
        // setPopularDestinations([...]);
        // airlines 더미 데이터 세팅 부분도 삭제
        // setAirlines([...]);
        setIsLoadingData(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // 스크롤 함수 추가
  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-gray-500">데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-12">
      <h2 className="text-3xl font-bold text-center mb-8">여행 정보</h2>

      {/* 탭 네비게이션 */}
      <div className="flex justify-center mb-8 border-b">
        <button
          className={`px-6 py-3 font-medium ${activeTab === "destinations" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}
          onClick={() => setActiveTab("destinations")}
        >
          <MapPin className="inline-block mr-2" size={18} />
          인기 여행지
        </button>
        <button
          className={`px-6 py-3 font-medium ${activeTab === "inspiration" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}
          onClick={() => setActiveTab("inspiration")}
        >
          ✈️ 여행지 추천
        </button>
        <button
          className={`px-6 py-3 font-medium ${activeTab === "hotels" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}
          onClick={() => setActiveTab("hotels")}
        >
          <Hotel className="inline-block mr-2" size={18} />
          추천 호텔
        </button>
      </div>

      {/* 도시 필터 버튼 (호텔 탭에서만 표시) */}
      {activeTab === "hotels" && (
        <div className="flex justify-center gap-2 mb-6">
          <button
            className={`px-4 py-2 rounded-full ${selectedCity === "all" ? "bg-primary text-white" : "bg-gray-100"}`}
            onClick={() => filterHotelsByCity("all")}
          >
            전체
          </button>
          {CITIES.map((city) => (
            <button
              key={city.name}
              className={`px-4 py-2 rounded-full ${selectedCity === city.name ? "bg-primary text-white" : "bg-gray-100"}`}
              onClick={() => filterHotelsByCity(city.name)}
            >
              {city.name}
            </button>
          ))}
        </div>
      )}

      {/* 인기 여행지 섹션 */}
      {activeTab === "destinations" && (
        <div className="relative">
          {/* 왼쪽 화살표 */}
          <button
            className="absolute left-[-20px] top-[40%] -translate-y-1/2 z-10 bg-white border rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-100"
            onClick={() => scroll(-1)}
            aria-label="왼쪽으로 스크롤"
            type="button"
          >
            <span className="text-2xl">←</span>
          </button>
          
          {/* 카드 리스트 */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollBehavior: "smooth" }}
          >
            {popularDestinations.map((destination) => (
              <Card key={destination.id} className="overflow-hidden hover:shadow-lg transition-shadow min-w-[300px] max-w-[300px] flex-shrink-0">
                <div className="h-48 w-200 flex items-center justify-center bg-gray-100 relative">
                  {/* 순위 뱃지 추가 - 좌상단에 파란색 박스 */}
                  <div className="absolute top-0 left-0 bg-blue-500 text-white px-3 py-1 rounded-br-md font-semibold shadow-md z-10">
                    {destination.description}
                  </div>
                  <img
                    src={`/city-images/${destination.code}.jpg`}
                    alt={destination.name}
                    className="max-w-full max-h-full object-contain"
                    onError={e => { e.target.onerror = null; e.target.src = '/city-images/default.jpg'; }}
                  />
                </div>
                <CardContent className="p-4">
                  <h3 className="text-xl font-bold mb-2">{destination.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* 오른쪽 화살표 */}
          <button
            className="absolute right-[-20px] top-[40%] -translate-y-1/2 z-10 bg-white border rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-100"
            onClick={() => scroll(1)}
            aria-label="오른쪽으로 스크롤"
            type="button"
          >
            <span className="text-2xl">→</span>
          </button>
        </div>
      )}

      {/* 여행지 추천 섹션 */}
      {activeTab === "inspiration" && (
        <div className="w-full max-w-2xl mx-auto">
          {/* 상단 파란 배경 */}
          <div className="rounded-t-2xl bg-gradient-to-r from-sky-500 to-sky-400 p-8 flex flex-col gap-2 relative overflow-hidden">
            <div className="text-white font-bold text-lg mb-1">제일 빠른 항공권!</div>
            <div className="text-white text-2xl font-extrabold mb-1">땡처리 항공권이 곧 마감됩니다.</div>
            
            {/* 비행기 날개 이미지 자리 (원하는 경우 public에 이미지 추가 후 src 교체) */}
            <div className="absolute right-0 bottom-0 w-1/2 h-24 opacity-30 bg-no-repeat bg-right bg-contain pointer-events-none" style={{backgroundImage: "url()"}}></div>
          </div>
          {/* 리스트 카드 */}
          <div className="bg-white rounded-b-2xl shadow-lg px-6 py-4 -mt-2">
            {/* 더미 데이터 반복 */}
            {[
              {
                from: '인천', to: '방콕', date: '2025.05.13~2025.10.25', type: '왕복 · 직항', price: '209,000원~', logo: '',
              },
              {
                from: '인천', to: '방콕', date: '2025.05.14~2025.10.22', type: '왕복 · 직항', price: '199,000원~', logo: '',
              },
              {
                from: '인천', to: '방콕', date: '2025.07.01~2025.10.22', type: '왕복 · 직항', price: '269,000원~', logo: '',
              },
              {
                from: '인천', to: '괌', date: '2025.05.13~2025.10.21', type: '왕복 · 직항', price: '209,000원~', logo: '',
              },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-4 border-b last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-lg text-gray-800">{item.from} - {item.to}</div>
                  <div className="text-gray-500 text-sm mb-1">{item.date} · {item.type}</div>
                  <div className="font-bold text-xl text-sky-700">{item.price}</div>
                </div>
                {/* 항공사 로고 자리 */}
                <div className="w-16 h-10 flex items-center justify-center">
                  {/* <img src={item.logo} alt="항공사" className="h-8" /> */}
                </div>
              </div>
            ))}
            {/* 더보기 버튼 */}
            <div className="flex justify-center mt-4">
              <button className="w-full py-3 rounded-lg bg-gray-50 text-lg font-semibold text-gray-700 hover:bg-gray-100 transition">상품 더보기</button>
            </div>
          </div>
        </div>
      )}

      {/* 호텔 정보 섹션 */}
      {activeTab === "hotels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotels.map((hotel) => (
            <Card 
              key={hotel.id} 
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleHotelClick(hotel)}
            >
              <div className="h-48 overflow-hidden">
                <img src={hotel.main_photo_url} alt={hotel.name} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-4">
                <h3 className="text-xl font-bold mb-1">{hotel.name}</h3>
                <p className="text-gray-600 mb-2">{hotel.city}</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-yellow-500 mr-1">★</span>
                    <span>{hotel.review_score.toFixed(1)}</span>
                    {hotel.review_nr && (
                      <span className="text-gray-500 text-sm ml-2">
                        ({hotel.review_nr.toLocaleString()}개 리뷰)
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary">{hotel.price}</span>
                    {hotel.original_price && hotel.original_price !== hotel.price && (
                      <div className="text-xs text-gray-500">
                        ({hotel.original_price.toLocaleString()} {hotel.currency})
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 호텔 상세 정보 모달 */}
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
                {selectedHotel.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={(e) => handleBooking(e, selectedHotel)}
                  startIcon={<ExternalLink />}
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
                  alt={selectedHotel.name}
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
                  {selectedHotel.address}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Rating value={parseFloat(selectedHotel.review_score)} precision={0.5} readOnly />
                  <Typography variant="body1" sx={{ ml: 1 }}>
                    {selectedHotel.review_score.toFixed(1)}
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

                {/* 객실 정보 섹션 */}
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : roomData && roomData.rooms ? (
                  <>
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
    </div>
  );
};

export default TravelInfoSection; 