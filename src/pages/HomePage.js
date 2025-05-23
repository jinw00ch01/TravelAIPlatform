import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "../lib/utils";
import { CalendarIcon, Minus, Plus, Loader2, X } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TravelInfoSection from "./HomePage/TravelInfoSection";
import FlightDialog from "./HomePage/FlightDialog";
import amadeusApi from "../utils/amadeusApi";
import ToursAndActivity from "./HomePage/ToursAndActivity";
import AccomodationDialog from "./HomePage/AccomodationDialog";
import websocketService from "../services/websocketService";
import { useAuth } from "../components/auth/AuthContext";

export const HomePage = () => {
  const navigate = useNavigate();
  const { getJwtToken } = useAuth();
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(""); // WebSocket 상태 메시지용
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [infantCount, setInfantCount] = useState(0);
  const [showPeopleSelector, setShowPeopleSelector] = useState(false);
  
  // -------------------- 다이얼로그/선택 상태 --------------------
  const [isFlightDialogOpen, setIsFlightDialogOpen] = useState(false);
  const [isAccommodationDialogOpen, setIsAccommodationDialogOpen] = useState(false);
  
  // 선택한 항공편 정보 저장
  const [selectedFlight, setSelectedFlight] = useState(null);
  // 선택한 숙소(호텔+객실) 정보 저장
  const [selectedAccommodation, setSelectedAccommodation] = useState(null);
  // 선택한 항공편의 dictionaries(항공사 등)와 공항 정보 캐시
  const [selectedFlightDictionaries, setSelectedFlightDictionaries] = useState({});
  const [airportInfoCache, setAirportInfoCache] = useState({});

  // 항공편 정보와 공항 정보를 합쳐서 확장된 항공편 정보를 만드는 함수
  const enrichFlightWithAirportInfo = useCallback((flight) => {
    if (!flight || !flight.itineraries || Object.keys(airportInfoCache).length === 0) {
      return flight;
    }

    // 원본 객체를 변경하지 않기 위해 깊은 복사
    const enrichedFlight = JSON.parse(JSON.stringify(flight));
    
    // 각 여정(가는편, 오는편)에 대해 공항 정보 추가
    enrichedFlight.itineraries.forEach((itinerary, itineraryIndex) => {
      // 각 구간(세그먼트)마다 출발/도착 공항 정보 추가
      itinerary.segments.forEach((segment, segmentIndex) => {
        // 출발 공항 정보 추가
        if (segment.departure?.iataCode && airportInfoCache[segment.departure.iataCode]) {
          const airportInfo = airportInfoCache[segment.departure.iataCode];
          
          // enrichedFlight에 위치 정보 추가
          enrichedFlight.itineraries[itineraryIndex].segments[segmentIndex].departure.airportInfo = {
            name: airportInfo.name,
            koreanName: airportInfo.koreanName || airportInfo.name,
            city: airportInfo.city || airportInfo.address?.cityName,
            country: airportInfo.country || airportInfo.address?.countryName,
          };
          
          // 위경도 정보가 있는 경우 추가
          if (airportInfo.geoCode?.latitude && airportInfo.geoCode?.longitude) {
            enrichedFlight.itineraries[itineraryIndex].segments[segmentIndex].departure.geoCode = {
              latitude: airportInfo.geoCode.latitude,
              longitude: airportInfo.geoCode.longitude
            };
          }
        }
        
        // 도착 공항 정보 추가
        if (segment.arrival?.iataCode && airportInfoCache[segment.arrival.iataCode]) {
          const airportInfo = airportInfoCache[segment.arrival.iataCode];
          
          // enrichedFlight에 위치 정보 추가
          enrichedFlight.itineraries[itineraryIndex].segments[segmentIndex].arrival.airportInfo = {
            name: airportInfo.name,
            koreanName: airportInfo.koreanName || airportInfo.name,
            city: airportInfo.city || airportInfo.address?.cityName,
            country: airportInfo.country || airportInfo.address?.countryName,
          };
          
          // 위경도 정보가 있는 경우 추가
          if (airportInfo.geoCode?.latitude && airportInfo.geoCode?.longitude) {
            enrichedFlight.itineraries[itineraryIndex].segments[segmentIndex].arrival.geoCode = {
              latitude: airportInfo.geoCode.latitude,
              longitude: airportInfo.geoCode.longitude
            };
          }
        }
      });
    });
    
    return enrichedFlight;
  }, [airportInfoCache]);

  // 항공편 선택 함수 업데이트
  const selectFlight = useCallback((flight, dictionaries, newAirportInfoCache) => {
    if (!flight) return;
    
    // 새로운 공항 정보가 있으면 캐시에 추가
    if (newAirportInfoCache && Object.keys(newAirportInfoCache).length > 0) {
      setAirportInfoCache(prev => ({...prev, ...newAirportInfoCache}));
    }
    
    // 항공편 정보에 공항 정보 추가
    const enrichedFlight = enrichFlightWithAirportInfo(flight);
    
    console.log('[HomePage] Selected flight with airport info:', enrichedFlight);
    setSelectedFlight(enrichedFlight);
    setSelectedFlightDictionaries(dictionaries || {});
    setIsFlightDialogOpen(false);
  }, [enrichFlightWithAirportInfo]);

  // 컴포넌트 언마운트 시 WebSocket 연결 정리
  useEffect(() => {
    return () => {
      // 컴포넌트가 언마운트될 때 WebSocket 연결 해제
      websocketService.disconnect();
    };
  }, []);

  // 선택한 항공편의 공항 세부정보(한글 공항/도시명 등) 동기화
  useEffect(() => {
    if (!selectedFlight) return;

    // 출발/도착 IATA 코드 모으기
    const codesSet = new Set();
    selectedFlight.itineraries.forEach((itinerary) => {
      itinerary.segments.forEach((seg) => {
        if (seg.departure?.iataCode) codesSet.add(seg.departure.iataCode);
        if (seg.arrival?.iataCode) codesSet.add(seg.arrival.iataCode);
      });
    });

    const codesToFetch = Array.from(codesSet).filter(
      (code) => code && !airportInfoCache[code]
    );

    if (codesToFetch.length === 0) return;

    const fetchPromises = codesToFetch.map((iataCode) =>
      amadeusApi
        .getAirportDetails(iataCode)
        .then((info) => ({ [iataCode]: info || { warning: "Failed" } }))
        .catch(() => ({ [iataCode]: { warning: "Failed" } }))
    );

    Promise.all(fetchPromises).then((results) => {
      const newEntries = results.reduce((acc, cur) => ({ ...acc, ...cur }), {});
      setAirportInfoCache((prev) => ({ ...prev, ...newEntries }));
    });
  }, [selectedFlight, airportInfoCache]);

  // 공항 정보가 업데이트 되면 선택된 항공편 정보도 업데이트 (무한 루프 방지)
  useEffect(() => {
    if (!selectedFlight) return;
    if (Object.keys(airportInfoCache).length === 0) return;

    const enriched = enrichFlightWithAirportInfo(selectedFlight);
    // 변경 사항이 있을 때만 업데이트(문자열 비교 단순 사용)
    if (JSON.stringify(enriched) !== JSON.stringify(selectedFlight)) {
      setSelectedFlight(enriched);
    }
  }, [airportInfoCache]);

  const processTextFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const processImageFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const sendToGemini = async (content, type) => {
    try {
      // TODO: Gemini API 엔드포인트로 실제 요청을 보내는 로직 구현
      const response = await fetch('YOUR_GEMINI_API_ENDPOINT', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          type, // 'text' or 'image'
        }),
      });

      if (!response.ok) {
        throw new Error('Gemini API request failed');
      }

      const result = await response.json();
      console.log('Gemini API response:', result);
      return result;
    } catch (error) {
      console.error('Error sending to Gemini:', error);
      throw error;
    }
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      for (const file of files) {
        const fileType = file.type;
        let content;

        if (fileType.startsWith('text/')) {
          // 텍스트 파일 처리
          content = await processTextFile(file);
          await sendToGemini(content, 'text');
        } else if (fileType.startsWith('image/')) {
          // 이미지 파일 처리
          content = await processImageFile(file);
          await sendToGemini(content, 'image');
        } else {
          console.warn('Unsupported file type:', fileType);
        }
      }
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) {
      console.warn('Search text is empty');
      return;
    }

    setIsProcessing(true); // 로딩 시작
    setProcessingStatus("연결을 준비 중입니다...");
    let planSuccessfullyCreated = false; // 성공 플래그
    let generatedPlanId = null;

    try {
      // WebSocket 상태 업데이트 핸들러 등록
      websocketService.onMessage('request_received', (data) => {
        console.log('[HomePage] request_received 메시지:', data);
        setProcessingStatus(data.message || "요청이 접수되었습니다...");
      });

      websocketService.onMessage('status_update', (data) => {
        console.log('[HomePage] status_update 메시지:', data);
        setProcessingStatus(data.message || "처리 중...");
      });

      // AuthContext에서 JWT 토큰 가져오기
      let authToken = null;
      try {
        const tokenResult = await getJwtToken();
        
        // getJwtToken()은 { success: boolean, token: string } 형태로 반환됨
        if (tokenResult && tokenResult.success && typeof tokenResult.token === 'string' && tokenResult.token.trim()) {
          authToken = tokenResult.token;
          console.log('[HomePage] JWT 토큰 가져오기 성공, 타입:', typeof tokenResult.token);
        } else {
          console.warn('[HomePage] JWT 토큰이 유효하지 않음. 결과:', tokenResult);
          authToken = 'test-token';
        }
      } catch (tokenError) {
        console.warn('[HomePage] JWT 토큰 가져오기 실패:', tokenError);
        // 개발 환경에서는 test-token 사용
        authToken = 'test-token';
      }

      const planDetails = {
        query: searchText,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd', { locale: ko }) : null,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd', { locale: ko }) : null,
        adults: adultCount,
        children: childCount,
      };
      
      if (selectedFlight) {
        planDetails.flightInfo = selectedFlight;
      }
      if (selectedAccommodation) {
        planDetails.accommodationInfo = selectedAccommodation;
      }

      console.log('[HomePage] 전송할 계획 세부사항:', planDetails);

      // WebSocket을 통한 여행 계획 생성 요청 (토큰 전달)
      const result = await websocketService.createTravelPlan(planDetails, authToken);

      console.log('[HomePage] WebSocket 응답 수신:', result);

      if (result && result.planId) {
        console.log('[HomePage] WebSocket AI 여행 계획 생성 성공 (ID 수신):', result.planId);
        planSuccessfullyCreated = true;
        generatedPlanId = result.planId;
        setProcessingStatus("여행 계획 생성이 완료되었습니다!");
      } else {
         console.warn('[HomePage] 생성 응답에 planId가 없거나 유효하지 않음:', result);
         setProcessingStatus("오류: 계획 ID를 받지 못했습니다.");
      }

    } catch (error) {
      console.error('[HomePage] WebSocket AI 여행 계획 생성 오류:', error);
      setProcessingStatus(`오류 발생: ${error.message}`);
    } finally {
      setIsProcessing(false); // 로딩 종료
      
      // 핸들러 정리
      websocketService.removeMessageHandler('request_received');
      websocketService.removeMessageHandler('status_update');
      
      if (planSuccessfullyCreated && generatedPlanId) {
        console.log('[HomePage] 페이지 이동 준비 중. generatedPlanId:', generatedPlanId, '타입:', typeof generatedPlanId);
        // 약간의 지연 후 페이지 이동 (사용자가 성공 메시지를 볼 수 있도록)
        setTimeout(() => {
          const targetUrl = `/planner/${generatedPlanId}`;
          console.log('[HomePage] 페이지 이동 실행:', targetUrl);
          navigate(targetUrl, { 
            state: { 
              flightData: selectedFlight, 
              isNewPlan: true,
              planId: generatedPlanId
            } 
          });
        }, 1500);
      } else {
        console.log('[HomePage] 여행 계획 생성 요청이 완료되었으나, 성공적으로 ID를 받지 못했거나 오류가 발생했습니다.');
        console.log('[HomePage] planSuccessfullyCreated:', planSuccessfullyCreated, 'generatedPlanId:', generatedPlanId);
        // 에러 메시지를 3초 후 제거
        setTimeout(() => {
          setProcessingStatus("");
        }, 3000);
      }
    }
  };

  const handleAdultCountChange = (increment) => {
    setAdultCount(prev => Math.max(1, prev + increment));
  };

  const handleChildCountChange = (increment) => {
    setChildCount(prev => Math.max(0, prev + increment));
  };

  const handleInfantCountChange = (increment) => {
    setInfantCount(prev => Math.max(0, prev + increment));
  };

  // 숙소 선택 핸들러
  const selectAccommodation = useCallback((accom) => {
    if (!accom) return;
    console.log('[HomePage] Selected accommodation:', accom);
    setSelectedAccommodation(accom);
    setIsAccommodationDialogOpen(false);
  }, []);

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
      <CalendarIcon className="mr-2 h-4 w-4" />
      {value || placeholder}
    </Button>
  ));

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[1920px] min-h-screen">
        <div className="relative h-[900px]">
          {/* Hero background section */}
          <div 
            className="absolute w-full h-[820px] top-0 left-0 bg-gradient-to-b from-sky-300 via-sky-200 to-white"
            style={{
              position: 'relative'
            }}
          >
            {/* 왼쪽 AI 생성 이미지 */}
            <div className="absolute right-[0%] top-[5px] w-[750px] h-[815px] rounded-lg overflow-hidden">
              <img src="/images/travel_right.gif" alt="여행 명소" className="w-full h-full object-cover" />
            </div>
            
            {/* 오른쪽 AI 생성 이미지 */}
            <div className="absolute left-[0%] top-[5px] w-[575px] h-[810px] rounded-lg overflow-hidden">
              <img src="/images/travel_left.gif" alt="여행 명소" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Main heading - 위로 올림 */}
          <h1 className="w-full max-w-[530px] top-[120px] left-1/2 -translate-x-1/2 text-white text-[50px] leading-[50px] absolute font-jua text-center">
            여행계획을 도와드릴까요?
          </h1>

          {/* Stack View Container - 모든 입력 요소를 포함하는 컨테이너 */}
          <div className="absolute w-full max-w-[750px] top-[200px] left-1/2 -translate-x-1/2 bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-700">
            {/* 상단 바 추가 */}
            <div className="flex justify-end mb-4">
              <div 
                className="text-white text-base font-medium cursor-pointer hover:underline flex items-center"
                onClick={() => navigate("/planner/none")}
              >
                <span>AI의 도움없이 일정 만들기</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="ml-1"
                >
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </div>
            </div>

            {/* Search section */}
            <div className="mb-6">
              <div className="relative h-[88px]">
                <Card className="w-full border-gray-200 bg-white">
                  <CardContent className="p-0">
                    <div className="flex items-center">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".txt,.jpg,.jpeg,.png"
                        multiple
                        onChange={handleFileUpload}
                        disabled={isProcessing}
                      />
                      <Button
                        className="absolute w-[25px] h-[25px] top-[30px] left-[8px] bg-gray-50 rounded-full border border-primary/90 flex items-center justify-center z-10 p-0 min-w-0 hover:bg-gray-100"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM11.25 8.25H8.25V11.25H6.75V8.25H3.75V6.75H6.75V3.75H8.25V6.75H11.25V8.25Z"
                            fill="currentColor"
                            className="text-primary"
                          />
                        </svg>
                      </Button>
                      <Input
                        className="min-h-[60px] pl-10 text-gray-400 text-base tracking-normal leading-normal border-none bg-white placeholder:text-gray-400"
                        placeholder="+버튼을 눌러 이미지나 텍스트파일을 추가할 수 있습니다."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        disabled={isProcessing}
                      />
                      <Button
                        className="absolute right-0 w-[25px] h-[25px] top-[30px] right-[10px] bg-primary/90 rounded-full p-0 min-w-0 flex items-center justify-center hover:bg-primary-dark/90"
                        size="icon"
                        onClick={handleSearch}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                          <img
                            className="w-[9px] h-2.5"
                            alt="SearchIcon arrow"
                            src="https://c.animaapp.com/m8mvwkhbmqwOZ5/img/polygon-1.svg"
                          />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 상태 메시지 표시 영역 */}
              {(isProcessing || processingStatus) && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                    <span className="text-blue-700 text-sm font-medium">
                      {processingStatus || "처리 중입니다..."}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Date selection section */}
            <div className="mb-6">
              <div className="flex flex-wrap justify-between items-center bg-white/90 rounded-lg p-3 mb-4">
                <div className="flex flex-wrap gap-2 mb-2 sm:mb-0">
                  <DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    dateFormat="yyyy/MM/dd"
                    locale={ko}
                    placeholderText="출국일"
                    customInput={<CustomInput />}
                    className="w-full"
                  />
                  <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate}
                    dateFormat="yyyy/MM/dd"
                    locale={ko}
                    placeholderText="귀국일"
                    customInput={<CustomInput />}
                    className="w-full"
                  />
                </div>
                
                {/* People selector button */}
                <div className="relative mb-2 sm:mb-0">
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto justify-center font-normal bg-white h-[40px] px-4"
                    onClick={() => setShowPeopleSelector(!showPeopleSelector)}
                  >
                    성인 {adultCount}명{childCount > 0 ? `, 어린이 ${childCount}명` : ''}{infantCount > 0 ? `, 유아 ${infantCount}명` : ''}
                  </Button>
                  {showPeopleSelector && (
                    <Card className="absolute top-full right-0 mt-1 w-[250px] z-20 shadow-lg border bg-white">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <span>성인</span>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleAdultCountChange(-1)}><Minus className="h-4 w-4" /></Button>
                            <span>{adultCount}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleAdultCountChange(1)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>어린이</span>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleChildCountChange(-1)}><Minus className="h-4 w-4" /></Button>
                            <span>{childCount}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleChildCountChange(1)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>유아</span>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleInfantCountChange(-1)}><Minus className="h-4 w-4" /></Button>
                            <span>{infantCount}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleInfantCountChange(1)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
              
              {/* 항공편/숙박 검색 버튼 및 선택 요약 */}
              <div className="flex flex-wrap items-start gap-4 mt-2">
                {/* 검색 버튼들 */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="bg-blue-500 hover:bg-blue-600 text-white" 
                    onClick={() => setIsFlightDialogOpen(true)}
                  >
                    항공편 검색
                  </Button>
                  <Button 
                    variant="outline" 
                    className="bg-green-500 hover:bg-green-600 text-white" 
                    onClick={() => setIsAccommodationDialogOpen(true)}
                  >
                    숙박 검색
                  </Button>
                </div>

                {/* 선택된 항공편/숙박 요약 카드 */}
                <div className="flex flex-wrap gap-4 w-full">
                  {selectedFlight && (
                    <Card className="relative p-4 shadow bg-white flex-1 min-w-[260px]">
                      {/* 기존 항공편 요약 내용 유지 */}
                      {(() => {
                        const formatDuration = (durationStr) => {
                          if (!durationStr) return "-";
                          return durationStr.replace("PT", "").replace("H", "시간 ").replace("M", "분").trim();
                        };

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

                        const isRoundTrip = selectedFlight.itineraries.length > 1;
                        const outbound = selectedFlight.itineraries[0];
                        const outFirst = outbound.segments[0];
                        const outLast = outbound.segments[outbound.segments.length - 1];
                        const outCarrierName =
                          selectedFlightDictionaries?.carriers?.[outFirst.carrierCode] ||
                          outFirst.carrierCode;
                        const outStops = outbound.segments.length - 1;
                        const outStopsText = outStops === 0 ? "직항" : `${outStops}회 경유`;
                        const outDuration = formatDuration(outbound.duration);

                        let inboundSection = null;
                        if (isRoundTrip) {
                          const inbound = selectedFlight.itineraries[1];
                          const inFirst = inbound.segments[0];
                          const inLast = inbound.segments[inbound.segments.length - 1];
                          const inCarrierName =
                            selectedFlightDictionaries?.carriers?.[inFirst.carrierCode] ||
                            inFirst.carrierCode;
                          const inStops = inbound.segments.length - 1;
                          const inStopsText = inStops === 0 ? "직항" : `${inStops}회 경유`;
                          const inDuration = formatDuration(inbound.duration);

                          inboundSection = (
                            <div className="mt-3 text-sm">
                              <div className="font-medium text-gray-600 mb-0.5">오는 편</div>
                              <div className="text-sm mb-0.5">
                                {new Date(inFirst.departure.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                <span className="text-gray-400 mx-1">→</span>
                                {new Date(inLast.arrival.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: true })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {inCarrierName} | {inStopsText} | 총 소요시간: {inDuration}
                              </div>
                            </div>
                          );
                        }

                        const price = parseInt(selectedFlight.price.grandTotal || selectedFlight.price.total).toLocaleString();

                        return (
                          <>
                            <div className="flex justify-between items-center mb-3">
                              <div className="text-sm font-semibold">
                                {isRoundTrip ? "왕복" : "편도"}: {getCityLabel(outFirst.departure.iataCode)} → {getCityLabel(outLast.arrival.iataCode)}
                              </div>
                              <div className="text-sm font-bold text-blue-600">{price}원</div>
                            </div>
                            <div className="text-sm">
                              <div className="font-medium text-gray-600 mb-0.5">가는 편</div>
                              <div className="text-sm mb-0.5">
                                {new Date(outFirst.departure.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                <span className="text-gray-400 mx-1">→</span>
                                {new Date(outLast.arrival.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: true })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {outCarrierName} | {outStopsText} | 총 소요시간: {outDuration}
                              </div>
                            </div>
                            {inboundSection}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={() => {
                                setSelectedFlight(null);
                                setSelectedFlightDictionaries({});
                              }}
                            >
                              <X className="h-4 w-4 text-gray-500" />
                            </Button>
                          </>
                        );
                      })()}
                    </Card>
                  )}

                  {selectedAccommodation && (
                    <Card className="relative p-4 shadow bg-white flex-1 min-w-[260px]">
                      {(() => {
                        const { hotel, room } = selectedAccommodation;
                        return (
                          <>
                            <div className="flex justify-between items-center mb-3">
                              <div className="text-sm font-semibold">숙소: {hotel.hotel_name_trans || hotel.hotel_name}</div>
                              {room.price && (
                                <div className="text-sm font-bold text-green-600">{room.price.toLocaleString()} {room.currency}</div>
                              )}
                            </div>
                            <div className="text-sm text-gray-700">{room.name}</div>
                            {(() => {
                              const dIn = selectedAccommodation.checkIn ? format(new Date(selectedAccommodation.checkIn), 'yyyy/MM/dd') : '';
                              const dOut = selectedAccommodation.checkOut ? format(new Date(selectedAccommodation.checkOut), 'yyyy/MM/dd') : '';
                              return (
                                <>
                                  <div className="text-xs text-gray-500">체크인 {dIn} {selectedAccommodation.hotel.checkin_from}{selectedAccommodation.hotel.checkin_until !== '정보 없음' ? ` ~ ${selectedAccommodation.hotel.checkin_until}` : ''}</div>
                                  <div className="text-xs text-gray-500 mb-1">체크아웃 {dOut} {selectedAccommodation.hotel.checkout_from !== '정보 없음' ? `${selectedAccommodation.hotel.checkout_from} ~ ` : ''}{selectedAccommodation.hotel.checkout_until}</div>
                                </>
                              );
                            })()}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={() => setSelectedAccommodation(null)}
                            >
                              <X className="h-4 w-4 text-gray-500" />
                            </Button>
                          </>
                        );
                      })()}
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 여행 정보 탭 섹션 */}
        <TravelInfoSection />

        {/* 수평선 */}
        <hr className="my-12 border-gray-200" />

        {/* 투어/액티비티 추천 섹션 */}
        <ToursAndActivity />

        {/* 항공편 검색 다이얼로그 */}
        <FlightDialog
          isOpen={isFlightDialogOpen}
          onClose={() => setIsFlightDialogOpen(false)}
          onSelectFlight={selectFlight}
          initialAdultCount={adultCount}
          initialChildCount={childCount}
          initialInfantCount={infantCount}
          defaultStartDate={startDate}
          defaultEndDate={endDate}
        />

        {/* 숙박 검색 다이얼로그 */}
        <AccomodationDialog
          isOpen={isAccommodationDialogOpen}
          onClose={() => setIsAccommodationDialogOpen(false)}
          onSelectAccommodation={selectAccommodation}
          defaultCheckIn={startDate}
          defaultCheckOut={endDate}
          initialAdults={adultCount}
          initialChildren={childCount}
          selectedAccommodation={selectedAccommodation}
        />
      </div>
    </div>
  );
};

export default HomePage;
