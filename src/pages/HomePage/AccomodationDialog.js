import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "../../components/ui/button";
import { Loader2, BedDouble, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { travelApi } from "../../services/api";
import SearchPopup from "../../components/SearchPopup";

// 재사용 DatePicker 입력
const CustomInput = React.forwardRef(({ value, onClick, placeholder }, ref) => (
  <Button
    variant="outline"
    className={cn(
      "w-full sm:w-[200px] justify-center text-center font-normal bg-white",
      !value && "text-gray-400"
    )}
    onClick={onClick}
    ref={ref}
  >
    {/* calendar icon */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="mr-2 h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
    {value || placeholder}
  </Button>
));

/**
 * 숙박 검색 다이얼로그 – 항공편 검색 UI(FlightDialog)를 준수하면서
 * 호텔/객실 검색·선택 기능을 제공한다.
 * 필요한 API 호출 로직은 AccommodationPlan 컴포넌트에서 발췌하여 축약하였다.
 */
const AccomodationDialog = ({
  isOpen,
  onClose,
  onSelectAccommodation,
  defaultCheckIn = null,
  defaultCheckOut = null,
  initialAdults = 2,
  initialChildren = 0,
  selectedAccommodation,
  isMultipleMode = false, // 다중 선택 모드 여부
  selectedAccommodations = [], // 이미 선택된 숙박편들 (다중 모드에서 사용)
}) => {
  /* --------------------- 검색조건 State --------------------- */
  const [selectedPlace, setSelectedPlace] = useState(null); // { name, lat, lng }
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);

  /* --------------------- 검색/결과 State --------------------- */
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hotelResults, setHotelResults] = useState([]); // 검색 결과 호텔 배열
  const [expandedHotelId, setExpandedHotelId] = useState(null); // 상세 토글
  const [roomDataByHotel, setRoomDataByHotel] = useState({}); // hotelId -> room list
  const [selectedRoomKey, setSelectedRoomKey] = useState(
    selectedAccommodation?.room?.id || null
  );
  const [expandedRoomId, setExpandedRoomId] = useState(null);

  /* --------------------- 장소 선택 --------------------- */
  const handlePlaceSelect = (place) => {
    if (!place) return;
    setSelectedPlace(place);
  };

  /* --------------------- 호텔 검색 --------------------- */
  const handleSearchHotels = async () => {
    if (!selectedPlace || !checkIn || !checkOut) {
      setSearchError("도시/지역 및 체크인·체크아웃 날짜를 입력하세요.");
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    setHotelResults([]);

    try {
      const params = {
        checkin_date: format(checkIn, "yyyy-MM-dd"),
        checkout_date: format(checkOut, "yyyy-MM-dd"),
        adults_number: adults.toString(),
        children_number: children.toString(),
        latitude: selectedPlace.lat.toString(),
        longitude: selectedPlace.lng.toString(),
        order_by: "distance",
        room_number: "1",
        page_number: "0",
        locale: "ko",
        filter_by_currency: "KRW",
        units: "metric",
        include_adjacency: "true",
      };

      const response = await travelApi.searchHotels(params);
      if (response && response.result) {
        const processed = response.result.map((h) => {
          // 거리 계산 보완: distance_to_cc, distance, actual_distance 순으로 시도
          const dist =
            parseFloat(h.distance_to_cc) ||
            parseFloat(h.distance) ||
            parseFloat(h.actual_distance) ||
            null;
          return {
            ...h,
            _parsedDistance: dist,
          };
        });

        // 5km(또는 거리 정보 없는 경우 포함) 필터
        const filtered = processed.filter((h) => {
          if (h._parsedDistance === null) return true; // 거리 정보 없으면 포함
          return h._parsedDistance <= 5;
        });

        setHotelResults(filtered.length > 0 ? filtered : processed); // 5km 결과 없으면 전체 표시
      } else {
        setSearchError("검색 결과를 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("Hotel search error", err);
      setSearchError("숙소 검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  /* --------------------- 호텔 상세(객실) 로드 --------------------- */
  const toggleHotelDetails = async (hotel) => {
    const open = expandedHotelId === hotel.hotel_id ? null : hotel.hotel_id;
    setExpandedHotelId(open);

    if (!open) return; // close action

    if (roomDataByHotel[hotel.hotel_id]) return; // already loaded

    try {
      const params = {
        type: "room_list",
        hotel_id: hotel.hotel_id,
        checkin_date: format(checkIn, "yyyy-MM-dd"),
        checkout_date: format(checkOut, "yyyy-MM-dd"),
        room_number: "1",
        adults_number: adults.toString(),
        children_number: children.toString(),
        currency: "KRW",
        locale: "ko",
        units: "metric",
      };
      const res = await travelApi.searchHotels(params);
      const processedRooms = processRoomData(res);
      setRoomDataByHotel((prev) => ({ ...prev, [hotel.hotel_id]: processedRooms }));
    } catch (err) {
      console.error("Room list error", err);
    }
  };

  /* --------------------- 객실 데이터 전처리 (AccommodationPlan에서 발췌) --------------------- */
  const processRoomData = (data) => {
    if (!data || !data.result || !data.result[0]) return [];
    const { rooms = {}, block = [] } = data.result[0];

    const extractPrice = (blk) => {
      if (!blk) return { p: null, c: "KRW" };
      const brk =
        blk.product_price_breakdown?.all_inclusive_amount ||
        blk.product_price_breakdown?.gross_amount ||
        blk.block_price_breakdown?.gross_amount;
      if (brk) return { p: brk.value, c: brk.currency };
      if (blk.min_price) return { p: blk.min_price.price || blk.min_price.value, c: blk.min_price.currency };
      return { p: blk.gross_price || blk.price || null, c: blk.currency || "KRW" };
    };

    return Object.entries(rooms).map(([roomId, room]) => {
      const blkMatch = block.find((b) => String(b.room_id || "").includes(roomId));
      const { p, c } = extractPrice(blkMatch);
      return {
        id: roomId,
        name: room.name || blkMatch?.room_name || `객실 ${roomId}`,
        price: p,
        currency: c,
        isRefundable: blkMatch ? !blkMatch.non_refundable : true,
        bedInfo: room.bed_configurations,
        roomSize: room.room_size,
        photos: room.photos,
        description: room.description,
        facilities: room.facilities,
        highlights: room.highlights
      };
    });
  };

  /* --------------------- 객실 선택 --------------------- */
  const combineDateTime = (dateObj, timeStr) => {
    if (!dateObj || !timeStr || timeStr === '정보 없음') return dateObj;
    const [hh, mm] = timeStr.split(':');
    const newDate = new Date(dateObj);
    newDate.setHours(parseInt(hh, 10), parseInt(mm || '0', 10), 0, 0);
    return newDate;
  };

  const handleRoomSelect = (hotel, room) => {
    setSelectedRoomKey(room.id);
    const checkInWithTime = combineDateTime(checkIn, hotel.checkin_from);
    const checkOutWithTime = combineDateTime(checkOut, hotel.checkout_until);
    onSelectAccommodation({ hotel, room, checkIn: checkInWithTime, checkOut: checkOutWithTime, adults, children }, isMultipleMode);
    onClose();
  };

  // 다이얼로그가 열릴 때 최신 기본값으로 초기화
  useEffect(() => {
    if (isOpen) {
      setCheckIn(defaultCheckIn);
      setCheckOut(defaultCheckOut);
      setAdults(initialAdults);
      setChildren(initialChildren);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultCheckIn, defaultCheckOut, initialAdults, initialChildren]);

  // isOpen이 false일 때 렌더링 중단
  if (!isOpen) return null;

  /* --------------------- 렌더 --------------------- */
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">숙박 검색</h2>
          </div>
          <Button variant="ghost" className="rounded-full p-1 hover:bg-gray-100" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel – 검색조건 */}
          <div className="w-1/3 border-r overflow-y-auto p-4 bg-gray-50 space-y-4">
            <h3 className="text-lg font-semibold">검색 조건</h3>
            {/* 도시/지역 */}
            <div>
              <label className="block text-sm font-medium mb-1">도시 / 지역 *</label>
              <SearchPopup onSelect={handlePlaceSelect} onClose={() => {}} />
              {selectedPlace && (
                <p className="mt-1 text-sm text-gray-600">선택됨: {selectedPlace.name}</p>
              )}
            </div>
            {/* 날짜 */}
            <div>
              <label className="block text-sm font-medium mb-1">체크인 *</label>
              <DatePicker
                selected={checkIn}
                onChange={(d) => setCheckIn(d)}
                selectsStart
                startDate={checkIn}
                endDate={checkOut}
                dateFormat="yyyy/MM/dd"
                locale={ko}
                placeholderText="체크인"
                customInput={<CustomInput />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">체크아웃 *</label>
              <DatePicker
                selected={checkOut}
                onChange={(d) => setCheckOut(d)}
                selectsEnd
                startDate={checkIn}
                endDate={checkOut}
                minDate={checkIn}
                dateFormat="yyyy/MM/dd"
                locale={ko}
                placeholderText="체크아웃"
                customInput={<CustomInput />}
              />
            </div>
            {/* 인원수 선택 (플러스/마이너스) */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium w-16">성인</label>
              <Button variant="ghost" size="icon" onClick={() => setAdults((v) => Math.max(1, v - 1))}>-</Button>
              <span className="w-6 text-center">{adults}</span>
              <Button variant="ghost" size="icon" onClick={() => setAdults((v) => Math.min(9, v + 1))}>+</Button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium w-16">어린이</label>
              <Button variant="ghost" size="icon" onClick={() => setChildren((v) => Math.max(0, v - 1))}>-</Button>
              <span className="w-6 text-center">{children}</span>
              <Button variant="ghost" size="icon" onClick={() => setChildren((v) => Math.min(9, v + 1))}>+</Button>
            </div>
            {/* 검색버튼 */}
            <Button
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 mt-2"
              onClick={handleSearchHotels}
              disabled={isSearching}
            >
              {isSearching ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> 검색 중...
                </span>
              ) : (
                "숙소 검색"
              )}
            </Button>
            {searchError && (
              <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm border border-red-200 rounded">{searchError}</div>
            )}
          </div>

          {/* Right panel – 결과 */}
          <div className="w-2/3 overflow-y-auto p-4">
            <h3 className="text-lg font-semibold mb-4">검색 결과</h3>
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500">숙소를 검색 중입니다...</p>
              </div>
            ) : hotelResults.length > 0 ? (
              <div className="space-y-4">
                {hotelResults.map((hotel) => {
                  const isExpanded = expandedHotelId === hotel.hotel_id;
                  const rooms = roomDataByHotel[hotel.hotel_id] || [];
                  return (
                    <div key={hotel.hotel_id} className="border rounded-lg shadow p-4">
                      {/* 호텔 요약 헤더 */}
                      <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleHotelDetails(hotel)}>
                        <div className="flex gap-3">
                          {hotel.main_photo_url && (
                            <img src={hotel.main_photo_url} alt={hotel.hotel_name} className="w-28 h-20 object-cover rounded" />
                          )}
                          <div>
                            <h4 className="font-semibold text-lg">{hotel.hotel_name_trans || hotel.hotel_name}</h4>
                            <p className="text-sm text-gray-500">{hotel.address}</p>
                            {(hotel.checkin_from || hotel.checkin_until) && (
                              <p className="text-xs text-gray-500">체크인 {hotel.checkin_from}{hotel.checkin_until !== '정보 없음' ? ` ~ ${hotel.checkin_until}` : ''}</p>
                            )}
                            {(hotel.checkout_from || hotel.checkout_until) && (
                              <p className="text-xs text-gray-500">체크아웃 {hotel.checkout_from !== '정보 없음' ? `${hotel.checkout_from} ~ ` : ''}{hotel.checkout_until}</p>
                            )}
                            {hotel.price && (
                              <p className="text-blue-600 font-bold mt-1">{hotel.price}</p>
                            )}
                          </div>
                        </div>
                        <div className="ml-2">
                          {isExpanded ? <ChevronUp /> : <ChevronDown />}
                        </div>
                      </div>

                      {/* 상세(객실 리스트) */}
                      {isExpanded && (
                        <div className="mt-4 space-y-3">
                          {rooms.length === 0 ? (
                            <p className="text-sm text-gray-500">객실 정보를 불러오는 중이거나 사용할 수 있는 객실이 없습니다.</p>
                          ) : (
                            rooms.map((room) => {
                              const selected = selectedRoomKey === room.id;
                              return (
                                <div
                                  key={room.id}
                                  className={cn(
                                    "p-3 border rounded hover:bg-blue-50",
                                    selected ? "border-blue-600 bg-blue-100" : "border-gray-200"
                                  )}
                                >
                                  <div className="flex justify-between items-center" onClick={() => setExpandedRoomId(expandedRoomId === room.id ? null : room.id)}>
                                    <div>
                                      <p className="font-medium">{room.name}</p>
                                      {room.price && (
                                        <p className="text-sm text-gray-600">{room.price.toLocaleString()} {room.currency}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {selected && <BedDouble className="text-blue-600" />}
                                      {expandedRoomId === room.id ? <ChevronUp /> : <ChevronDown />}
                                    </div>
                                  </div>

                                  {/* 상세 정보 */}
                                  {expandedRoomId === room.id && (
                                    <div className="mt-2 text-sm space-y-1">
                                      {room.photos && room.photos.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto py-1">
                                          {room.photos.slice(0, 5).map((ph) => (
                                            <img key={ph.photo_id || ph.url_original} src={ph.url_max300 || ph.url_original} alt="room" className="w-32 h-24 object-cover rounded" />
                                          ))}
                                        </div>
                                      )}
                                      {room.roomSize && (
                                        <p>객실 크기: {room.roomSize.size} {room.roomSize.unit}</p>
                                      )}
                                      {room.bedInfo && room.bedInfo.length > 0 && (
                                        <p>
                                          침대 구성: {room.bedInfo[0].bed_types.map((b) => `${b.name}(${b.count})`).join(', ')}
                                        </p>
                                      )}
                                      {room.description && (
                                        <p className="text-xs text-gray-500 mt-1 italic">
                                          "{room.description}"
                                        </p>
                                      )}
                                      {room.facilities && room.facilities.length > 0 && (
                                        <div className="mt-1">
                                          <p className="text-xs font-medium text-gray-700">주요 편의시설:</p>
                                          <ul className="list-disc list-inside text-xs text-gray-500 pl-2">
                                            {room.facilities.slice(0, 7).map(facility => (
                                              <li key={facility.id}>{facility.name}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      <Button size="sm" className="mt-1" onClick={() => handleRoomSelect(hotel, room)}>
                                        이 객실 선택
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">검색 결과가 없습니다. 검색 조건을 입력하세요.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccomodationDialog; 