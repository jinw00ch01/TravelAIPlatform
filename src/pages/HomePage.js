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
  const [validationErrors, setValidationErrors] = useState([]); // 검증 오류 메시지용
  const [showGif, setShowGif] = useState(false); // GIF 표시 상태 (WebSocket 완료 후에도 유지)
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
  
  // 선택한 항공편들 정보 저장 (다중 선택 지원)
  const [selectedFlights, setSelectedFlights] = useState([]);
  // 선택한 숙소들(호텔+객실) 정보 저장 (다중 선택 지원)
  const [selectedAccommodations, setSelectedAccommodations] = useState([]);
  // 선택한 항공편의 dictionaries(항공사 등)와 공항 정보 캐시
  const [selectedFlightDictionaries, setSelectedFlightDictionaries] = useState({});
  const [airportInfoCache, setAirportInfoCache] = useState({});
  
  // 하위 호환성을 위한 단일 선택 getter (기존 코드와의 호환성)
  const selectedFlight = selectedFlights.length > 0 ? selectedFlights[0] : null;
  const selectedAccommodation = selectedAccommodations.length > 0 ? selectedAccommodations[0] : null;

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

  // 항공편 선택 함수 업데이트 (다중 선택 지원)
  const selectFlight = useCallback((flight, dictionaries, newAirportInfoCache, isMultiple = false) => {
    if (!flight) return;
    
    // 새로운 공항 정보가 있으면 캐시에 추가
    if (newAirportInfoCache && Object.keys(newAirportInfoCache).length > 0) {
      setAirportInfoCache(prev => ({...prev, ...newAirportInfoCache}));
    }
    
    // 항공편 정보에 공항 정보 추가
    const enrichedFlight = enrichFlightWithAirportInfo(flight);
    
    console.log('[HomePage] Selected flight with airport info:', enrichedFlight);
    
    if (isMultiple) {
      // 다중 선택 모드: 기존 항공편 목록에 추가
      setSelectedFlights(prev => {
        // 중복 방지: 같은 ID의 항공편이 이미 있으면 교체
        const existingIndex = prev.findIndex(f => f.id === enrichedFlight.id);
        if (existingIndex >= 0) {
          const newFlights = [...prev];
          newFlights[existingIndex] = enrichedFlight;
          return newFlights;
        } else {
          return [...prev, enrichedFlight];
        }
      });
    } else {
      // 단일 선택 모드: 기존 항공편 교체
      setSelectedFlights([enrichedFlight]);
    }
    
    setSelectedFlightDictionaries(prev => ({...prev, ...dictionaries}));
    setIsFlightDialogOpen(false);
  }, [enrichFlightWithAirportInfo]);

  // 항공편 제거 함수
  const removeFlight = useCallback((flightId) => {
    setSelectedFlights(prev => prev.filter(f => f.id !== flightId));
  }, []);

  // 항공편 순서 변경 함수
  const reorderFlights = useCallback((fromIndex, toIndex) => {
    setSelectedFlights(prev => {
      const newFlights = [...prev];
      const [removed] = newFlights.splice(fromIndex, 1);
      newFlights.splice(toIndex, 0, removed);
      return newFlights;
    });
  }, []);

  // 컴포넌트 언마운트 시 WebSocket 연결 정리
  useEffect(() => {
    return () => {
      // 컴포넌트가 언마운트될 때 WebSocket 연결 해제
      websocketService.disconnect();
    };
  }, []);

  // ==================== 날짜 검증 로직 ====================
  
  /**
   * 다중 항공편 날짜 검증
   * @param {Array} flights - 선택된 항공편들 정보
   * @param {Date} userStartDate - 사용자가 선택한 출국일
   * @param {Date} userEndDate - 사용자가 선택한 귀국일
   * @returns {Object} { isValid: boolean, errors: string[] }
   */
  const validateMultipleFlightDates = (flights, userStartDate, userEndDate) => {
    if (!flights || flights.length === 0 || !userStartDate) {
      return { isValid: true, errors: [] }; // 항공편이 없으면 검증 통과
    }

    const errors = [];

    // 왕복편과 편도편 혼재 검증
    const hasRoundTrip = flights.some(f => f.itineraries.length > 1);
    const hasOneWay = flights.some(f => f.itineraries.length === 1);
    
    if (hasRoundTrip && hasOneWay) {
      errors.push('왕복편과 편도편을 동시에 선택할 수 없습니다.');
      return { isValid: false, errors };
    }

    if (hasRoundTrip && flights.length > 1) {
      errors.push('왕복편은 1개만 선택할 수 있습니다.');
      return { isValid: false, errors };
    }

    // 단일 왕복편인 경우
    if (hasRoundTrip) {
      const flight = flights[0];
      const outboundSegment = flight.itineraries[0].segments[0];
      const inboundSegment = flight.itineraries[1].segments[0];
      
      const flightDepartureDate = new Date(outboundSegment.departure.at);
      const returnDepartureDate = new Date(inboundSegment.departure.at);
      
      const userStartDateOnly = new Date(userStartDate.getFullYear(), userStartDate.getMonth(), userStartDate.getDate());
      const userEndDateOnly = new Date(userEndDate.getFullYear(), userEndDate.getMonth(), userEndDate.getDate());
      const flightDepartureDateOnly = new Date(flightDepartureDate.getFullYear(), flightDepartureDate.getMonth(), flightDepartureDate.getDate());
      const returnDepartureDateOnly = new Date(returnDepartureDate.getFullYear(), returnDepartureDate.getMonth(), returnDepartureDate.getDate());
      
      if (flightDepartureDateOnly.getTime() !== userStartDateOnly.getTime()) {
        errors.push(`왕복편 출발일(${flightDepartureDateOnly.toLocaleDateString('ko-KR')})이 설정한 출국일(${userStartDateOnly.toLocaleDateString('ko-KR')})과 일치하지 않습니다.`);
      }
      
      if (returnDepartureDateOnly.getTime() !== userEndDateOnly.getTime()) {
        errors.push(`왕복편 귀국일(${returnDepartureDateOnly.toLocaleDateString('ko-KR')})이 설정한 귀국일(${userEndDateOnly.toLocaleDateString('ko-KR')})과 일치하지 않습니다.`);
      }
    }

    // 다중 편도편인 경우
    if (hasOneWay) {
      if (!userEndDate) {
        errors.push('편도 항공편을 선택했습니다. 귀국일을 설정해주세요.');
        return { isValid: false, errors };
      }

      // 항공편들을 출발 날짜 순으로 정렬
      const sortedFlights = [...flights].sort((a, b) => {
        const dateA = new Date(a.itineraries[0].segments[0].departure.at);
        const dateB = new Date(b.itineraries[0].segments[0].departure.at);
        return dateA.getTime() - dateB.getTime();
      });

      const userStartDateOnly = new Date(userStartDate.getFullYear(), userStartDate.getMonth(), userStartDate.getDate());
      const userEndDateOnly = new Date(userEndDate.getFullYear(), userEndDate.getMonth(), userEndDate.getDate());

      // 첫 번째 항공편이 출국일과 일치하는지 확인
      const firstFlightDate = new Date(sortedFlights[0].itineraries[0].segments[0].departure.at);
      const firstFlightDateOnly = new Date(firstFlightDate.getFullYear(), firstFlightDate.getMonth(), firstFlightDate.getDate());
      
      if (firstFlightDateOnly.getTime() !== userStartDateOnly.getTime()) {
        errors.push(`첫 번째 항공편 출발일(${firstFlightDateOnly.toLocaleDateString('ko-KR')})이 설정한 출국일(${userStartDateOnly.toLocaleDateString('ko-KR')})과 일치하지 않습니다.`);
      }

      // 마지막 항공편이 귀국일과 일치하는지 확인
      const lastFlight = sortedFlights[sortedFlights.length - 1];
      const lastFlightDate = new Date(lastFlight.itineraries[0].segments[0].departure.at);
      const lastFlightDateOnly = new Date(lastFlightDate.getFullYear(), lastFlightDate.getMonth(), lastFlightDate.getDate());
      
      if (lastFlightDateOnly.getTime() !== userEndDateOnly.getTime()) {
        errors.push(`마지막 항공편 출발일(${lastFlightDateOnly.toLocaleDateString('ko-KR')})이 설정한 귀국일(${userEndDateOnly.toLocaleDateString('ko-KR')})과 일치하지 않습니다.`);
      }

      // 중간 항공편들이 출국일-귀국일 사이에 있는지 확인
      for (let i = 1; i < sortedFlights.length - 1; i++) {
        const flightDate = new Date(sortedFlights[i].itineraries[0].segments[0].departure.at);
        const flightDateOnly = new Date(flightDate.getFullYear(), flightDate.getMonth(), flightDate.getDate());
        
        if (flightDateOnly.getTime() <= userStartDateOnly.getTime() || flightDateOnly.getTime() >= userEndDateOnly.getTime()) {
          errors.push(`${i + 1}번째 항공편 출발일(${flightDateOnly.toLocaleDateString('ko-KR')})이 출국일과 귀국일 사이에 있지 않습니다.`);
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  };

  /**
   * 다중 숙박편 날짜 검증
   * @param {Array} accommodations - 선택된 숙박편들 정보
   * @param {Date} userStartDate - 사용자가 선택한 출국일
   * @param {Date} userEndDate - 사용자가 선택한 귀국일
   * @returns {Object} { isValid: boolean, errors: string[] }
   */
  const validateMultipleAccommodationDates = (accommodations, userStartDate, userEndDate) => {
    if (!accommodations || accommodations.length === 0 || !userStartDate || !userEndDate) {
      return { isValid: true, errors: [] }; // 숙박편이 없으면 검증 통과
    }

    const errors = [];
    const userStartDateOnly = new Date(userStartDate.getFullYear(), userStartDate.getMonth(), userStartDate.getDate());
    const userEndDateOnly = new Date(userEndDate.getFullYear(), userEndDate.getMonth(), userEndDate.getDate());

    // 숙박편들을 체크인 날짜 순으로 정렬
    const sortedAccommodations = [...accommodations].sort((a, b) => {
      return new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
    });

    // 각 숙박편 개별 검증
    sortedAccommodations.forEach((accommodation, index) => {
      const checkInDate = new Date(accommodation.checkIn);
      const checkOutDate = new Date(accommodation.checkOut);
      const checkInDateOnly = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
      const checkOutDateOnly = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate());

      // 체크인이 체크아웃보다 이전인지 확인
      if (checkInDateOnly.getTime() >= checkOutDateOnly.getTime()) {
        errors.push(`${index + 1}번째 숙박편: 체크인 날짜가 체크아웃 날짜와 같거나 늦습니다.`);
      }

      // 첫 번째 숙박편의 체크인이 출국일 이후인지 확인
      if (index === 0 && checkInDateOnly.getTime() < userStartDateOnly.getTime()) {
        errors.push(`첫 번째 숙박편 체크인 날짜(${checkInDateOnly.toLocaleDateString('ko-KR')})가 출국일(${userStartDateOnly.toLocaleDateString('ko-KR')})보다 이릅니다.`);
      }

      // 마지막 숙박편의 체크아웃이 귀국일 이전인지 확인
      if (index === sortedAccommodations.length - 1 && checkOutDateOnly.getTime() > userEndDateOnly.getTime()) {
        errors.push(`마지막 숙박편 체크아웃 날짜(${checkOutDateOnly.toLocaleDateString('ko-KR')})가 귀국일(${userEndDateOnly.toLocaleDateString('ko-KR')})보다 늦습니다.`);
      }
    });

    // 숙박편 간 연결성 검증 (이전 체크아웃 = 다음 체크인)
    for (let i = 0; i < sortedAccommodations.length - 1; i++) {
      const currentCheckOut = new Date(sortedAccommodations[i].checkOut);
      const nextCheckIn = new Date(sortedAccommodations[i + 1].checkIn);
      
      const currentCheckOutDateOnly = new Date(currentCheckOut.getFullYear(), currentCheckOut.getMonth(), currentCheckOut.getDate());
      const nextCheckInDateOnly = new Date(nextCheckIn.getFullYear(), nextCheckIn.getMonth(), nextCheckIn.getDate());

      if (currentCheckOutDateOnly.getTime() !== nextCheckInDateOnly.getTime()) {
        errors.push(`${i + 1}번째 숙박편 체크아웃 날짜(${currentCheckOutDateOnly.toLocaleDateString('ko-KR')})와 ${i + 2}번째 숙박편 체크인 날짜(${nextCheckInDateOnly.toLocaleDateString('ko-KR')})가 연결되지 않습니다.`);
      }
    }

    // 날짜별 숙박편 개수 검증 (각 날짜마다 1개 또는 2개만 허용)
    const dateAccommodationCount = {};
    
    sortedAccommodations.forEach((accommodation, index) => {
      const checkInDate = new Date(accommodation.checkIn);
      const checkOutDate = new Date(accommodation.checkOut);
      
      // 체크인 날짜부터 체크아웃 날짜 전날까지 카운트
      let currentDate = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
      const endDate = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate());
      
      while (currentDate.getTime() < endDate.getTime()) {
        const dateKey = currentDate.toISOString().split('T')[0];
        dateAccommodationCount[dateKey] = (dateAccommodationCount[dateKey] || 0) + 1;
        
        if (dateAccommodationCount[dateKey] > 2) {
          errors.push(`${currentDate.toLocaleDateString('ko-KR')} 날짜에 3개 이상의 숙박편이 겹칩니다. 최대 2개까지만 허용됩니다.`);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // 출국일부터 귀국일까지 모든 날짜에 숙박편이 있는지 확인
    let checkDate = new Date(userStartDateOnly);
    while (checkDate.getTime() < userEndDateOnly.getTime()) {
      const dateKey = checkDate.toISOString().split('T')[0];
      if (!dateAccommodationCount[dateKey]) {
        errors.push(`${checkDate.toLocaleDateString('ko-KR')} 날짜에 숙박편이 없습니다.`);
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }

    return { isValid: errors.length === 0, errors };
  };

  /**
   * 항공편과 숙박편 간의 호환성 검증
   * @param {Object} flight - 선택된 항공편 정보
   * @param {Object} accommodation - 선택된 숙박편 정보
   * @returns {Object} { isValid: boolean, error: string }
   */
  const validateFlightAccommodationCompatibility = (flight, accommodation) => {
    // 항공편과 숙박편 간의 시간 검증은 사용자의 자유도를 위해 제거
    return { isValid: true, error: null };
  };

  /**
   * 전체 검증 실행 (다중 선택 지원)
   * @returns {Object} { isValid: boolean, errors: string[] }
   */
  const validateAllSelections = () => {
    const errors = [];

    // 필수 필드 검증
    if (!searchText.trim()) {
      errors.push('여행 요구사항을 입력해주세요.');
    }
    if (!startDate) {
      errors.push('출국일을 선택해주세요.');
    }
    if (!endDate) {
      errors.push('귀국일을 선택해주세요.');
    }

    // 날짜 순서 검증
    if (startDate && endDate && startDate >= endDate) {
      errors.push('귀국일은 출국일보다 늦어야 합니다.');
    }

    // 다중 항공편 날짜 검증
    const flightValidation = validateMultipleFlightDates(selectedFlights, startDate, endDate);
    if (!flightValidation.isValid) {
      errors.push(...flightValidation.errors);
    }

    // 다중 숙박편 날짜 검증
    const accommodationValidation = validateMultipleAccommodationDates(selectedAccommodations, startDate, endDate);
    if (!accommodationValidation.isValid) {
      errors.push(...accommodationValidation.errors);
    }

    // 항공편-숙박편 호환성 검증 (첫 번째 항공편과 첫 번째 숙박편만 검증)
    if (selectedFlights.length > 0 && selectedAccommodations.length > 0) {
      const compatibilityValidation = validateFlightAccommodationCompatibility(selectedFlights[0], selectedAccommodations[0]);
      if (!compatibilityValidation.isValid) {
        errors.push(compatibilityValidation.error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

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

  // 공항 정보가 업데이트 되면 선택된 항공편들 정보도 업데이트 (무한 루프 방지)
  useEffect(() => {
    if (selectedFlights.length === 0) return;
    if (Object.keys(airportInfoCache).length === 0) return;

    const enrichedFlights = selectedFlights.map(flight => enrichFlightWithAirportInfo(flight));
    // 변경 사항이 있을 때만 업데이트(문자열 비교 단순 사용)
    if (JSON.stringify(enrichedFlights) !== JSON.stringify(selectedFlights)) {
      setSelectedFlights(enrichedFlights);
    }
  }, [airportInfoCache, selectedFlights, enrichFlightWithAirportInfo]);

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
    // 전체 검증 실행
    const validation = validateAllSelections();
    
    if (!validation.isValid) {
      // 검증 실패 시 오류 메시지 상태에 저장
      setValidationErrors(validation.errors);
      // 3초 후 오류 메시지 제거
      setTimeout(() => {
        setValidationErrors([]);
      }, 8000);
      return;
    }

    // 검증 성공 시 오류 메시지 제거
    setValidationErrors([]);

    setIsProcessing(true); // 로딩 시작
    setProcessingStatus("연결을 준비 중입니다...");
    setShowGif(true); // GIF 표시 시작
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
      
      // 다중 항공편 정보 추가
      if (selectedFlights.length > 0) {
        if (selectedFlights.length === 1) {
          // 하위 호환성을 위해 단일 항공편은 기존 방식 유지
          planDetails.flightInfo = selectedFlights[0];
        } else {
          // 다중 항공편은 새로운 방식으로 전송
          planDetails.flightInfos = selectedFlights;
        }
      }
      
      // 다중 숙박편 정보 추가
      if (selectedAccommodations.length > 0) {
        if (selectedAccommodations.length === 1) {
          // 하위 호환성을 위해 단일 숙박편은 기존 방식 유지
          planDetails.accommodationInfo = selectedAccommodations[0];
        } else {
          // 다중 숙박편은 새로운 방식으로 전송
          planDetails.accommodationInfos = selectedAccommodations;
        }
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
      
      // GIF를 3초 더 표시한 후 숨김
      setTimeout(() => {
        setShowGif(false);
      }, 5000);
      
      if (planSuccessfullyCreated && generatedPlanId) {
        console.log('[HomePage] 페이지 이동 준비 중. generatedPlanId:', generatedPlanId, '타입:', typeof generatedPlanId);
        // 약간의 지연 후 페이지 이동 (사용자가 성공 메시지를 볼 수 있도록)
        setTimeout(() => {
          const targetUrl = `/planner/${generatedPlanId}`;
          console.log('[HomePage] 페이지 이동 실행:', targetUrl);
          navigate(targetUrl, { 
            state: { 
              flightData: selectedFlights.length > 0 ? selectedFlights[0] : null, // 하위 호환성
              flightDatas: selectedFlights, // 다중 항공편 데이터
              accommodationDatas: selectedAccommodations, // 다중 숙박편 데이터
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

  // 숙소 선택 핸들러 (다중 선택 지원)
  const selectAccommodation = useCallback((accom, isMultiple = false) => {
    if (!accom) return;
    console.log('[HomePage] Selected accommodation:', accom);
    
    if (isMultiple) {
      // 다중 선택 모드: 기존 숙박편 목록에 추가
      setSelectedAccommodations(prev => {
        // 중복 방지: 같은 호텔+객실 조합이 이미 있으면 교체
        const existingIndex = prev.findIndex(a => 
          a.hotel.hotel_id === accom.hotel.hotel_id && 
          a.room.id === accom.room.id &&
          a.checkIn.getTime() === accom.checkIn.getTime()
        );
        if (existingIndex >= 0) {
          const newAccommodations = [...prev];
          newAccommodations[existingIndex] = accom;
          return newAccommodations;
        } else {
          return [...prev, accom];
        }
      });
    } else {
      // 단일 선택 모드: 기존 숙박편 교체
      setSelectedAccommodations([accom]);
    }
    
    setIsAccommodationDialogOpen(false);
  }, []);

  // 숙박편 제거 함수
  const removeAccommodation = useCallback((index) => {
    setSelectedAccommodations(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 숙박편 순서 변경 함수
  const reorderAccommodations = useCallback((fromIndex, toIndex) => {
    setSelectedAccommodations(prev => {
      const newAccommodations = [...prev];
      const [removed] = newAccommodations.splice(fromIndex, 1);
      newAccommodations.splice(toIndex, 0, removed);
      return newAccommodations;
    });
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
      <div className="w-full max-w-[2160px] min-h-screen">
        <div className="relative h-[900px]">
          {/* Hero background section */}
          <div 
            className="absolute w-full h-[820px] top-0 left-0 bg-gradient-to-b from-sky-300 via-sky-200 to-white"
            style={{
              position: 'relative'
            }}
          >
            {/* 오른쪽 AI 생성 이미지 */}
            <div className="absolute right-[0%] top-[5px] w-[694px] h-[815px] rounded-lg overflow-hidden">
              <img 
                src={showGif ? "/images/travel_right.gif" : "/images/travel_right.png"} 
                alt="여행 명소" 
                className="w-full h-full object-cover transition-opacity duration-500" 
              />
            </div>
            
            {/* 왼쪽 AI 생성 이미지 */}
            <div className="absolute left-[0%] top-[5px] w-[694px] h-[815px] rounded-lg overflow-hidden">
              <img 
                src={showGif ? "/images/travel_left.gif" : "/images/travel_left.png"} 
                alt="여행 명소" 
                className="w-full h-full object-cover transition-opacity duration-500" 
              />
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
                              <button 
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-full border border-blue-500 hover:border-blue-600 transition-all duration-200 flex items-center gap-2 shadow-lg"
                  onClick={() => navigate("/planner/none")}
              >
                <span>직접 일정 만들기</span>
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
                  className="transition-transform group-hover:translate-x-1"
                >
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </button>
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

              {/* 검증 오류 메시지 표시 영역 */}
              {validationErrors.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-red-700 text-sm font-medium mb-1">다음 문제를 해결해주세요:</p>
                      <ul className="text-red-600 text-sm space-y-1">
                        {validationErrors.map((error, index) => (
                          <li key={index} className="flex items-start gap-1">
                            <span className="text-red-400 mt-1">•</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
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
                  <div className="flex flex-col gap-1">
                    <Button 
                      variant="outline" 
                      className="bg-blue-500 hover:bg-blue-600 text-white" 
                      onClick={() => setIsFlightDialogOpen(true)}
                    >
                      항공편 검색
                    </Button>
                    {selectedFlights.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-blue-400 hover:bg-blue-500 text-white text-xs" 
                        onClick={() => setIsFlightDialogOpen(true)}
                      >
                        + 항공편 추가
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button 
                      variant="outline" 
                      className="bg-green-500 hover:bg-green-600 text-white" 
                      onClick={() => setIsAccommodationDialogOpen(true)}
                    >
                      숙박 검색
                    </Button>
                    {selectedAccommodations.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-green-400 hover:bg-green-500 text-white text-xs" 
                        onClick={() => setIsAccommodationDialogOpen(true)}
                      >
                        + 숙박 추가
                      </Button>
                    )}
                  </div>
                </div>

                {/* 선택된 항공편/숙박 요약 카드 */}
                <div className="flex flex-wrap gap-4 w-full">
                  {/* 다중 항공편 표시 */}
                  {selectedFlights.length > 0 && (
                    <div className="w-full">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">선택된 항공편 ({selectedFlights.length}개)</h4>
                      <div className="space-y-2">
                        {selectedFlights.map((flight, index) => (
                          <Card key={flight.id} className="relative p-3 shadow bg-white">
                            {(() => {

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

                              const isRoundTrip = flight.itineraries.length > 1;
                              const outbound = flight.itineraries[0];
                              const outFirst = outbound.segments[0];
                              const outLast = outbound.segments[outbound.segments.length - 1];
                              const outCarrierName =
                                selectedFlightDictionaries?.carriers?.[outFirst.carrierCode] ||
                                outFirst.carrierCode;
                              const outStops = outbound.segments.length - 1;
                              const outStopsText = outStops === 0 ? "직항" : `${outStops}회 경유`;
                              const price = parseInt(flight.price.grandTotal || flight.price.total).toLocaleString();

                              return (
                                <>
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="text-sm font-semibold">
                                      #{index + 1} {isRoundTrip ? "왕복" : "편도"}: {getCityLabel(outFirst.departure.iataCode)} → {getCityLabel(outLast.arrival.iataCode)}
                                    </div>
                                    <div className="text-sm font-bold text-blue-600">{price}원</div>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(outFirst.departure.at).toLocaleDateString('ko-KR')} {new Date(outFirst.departure.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                    <span className="mx-1">→</span>
                                    {new Date(outLast.arrival.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                    <span className="ml-2">{outCarrierName} | {outStopsText}</span>
                                  </div>
                                  
                                  {/* 순서 변경 버튼 */}
                                  <div className="absolute top-2 right-8 flex gap-1">
                                    {index > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => reorderFlights(index, index - 1)}
                                      >
                                        ↑
                                      </Button>
                                    )}
                                    {index < selectedFlights.length - 1 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => reorderFlights(index, index + 1)}
                                      >
                                        ↓
                                      </Button>
                                    )}
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2"
                                    onClick={() => removeFlight(flight.id)}
                                  >
                                    <X className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </>
                              );
                            })()}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 다중 숙박편 표시 */}
                  {selectedAccommodations.length > 0 && (
                    <div className="w-full">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">선택된 숙박편 ({selectedAccommodations.length}개)</h4>
                      <div className="space-y-2">
                        {selectedAccommodations.map((accommodation, index) => (
                          <Card key={`${accommodation.hotel.hotel_id}-${index}`} className="relative p-3 shadow bg-white">
                            {(() => {
                              const { hotel, room } = accommodation;
                              return (
                                <>
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="text-sm font-semibold">
                                      #{index + 1} {hotel.hotel_name_trans || hotel.hotel_name}
                                    </div>
                                    {room.price && (
                                      <div className="text-sm font-bold text-green-600">{room.price.toLocaleString()} {room.currency}</div>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-700">{room.name}</div>
                                  {(() => {
                                    const dIn = accommodation.checkIn ? format(new Date(accommodation.checkIn), 'yyyy/MM/dd') : '';
                                    const dOut = accommodation.checkOut ? format(new Date(accommodation.checkOut), 'yyyy/MM/dd') : '';
                                    return (
                                      <>
                                        <div className="text-xs text-gray-500">체크인 {dIn} {hotel.checkin_from}{hotel.checkin_until !== '정보 없음' ? ` ~ ${hotel.checkin_until}` : ''}</div>
                                        <div className="text-xs text-gray-500 mb-1">체크아웃 {dOut} {hotel.checkout_from !== '정보 없음' ? `${hotel.checkout_from} ~ ` : ''}{hotel.checkout_until}</div>
                                      </>
                                    );
                                  })()}
                                  
                                  {/* 순서 변경 버튼 */}
                                  <div className="absolute top-2 right-8 flex gap-1">
                                    {index > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => reorderAccommodations(index, index - 1)}
                                      >
                                        ↑
                                      </Button>
                                    )}
                                    {index < selectedAccommodations.length - 1 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => reorderAccommodations(index, index + 1)}
                                      >
                                        ↓
                                      </Button>
                                    )}
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2"
                                    onClick={() => removeAccommodation(index)}
                                  >
                                    <X className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </>
                              );
                            })()}
                          </Card>
                        ))}
                      </div>
                    </div>
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
          isMultipleMode={selectedFlights.length > 0} // 이미 항공편이 선택되어 있으면 다중 모드
          selectedFlights={selectedFlights}
          key={isFlightDialogOpen ? 'open' : 'closed'} // 다이얼로그 열릴 때마다 컴포넌트 재생성
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
          isMultipleMode={selectedAccommodations.length > 0} // 이미 숙박편이 선택되어 있으면 다중 모드
          selectedAccommodations={selectedAccommodations}
        />
      </div>
    </div>
  );
};

export default HomePage;
