import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Loader2, Plane, X } from "lucide-react";
import amadeusApi from "../../utils/amadeusApi";
import { cn } from "../../lib/utils";

// 재사용되는 DatePicker용 커스텀 입력
const CustomInput = React.forwardRef(({ value, onClick, placeholder, disabled }, ref) => (
  <Button
    variant="outline"
    className={cn(
      "w-full sm:w-[200px] justify-center text-center font-normal bg-white",
      !value && "text-gray-400",
      disabled && "opacity-50 cursor-not-allowed bg-gray-100"
    )}
    onClick={disabled ? undefined : onClick}
    ref={ref}
    disabled={disabled}
  >
    {/* Calendar icon */}
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

const FlightDialog = ({
  isOpen,
  onClose,
  onSelectFlight,
  initialAdultCount = 1,
  initialChildCount = 0,
  initialInfantCount = 0,
  defaultStartDate = null,
  defaultEndDate = null,
  isMultipleMode = false, // 다중 선택 모드 여부
  selectedFlights = [], // 이미 선택된 항공편들 (다중 모드에서 사용)
}) => {
  // --------------------- state ---------------------
  // 검색 입력 및 도시 결과 상태
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);

  // 날짜 및 인원
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [adultCount, setAdultCount] = useState(initialAdultCount);
  const [childCount, setChildCount] = useState(initialChildCount);
  const [infantCount, setInfantCount] = useState(initialInfantCount);

  // 추가 조건
  const [travelClass, setTravelClass] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [nonStop, setNonStop] = useState(false);
  const [isOneWay, setIsOneWay] = useState(false); // 편도/왕복 선택 상태

  // 로딩 & 결과
  const [isLoadingFlights, setIsLoadingFlights] = useState(false);
  const [flightResults, setFlightResults] = useState([]);
  const [flightError, setFlightError] = useState(null);
  const [dictionaries, setDictionaries] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [isLoadingCities, setIsLoadingCities] = useState(false); // 도시 검색 로딩 상태(현재 UI 미사용)
  // 공항 상세정보 캐시
  const [airportInfoCache, setAirportInfoCache] = useState({});
  // 사용자가 이 다이얼로그에서 선택한 항공편을 표시하기 위한 로컬 state
  const [selectedFlightIdLocal, setSelectedFlightIdLocal] = useState(null);
  // 다중 선택 모드에서 이미 선택된 항공편 ID들
  const selectedFlightIds = selectedFlights.map(f => f.id);

  // 편도/왕복 선택 핸들러
  const handleTripTypeChange = (oneWay) => {
    setIsOneWay(oneWay);
    if (oneWay) {
      // 편도 선택 시 오는날 초기화
      setEndDate(null);
    }
  };

  // 초기값 세팅 (대략 30일 후 기본 출발일 등)
  useEffect(() => {
    if (isOpen) {
      // 다이얼로그를 열 때마다 로컬 선택 상태 완전 초기화
      setSelectedFlightIdLocal(null);
      setFlightResults([]); // 이전 검색 결과도 초기화
      setFlightError(null);
      
      // 다이얼로그를 열 때 부모에서 전달된 날짜를 우선 사용
      if (defaultStartDate) {
        setStartDate(defaultStartDate);
      } else if (!startDate) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setStartDate(d);
      }

      if (defaultEndDate) {
        setEndDate(defaultEndDate);
        setIsOneWay(false); // 귀국일이 있으면 왕복으로 설정
      } else {
        setIsOneWay(false); // 기본값은 왕복
      }

      // 인원 수 동기화
      setAdultCount(initialAdultCount);
      setChildCount(initialChildCount);
      setInfantCount(initialInfantCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultStartDate, defaultEndDate, initialAdultCount, initialChildCount, initialInfantCount]);

  /* ----------------------------- API 호출 ----------------------------- */
  const handleCitySearch = async (value, type) => {
    if (!value || value.length < 2) {
      if (type === "origin") setOriginCities([]);
      else setDestinationCities([]);
      return;
    }

    setIsLoadingCities(true);
    setFlightError(null);

    try {
      const response = await amadeusApi.searchCities(value);
      const apiOptions = Array.isArray(response?.data)
        ? response.data.map((location) => ({
            name: location.name,
            iataCode: location.iataCode,
            address: location.address?.cityName || "",
            id: location.id || `${location.iataCode}-${location.name}`,
          }))
        : [];

      if (type === "origin") setOriginCities(apiOptions);
      else setDestinationCities(apiOptions);
    } catch (err) {
      console.error("API 도시 검색 오류:", err);
      if (type === "origin") setOriginCities([]);
      else setDestinationCities([]);
    } finally {
      setIsLoadingCities(false);
    }
  };

  /* ----------------------------- 항공권 검색 ----------------------------- */
  const searchFlights = () => {
    if (!selectedOrigin) {
      setFlightError("출발지를 선택해주세요.");
      return;
    }
    if (!selectedDestination) {
      setFlightError("도착지를 선택해주세요.");
      return;
    }
    if (!startDate) {
      setFlightError("가는 날짜를 선택해주세요.");
      return;
    }
    // 유아 수 체크
    if (infantCount > adultCount) {
      setFlightError("유아 수는 성인 수를 초과할 수 없습니다.");
      return;
    }
    const totalPassengers = adultCount + childCount;
    if (totalPassengers > 9) {
      setFlightError("총 탑승객(성인+어린이)은 9명을 초과할 수 없습니다.");
      return;
    }

    setIsLoadingFlights(true);
    setFlightError(null);
    setFlightResults([]);
    setSelectedFlightIdLocal(null); // 새로운 검색 시 로컬 선택 상태 초기화

    const paramsToApi = {
      originCode: selectedOrigin.iataCode,
      destinationCode: selectedDestination.iataCode,
      departureDate: format(startDate, "yyyy-MM-dd"),
      returnDate: endDate ? format(endDate, "yyyy-MM-dd") : null,
      adults: adultCount,
      children: childCount > 0 ? childCount : undefined,
      infants: infantCount > 0 ? infantCount : undefined,
      travelClass: travelClass || undefined,
      nonStop: nonStop || undefined,
      currencyCode: "KRW",
      maxPrice: maxPrice || undefined,
      max: 20,
    };

    amadeusApi
      .searchFlights(paramsToApi)
      .then((response) => {
        if (response && Array.isArray(response.data)) {
          setFlightResults(response.data);
          setDictionaries(response.dictionaries || {});

          // 공항 한글명 로딩
          fetchAirportDetailsForResults(response.data);

          if (response.data.length === 0) {
            setFlightError("검색 조건에 맞는 항공편이 없습니다.");
          }
        } else {
          setFlightError("항공편 검색 결과가 없거나 형식이 올바르지 않습니다.");
        }
      })
      .catch((err) => {
        console.error("항공편 검색 오류:", err);
        setFlightError(err.message || "항공편 검색 중 오류가 발생했습니다.");
      })
      .finally(() => setIsLoadingFlights(false));
  };

  // 공항 세부정보를 검색하여 캐시에 저장
  const fetchAirportDetailsForResults = (results) => {
    if (!results || results.length === 0) return;

    const codesSet = new Set();
    results.forEach((flight) => {
      flight.itineraries.forEach((itinerary) => {
        itinerary.segments.forEach((seg) => {
          if (seg.departure?.iataCode) codesSet.add(seg.departure.iataCode);
          if (seg.arrival?.iataCode) codesSet.add(seg.arrival.iataCode);
        });
      });
    });

    const codesToFetch = Array.from(codesSet).filter(
      (code) => code && !airportInfoCache[code]
    );

    if (codesToFetch.length === 0) return;

    const promises = codesToFetch.map((code) =>
      amadeusApi
        .getAirportDetails(code)
        .then((info) => ({ [code]: info || {} }))
        .catch(() => ({ [code]: {} }))
    );

    Promise.all(promises).then((resultsArr) => {
      const merged = resultsArr.reduce((acc, cur) => ({ ...acc, ...cur }), {});
      setAirportInfoCache((prev) => ({ ...prev, ...merged }));
    });
  };

  // 결과 렌더링 내 항공편 선택 버튼 클릭 핸들러 업데이트
  const handleFlightSelect = (flight) => {
    // 다중 선택 모드가 아닌 경우에만 로컬 선택 상태를 업데이트
    if (!isMultipleMode) {
    setSelectedFlightIdLocal(flight.id);
    }
    
    // 부모 컴포넌트로 항공편 정보와 함께 dictionaries와 airportInfoCache도 전달
    // 다중 선택 모드 여부도 함께 전달
    onSelectFlight(flight, dictionaries, airportInfoCache, isMultipleMode);
  };

  // 다이얼로그 닫기 핸들러
  const handleClose = () => {
    // 다이얼로그 닫을 때 로컬 상태 정리
    setSelectedFlightIdLocal(null);
    onClose();
  };

  // isOpen이 false 일 때 다이얼로그를 렌더링하지 않음
  if (!isOpen) return null;

  /* ----------------------------- 렌더 ----------------------------- */
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">항공편 검색</h2>
            {isMultipleMode && (
              <p className="text-sm text-gray-600 mt-1">
                다중 선택 모드 - 이미 선택된 항공편: {selectedFlights.length}개
              </p>
            )}
          </div>
          <Button variant="ghost" className="rounded-full p-1 hover:bg-gray-100" onClick={handleClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel */}
          <div className="w-1/3 border-r overflow-y-auto p-4 bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">검색 조건</h3>

            {/* 출발지 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">출발지 *</label>
              <div className="relative">
                <Input
                  placeholder="도시 또는 공항 검색 (2글자 이상)"
                  value={originSearch}
                  onChange={(e) => {
                    setOriginSearch(e.target.value);
                    if (e.target.value.length >= 2) {
                      handleCitySearch(e.target.value, "origin");
                    } else {
                      setOriginCities([]);
                    }
                  }}
                />
                {originCities.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {originCities.map((city) => (
                      <div
                        key={city.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSelectedOrigin(city);
                          setOriginSearch(`${city.name} (${city.iataCode})`);
                          setOriginCities([]);
                        }}
                      >
                        {city.name} ({city.iataCode})
                        {city.address && <div className="text-xs text-gray-500">{city.address}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 도착지 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">도착지 *</label>
              <div className="relative">
                <Input
                  placeholder="도시 또는 공항 검색 (2글자 이상)"
                  value={destinationSearch}
                  onChange={(e) => {
                    setDestinationSearch(e.target.value);
                    if (e.target.value.length >= 2) {
                      handleCitySearch(e.target.value, "destination");
                    } else {
                      setDestinationCities([]);
                    }
                  }}
                />
                {destinationCities.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {destinationCities.map((city) => (
                      <div
                        key={city.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSelectedDestination(city);
                          setDestinationSearch(`${city.name} (${city.iataCode})`);
                          setDestinationCities([]);
                        }}
                      >
                        {city.name} ({city.iataCode})
                        {city.address && <div className="text-xs text-gray-500">{city.address}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 편도/왕복 선택 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">여행 유형</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!isOneWay ? "default" : "outline"}
                  className={`flex-1 ${!isOneWay ? "bg-blue-500 hover:bg-blue-600 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => handleTripTypeChange(false)}
                >
                  왕복
                </Button>
                <Button
                  type="button"
                  variant={isOneWay ? "default" : "outline"}
                  className={`flex-1 ${isOneWay ? "bg-blue-500 hover:bg-blue-600 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => handleTripTypeChange(true)}
                >
                  편도
                </Button>
              </div>
            </div>

            {/* 날짜 선택 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">가는 날 *</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                dateFormat="yyyy/MM/dd"
                locale={ko}
                placeholderText="가는 날"
                customInput={<CustomInput />}
              />
            </div>
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-1 ${isOneWay ? "text-gray-400" : ""}`}>
                오는 날 {isOneWay ? "(편도 선택됨)" : "(선택사항)"}
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                dateFormat="yyyy/MM/dd"
                locale={ko}
                placeholderText={isOneWay ? "편도 항공편" : "오는 날"}
                customInput={<CustomInput />}
                disabled={isOneWay}
              />
              {isOneWay && (
                <p className="text-xs text-gray-500 mt-1">편도 항공편을 선택했습니다. 오는 날은 설정할 수 없습니다.</p>
              )}
            </div>

            {/* 인원 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">성인 (만 12세 이상) *</label>
              <Input
                type="number"
                min="1"
                max="9"
                value={adultCount}
                onChange={(e) => setAdultCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">어린이 (만 2-11세)</label>
              <Input
                type="number"
                min="0"
                max="9"
                value={childCount}
                onChange={(e) => setChildCount(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">유아 (만 2세 미만)</label>
              <Input
                type="number"
                min="0"
                max="9"
                value={infantCount}
                onChange={(e) => setInfantCount(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            {/* 좌석 등급 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">좌석 등급</label>
              <select
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={travelClass}
                onChange={(e) => setTravelClass(e.target.value)}
              >
                <option value="">모든 등급</option>
                <option value="ECONOMY">이코노미</option>
                <option value="PREMIUM_ECONOMY">프리미엄 이코노미</option>
                <option value="BUSINESS">비즈니스</option>
                <option value="FIRST">퍼스트</option>
              </select>
            </div>

            {/* 최대 가격 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">최대 가격 (1인당)</label>
              <Input
                type="number"
                min="0"
                placeholder="예: 500000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) : "")}
              />
            </div>

            {/* 직항 */}
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="nonStop"
                checked={nonStop}
                onChange={(e) => setNonStop(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="nonStop" className="text-sm">
                직항만 검색
              </label>
            </div>

            <Button
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 mt-4"
              onClick={searchFlights}
              disabled={isLoadingFlights}
            >
              {isLoadingFlights ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  검색 중...
                </span>
              ) : (
                "항공권 검색"
              )}
            </Button>

            {flightError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                {flightError}
              </div>
            )}
          </div>

          {/* Right panel - 결과 */}
          <div className="w-2/3 overflow-y-auto p-4">
            <h3 className="text-lg font-semibold mb-4">검색 결과</h3>

            {isLoadingFlights ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500">항공편을 검색 중입니다...</p>
              </div>
            ) : flightResults.length > 0 ? (
              <div className="space-y-4">
                {flightResults.map((flight, index) => {
                  const isRoundTrip = flight.itineraries.length > 1;
                  const outboundItinerary = flight.itineraries[0];
                  const outboundFirstSegment = outboundItinerary.segments[0];
                  const outboundLastSegment = outboundItinerary.segments[outboundItinerary.segments.length - 1];

                  const priceFormatted = parseInt(flight.price.grandTotal).toLocaleString();
                  const outboundCarrierCode = outboundFirstSegment.carrierCode;
                  const outboundCarrierName = dictionaries?.carriers?.[outboundCarrierCode] || outboundCarrierCode;
                  const outboundDuration = outboundItinerary.duration
                    .replace("PT", "")
                    .replace("H", "시간 ")
                    .replace("M", "분");
                  const outboundStops = outboundItinerary.segments.length - 1;
                  const outboundStopsText = outboundStops === 0 ? "직항" : `${outboundStops}회 경유`;

                  // inbound info if round trip
                  let inboundInfo = null;
                  if (isRoundTrip) {
                    const inboundItinerary = flight.itineraries[1];
                    const inboundFirstSegment = inboundItinerary.segments[0];
                    const inboundLastSegment = inboundItinerary.segments[inboundItinerary.segments.length - 1];

                    const inboundCarrierCode = inboundFirstSegment.carrierCode;
                    const inboundCarrierName = dictionaries?.carriers?.[inboundCarrierCode] || inboundCarrierCode;
                    const inboundDuration = inboundItinerary.duration
                      .replace("PT", "")
                      .replace("H", "시간 ")
                      .replace("M", "분");
                    const inboundStops = inboundItinerary.segments.length - 1;
                    const inboundStopsText = inboundStops === 0 ? "직항" : `${inboundStops}회 경유`;

                    inboundInfo = {
                      departureCode: inboundFirstSegment.departure.iataCode,
                      arrivalCode: inboundLastSegment.arrival.iataCode,
                      departureTime: new Date(inboundFirstSegment.departure.at).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                      arrivalTime: new Date(inboundLastSegment.arrival.at).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                      carrierName: inboundCarrierName,
                      stopsText: inboundStopsText,
                      duration: inboundDuration,
                    };
                  }

                  const getCityLabel = (code) => {
                    const info = airportInfoCache[code] || {};
                    return (
                      info.koreanMunicipalityName ||
                      info.koreanFullName ||
                      info.koreanName ||
                      info.name ||
                      code
                    );
                  };

                  // 이미 선택된 항공편인지 확인 (다중 선택 모드에서만)
                  const isAlreadySelected = isMultipleMode && selectedFlightIds.includes(flight.id);
                  // 단일 선택 모드일 때만 현재 선택 상태를 표시
                  const isCurrentlySelected = !isMultipleMode && selectedFlightIdLocal === flight.id;

                  return (
                    <div
                      key={flight.id}
                      onClick={() => handleFlightSelect(flight)}
                      className={cn(
                        "flex flex-col p-4 mb-4 border cursor-pointer hover:border-blue-500 rounded-lg shadow relative",
                        isCurrentlySelected ? "border-2 border-blue-600 bg-blue-50" : 
                        isAlreadySelected ? "border-2 border-green-500 bg-green-50" : "border-gray-200"
                      )}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-bold">
                            {getCityLabel(outboundFirstSegment.departure.iataCode)} → {getCityLabel(outboundLastSegment.arrival.iataCode)}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                            isRoundTrip 
                              ? "bg-blue-100 text-blue-700" 
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {isRoundTrip ? "왕복" : "편도"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-bold text-blue-600">{priceFormatted}원</div>
                          {isAlreadySelected && (
                            <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                              선택됨
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 가는 편 */}
                      <div className="border-b pb-2 mb-2">
                        <div className="text-sm font-medium text-gray-500 mb-1">가는 편</div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {new Date(outboundFirstSegment.departure.at).toLocaleTimeString("ko-KR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium">
                                {new Date(outboundLastSegment.arrival.at).toLocaleTimeString("ko-KR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {outboundCarrierName} | {outboundStopsText} | 총 소요시간: {outboundDuration}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 오는 편 */}
                      {inboundInfo && (
                        <div className="border-b pb-2 mb-2">
                          <div className="text-sm font-medium text-gray-500 mb-1">오는 편</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{inboundInfo.departureTime}</span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium">{inboundInfo.arrivalTime}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                {inboundInfo.carrierName} | {inboundInfo.stopsText} | 총 소요시간: {inboundInfo.duration}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Plane className="h-16 w-16 text-gray-300" />
                <p className="mt-4">아직 항공편 검색 결과가 없습니다.</p>
                <p className="mt-2 text-sm">왼쪽에서 검색 조건을 입력하고 검색 버튼을 클릭하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightDialog; 