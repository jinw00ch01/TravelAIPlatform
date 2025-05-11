import React, { useRef, useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "../lib/utils";
import { CalendarIcon, Minus, Plus, Plane, Hotel, MapPin, Loader2, X } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { travelApi } from "../services/api";
import amadeusApi from "../utils/amadeusApi";
import FlightPlan from "../components/FlightPlan"; // FlightPlan 컴포넌트 import

// Material UI 테마 프로바이더 추가
import { ThemeProvider, createTheme, StyledEngineProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// MUI 다크/라이트 테마 설정
const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3b82f6', // tailwind blue-500과 유사한 색상
    },
  },
  // MUI 스타일에 tailwind 스타일보다 낮은 우선순위 부여
  components: {
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          width: '100%',
        },
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          width: '100%',
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        }
      }
    }
  }
});

export const PlanTravel = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [showPeopleSelector, setShowPeopleSelector] = useState(false);
  
  // 비행 계획 관련 팝업 상태
  const [isFlightDialogOpen, setIsFlightDialogOpen] = useState(false);
  
  // 비행 계획 관련 상태
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingFlights, setIsLoadingFlights] = useState(false);
  const [flightResults, setFlightResults] = useState([]);
  const [flightError, setFlightError] = useState(null);
  const [infantCount, setInfantCount] = useState(0);
  const [travelClass, setTravelClass] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [nonStop, setNonStop] = useState(false);
  
  // API 데이터 관련 상태 추가
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [popularDestinations, setPopularDestinations] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [activeTab, setActiveTab] = useState('destinations'); // 'destinations', 'airlines', 'hotels'

  // FlightPlan 컴포넌트에 전달할 검색 파라미터
  const [flightSearchParams, setFlightSearchParams] = useState({
    originSearch: "",
    destinationSearch: "",
    selectedOrigin: null,
    selectedDestination: null,
    departureDate: null,
    returnDate: null,
    adults: 1,
    children: 0,
    infants: 0,
    travelClass: "",
    currencyCode: "KRW",
    maxPrice: "",
    nonStop: false
  });

  // FlightPlan에서 사용할 상태들
  const [airportInfoCache, setAirportInfoCache] = useState({});
  const [dictionaries, setDictionaries] = useState({});
  const [loadingAirportInfo, setLoadingAirportInfo] = useState(false);

  // 선택한 항공편 정보 저장
  const [selectedFlight, setSelectedFlight] = useState(null);

  // 다이얼로그가 열릴 때 초기값 설정
  useEffect(() => {
    if (isFlightDialogOpen) {
      // 출발지/도착지는 이미 선택되어 있으면 초기화하지 않음
      if (!selectedOrigin) {
        setOriginSearch("");
        setOriginCities([]);
      }
      
      if (!selectedDestination) {
        setDestinationSearch("");
        setDestinationCities([]);
      }
      
      // 검색 결과는 유지, 오류 메시지만 초기화
      setFlightError(null);
      
      // 기본값 설정 (현재 날짜 및 인원수는 유지)
      if (!travelClass) {
        setTravelClass("");
      }
      
      if (!maxPrice) {
        setMaxPrice("");
      }
      
      // 기존 날짜 초기화 코드는 유지
      if (!startDate) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30); // 30일 후
        setStartDate(futureDate);
      }
      
      if (!endDate && startDate) {
        const returnDate = new Date(startDate);
        returnDate.setDate(returnDate.getDate() + 7); // 가는 날로부터 7일 후
        setEndDate(returnDate);
      }
    }
  }, [isFlightDialogOpen, startDate, endDate, selectedOrigin, selectedDestination, travelClass, maxPrice]);

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
      alert('여행 관련 정보를 입력해주세요. (예: 3박 4일 도쿄 여행)');
      return;
    }

    setIsProcessing(true); // 로딩 시작
    try {
      // Lambda 함수에 전달할 정보 구성 (children 제외)
      const planDetails = {
        query: searchText,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd', { locale: ko }) : null,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd', { locale: ko }) : null,
        adults: adultCount,
      };
      
      // 선택한 항공편 정보가 있으면 추가
      if (selectedFlight) {
        // 첫 번째 세그먼트 정보 가져오기
        const firstItinerary = selectedFlight.itineraries[0];
        const firstSegment = firstItinerary.segments[0];
        const lastSegment = firstItinerary.segments[firstItinerary.segments.length - 1];
        
        // 항공편 정보 추가
        planDetails.flightInfo = {
          id: selectedFlight.id,
          originCode: firstSegment.departure.iataCode,
          destinationCode: lastSegment.arrival.iataCode,
          departureDate: firstSegment.departure.at,
          arrivalDate: lastSegment.arrival.at,
          carrierCode: firstSegment.carrierCode,
          price: selectedFlight.price.grandTotal,
          currency: selectedFlight.price.currency,
          duration: firstItinerary.duration,
          stops: firstItinerary.segments.length - 1
        };
        
        console.log('[PlanTravel] 선택한 항공편 정보를 포함하여 AI 여행 계획 생성 요청:', planDetails);
      } else {
        console.log('[PlanTravel] AI 여행 계획 생성 요청 (항공편 미선택):', planDetails);
      }

      // travelApi.createTravelPlan 호출
      // 주의: api.js의 createTravelPlan 함수가 올바른 Python Lambda 엔드포인트를 호출하는지 확인 필요
      const result = await travelApi.createTravelPlan(planDetails);

      console.log('[PlanTravel] AI 여행 계획 생성 성공:', result);

      // 성공 시 플래너 페이지로 이동 (생성된 데이터 전달)
      if (result && result.plan) {
         navigate('/planner', { state: { planData: result.plan, flightData: selectedFlight } });
      } else {
         console.warn('[PlanTravel] 생성 응답에 plan 데이터가 없거나 유효하지 않음:', result);
         alert('AI 여행 계획 생성 응답 형식이 올바르지 않습니다. 수동 플래너로 이동합니다.');
         navigate('/planner', { state: { flightData: selectedFlight } }); 
      }

    } catch (error) {
      console.error('[PlanTravel] AI 여행 계획 생성 오류:', error);
      alert('AI 여행 계획 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsProcessing(false); // 로딩 종료
    }
  };

  const handleAdultCountChange = (increment) => {
    setAdultCount(prev => Math.max(1, prev + increment));
  };

  const handleChildCountChange = (increment) => {
    setChildCount(prev => Math.max(0, prev + increment));
  };

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

  // API 데이터 로딩 함수 (나중에 실제 API 호출로 대체)
  const loadApiData = async () => {
    setIsLoadingData(true);
    try {
      // 여기에 실제 API 호출 코드가 들어갈 예정
      // 임시 데이터로 UI 미리 구현
      setTimeout(() => {
        setPopularDestinations([
          
          { id: 1, name: '도쿄', image: 'https://images.unsplash.com/photo-1498036882173-b41c28a8ba34?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '일본의 수도' },
          { id: 2, name: '파리', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '프랑스의 수도' },
          { id: 3, name: '뉴욕', image: 'https://images.unsplash.com/photo-1538970272646-f61fabb3a8a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '미국의 대도시' },
          { id: 4, name: '로마', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '이탈리아의 수도' },
          { id: 5, name: '시드니', image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '호주의 대도시' },
        ]);
        
        setAirlines([
          { id: 1, name: '대한항공', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Korean_Air_logo.svg/200px-Korean_Air_logo.svg.png', rating: 4.5 },
          { id: 2, name: '아시아나항공', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Asiana_Airlines_logo.svg/200px-Asiana_Airlines_logo.svg.png', rating: 4.3 },
          { id: 3, name: '제주항공', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Jeju_Air_logo.svg/200px-Jeju_Air_logo.svg.png', rating: 4.0 },
          { id: 4, name: '진에어', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Jin_Air_logo.svg/200px-Jin_Air_logo.svg.png', rating: 3.8 },
          { id: 5, name: '에어서울', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Air_Seoul_logo.svg/200px-Air_Seoul_logo.svg.png', rating: 3.7 },
        ]);
        
        setHotels([
          { id: 1, name: '그랜드 호텔', location: '서울', rating: 4.7, price: '150,000원/박', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
          { id: 2, name: '시티 호텔', location: '부산', rating: 4.5, price: '120,000원/박', image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
          { id: 3, name: '리버사이드 호텔', location: '강릉', rating: 4.3, price: '180,000원/박', image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
          { id: 4, name: '마운틴 뷰 호텔', location: '제주', rating: 4.6, price: '200,000원/박', image: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
          { id: 5, name: '오션 호텔', location: '여수', rating: 4.2, price: '130,000원/박', image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
        ]);
        
        setIsLoadingData(false);
      }, 1500); // 1.5초 후 데이터 로드 (실제 API 호출 시 제거)
    } catch (error) {
      console.error('Error loading API data:', error);
      setIsLoadingData(false);
    }
  };

  // 도시 검색 함수 (FlightPlan 컴포넌트에서 사용)
  const handleCitySearch = async (value, type) => {
    if (!value || value.length < 2) {
      if (type === 'origin') setOriginCities([]);
      else setDestinationCities([]);
      return;
    }

    setIsLoadingCities(true);
    setFlightError(null);
    try {
      console.log(`도시 검색 시작: ${value}, 타입: ${type}`);
      
      // API 호출
      try {
        const response = await amadeusApi.searchCities(value);
        if (response && response.data && Array.isArray(response.data)) {
          const apiOptions = response.data.map(location => ({
            name: location.name,
            iataCode: location.iataCode,
            address: location.address?.cityName || '',
            id: location.id || `${location.iataCode}-${location.name}`
          }));
          
          // API 결과만 사용
          if (type === 'origin') setOriginCities(apiOptions);
          else setDestinationCities(apiOptions);
        } else {
          // API 응답이 없거나 형식이 맞지 않으면 빈 배열 반환
          if (type === 'origin') setOriginCities([]);
          else setDestinationCities([]);
        }
      } catch (err) {
        console.error("API 도시 검색 오류:", err);
        // API 오류 시 빈 배열 반환
        if (type === 'origin') setOriginCities([]);
        else setDestinationCities([]);
      }
    } catch (err) {
      console.error("도시 검색 중 오류 발생:", err);
      setFlightError(err.message || '도시 검색 중 오류 발생');
    } finally {
      setIsLoadingCities(false);
    }
  };

  // 항공권 검색 함수 (FlightPlan 컴포넌트에서 사용)
  const handleFlightSearch = async () => {
    setFlightError(null);
    setFlightResults([]);

    // 필수 값 검증
    if (!flightSearchParams.selectedOrigin) {
      setFlightError('출발지를 선택해주세요.');
      return;
    }
    if (!flightSearchParams.selectedDestination) {
      setFlightError('도착지를 선택해주세요.');
      return;
    }
    if (!flightSearchParams.departureDate) {
      setFlightError('가는 날짜를 선택해주세요.');
      return;
    }

    setIsLoadingFlights(true);
    try {
      console.log("항공편 검색 시작:", flightSearchParams);
      
      // 항공권 검색 요청 객체
      const paramsToApi = {
        originCode: flightSearchParams.selectedOrigin.iataCode,
        destinationCode: flightSearchParams.selectedDestination.iataCode,
        departureDate: format(flightSearchParams.departureDate, 'yyyy-MM-dd'),
        returnDate: flightSearchParams.returnDate ? format(flightSearchParams.returnDate, 'yyyy-MM-dd') : null,
        adults: flightSearchParams.adults,
        children: flightSearchParams.children,
        infants: flightSearchParams.infants || 0,
        travelClass: flightSearchParams.travelClass || null,
        currencyCode: flightSearchParams.currencyCode || 'KRW',
        maxPrice: flightSearchParams.maxPrice || null,
        nonStop: flightSearchParams.nonStop || false,
        max: 20, // 검색 결과 수
      };

      console.log("API 요청 파라미터:", paramsToApi);

      // 항공편 검색 API 호출
      amadeusApi.searchFlights(paramsToApi)
        .then(response => {
          if (response && response.data && Array.isArray(response.data)) {
            console.log("API 응답 성공:", response);
            setFlightResults(response.data);
            setDictionaries(response.dictionaries || {});
            
            // 결과가 없으면 가짜 데이터 표시
            if (response.data.length === 0) {
              console.log("검색 결과가 없어 가짜 데이터 사용");
              // 가짜 항공편 데이터
              const mockData = generateMockFlightData(paramsToApi);
              setFlightResults(mockData.flights);
              setDictionaries(mockData.dictionaries);
            }
          } else {
            console.log("API 응답 형식 오류:", response);
            // API 호출은 성공했지만 결과가 없거나 형식이 잘못된 경우 가짜 데이터 사용
            const mockData = generateMockFlightData(paramsToApi);
            setFlightResults(mockData.flights);
            setDictionaries(mockData.dictionaries);
          }
        })
        .catch(err => {
          console.error("항공편 검색 오류:", err);
          setFlightError(err.message || '항공편 검색 중 오류가 발생했습니다.');
          
          // API 호출 실패 시 가짜 데이터 사용
          console.log("API 호출 실패로 가짜 데이터 사용");
          const mockData = generateMockFlightData(paramsToApi);
          setFlightResults(mockData.flights);
          setDictionaries(mockData.dictionaries);
        })
        .finally(() => {
          setIsLoadingFlights(false);
        });
    } catch (err) {
      console.error("항공편 검색 중 오류 발생:", err);
      setFlightError(err.message || '항공편 검색 중 오류가 발생했습니다.');
      setFlightResults([]);
    }
  };

  // 선택한 항공편을 일정에 추가하는 함수
  const handleAddFlightToSchedule = (flight, dictionaries, airportInfo) => {
    navigate('/planner', { 
      state: { 
        flightData: flight,
        dictionaries,
        airportInfo
      } 
    });
    setIsFlightDialogOpen(false);
  };

  // 컴포넌트 마운트 시 데이터 로드
  React.useEffect(() => {
    loadApiData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[1920px] min-h-screen">
        <div className="relative h-[766px]">
          {/* Hero background section */}
          <div 
            className="absolute w-full h-[692px] top-0 left-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80')",
              position: 'relative'
            }}
          >
            {/* 배경 이미지 위에 어두운 오버레이 추가 */}
            <div className="absolute inset-0 bg-black/40"></div>
          </div>

          {/* Main heading - 위로 올림 */}
          <h1 className="w-full max-w-[507px] top-[120px] left-1/2 -translate-x-1/2 text-white text-[50px] leading-[50px] absolute font-jua text-center">
            여행을 떠나시나요?
          </h1>

          {/* Stack View Container - 모든 입력 요소를 포함하는 컨테이너 */}
          <div className="absolute w-full max-w-[750px] top-[200px] left-1/2 -translate-x-1/2 bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-700">
            {/* 상단 바 추가 */}
            <div className="flex justify-end mb-4">
              <div 
                className="text-white text-base font-medium cursor-pointer hover:underline flex items-center"
                onClick={() => navigate("/planner")}
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
                    placeholderText="가는 날"
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
                    placeholderText="오는 날"
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
                    성인 {adultCount}명{childCount > 0 ? `, 어린이 ${childCount}명` : ''}
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
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
              
              {/* 비행기 모양 원형 버튼 추가 */}
              <div className="flex justify-start mt-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full w-10 h-10 bg-blue-500 hover:bg-blue-600 border-none shadow-md"
                  onClick={() => setIsFlightDialogOpen(true)}
                >
                  <Plane className="h-5 w-5 text-white" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* API 데이터 표시 섹션 */}
        <div className="w-full max-w-[1200px] mx-auto px-4 py-12">
          <h2 className="text-3xl font-bold text-center mb-8">여행 정보</h2>
          
          {/* 탭 네비게이션 */}
          <div className="flex justify-center mb-8 border-b">
            <button 
              className={`px-6 py-3 font-medium ${activeTab === 'destinations' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}
              onClick={() => setActiveTab('destinations')}
            >
              <MapPin className="inline-block mr-2" size={18} />
              인기 여행지
            </button>
            <button 
              className={`px-6 py-3 font-medium ${activeTab === 'airlines' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}
              onClick={() => setActiveTab('airlines')}
            >
              <Plane className="inline-block mr-2" size={18} />
              항공사 정보
            </button>
            <button 
              className={`px-6 py-3 font-medium ${activeTab === 'hotels' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}
              onClick={() => setActiveTab('hotels')}
            >
              <Hotel className="inline-block mr-2" size={18} />
              호텔 정보
            </button>
          </div>
          
          {/* 로딩 상태 표시 */}
          {isLoadingData && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-gray-500">데이터를 불러오는 중입니다...</p>
            </div>
          )}
          
          {/* 인기 여행지 섹션 */}
          {!isLoadingData && activeTab === 'destinations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularDestinations.map((destination) => (
                <Card key={destination.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={destination.image} 
                      alt={destination.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="text-xl font-bold mb-2">{destination.name}</h3>
                    <p className="text-gray-600">{destination.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {/* 항공사 정보 섹션 */}
          {!isLoadingData && activeTab === 'airlines' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {airlines.map((airline) => (
                <Card key={airline.id} className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                      <img 
                        src={airline.logo} 
                        alt={airline.name} 
                        className="w-12 h-12 object-contain"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{airline.name}</h3>
                      <div className="flex items-center">
                        <span className="text-yellow-500 mr-1">★</span>
                        <span>{airline.rating}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          
          {/* 호텔 정보 섹션 */}
          {!isLoadingData && activeTab === 'hotels' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotels.map((hotel) => (
                <Card key={hotel.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={hotel.image} 
                      alt={hotel.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="text-xl font-bold mb-1">{hotel.name}</h3>
                    <p className="text-gray-600 mb-2">{hotel.location}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="text-yellow-500 mr-1">★</span>
                        <span>{hotel.rating}</span>
                      </div>
                      <span className="font-bold text-primary">{hotel.price}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* FlightPlan 컴포넌트를 사용한 다이얼로그 */}
      {isFlightDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 다이얼로그 헤더 */}
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">항공편 검색</h2>
              <Button 
                variant="ghost" 
                className="rounded-full p-1 hover:bg-gray-100" 
                onClick={() => setIsFlightDialogOpen(false)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
            
            {/* 다이얼로그 컨텐츠 - 좌우 분할 레이아웃 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 왼쪽 패널: 검색 조건 (스크롤 가능) */}
              <div className="w-1/3 border-r overflow-y-auto p-4 bg-gray-50">
                <h3 className="text-lg font-semibold mb-4">검색 조건</h3>
                
                {/* 출발지 입력 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">출발지 *</label>
                  <div className="relative">
                    <Input
                      placeholder="도시 또는 공항 검색 (2글자 이상)"
                      value={originSearch}
                      onChange={(e) => {
                        setOriginSearch(e.target.value);
                        if (e.target.value.length >= 2) {
                          handleCitySearch(e.target.value, 'origin');
                        } else {
                          setOriginCities([]); // 2글자 미만이면 검색 결과 초기화
                        }
                      }}
                      className="w-full"
                    />
                    {originCities.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        {originCities.map(city => (
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
                
                {/* 도착지 입력 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">도착지 *</label>
                  <div className="relative">
                    <Input
                      placeholder="도시 또는 공항 검색 (2글자 이상)"
                      value={destinationSearch}
                      onChange={(e) => {
                        setDestinationSearch(e.target.value);
                        if (e.target.value.length >= 2) {
                          handleCitySearch(e.target.value, 'destination');
                        } else {
                          setDestinationCities([]); // 2글자 미만이면 검색 결과 초기화
                        }
                      }}
                      className="w-full"
                    />
                    {destinationCities.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        {destinationCities.map(city => (
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
                    className="w-full"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">오는 날 (선택사항)</label>
                  <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate}
                    dateFormat="yyyy/MM/dd"
                    locale={ko}
                    placeholderText="오는 날"
                    customInput={<CustomInput />}
                    className="w-full"
                  />
                </div>
                
                {/* 인원 수 입력 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">성인 (만 12세 이상) *</label>
                  <Input
                    type="number"
                    min="1"
                    max="9"
                    value={adultCount}
                    onChange={(e) => setAdultCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full"
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
                    className="w-full"
                  />
                </div>
                
                {/* 유아 수 입력 필드 추가 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">유아 (만 2세 미만)</label>
                  <Input
                    type="number"
                    min="0"
                    max="9"
                    value={infantCount}
                    onChange={(e) => setInfantCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full"
                  />
                </div>
                
                {/* 좌석 등급 선택 추가 */}
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
                
                {/* 가격 제한 필드 추가 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">최대 가격 (1인당)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="예: 500000"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full"
                  />
                </div>
                
                {/* 직항 필터 추가 */}
                <div className="mb-4 flex items-center">
                  <input
                    type="checkbox"
                    id="nonStop"
                    checked={nonStop}
                    onChange={(e) => setNonStop(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="nonStop" className="text-sm">직항만 검색</label>
                </div>
                
                {/* 검색 버튼 */}
                <Button 
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 mt-4"
                  onClick={() => {
                    // 검색 파라미터 설정
                    const params = {
                      selectedOrigin: selectedOrigin,
                      selectedDestination: selectedDestination,
                      departureDate: startDate,
                      returnDate: endDate,
                      adults: adultCount,
                      children: childCount,
                      infants: infantCount,
                      travelClass: travelClass,
                      nonStop: nonStop,
                      currencyCode: 'KRW',
                      maxPrice: maxPrice
                    };
                    
                    // 현재 검색 파라미터 상태 업데이트
                    setFlightSearchParams(params);
                    
                    // 플래너의 검색 함수와 비슷한 로직으로 검색 실행
                    if (!params.selectedOrigin) {
                      setFlightError('출발지를 선택해주세요.');
                      return;
                    }
                    if (!params.selectedDestination) {
                      setFlightError('도착지를 선택해주세요.');
                      return;
                    }
                    if (!params.departureDate) {
                      setFlightError('가는 날짜를 선택해주세요.');
                      return;
                    }
                    
                    // 추가 유효성 검사
                    if (params.infants > params.adults) {
                      setFlightError('유아 수는 성인 수를 초과할 수 없습니다.');
                      return;
                    }
                    
                    const totalPassengers = (parseInt(params.adults) || 0) + (parseInt(params.children) || 0);
                    if (totalPassengers > 9) {
                      setFlightError('총 탑승객(성인+어린이)은 9명을 초과할 수 없습니다.');
                      return;
                    }
                    
                    setIsLoadingFlights(true);
                    setFlightResults([]);
                    setFlightError(null);
                    
                    // API 요청 구성
                    const paramsToApi = {
                      originCode: params.selectedOrigin.iataCode,
                      destinationCode: params.selectedDestination.iataCode,
                      departureDate: format(params.departureDate, 'yyyy-MM-dd'),
                      returnDate: params.returnDate ? format(params.returnDate, 'yyyy-MM-dd') : null,
                      adults: params.adults,
                      children: params.children > 0 ? params.children : undefined,
                      infants: params.infants > 0 ? params.infants : undefined,
                      travelClass: params.travelClass || undefined,
                      nonStop: params.nonStop || undefined,
                      currencyCode: 'KRW',
                      maxPrice: params.maxPrice || undefined,
                      max: 20
                    };
                    
                    console.log("항공편 검색 파라미터:", paramsToApi);
                    
                    // 항공편 검색 API 호출
                    amadeusApi.searchFlights(paramsToApi)
                      .then(response => {
                        if (response && response.data && Array.isArray(response.data)) {
                          setFlightResults(response.data);
                          setDictionaries(response.dictionaries || {});
                          if (response.data.length === 0) {
                            setFlightError('검색 조건에 맞는 항공편이 없습니다.');
                          }
                        } else {
                          setFlightResults([]);
                          setFlightError('항공편 검색 결과가 없거나 형식이 올바르지 않습니다.');
                        }
                      })
                      .catch(err => {
                        console.error("항공편 검색 오류:", err);
                        setFlightError(err.message || '항공편 검색 중 오류가 발생했습니다.');
                        setFlightResults([]);
                      })
                      .finally(() => {
                        setIsLoadingFlights(false);
                      });
                  }}
                  disabled={isLoadingFlights}
                >
                  {isLoadingFlights ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      검색 중...
                    </span>
                  ) : "항공권 검색"}
                </Button>
                
                {/* 오류 메시지 */}
                {flightError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                    {flightError}
                  </div>
                )}
              </div>
              
              {/* 오른쪽 패널: 검색 결과 (스크롤 가능) */}
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
                      // 첫 번째 세그먼트 정보 가져오기
                      const firstItinerary = flight.itineraries[0];
                      const firstSegment = firstItinerary.segments[0];
                      const lastSegment = firstItinerary.segments[firstItinerary.segments.length - 1];
                      
                      // 가격 포맷팅
                      const price = parseInt(flight.price.grandTotal).toLocaleString();
                      
                      // 항공사 정보
                      const carrierCode = firstSegment.carrierCode;
                      const carrierName = dictionaries?.carriers?.[carrierCode] || carrierCode;
                      
                      // 소요 시간 포맷팅
                      const duration = firstItinerary.duration
                        .replace('PT', '')
                        .replace('H', '시간 ')
                        .replace('M', '분');
                      
                      // 경유 정보
                      const stops = firstItinerary.segments.length - 1;
                      const stopsText = stops === 0 ? '직항' : `${stops}회 경유`;
                      
                      return (
                        <div key={index} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-lg font-bold">
                              {firstSegment.departure.iataCode} → {lastSegment.arrival.iataCode}
                            </div>
                            <div className="text-lg font-bold text-blue-600">{price}원</div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {new Date(firstSegment.departure.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium">
                                  {new Date(lastSegment.arrival.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                {carrierName} | {stopsText} | 총 소요시간: {duration}
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              className="border-blue-500 text-blue-500 hover:bg-blue-50"
                              onClick={() => {
                                // 선택한 항공편 정보 저장 및 콘솔 출력
                                console.log("선택한 항공편 정보:", flight);
                                setSelectedFlight(flight);
                                
                                // 다이얼로그 닫기
                                setIsFlightDialogOpen(false);
                                
                                // 알림 표시
                                alert(`항공편이 선택되었습니다. 가격: ${parseInt(flight.price.grandTotal).toLocaleString()}원`);
                              }}
                            >
                              선택
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <div className="mb-4">
                      <Plane className="h-16 w-16 text-gray-300" />
                    </div>
                    <p>아직 항공편 검색 결과가 없습니다.</p>
                    <p className="mt-2 text-sm">왼쪽에서 검색 조건을 입력하고 검색 버튼을 클릭하세요.</p>
                    <div className="mt-6 p-4 bg-blue-50 rounded-md max-w-md text-sm text-blue-700">
                      <p className="font-medium mb-2">검색 팁:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>도시나 공항 이름은 영문으로 입력하면 더 정확한 결과를 얻을 수 있습니다. (예: Seoul, Tokyo)</li>
                        <li>도시 코드를 직접 입력할 수도 있습니다. (예: ICN, NRT)</li>
                        <li>검색 조건을 너무 제한적으로 설정하면 결과가 없을 수 있습니다.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* MUI 스타일을 위한 전역 CSS */}
      <style jsx global>{`
        .mui-wrapper .MuiAutocomplete-root,
        .mui-wrapper .MuiTextField-root,
        .mui-wrapper .MuiFormControl-root {
          width: 100%;
          margin-bottom: 12px;
        }
        .mui-wrapper .MuiButton-root {
          text-transform: none;
        }
        .mui-wrapper .MuiPaper-root {
          width: 100%;
        }
        .mui-wrapper .MuiAutocomplete-option {
          padding: 8px 12px;
        }
        .mui-wrapper .MuiAutocomplete-option strong {
          font-weight: 600;
        }
        .mui-wrapper .MuiInputBase-root {
          font-size: 14px;
        }
        .mui-wrapper .MuiTypography-root {
          font-size: 14px;
        }
        .mui-wrapper .MuiInputLabel-root {
          font-size: 14px;
        }
        .mui-wrapper .MuiAutocomplete-listbox {
          max-height: 300px;
        }
        .mui-wrapper .MuiAutocomplete-paper {
          max-height: 300px;
          overflow-y: auto;
        }
        .mui-wrapper .MuiDialogContent-root {
          padding: 16px;
        }
      `}</style>
    </div>
  );
};

// 날짜 선택기 커스텀 입력 컴포넌트
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

// 가짜 항공편 데이터 생성 함수
const generateMockFlightData = (params) => {
  // 현재 시간 기준으로 출발, 도착 시간 생성
  const departureDate = new Date();
  departureDate.setHours(10, 0, 0);
  
  const arrivalDate = new Date(departureDate);
  arrivalDate.setHours(12, 30, 0);
  
  // 출발지, 도착지 IATA 코드 사용
  const originCode = params.originCode;
  const destinationCode = params.destinationCode;
  
  // 항공사 정보
  const carriers = {
    "KE": "대한항공",
    "OZ": "아시아나항공",
    "7C": "제주항공",
    "LJ": "진에어",
    "TW": "티웨이항공"
  };

  // 가짜 항공편 생성
  const mockFlights = [
    {
      type: "flight-offer",
      id: "1",
      source: "GDS",
      instantTicketingRequired: false,
      nonHomogeneous: false,
      oneWay: false,
      lastTicketingDate: "2023-12-30",
      numberOfBookableSeats: 9,
      itineraries: [
        {
          duration: "PT2H30M",
          segments: [
            {
              departure: {
                iataCode: originCode,
                at: departureDate.toISOString()
              },
              arrival: {
                iataCode: destinationCode,
                at: arrivalDate.toISOString()
              },
              carrierCode: "KE",
              number: "701",
              aircraft: {
                code: "738"
              },
              operating: {
                carrierCode: "KE"
              },
              duration: "PT2H30M",
              id: "1",
              numberOfStops: 0
            }
          ]
        }
      ],
      price: {
        currency: "KRW",
        total: "350000",
        base: "300000",
        fees: [
          {
            amount: "0",
            type: "SUPPLIER"
          },
          {
            amount: "0",
            type: "TICKETING"
          }
        ],
        grandTotal: "350000"
      },
      pricingOptions: {
        fareType: ["PUBLISHED"],
        includedCheckedBagsOnly: true
      },
      validatingAirlineCodes: ["KE"],
      travelerPricings: [
        {
          travelerId: "1",
          fareOption: "STANDARD",
          travelerType: "ADULT",
          price: {
            currency: "KRW",
            total: "350000",
            base: "300000"
          },
          fareDetailsBySegment: [
            {
              segmentId: "1",
              cabin: "ECONOMY",
              fareBasis: "YLXSP",
              class: "Y",
              includedCheckedBags: {
                quantity: 1
              }
            }
          ]
        }
      ]
    },
    {
      type: "flight-offer",
      id: "2",
      source: "GDS",
      instantTicketingRequired: false,
      nonHomogeneous: false,
      oneWay: false,
      lastTicketingDate: "2023-12-30",
      numberOfBookableSeats: 9,
      itineraries: [
        {
          duration: "PT2H20M",
          segments: [
            {
              departure: {
                iataCode: originCode,
                at: new Date(departureDate.getTime() + 4 * 60 * 60 * 1000).toISOString() // 4시간 후 출발
              },
              arrival: {
                iataCode: destinationCode,
                at: new Date(arrivalDate.getTime() + 4 * 60 * 60 * 1000).toISOString() // 4시간 후 도착
              },
              carrierCode: "OZ",
              number: "225",
              aircraft: {
                code: "321"
              },
              operating: {
                carrierCode: "OZ"
              },
              duration: "PT2H20M",
              id: "2",
              numberOfStops: 0
            }
          ]
        }
      ],
      price: {
        currency: "KRW",
        total: "320000",
        base: "280000",
        fees: [
          {
            amount: "0",
            type: "SUPPLIER"
          },
          {
            amount: "0",
            type: "TICKETING"
          }
        ],
        grandTotal: "320000"
      },
      pricingOptions: {
        fareType: ["PUBLISHED"],
        includedCheckedBagsOnly: true
      },
      validatingAirlineCodes: ["OZ"],
      travelerPricings: [
        {
          travelerId: "1",
          fareOption: "STANDARD",
          travelerType: "ADULT",
          price: {
            currency: "KRW",
            total: "320000",
            base: "280000"
          },
          fareDetailsBySegment: [
            {
              segmentId: "2",
              cabin: "ECONOMY",
              fareBasis: "YLXSP",
              class: "Y",
              includedCheckedBags: {
                quantity: 1
              }
            }
          ]
        }
      ]
    }
  ];

  // 항공사 사전 데이터 생성
  const mockDictionaries = {
    locations: {
      [originCode]: {
        cityCode: originCode.substring(0, 3),
        countryCode: "KR"
      },
      [destinationCode]: {
        cityCode: destinationCode.substring(0, 3),
        countryCode: "JP"
      }
    },
    aircraft: {
      "738": "BOEING 737-800",
      "321": "AIRBUS A321"
    },
    currencies: {
      "KRW": "대한민국 원"
    },
    carriers: {
      "KE": "대한항공",
      "OZ": "아시아나항공"
    }
  };

  return { flights: mockFlights, dictionaries: mockDictionaries };
};

export default PlanTravel;
