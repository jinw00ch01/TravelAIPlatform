import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { Box, Button, Typography, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, TextField, Tabs, Tab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SearchPopup from '../components/SearchPopup';
import MapboxComponent from '../components/MapboxComponent';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import AccommodationPlan from '../components/AccommodationPlan';
import FlightPlan from '../components/FlightPlan';
import { travelApi } from '../services/api';
import amadeusApi from '../utils/amadeusApi';
import { format as formatDateFns } from 'date-fns';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CloseIcon from '@mui/icons-material/Close';
import { Divider } from '@mui/material';
import {
    formatPrice,
    formatDuration,
    renderFareDetails,
    renderItineraryDetails
} from '../utils/flightFormatters';

const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props}>{children}</Droppable>;
};

const TravelPlanner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [travelPlans, setTravelPlans] = useState({
    1: {
      title: formatDateFns(new Date(), 'M/d'),
      schedules: []
    }
  });
  const [selectedDay, setSelectedDay] = useState(1);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editSchedule, setEditSchedule] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [dayOrder, setDayOrder] = useState(Object.keys(travelPlans));
  const [sidebarTab, setSidebarTab] = useState('schedule');
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [hotelSearchResults, setHotelSearchResults] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [showMap, setShowMap] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [isDateEditDialogOpen, setIsDateEditDialogOpen] = useState(false);
  const [editTitleMode, setEditTitleMode] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planId, setPlanId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [flightDictionaries, setFlightDictionaries] = useState(null);
  const [selectedFlightForPlannerDialog, setSelectedFlightForPlannerDialog] = useState(null);
  const [isPlannerFlightDetailOpen, setIsPlannerFlightDetailOpen] = useState(false);

  // 메인 영역의 AccommodationPlan 컴포넌트에 대한 ref
  const mainAccommodationPlanRef = useRef(null);
  // 사이드바의 AccommodationPlan 컴포넌트에 대한 ref (필요한 경우 사용)
  const sidebarAccommodationPlanRef = useRef(null);

  // AccommodationPlan의 상태를 부모 컴포넌트로 이동
  const [accommodationFormData, setAccommodationFormData] = useState({
    cityName: '',
    checkIn: new Date(),
    checkOut: new Date(new Date().setDate(new Date().getDate() + 1)),
    adults: '2',
    latitude: null,
    longitude: null
  });

  // --- Lifted State for FlightPlan ---
  const [flightSearchParams, setFlightSearchParams] = useState({
      originSearch: '',
      destinationSearch: '',
      selectedOrigin: null,
      selectedDestination: null,
      departureDate: null,
      returnDate: null,
      adults: 1,
      children: 0,
      infants: 0,
      travelClass: '',
      nonStop: false,
      currencyCode: 'KRW',
      maxPrice: '',
      max: 10,
  });
  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);
  const [flightResults, setFlightResults] = useState([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingFlights, setIsLoadingFlights] = useState(false);
  const [flightError, setFlightError] = useState(null);
  // --- End Lifted State ---

  // --- airportInfoCache 와 loadingAirportInfo 상태를 TravelPlanner로 이동 ---
  const [airportInfoCache, setAirportInfoCache] = useState({});
  const [loadingAirportInfo, setLoadingAirportInfo] = useState(new Set());
  // --- 상태 이동 끝 ---

  // currentPlan을 먼저 선언
  const currentPlan = travelPlans[selectedDay] || { title: '', schedules: [] };

  // 여행 계획 로드 함수 - 외부에서 재사용할 수 있도록 분리
  const loadTravelPlan = async (params = { newest: true }) => {
    console.log('[TravelPlanner] loadTravelPlan 함수 시작', params);
    setIsLoadingPlan(true);
    try {
      console.log('[TravelPlanner] 여행 계획 로드 시작...');
      const data = await travelApi.loadPlan(params);
      console.log('[TravelPlanner] travelApi.loadPlan 응답 데이터:', JSON.stringify(data, null, 2)); // 응답 데이터 상세 로깅

      // 서버에서 이미 처리된 데이터가 있는 경우 (plannerData 필드)
      if (data?.plannerData && Object.keys(data.plannerData).length > 0) {
        console.log('[TravelPlanner] 서버에서 처리된 플래너 데이터 발견');
        setTravelPlans(data.plannerData);
        setDayOrder(Object.keys(data.plannerData));
        setSelectedDay(Object.keys(data.plannerData)[0]);
        
        // 플랜 ID 설정
        if (data.plan && data.plan[0] && data.plan[0].id) {
          setPlanId(data.plan[0].id);
          console.log(`[TravelPlanner] 플랜 ID 설정: ${data.plan[0].id}`);
        }
        
        setIsLoadingPlan(false);
        return; // 여기서 함수 종료
      }

      // 기존 로직: itinerary_schedules를 확인
      if (data?.plan && Array.isArray(data.plan) && data.plan.length > 0 && data.plan[0].itinerary_schedules) {
        console.log('[TravelPlanner] itinerary_schedules 데이터 발견');
        const itinerarySchedules = data.plan[0].itinerary_schedules;
        
        // 항공편 정보 처리
        const flightDetails = data.plan[0].flight_details || [];
        console.log('[TravelPlanner] 항공편 정보 확인:', flightDetails);
        
        if (itinerarySchedules && Object.keys(itinerarySchedules).length > 0) {
          const formattedPlans = {};
          
          Object.keys(itinerarySchedules).forEach(dayKey => {
            const dayPlan = itinerarySchedules[dayKey];
            const date = new Date(startDate);
            date.setDate(date.getDate() + parseInt(dayKey) - 1);
            const dateStr = formatDateFns(date, 'M/d');
            
            // 기존 제목에서 날짜 부분 제거
            const detail = (dayPlan.title || '').replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim();
            const fullTitle = detail ? `${dateStr} ${detail}` : dateStr;
            
            // 일정 목록에 항공편 정보 병합
            let schedules = Array.isArray(dayPlan.schedules) ? [...dayPlan.schedules] : [];
            
            // 항공편 정보 처리 - 일정과 병합
            if (Array.isArray(flightDetails) && flightDetails.length > 0) {
              // 항공편이 표시될 위치 결정 (보통 각 일차의 첫 번째 또는 마지막 일정)
              const departureFlights = flightDetails.filter(flight => flight.type === 'Flight_Departure');
              const returnFlights = flightDetails.filter(flight => flight.type === 'Flight_Return');
              
              // 첫날에 출발 항공편 추가
              if (dayKey === '1' && departureFlights.length > 0) {
                departureFlights.forEach(flight => {
                  const flightSchedule = {
                    id: `${dayKey}-flight-departure-${Math.random().toString(36).substring(7)}`,
                    name: '출발 항공편',
                    time: '08:00', // 기본값
                    address: '공항',
                    category: '항공편',
                    type: 'Flight_Departure',
                    duration: '1시간',
                    notes: '',
                    lat: null,
                    lng: null,
                    flightOfferDetails: {
                      flightOfferData: flight.original_flight_offer || {},
                      departureAirportInfo: flight.departure_airport_details || {},
                      arrivalAirportInfo: flight.arrival_airport_details || {}
                    }
                  };
                  
                  // 항공편의 기본 정보 추출
                  if (flight.original_flight_offer && flight.original_flight_offer.itineraries && 
                      flight.original_flight_offer.itineraries.length > 0) {
                    const firstSegment = flight.original_flight_offer.itineraries[0].segments[0];
                    if (firstSegment) {
                      flightSchedule.time = firstSegment.departure?.at ? 
                        new Date(firstSegment.departure.at).toLocaleTimeString('ko-KR', { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: false 
                        }) : '08:00';
                      
                      if (firstSegment.departure?.iataCode && flight.departure_airport_details) {
                        flightSchedule.address = `${firstSegment.departure.iataCode} 공항`;
                      }
                      
                      // 항공편 정보에서 출발/도착 시간으로 기간 계산
                      if (firstSegment.departure?.at && firstSegment.arrival?.at) {
                        const departureTime = new Date(firstSegment.departure.at);
                        const arrivalTime = new Date(firstSegment.arrival.at);
                        const durationMs = arrivalTime - departureTime;
                        const hours = Math.floor(durationMs / (1000 * 60 * 60));
                        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                        flightSchedule.duration = `${hours}시간 ${minutes}분`;
                      }
                    }
                  }
                  
                  // 일정 앞부분에 추가
                  schedules.unshift(flightSchedule);
                });
              }
              
              // 마지막 날에 귀국 항공편 추가
              const lastDayKey = Math.max(...Object.keys(itinerarySchedules).map(Number)).toString();
              if (dayKey === lastDayKey && returnFlights.length > 0) {
                returnFlights.forEach(flight => {
                  const flightSchedule = {
                    id: `${dayKey}-flight-return-${Math.random().toString(36).substring(7)}`,
                    name: '귀국 항공편',
                    time: '18:00', // 기본값
                    address: '공항',
                    category: '항공편',
                    type: 'Flight_Return',
                    duration: '1시간',
                    notes: '',
                    lat: null,
                    lng: null,
                    flightOfferDetails: {
                      flightOfferData: flight.original_flight_offer || {},
                      departureAirportInfo: flight.departure_airport_details || {},
                      arrivalAirportInfo: flight.arrival_airport_details || {}
                    }
                  };
                  
                  // 항공편의 기본 정보 추출
                  if (flight.original_flight_offer && flight.original_flight_offer.itineraries && 
                      flight.original_flight_offer.itineraries.length > 0) {
                    const itinerary = flight.original_flight_offer.itineraries[0];
                    if (itinerary && itinerary.segments && itinerary.segments.length > 0) {
                      const firstSegment = itinerary.segments[0];
                      if (firstSegment) {
                        flightSchedule.time = firstSegment.departure?.at ? 
                          new Date(firstSegment.departure.at).toLocaleTimeString('ko-KR', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: false 
                          }) : '18:00';
                        
                        if (firstSegment.departure?.iataCode && flight.departure_airport_details) {
                          flightSchedule.address = `${firstSegment.departure.iataCode} 공항`;
                        }
                        
                        // 항공편 정보에서 출발/도착 시간으로 기간 계산
                        if (firstSegment.departure?.at && firstSegment.arrival?.at) {
                          const departureTime = new Date(firstSegment.departure.at);
                          const arrivalTime = new Date(firstSegment.arrival.at);
                          const durationMs = arrivalTime - departureTime;
                          const hours = Math.floor(durationMs / (1000 * 60 * 60));
                          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                          flightSchedule.duration = `${hours}시간 ${minutes}분`;
                        }
                      }
                    }
                  }
                  
                  // 일정 뒷부분에 추가
                  schedules.push(flightSchedule);
                });
              }
            }
            
            formattedPlans[dayKey] = {
              title: fullTitle,
              schedules: schedules
            };
          });
          
          if (Object.keys(formattedPlans).length > 0) {
            console.log('[TravelPlanner] itinerary_schedules 데이터 변환 완료:', formattedPlans);
            setTravelPlans(formattedPlans);
            setDayOrder(Object.keys(formattedPlans));
            setSelectedDay(Object.keys(formattedPlans)[0]);
            
            // 플랜 ID 설정
            if (data.plan[0].plan_id) {
              setPlanId(data.plan[0].plan_id);
              console.log(`[TravelPlanner] 플랜 ID 설정: ${data.plan[0].plan_id}`);
            }
            
            setIsLoadingPlan(false);
            return; // 여기서 함수 종료
          }
        }
      }

      // 이전 방식: AI generated data 파싱
      let itineraryData = null;

      // 1. data.plan[0].plan_data 에서 itinerary 추출 시도 (Standard JS Access)
      if (data?.plan && Array.isArray(data.plan) && data.plan.length > 0) {
        const firstPlanItem = data.plan[0];
        // Check if plan_data and the nested structure exist using standard JS access
        if (firstPlanItem?.plan_data?.candidates && Array.isArray(firstPlanItem.plan_data.candidates) && firstPlanItem.plan_data.candidates.length > 0) {
          console.log('[TravelPlanner] data.plan[0].plan_data 형식 감지 (Standard JS), 파싱 시도...');
          try {
            const candidate = firstPlanItem.plan_data.candidates[0]; // Direct array access
            if (candidate?.content?.parts && Array.isArray(candidate.content.parts) && candidate.content.parts.length > 0) {
              const textContent = candidate.content.parts[0]?.text; // Direct property access
              if (textContent) {
                const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/); // Regex to find the JSON block
                if (jsonMatch && jsonMatch[1]) {
                  console.log('[TravelPlanner] JSON 데이터 추출 성공 (data.plan[0].plan_data)');
                  const parsedData = JSON.parse(jsonMatch[1]);
                  console.log('[TravelPlanner] 파싱된 JSON 데이터 구조:', parsedData);
                  if (parsedData.itinerary) {
                    console.log('[TravelPlanner] itinerary 데이터 확인 (data.plan[0].plan_data)');
                    itineraryData = parsedData.itinerary;
                  } else if (parsedData.days) {
                    console.log('[TravelPlanner] days 형식 데이터 발견');
                    // days 형식 처리 (day_1, day_2, ...)
                    if (Array.isArray(parsedData.days)) {
                      console.log('[TravelPlanner] days 배열 직접 사용');
                      itineraryData = parsedData.days;
                    } else {
                      itineraryData = processNewDaysFormat(parsedData.days);
                    }
                  } else {
                    console.log('[TravelPlanner] 파싱된 JSON에 itinerary/days 없음');
                    // 전체 데이터를 그대로 처리해봄
                    if (parsedData.title && Array.isArray(parsedData.days)) {
                      console.log('[TravelPlanner] 최상위 구조에서 days 배열 발견');
                      itineraryData = parsedData.days;
                    }
                  }
                } else {
                  console.log('[TravelPlanner] textContent에서 JSON 블록 못 찾음:', textContent); // Log content if match fails
                }
              } else {
                console.log('[TravelPlanner] content.parts[0]에 text 없음');
              }
            } else {
              console.log('[TravelPlanner] candidates[0]에 content.parts 없음');
            }
          } catch (parseError) {
            console.error('data.plan[0].plan_data 파싱 실패:', parseError);
          }
        } else {
            console.log('[TravelPlanner] data.plan[0]에 plan_data.candidates 구조 없음');
        }
      }
      
      // 2. (Fallback) 이전 방식: data.candidates 에서 itinerary 추출 시도 (DynamoDB-like format)
      if (!itineraryData && data?.candidates?.L && data.candidates.L.length > 0) {
        console.log('[TravelPlanner] data.candidates 형식 감지 (DynamoDB), 파싱 시도...');
        try {
          const candidateData = data.candidates.L[0].M;
          if (candidateData.content?.M?.parts?.L && candidateData.content.M.parts.L.length > 0) {
            const textContent = candidateData.content.M.parts.L[0].M.text.S;
            const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
              console.log('[TravelPlanner] JSON 데이터 추출 성공 (data.candidates)');
              const parsedData = JSON.parse(jsonMatch[1]);
              console.log('[TravelPlanner] 파싱된 JSON 데이터 구조 (DynamoDB):', parsedData);
              if (parsedData.itinerary) {
                console.log('[TravelPlanner] itinerary 데이터 확인 (data.candidates)');
                itineraryData = parsedData.itinerary;
              } else if (parsedData.days) {
                console.log('[TravelPlanner] days 형식 데이터 발견 (DynamoDB)');
                // days 형식 처리 (day_1, day_2, ...)
                if (Array.isArray(parsedData.days)) {
                  console.log('[TravelPlanner] days 배열 직접 사용 (DynamoDB)');
                  itineraryData = parsedData.days;
                } else {
                  itineraryData = processNewDaysFormat(parsedData.days);
                }
              } else {
                console.log('[TravelPlanner] 파싱된 JSON에 itinerary/days 없음 (DynamoDB)');
                // 전체 데이터를 그대로 처리해봄 
                if (parsedData.title && Array.isArray(parsedData.days)) {
                  console.log('[TravelPlanner] 최상위 구조에서 days 배열 발견 (DynamoDB)');
                  itineraryData = parsedData.days;
                }
              }
            }
          }
        } catch (parseError) {
          console.error('data.candidates 파싱 실패:', parseError);
        }
      }
      
      // 3. (Fallback) 가장 기본적인 planData 또는 plan 배열 확인
      if (!itineraryData) {
        const basicPlanData = data?.planData || data?.plan;
        // Check if it's the plan array itself, not the outer structure
        if (Array.isArray(basicPlanData) && basicPlanData.length > 0 && basicPlanData[0].day) { 
          itineraryData = basicPlanData;
           console.log('[TravelPlanner] 기본 planData/plan 필드 (itinerary 형식) 사용');
        } else {
            console.log('[TravelPlanner] 기본 planData/plan 필드가 itinerary 형식이 아님');
        }
      }

      if (itineraryData && Array.isArray(itineraryData)) {
        console.log('[TravelPlanner] 유효한 itinerary 데이터 수신:', itineraryData);
        
        // 데이터 형식 변환: itinerary 배열 → 일차별 객체 맵핑
        const formattedPlans = {};
        console.log('[TravelPlanner] itinerary 데이터 변환 시작...');
        
        itineraryData.forEach((dayPlan, index) => {
          const dayNumber = (dayPlan.day || index + 1).toString();
          // 날짜 계산
          const date = new Date(startDate);
          date.setDate(date.getDate() + index);
          const dateStr = formatDateFns(date, 'M/d');
          // 상세 제목(기존 title)에서 날짜 부분 제거
          const detail = (dayPlan.title || '').replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim();
          const fullTitle = detail ? `${dateStr} ${detail}` : dateStr;
          let schedules = [];
          
          if (dayPlan.schedules && Array.isArray(dayPlan.schedules)) {
            // Gemini 형식 호환성 (최우선) 
            console.log(`[TravelPlanner] ${dayNumber}일차 schedules 발견 (Gemini 형식)`);
            schedules = dayPlan.schedules.map((schedule, idx) => ({
              id: schedule.id || `${dayNumber}-${idx}`,
              name: schedule.name || '',
              time: schedule.time || '00:00',
              address: schedule.address || '',
              category: schedule.category || '',
              duration: schedule.duration || '1시간',
              notes: schedule.notes || '',
              lat: schedule.lat || null,
              lng: schedule.lng || null,
              cost: schedule.cost || '',
            }));
          } else if (dayPlan.activities && Array.isArray(dayPlan.activities)) {
            console.log(`[TravelPlanner] ${dayNumber}일차 activities 발견`);
            schedules = dayPlan.activities.map((activity, idx) => ({
              id: `${dayNumber}-${idx}`,
              name: activity.title,
              time: activity.time || '00:00',
              address: activity.location || '',
              category: activity.description || '',
              duration: activity.duration || '1시간',
              notes: '',
              lat: activity.latitude || (dayPlan.last_location?.latitude),
              lng: activity.longitude || (dayPlan.last_location?.longitude)
            }));
          } else if (dayPlan.places && Array.isArray(dayPlan.places)) {
            console.log(`[TravelPlanner] ${dayNumber}일차 places 발견`);
            schedules = dayPlan.places.map((place, idx) => ({
              id: `${dayNumber}-${idx}`,
              name: place.title || place.name,
              time: place.time || '00:00',
              address: place.location || place.name || '',
              category: place.category || '',
              duration: place.duration || '1시간',
              notes: place.description || '',
              lat: place.latitude || (dayPlan.hotel?.latitude) || null,
              lng: place.longitude || (dayPlan.hotel?.longitude) || null
            }));
          } else if (Array.isArray(dayPlan)) {
            // 레거시 호환성
            console.log(`[TravelPlanner] ${dayNumber}일차 배열 형식 발견 (레거시)`);
            schedules = dayPlan;
          }
          
          formattedPlans[dayNumber] = {
            title: fullTitle,
            description: dayPlan.description || '',
            schedules: schedules
          };
        });
                
        if (Object.keys(formattedPlans).length > 0) {
          console.log('[TravelPlanner] 상태 업데이트 예정:', formattedPlans);
          setTravelPlans(formattedPlans);
          setDayOrder(Object.keys(formattedPlans));
          setSelectedDay(Object.keys(formattedPlans)[0]);
          
          // 플랜 ID 설정
          if (data.plan && data.plan[0] && data.plan[0].id) {
            setPlanId(data.plan[0].id);
            console.log(`[TravelPlanner] 플랜 ID 설정: ${data.plan[0].id}`);
          }
        } else {
          console.log('[TravelPlanner] 변환된 계획 데이터가 없음');
          // 기본 상태 유지
          setTravelPlans({ 1: { title: '1일차', schedules: [] } });
          setDayOrder(['1']);
          setSelectedDay(1);
        }
      } else {
        console.log('[TravelPlanner] 최종적으로 유효한 itinerary 데이터를 찾지 못함:', data);
        // 기본 상태 유지 또는 초기화 (기존 로직)
        setTravelPlans({ 1: { title: '1일차', schedules: [] } });
        setDayOrder(['1']);
        setSelectedDay(1);
      }
    } catch (error) {
      console.error('[TravelPlanner] 여행 계획 로드 실패:', error);
      
      // 더 구체적인 오류 메시지 제공
      if (error.response) {
        if (error.response.status === 502) {
          alert('서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요. (502 Bad Gateway)');
        } else {
          alert(`여행 계획을 불러오는데 실패했습니다. (HTTP 오류 ${error.response.status})`);
        }
      } else if (error.request) {
        alert('서버에서 응답이 없습니다. 네트워크 연결을 확인해주세요.');
      } else {
        alert('여행 계획을 불러오는데 실패했습니다.');
      }
    } finally {
      setIsLoadingPlan(false);
      console.log('[TravelPlanner] loadTravelPlan 함수 종료');
    }
  };
  
  // 새로운 days 형식 데이터 처리 함수 (day_1, day_2, ...)
  const processNewDaysFormat = (daysData) => {
    if (!daysData) return null;
    
    console.log('[TravelPlanner] processNewDaysFormat - 데이터 구조 확인:', daysData);
    
    // Gemini 형식: days 배열 형태인 경우 직접 반환
    if (Array.isArray(daysData)) {
      console.log('[TravelPlanner] Gemini 형식 - days 배열 형식 감지, 직접 사용');
      return daysData;
    }
    
    // Gemini 형식: 객체 안에 days 배열이 있는 경우
    if (daysData.days && Array.isArray(daysData.days)) {
      console.log('[TravelPlanner] Gemini 형식 - {title, days:[...]} 구조 감지, days 배열 직접 사용');
      return daysData.days;
    }
    
    const result = [];
    
    // 레거시 형식: day_1, day_2 형식의 객체
    const dayKeys = Object.keys(daysData).filter(key => /^day_\d+$/.test(key)).sort((a, b) => {
      const dayA = parseInt(a.split('_')[1]);
      const dayB = parseInt(b.split('_')[1]);
      return dayA - dayB;
    });
    
    if (dayKeys.length > 0) {
      console.log('[TravelPlanner] 레거시 형식 - day_숫자 키 발견:', dayKeys);
      
      dayKeys.forEach(dayKey => {
        const day = parseInt(dayKey.split('_')[1]);
        const dayData = daysData[dayKey];
        
        // 레거시 형식 day_숫자 객체를 days 배열 형식으로 변환
        result.push({
          day,
          title: dayData.title || `${day}일차`,
          date: dayData.date,
          hotel: dayData.hotel,
          places: dayData.places || [] // places 배열 유지
        });
      });
    }
    
    console.log('[TravelPlanner] processNewDaysFormat 처리 결과:', result);
    return result;
  };
  
  // DynamoDB 형식 데이터를 JavaScript 객체로 변환
  const convertFromDynamoDBFormat = (dynamoData) => {
    if (!dynamoData) return {};
    
    const result = {};
    
    // 각 일차 데이터 처리
    Object.keys(dynamoData).forEach(dayKey => {
      if (dynamoData[dayKey] && dynamoData[dayKey].M) {
        const dayData = dynamoData[dayKey].M;
        
        // 일차 제목
        const title = dayData.title && dayData.title.S ? dayData.title.S : `${dayKey}일차`;
        
        // 스케줄 목록
        let schedules = [];
        if (dayData.schedules && dayData.schedules.L) {
          schedules = dayData.schedules.L.map(scheduleItem => {
            const schedule = scheduleItem.M;
            const baseSchedule = {
              id: schedule.id?.S || `${dayKey}-${Math.random().toString(36).substring(7)}`,
              name: schedule.name?.S || '',
              time: schedule.time?.S || '00:00',
              address: schedule.address?.S || '',
              category: schedule.category?.S || '',
              duration: schedule.duration?.S || '1시간',
              notes: schedule.notes?.S || '',
              lat: schedule.lat?.N ? parseFloat(schedule.lat.N) : null,
              lng: schedule.lng?.N ? parseFloat(schedule.lng.N) : null
            };
            
            // 타입 정보가 있으면 추가
            if (schedule.type && schedule.type.S) {
              baseSchedule.type = schedule.type.S;
            }
            
            // 호텔 상세 정보가 있으면 복원
            if (schedule.hotelDetails && schedule.hotelDetails.M) {
              const hotelDetails = schedule.hotelDetails.M;
              baseSchedule.hotelDetails = {
                hotelId: hotelDetails.hotelId?.S || '',
                hotelName: hotelDetails.hotelName?.S || baseSchedule.name,
                price: hotelDetails.price?.S || '',
                rating: hotelDetails.rating?.N ? parseFloat(hotelDetails.rating.N) : 0,
                reviewCount: hotelDetails.reviewCount?.N ? parseInt(hotelDetails.reviewCount.N) : 0,
                amenities: hotelDetails.amenities?.L ? 
                  hotelDetails.amenities.L.map(item => item.S) : 
                  (hotelDetails.amenities?.S ? hotelDetails.amenities.S.split(', ') : []),
                checkin: hotelDetails.checkin?.S || '',
                checkout: hotelDetails.checkout?.S || '',
                // 추가 호텔 정보 필드
                imageUrl: hotelDetails.imageUrl?.S || '',
                address: hotelDetails.address?.S || '',
                description: hotelDetails.description?.S || ''
              };
            }
            
            // 항공편 상세 정보가 있으면 복원
            if (schedule.flightOfferDetails && schedule.flightOfferDetails.M) {
              const flightDetails = schedule.flightOfferDetails.M;
              try {
                baseSchedule.flightOfferDetails = {
                  flightOfferData: flightDetails.flightOfferData?.S ? 
                    JSON.parse(flightDetails.flightOfferData.S) : 
                    (flightDetails.flightOfferData?.M ? extractDynamoDbObject(flightDetails.flightOfferData.M) : {}),
                  departureAirportInfo: flightDetails.departureAirportInfo?.S ? 
                    JSON.parse(flightDetails.departureAirportInfo.S) : 
                    (flightDetails.departureAirportInfo?.M ? extractDynamoDbObject(flightDetails.departureAirportInfo.M) : {}),
                  arrivalAirportInfo: flightDetails.arrivalAirportInfo?.S ? 
                    JSON.parse(flightDetails.arrivalAirportInfo.S) : 
                    (flightDetails.arrivalAirportInfo?.M ? extractDynamoDbObject(flightDetails.arrivalAirportInfo.M) : {})
                };
              } catch (error) {
                console.error(`[TravelPlanner] 항공편 데이터 파싱 실패:`, error);
                baseSchedule.flightOfferDetails = {
                  flightOfferData: {},
                  departureAirportInfo: {},
                  arrivalAirportInfo: {}
                };
              }
            }
            
            return baseSchedule;
          });
        }
        
        // 결과에 추가
        result[dayKey] = {
          title,
          schedules
        };
      }
    });
    
    return result;
  };
  
  // DynamoDB 객체를 일반 JS 객체로 추출하는 헬퍼 함수
  const extractDynamoDbObject = (dynamoObject) => {
    if (!dynamoObject || typeof dynamoObject !== 'object') return {};
    
    const result = {};
    
    Object.keys(dynamoObject).forEach(key => {
      const value = dynamoObject[key];
      
      if (value.S) {
        // 문자열
        result[key] = value.S;
      } else if (value.N) {
        // 숫자
        result[key] = parseFloat(value.N);
      } else if (value.BOOL !== undefined) {
        // 불리언
        result[key] = value.BOOL;
      } else if (value.NULL) {
        // null
        result[key] = null;
      } else if (value.L) {
        // 배열
        result[key] = value.L.map(item => {
          if (item.S) return item.S;
          if (item.N) return parseFloat(item.N);
          if (item.M) return extractDynamoDbObject(item.M);
          if (item.BOOL !== undefined) return item.BOOL;
          return null;
        });
      } else if (value.M) {
        // 객체
        result[key] = extractDynamoDbObject(value.M);
      }
    });
    
    return result;
  };

  // 컴포넌트 마운트 시 최신 여행 계획 로드
  useEffect(() => {
    console.log('[TravelPlanner] 마운트 useEffect 실행됨. 현재 user 상태:', user);

    if (user) { // 로그인된 경우에만 로드
      console.log('[TravelPlanner] user 확인됨. loadTravelPlan 호출 시도 (마운트).');
      loadTravelPlan();
    } else {
      console.log('[TravelPlanner] user 없음. loadTravelPlan 호출 안 함 (마운트).');
    }
  }, [user]); // user가 변경될 때 (로그인/로그아웃 시) 다시 로드

  // F5 키 이벤트 핸들러 추가
  useEffect(() => {
    const handleKeyDown = (event) => {
      // F5 키 코드는 116
      if (event.keyCode === 116) {
        console.log('[TravelPlanner] F5 키 입력 감지');
        event.preventDefault(); // 기본 새로고침 동작 방지
        if (user) {
          console.log('[TravelPlanner] F5 감지: loadTravelPlan 호출 시도');
          loadTravelPlan();
        } else {
          console.log('[TravelPlanner] F5 감지: user 없음, 로드 안 함');
        }
      }
    };

    console.log('[TravelPlanner] F5 이벤트 리스너 등록');
    window.addEventListener('keydown', handleKeyDown);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      console.log('[TravelPlanner] F5 이벤트 리스너 제거');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [user]); // user 상태가 변경될 때 이벤트 리스너 재설정

  // 지도 리사이즈 핸들러 추가
  useEffect(() => {
    const map = document.querySelector('.mapboxgl-map');
    if (map) {
      map.style.transition = 'width 0.3s ease';
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    }
  }, [isSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const getDayTitle = (dayNumber) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayNumber - 1);
    return formatDateFns(date, 'M/d');
  };

  const reorderDays = (plans) => {
    const orderedPlans = {};
    const days = Object.entries(plans)
      .sort(([a], [b]) => parseInt(a) - parseInt(b));

    days.forEach(([_, plan], index) => {
      orderedPlans[index + 1] = {
        ...plan,
        title: getDayTitle(index + 1)
      };
    });

    return orderedPlans;
  };

  const addDay = () => {
    const newDayNumber = Math.max(...Object.keys(travelPlans).map(Number)) + 1;
    const newPlans = {
      ...travelPlans,
      [newDayNumber]: {
        title: getDayTitle(newDayNumber),
        schedules: []
      }
    };
    setTravelPlans(newPlans);
    setDayOrder(prevOrder => [...prevOrder, newDayNumber.toString()]);
  };

  const removeDay = (dayToRemove) => {
    if (Object.keys(travelPlans).length <= 1) {
      alert('최소 하나의 날짜는 유지해야 합니다.');
      return;
    }
    
    // 남은 날짜들을 순서대로 정렬
    const remainingDays = Object.keys(travelPlans)
      .filter(day => day !== dayToRemove.toString())
      .map(Number)
      .sort((a, b) => a - b);

    // 새로운 여행 계획 객체 생성
    const newPlans = {};
    remainingDays.forEach((oldDay, index) => {
      const newDayNumber = index + 1;
      newPlans[newDayNumber] = {
        ...travelPlans[oldDay],
        title: getDayTitle(newDayNumber)
      };
    });

    // 새로운 dayOrder 생성
    const newDayOrder = Object.keys(newPlans);

    // 상태 업데이트
    setTravelPlans(newPlans);
    setDayOrder(newDayOrder);

    // 선택된 날짜 조정
    if (selectedDay === dayToRemove) {
      // 삭제된 날짜가 마지막 날짜였다면 마지막 날짜를 선택
      const newSelectedDay = Math.min(dayToRemove, Object.keys(newPlans).length);
      setSelectedDay(newSelectedDay);
    } else if (selectedDay > dayToRemove) {
      // 삭제된 날짜보다 큰 날짜를 선택중이었다면 하루 앞당김
      setSelectedDay(selectedDay - 1);
    }
  };

  const handleAddPlace = (place) => {
    if (!selectedDay) {
      alert('날짜를 선택해주세요.');
      return;
    }

    const newSchedule = {
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      category: place.category,
      time: '09:00',
      duration: '2시간',
      notes: ''
    };

    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: [...(prev[selectedDay]?.schedules || []), newSchedule]
      }
    }));
  };

  const handleEditSchedule = (schedule) => {
    setEditSchedule(schedule);
    setEditDialogOpen(true);
  };

  const handleUpdateSchedule = () => {
    if (!editSchedule) return;

    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: prev[selectedDay].schedules.map(schedule =>
          schedule.id === editSchedule.id ? editSchedule : schedule
        )
      }
    }));

    setEditDialogOpen(false);
    setEditSchedule(null);
  };

  const handleDeleteSchedule = (scheduleId) => {
    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: prev[selectedDay].schedules.filter(schedule => schedule.id !== scheduleId)
      }
    }));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const daySchedules = [...travelPlans[selectedDay].schedules];
    const [reorderedItem] = daySchedules.splice(source.index, 1);
    daySchedules.splice(destination.index, 0, reorderedItem);

    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: daySchedules
      }
    }));
  };

  // 날짜 순서 변경 핸들러
  const handleDayDragEnd = (result) => {
    if (!result.destination) return;

    const newDayOrder = Array.from(dayOrder);
    const [reorderedDay] = newDayOrder.splice(result.source.index, 1);
    newDayOrder.splice(result.destination.index, 0, reorderedDay);

    // 새로운 순서대로 travelPlans 재정렬 (key와 title 모두 재정렬)
    const newTravelPlans = {};
    newDayOrder.forEach((dayKey, index) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index);
      newTravelPlans[(index + 1).toString()] = {
        ...travelPlans[dayKey],
        title: formatDateFns(date, 'M/d')
      };
    });

    setDayOrder(Object.keys(newTravelPlans));
    setTravelPlans(newTravelPlans);
    // 이동한 날짜에 포커스
    setSelectedDay(result.destination.index + 1);
  };

  // 사이드바에서 장소 선택 시 메인 영역으로 전달
  const handleSidebarPlaceSelect = (place) => {
    if (mainAccommodationPlanRef.current) {
      mainAccommodationPlanRef.current.handlePlaceSelect(place);
    }
  };
  
  // 사이드바에서 검색 버튼 클릭 시 메인 영역으로 전달
  const handleSidebarSearch = () => {
    if (mainAccommodationPlanRef.current) {
      mainAccommodationPlanRef.current.handleSearch();
    }
  };
  
  // 사이드바에서 검색 팝업 열기
  const handleOpenSearchPopup = () => {
    if (mainAccommodationPlanRef.current) {
      mainAccommodationPlanRef.current.openSearchPopup();
    }
  };

  const handleHotelSearchResults = (results) => {
    setHotelSearchResults(results);
  };

  const handleHotelSelect = (hotel) => {
    setSelectedHotel(hotel);
    // 선택된 호텔을 일정에 추가하는 로직
    if (selectedDay) {
      const newSchedule = {
        id: `hotel-${hotel.hotel_id}`,
        name: hotel.hotel_name,
        time: '체크인',
        address: hotel.address,
        category: '숙소',
        duration: '1박',
        notes: `가격: ${hotel.price}`,
        lat: hotel.latitude,
        lng: hotel.longitude
      };

      setTravelPlans(prev => ({
        ...prev,
        [selectedDay]: {
          ...prev[selectedDay],
          schedules: [...(prev[selectedDay]?.schedules || []), newSchedule]
        }
      }));
    }
  };

  // --- Flight Search Handlers ---
  const handleCitySearch = useCallback(async (value, type) => {
    if (!value || value.length < 2) {
        if (type === 'origin') setOriginCities([]);
        else setDestinationCities([]);
        return;
    };

    setIsLoadingCities(true);
    setFlightError(null);
    try {
        const response = await amadeusApi.searchCities(value);
        if (response && response.data && Array.isArray(response.data)) {
            const options = response.data.map(location => ({
                name: location.name,
                iataCode: location.iataCode,
                address: location.address?.cityName || '',
                id: location.id || `${location.iataCode}-${location.name}`
            }));
             if (type === 'origin') setOriginCities(options);
             else setDestinationCities(options);
        } else {
             if (type === 'origin') setOriginCities([]);
             else setDestinationCities([]);
        }
    } catch (err) {
        console.error("City search error:", err);
        setFlightError(err.message || '도시 검색 중 오류 발생');
        if (type === 'origin') setOriginCities([]);
        else setDestinationCities([]);
    } finally {
        setIsLoadingCities(false);
    }
  }, []);

  const handleFlightSearch = useCallback(async () => {
    setFlightError(null);
    setFlightResults([]);
    setFlightDictionaries(null); // 검색 시작 시 초기화

    const {
        selectedOrigin, selectedDestination, departureDate, returnDate,
        adults, children, infants, travelClass,
        nonStop, currencyCode, maxPrice, max
     } = flightSearchParams;

    // Updated Validation with clearer messages
    let missingFields = [];
    if (!selectedOrigin) missingFields.push('출발지');
    if (!selectedDestination) missingFields.push('도착지');
    if (!departureDate) missingFields.push('가는 날짜');
    if (!adults || adults < 1) missingFields.push('성인 수(1명 이상)');

    if (missingFields.length > 0) {
        setFlightError(`${missingFields.join(', ')} 항목을 입력해주세요.`);
        return;
    }
    if (infants > adults) {
        setFlightError('유아 수는 성인 수를 초과할 수 없습니다.');
        return;
    }
     const totalPassengers = (parseInt(adults, 10) || 0) + (parseInt(children, 10) || 0);
     if (totalPassengers > 9) {
          setFlightError('총 탑승객(성인+소아)은 9명을 초과할 수 없습니다.');
          return;
     }

    setIsLoadingFlights(true);
    try {
        const paramsToApi = {
             originCode: selectedOrigin.iataCode,
             destinationCode: selectedDestination.iataCode,
             departureDate: departureDate.toISOString().split('T')[0],
             returnDate: returnDate ? returnDate.toISOString().split('T')[0] : null,
             adults: parseInt(adults, 10),
             ...(children > 0 && { children: parseInt(children, 10) }),
             ...(infants > 0 && { infants: parseInt(infants, 10) }),
             ...(travelClass && { travelClass }),
             ...(nonStop && { nonStop }),
             currencyCode: currencyCode || 'KRW',
             ...(maxPrice && { maxPrice: parseInt(maxPrice, 10) }),
             max: max || 10,
        };

        const response = await amadeusApi.searchFlights(paramsToApi);
        if (response && response.data && Array.isArray(response.data) && response.dictionaries) {
             setFlightResults(response.data);
             setFlightDictionaries(response.dictionaries);
             
             if(response.data.length === 0) {
                 setFlightError('검색 조건에 맞는 항공편이 없습니다.');
             }
        } else if (response && response.data && Array.isArray(response.data) && !response.dictionaries) {
            // dictionaries가 없는 경우 (이전 구조 호환 또는 API 변경)
            setFlightResults(response.data);
            setFlightDictionaries(null); // dictionaries가 없음을 명시
            console.warn("[TravelPlanner] Dictionaries not found in flight search response. Some details might be missing.");
            if(response.data.length === 0) {
                 setFlightError('검색 조건에 맞는 항공편이 없습니다.');
            }
        } else {
            setFlightResults([]);
            setFlightDictionaries(null);
            setFlightError('항공편 검색 결과가 없거나 형식이 올바르지 않습니다.');
            console.log("Unexpected flight search response:", response);
        }
    } catch (err) {
        console.error("Flight search error:", err);
        setFlightError(err.message || '항공편 검색 중 오류 발생');
        setFlightResults([]);
        setFlightDictionaries(null);
    } finally {
        setIsLoadingFlights(false);
    }
  }, [flightSearchParams]);

  // --- End Flight Search Handlers ---

  // 날짜 수정 다이얼로그 열기
  const handleOpenDateEditDialog = () => {
    setIsDateEditDialogOpen(true);
  };

  // 날짜 수정 처리
  const handleDateChange = (newDate) => {
    setStartDate(newDate);
    // 모든 일정의 날짜 업데이트
    const newPlans = {};
    Object.keys(travelPlans).forEach((day, index) => {
      const date = new Date(newDate);
      date.setDate(date.getDate() + index);
      const oldTitle = travelPlans[day].title || '';
      // 날짜(예: 5/10)로 시작하는 부분만 바꾸고, 상세 제목은 유지
      const detail = oldTitle.replace(/^[0-9]{1,2}\/[0-9]{1,2}( |:)?/, '').trim();
      const newTitle = detail ? `${formatDateFns(date, 'M/d')} ${detail}`.trim() : formatDateFns(date, 'M/d');
      newPlans[day] = {
        ...travelPlans[day],
        title: newTitle
      };
    });
    setTravelPlans(newPlans);
    setIsDateEditDialogOpen(false);
  };

  useEffect(() => {
    if (currentPlan && currentPlan.title) {
      setTempTitle(currentPlan.title);
    }
  }, [selectedDay, currentPlan.title]);

  // TravelPlanner 컴포넌트 내부에 저장 함수 추가
  const onSaveTravelPlans = () => {
    // 저장 다이얼로그 열기
    setPlanTitle(''); // 모달 열 때 입력 초기화
    setIsSaveDialogOpen(true);
  };

  // 실제 저장 처리 함수 추가
  const handleSaveConfirm = async () => {
    if (!planTitle.trim()) {
      alert('여행 계획의 제목을 입력해주세요.');
      return;
    }
    
    try {
      setIsSaving(true); // 저장 중 상태 설정
      
      // 저장할 데이터 구성 - 일반 JavaScript 객체 형식
      // days 배열 구성: schedules에 호텔과 항공편 데이터도 포함
      const planData = {
        title: planTitle,
        days: Object.keys(travelPlans).map(day => ({
          day: parseInt(day),
          title: travelPlans[day].title,
          schedules: travelPlans[day].schedules.map(schedule => {
            // 기본 일정 데이터
            const baseSchedule = {
              id: schedule.id || `${day}-${Math.random().toString(36).substring(7)}`,
              name: schedule.name || '',
              time: schedule.time || '00:00',
              address: schedule.address || '',
              category: schedule.category || '',
              duration: schedule.duration || '1시간',
              notes: schedule.notes || '',
              lat: schedule.lat || null,
              lng: schedule.lng || null
            };
            
            // 타입 정보가 있으면 추가
            if (schedule.type) {
              baseSchedule.type = schedule.type;
            }
            
            // 호텔 상세 정보가 있으면 추가
            if (schedule.hotelDetails) {
              baseSchedule.hotelDetails = { ...schedule.hotelDetails };
              
              // 호텔 어매니티가 문자열인 경우 배열로 변환
              if (typeof baseSchedule.hotelDetails.amenities === 'string') {
                baseSchedule.hotelDetails.amenities = baseSchedule.hotelDetails.amenities.split(', ');
              }
              
              // 숫자 필드 확인
              if (baseSchedule.hotelDetails.rating && typeof baseSchedule.hotelDetails.rating === 'string') {
                baseSchedule.hotelDetails.rating = parseFloat(baseSchedule.hotelDetails.rating);
              }
              if (baseSchedule.hotelDetails.reviewCount && typeof baseSchedule.hotelDetails.reviewCount === 'string') {
                baseSchedule.hotelDetails.reviewCount = parseInt(baseSchedule.hotelDetails.reviewCount);
              }
            }
            
            // 항공편 상세 정보가 있으면 추가
            if (schedule.flightOfferDetails) {
              baseSchedule.flightOfferDetails = { ...schedule.flightOfferDetails };
              
              // 항공편 데이터가 문자열로 저장되어 있으면 파싱
              ['flightOfferData', 'departureAirportInfo', 'arrivalAirportInfo'].forEach(field => {
                if (typeof baseSchedule.flightOfferDetails[field] === 'string') {
                  try {
                    baseSchedule.flightOfferDetails[field] = JSON.parse(baseSchedule.flightOfferDetails[field]);
                  } catch (e) {
                    console.warn(`항공편 데이터 파싱 실패 (${field}):`, e);
                  }
                }
              });
            }
            
            return baseSchedule;
          })
        })),
        startDate: formatDateFns(startDate, 'yyyy-MM-dd') // 시작일 포함
      };
      
      console.log('[TravelPlanner] 여행 계획 저장 시도:', planData);
      
      // SavePlanFunction API 호출
      try {
        // travelApi.savePlan 함수 호출 (API Gateway의 /api/travel/save 엔드포인트 호출)
        const response = await travelApi.savePlan(planData);
        
        if (response && response.success) {
          // 응답에서 새로 생성된 ID를 상태에 저장
          if (response.plan_id) {
            setPlanId(response.plan_id);
            console.log(`[TravelPlanner] 새 계획 ID 받음: ${response.plan_id}`);
          }
          
          console.log('[TravelPlanner] 여행 계획 저장 성공:', response);
          
          // 로컬스토리지에도 저장 (백업 또는 오프라인 지원)
          const storageData = {
            planData: planData,
            planId: response.plan_id, // 서버에서 받은 ID 사용
            lastSaved: new Date().toISOString()
          };
          localStorage.setItem('savedTravelPlan', JSON.stringify(storageData));
          
          alert(response.message || '여행 계획이 성공적으로 저장되었습니다!');
        } else {
          throw new Error(response.message || '서버 응답이 올바르지 않습니다.');
        }
      } catch (apiError) {
        console.error('[TravelPlanner] 서버 저장 실패:', apiError);
        
        // API 실패 시에도 로컬 저장 시도
        const storageData = {
          planData: planData,
          planId, // 있는 경우에만 ID 포함
          lastSaved: new Date().toISOString(),
          isLocalOnly: true // 로컬에만 저장됨을 표시
        };
        localStorage.setItem('savedTravelPlan', JSON.stringify(storageData));
        
        alert('서버 저장에 실패했습니다. 계획은 기기에만 저장되었습니다.');
      }
    } catch (error) {
      console.error('여행 계획 저장 실패:', error);
      alert('여행 계획 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
      setIsSaveDialogOpen(false);
    }
  };

  // startDate가 변경될 때 숙소 계획의 checkIn, checkOut도 동기화
  useEffect(() => {
    const checkIn = startDate;
    const checkOut = new Date(startDate);
    checkOut.setDate(checkOut.getDate() + 1);
    setAccommodationFormData(prev => ({
      ...prev,
      checkIn,
      checkOut
    }));
  }, [startDate]);

  // --- 날짜 동기화를 위한 useEffect --- 
  useEffect(() => {
    if (startDate && Object.keys(travelPlans).length > 0) {
      const currentTravelStartDate = startDate;
      
      // 여행 마지막 날짜 계산
      const numberOfDays = Object.keys(travelPlans).length;
      const currentTravelEndDate = new Date(startDate);
      if (numberOfDays > 0) { // 최소 1일 이상일 때만 계산
        currentTravelEndDate.setDate(startDate.getDate() + numberOfDays - 1);
      }

      // 비행 계획의 날짜가 (1) 아직 설정되지 않았거나 
      // (2) 현재 여행 계획의 시작/종료일과 다를 경우 업데이트
      // 이렇게 하면 사용자가 비행 계획 탭에서 직접 날짜를 바꾼 경우는 유지하려고 시도합니다.
      // 하지만 여행 계획 탭에서 날짜를 바꾸면, 그 변경이 우선시되어 비행 계획 날짜도 바뀔 수 있습니다.
      const shouldUpdateDeparture = !flightSearchParams.departureDate || flightSearchParams.departureDate.getTime() !== currentTravelStartDate.getTime();
      const shouldUpdateReturn = numberOfDays > 0 && (!flightSearchParams.returnDate || flightSearchParams.returnDate.getTime() !== currentTravelEndDate.getTime());
      const isOneDayTripForFlight = numberOfDays === 1; // 여행 기간이 하루일 경우 비행계획의 returnDate는 null로

      if (shouldUpdateDeparture || (numberOfDays > 0 && shouldUpdateReturn) || (isOneDayTripForFlight && flightSearchParams.returnDate !== null) ) {
        console.log('[TravelPlanner] Syncing dates from Travel Plan to Flight Plan.');
        console.log('Travel Start:', currentTravelStartDate, 'Travel End:', currentTravelEndDate);
        setFlightSearchParams(prevParams => ({
          ...prevParams,
          departureDate: currentTravelStartDate,
          // 여행 기간이 하루면 returnDate는 null (편도 간주), 아니면 계산된 종료일
          returnDate: numberOfDays > 1 ? currentTravelEndDate : null 
        }));
      }
    }
  }, [startDate, travelPlans, setFlightSearchParams]); // flightSearchParams를 의존성에 넣으면 무한루프 가능성 있어 제외
  // --- 날짜 동기화 useEffect 끝 ---

  // --- 공항 정보 로딩 useEffect (FlightPlan에서 가져옴) ---
  useEffect(() => {
    if (!flightResults || flightResults.length === 0) {
        setAirportInfoCache({}); 
        setLoadingAirportInfo(new Set());
        return; 
    }

    const uniqueIataCodes = new Set();
    flightResults.forEach(flight => {
        flight.itineraries.forEach(itinerary => {
            itinerary.segments.forEach(segment => {
                if (segment.departure?.iataCode) uniqueIataCodes.add(segment.departure.iataCode);
                if (segment.arrival?.iataCode) uniqueIataCodes.add(segment.arrival.iataCode);
                if (segment.stops) {
                    segment.stops.forEach(stop => { if (stop.iataCode) uniqueIataCodes.add(stop.iataCode); });
                }
            });
        });
    });

    const codesToFetch = [...uniqueIataCodes].filter(code => code && !airportInfoCache[code] && !(loadingAirportInfo && loadingAirportInfo.has(code)));

    if (codesToFetch.length > 0) {
        setLoadingAirportInfo(prev => new Set([...prev, ...codesToFetch]));
        
        const fetchPromises = codesToFetch.map(iataCode => 
            amadeusApi.getAirportDetails(iataCode).then(info => ({ [iataCode]: info || { warning: 'Failed to fetch details'} }))
        );

        Promise.all(fetchPromises).then(results => {
            const newCacheEntries = results.reduce((acc, current) => ({ ...acc, ...current }), {});
            setAirportInfoCache(prevCache => ({ ...prevCache, ...newCacheEntries }));
            setLoadingAirportInfo(prev => {
                const next = new Set(prev);
                codesToFetch.forEach(code => next.delete(code));
                return next;
            });
        });
    }
  }, [flightResults]); // flightResults가 변경될 때 실행
 // --- 공항 정보 로딩 useEffect 끝 ---

  const handleAddFlightToSchedule = useCallback((flightOffer, dictionaries, currentAirportCache) => {
    console.log('[TravelPlanner] Adding flight to schedule:', flightOffer, dictionaries, currentAirportCache);
    if (!flightOffer || !flightOffer.itineraries || flightOffer.itineraries.length === 0) {
      console.error('Invalid flightOffer data for adding to schedule');
      return;
    }
    const newSchedules = {};
    const isRoundTrip = flightOffer.itineraries.length > 1;
    const outboundItinerary = flightOffer.itineraries[0];
    const outboundLastSegment = outboundItinerary.segments[outboundItinerary.segments.length - 1];
    const outboundArrivalAirportInfo = currentAirportCache?.[outboundLastSegment.arrival.iataCode];
    
    const departureSchedule = {
      id: `flight-departure-${flightOffer.id}-${Date.now()}`,
      name: `${outboundItinerary.segments[0].departure.iataCode} → ${outboundLastSegment.arrival.iataCode} 항공편`,
      time: new Date(outboundLastSegment.arrival.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      address: currentAirportCache?.[outboundLastSegment.arrival.iataCode]?.koreanFullName || currentAirportCache?.[outboundLastSegment.arrival.iataCode]?.name || outboundLastSegment.arrival.iataCode,
      category: '항공편',
      type: 'Flight_Departure',
      duration: formatDuration(outboundItinerary.duration),
      notes: `가격: ${formatPrice(flightOffer.price.grandTotal || flightOffer.price.total, flightOffer.price.currency)}`,
      lat: outboundArrivalAirportInfo?.geoCode?.latitude || dictionaries?.locations?.[outboundLastSegment.arrival.iataCode]?.geoCode?.latitude || null,
      lng: outboundArrivalAirportInfo?.geoCode?.longitude || dictionaries?.locations?.[outboundLastSegment.arrival.iataCode]?.geoCode?.longitude || null,
      flightOfferDetails: { 
        flightOfferData: flightOffer,
        departureAirportInfo: currentAirportCache?.[outboundItinerary.segments[0].departure.iataCode],
        arrivalAirportInfo: outboundArrivalAirportInfo,
      }
    };
    const firstDayKey = dayOrder[0] || '1';
    newSchedules[firstDayKey] = {
      ...travelPlans[firstDayKey],
      schedules: [departureSchedule, ...(travelPlans[firstDayKey]?.schedules || [])]
    };
    if (isRoundTrip && flightOffer.itineraries.length > 1) {
      const inboundItinerary = flightOffer.itineraries[1];
      const inboundFirstSegment = inboundItinerary.segments[0];
      const inboundDepartureAirportInfo = currentAirportCache?.[inboundFirstSegment.departure.iataCode];
      const returnSchedule = {
        id: `flight-return-${flightOffer.id}-${Date.now()}`,
        name: `${inboundFirstSegment.departure.iataCode} → ${inboundItinerary.segments[inboundItinerary.segments.length - 1].arrival.iataCode} 항공편`,
        time: new Date(inboundFirstSegment.departure.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        address: currentAirportCache?.[inboundFirstSegment.departure.iataCode]?.koreanFullName || currentAirportCache?.[inboundFirstSegment.departure.iataCode]?.name || inboundFirstSegment.departure.iataCode,
        category: '항공편',
        type: 'Flight_Return',
        duration: formatDuration(inboundItinerary.duration),
        notes: `가격: ${formatPrice(flightOffer.price.grandTotal || flightOffer.price.total, flightOffer.price.currency)}`,
        lat: inboundDepartureAirportInfo?.geoCode?.latitude || dictionaries?.locations?.[inboundFirstSegment.departure.iataCode]?.geoCode?.latitude || null,
        lng: inboundDepartureAirportInfo?.geoCode?.longitude || dictionaries?.locations?.[inboundFirstSegment.departure.iataCode]?.geoCode?.longitude || null,
        flightOfferDetails: { 
          flightOfferData: flightOffer,
          departureAirportInfo: inboundDepartureAirportInfo,
          arrivalAirportInfo: currentAirportCache?.[inboundItinerary.segments[inboundItinerary.segments.length - 1].arrival.iataCode],
        }
      };
      const lastDayKey = dayOrder[dayOrder.length - 1] || '1';
      if (firstDayKey === lastDayKey) {
         newSchedules[lastDayKey] = {
            ...(newSchedules[lastDayKey] || travelPlans[lastDayKey]),
            schedules: [...(newSchedules[lastDayKey]?.schedules || travelPlans[lastDayKey]?.schedules || []), returnSchedule]
        };
      } else {
        newSchedules[lastDayKey] = {
            ...(travelPlans[lastDayKey]),
            schedules: [...(travelPlans[lastDayKey]?.schedules || []), returnSchedule]
        };
      }
    }
    setTravelPlans(prevPlans => ({
      ...prevPlans,
      ...newSchedules
    }));
    alert('항공편이 여행 계획에 추가되었습니다!');
  }, [travelPlans, dayOrder, setTravelPlans]);

  // --- 여행 계획 탭에서 항공편 클릭 시 상세 보기 핸들러 ---
  const handleOpenPlannerFlightDetail = useCallback((flightScheduleItem) => {
    if (flightScheduleItem?.flightOfferDetails?.flightOfferData) {
      setSelectedFlightForPlannerDialog(flightScheduleItem.flightOfferDetails);
      setIsPlannerFlightDetailOpen(true);
    } else {
      console.warn('Flight detail not found in schedule item:', flightScheduleItem);
    }
  }, []);

  const handleClosePlannerFlightDetail = useCallback(() => {
    setIsPlannerFlightDetailOpen(false);
    setSelectedFlightForPlannerDialog(null);
  }, []);
  // --- 여행 계획 탭 항공편 상세 보기 끝 ---

  if (!user) return null;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        {/* 사이드바 */}
        <Box
          sx={{
            width: isSidebarOpen ? '350px' : '0',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            overflow: 'hidden',
            transition: 'width 0.3s ease',
            bgcolor: 'background.paper',
            boxShadow: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ 
            width: '350px',
            visibility: isSidebarOpen ? 'visible' : 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            {/* 사이드바 헤더 */}
            <Box sx={{ 
              p: 2, 
              borderBottom: 1, 
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Typography variant="h6" noWrap>여행 플래너</Typography>
              <IconButton onClick={toggleSidebar}>
                <span className="text-2xl">☰</span>
              </IconButton>
            </Box>

            {/* 사이드바 탭 */}
            <Tabs
              value={sidebarTab}
              onChange={(e, newValue) => setSidebarTab(newValue)}
              variant="fullWidth"
              className="border-b border-gray-200 flex-shrink-0"
            >
              <Tab label="여행 계획" value="schedule" />
              <Tab label="숙소 계획" value="accommodation" />
              <Tab label="비행 계획" value="flight" />
            </Tabs>

            {/* 사이드바 컨텐츠 */}
            <div className="flex-1 overflow-y-auto">
              {sidebarTab === 'schedule' && (
                <>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={addDay}
                      fullWidth
                    >
                      날짜 추가
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleOpenDateEditDialog}
                    >
                      시작일 수정
                    </Button>
                  </Box>
                  <DragDropContext onDragEnd={handleDayDragEnd}>
                    <StrictModeDroppable droppableId="days" direction="vertical">
                      {(provided, snapshot) => (
                        <Box
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1
                          }}
                        >
                          {dayOrder.map((dayKey, index) => (
                            <Draggable key={`day-${dayKey}`} draggableId={`day-${dayKey}`} index={index}>
                              {(providedDraggable) => (
                                <Paper
                                  ref={providedDraggable.innerRef}
                                  {...providedDraggable.draggableProps}
                                  {...providedDraggable.dragHandleProps}
                                  sx={{
                                    p: 1.5, cursor: 'pointer',
                                    bgcolor: selectedDay === parseInt(dayKey) ? 'primary.light' : 'background.paper',
                                    border: selectedDay === parseInt(dayKey) ? 2 : 1,
                                    borderColor: selectedDay === parseInt(dayKey) ? 'primary.main' : 'divider',
                                    boxShadow: providedDraggable.isDragging ? 6 : 1,
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                  }}
                                  onClick={() => setSelectedDay(parseInt(dayKey))}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <DragIndicatorIcon sx={{ mr: 1, color: 'action.active' }} />
                                    <Typography variant="subtitle1">{travelPlans[dayKey]?.title || getDayTitle(parseInt(dayKey))}</Typography>
                                  </Box>
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeDay(parseInt(dayKey)); }}>
                                    <DeleteIcon />
                                  </IconButton>
                                </Paper>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </Box>
                      )}
                    </StrictModeDroppable>
                  </DragDropContext>
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={onSaveTravelPlans}
                      sx={{ mt: 2 }}
                    >
                      저장
                    </Button>
                  </Box>
                </>
              )}

              {sidebarTab === 'accommodation' && (
                <Box sx={{ p: 2 }}>
                  <AccommodationPlan 
                    onPlaceSelect={handleSidebarPlaceSelect}
                    onSearch={handleSidebarSearch}
                    onOpenSearchPopup={handleOpenSearchPopup}
                    onSearchResults={handleHotelSearchResults}
                    onHotelSelect={handleHotelSelect}
                    ref={sidebarAccommodationPlanRef}
                    formData={accommodationFormData}
                    setFormData={setAccommodationFormData}
                  />
                </Box>
              )}

              {sidebarTab === 'flight' && (
                <FlightPlan
                  fullWidth={false}
                  searchParams={flightSearchParams}
                  setSearchParams={setFlightSearchParams}
                  originCities={originCities}
                  destinationCities={destinationCities}
                  handleCitySearch={handleCitySearch}
                  flights={flightResults}
                  dictionaries={flightDictionaries}
                  airportInfoCache={airportInfoCache}
                  loadingAirportInfo={loadingAirportInfo}
                  isLoadingCities={isLoadingCities}
                  isLoadingFlights={isLoadingFlights}
                  error={flightError}
                  handleFlightSearch={handleFlightSearch}
                  onAddFlightToSchedule={handleAddFlightToSchedule}
                />
              )}
            </div>
          </Box>
        </Box>

        {/* 메인 컨텐츠 */}
        <Box sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left 0.3s ease',
        }}>
          {/* 상단 바 */}
          <Box sx={{ 
            bgcolor: 'background.paper',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider'
          }}>
            <Button
              variant="outlined"
              onClick={toggleSidebar}
              startIcon={<span className="text-xl">☰</span>}
              sx={{ mr: 2 }}
            >
              메뉴
            </Button>
            <Typography variant="h6">
              {sidebarTab === 'schedule' ? '여행 일정' : 
               sidebarTab === 'accommodation' ? '숙소 검색 결과' : 
               '항공편 검색 결과'}
            </Typography>
          </Box>

          {/* Main Content Area */}
          <Box sx={{ flex: 1, p: 2, overflow: 'hidden', bgcolor: '#f4f6f8' }}>
            {sidebarTab === 'schedule' ? (
               selectedDay && currentPlan ? (
                 <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                   {/* Schedule Details + Map */}
                   <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      {/* 대표 제목(상세 제목) 수정 UI */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {editTitleMode ? (
                          <TextField
                            value={tempTitle}
                            onChange={e => setTempTitle(e.target.value)}
                            onBlur={() => {
                              setTravelPlans(prev => ({
                                ...prev,
                                [selectedDay]: {
                                  ...prev[selectedDay],
                                  title: tempTitle
                                }
                              }));
                              setEditTitleMode(false);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                setTravelPlans(prev => ({
                                  ...prev,
                                  [selectedDay]: {
                                    ...prev[selectedDay],
                                    title: tempTitle
                                  }
                                }));
                                setEditTitleMode(false);
                              }
                            }}
                            size="small"
                            sx={{ minWidth: 220 }}
                            autoFocus
                          />
                        ) : (
                          <>
                            <Typography variant="h5" sx={{ mr: 1 }}>{currentPlan.title}</Typography>
                            <IconButton size="small" onClick={() => setEditTitleMode(true)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                      {/* 버튼 세 개를 한 줄에 배치: 전체 마커 보기 → 지도 숨기기 → 장소 검색 순 */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant={showAllMarkers ? "contained" : "outlined"}
                          color="primary"
                          onClick={() => setShowAllMarkers(!showAllMarkers)}
                        >
                          {showAllMarkers ? "현재 날짜 마커만 보기" : "전체 날짜 마커 보기"}
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => setShowMap(v => !v)}>
                          {showMap ? '지도 숨기기' : '지도 보이기'}
                        </Button>
                        <Button variant="contained" startIcon={<SearchIcon />} onClick={() => setIsSearchOpen(true)}>
                          장소 검색
                        </Button>
                      </Box>
                   </Box>
                   <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: showMap ? { xs: '1fr', md: '1fr 1fr' } : '1fr', gap: 2, overflow: 'hidden' }}>
                      {/* Schedule List */}
                      <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, p: 2, overflow: 'auto' }}>
                         <Typography variant="h6" sx={{ mb: 2 }}>일정 목록</Typography>
                         <DragDropContext onDragEnd={handleDragEnd}>
                             <StrictModeDroppable droppableId="schedules">
                               {(providedList) => (
                                 <List ref={providedList.innerRef} {...providedList.droppableProps} sx={{ minHeight: '100px', bgcolor: providedList.isDraggingOver ? 'action.hover' : 'transparent', transition: 'background-color 0.2s ease', '& > *:not(:last-child)': { mb: 1 } }}>
                                   {currentPlan.schedules.map((schedule, index) => (
                                     <Draggable key={schedule.id || `schedule-${index}`} draggableId={schedule.id || `schedule-${index}`} index={index}>
                                       {(providedItem) => (
                                         <ListItem 
                                            ref={providedItem.innerRef} 
                                            {...providedItem.draggableProps} 
                                            onClick={() => (schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return') && handleOpenPlannerFlightDetail(schedule)}
                                            sx={{ 
                                                p: 2, 
                                                bgcolor: schedule.type?.startsWith('Flight') ? '#e3f2fd' : (schedule.type === 'accommodation' ? '#fff0e6' : 'background.paper'), 
                                                borderRadius: 1, border: 1, borderColor: 'divider', 
                                                '&:hover': { bgcolor: 'action.hover', cursor: (schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return') ? 'pointer' : 'grab' }, 
                                            }}
                                            secondaryAction={
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); handleEditSchedule(schedule); }} sx={{ mr: 1 }}>
                                                        <EditIcon />
                                                    </IconButton>
                                                    <IconButton edge="end" aria-label="delete" onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(schedule.id); }}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Box>
                                            }
                                            >
                                           <div {...providedItem.dragHandleProps} style={{ marginRight: 8, cursor: 'grab' }}>
                                             <DragIndicatorIcon color="action" />
                                           </div>
                                           <ListItemText
                                             primary={
                                               <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                 <Typography variant="subtitle1">
                                                   {schedule.time}
                                                 </Typography>
                                                 <Typography variant="subtitle1" sx={{ ml: 2 }}>
                                                   {schedule.name}
                                                 </Typography>
                                               </Box>
                                             }
                                             secondary={
                                               <React.Fragment>
                                                 <Typography component="span" variant="body2" color="text.primary">
                                                   {schedule.address}
                                                 </Typography>
                                                 <br />
                                                 <Typography component="span" variant="body2" color="text.secondary">
                                                   {schedule.category}
                                                   {schedule.duration && ` • ${schedule.duration}`}
                                                 </Typography>
                                               </React.Fragment>
                                             }
                                           />
                                         </ListItem>
                                       )}
                                     </Draggable>
                                   ))}
                                   {providedList.placeholder}
                                 </List>
                               )}
                             </StrictModeDroppable>
                         </DragDropContext>
                      </Box>
                      {/* Map */}
                      {showMap && (
                        <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, overflow: 'hidden', height: '100%' }}>
                          <MapboxComponent selectedPlace={null} travelPlans={travelPlans} selectedDay={selectedDay} showAllMarkers={showAllMarkers}/>
                        </Box>
                      )}
                   </Box>
                 </Box>
               ) : ( 
                 <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Typography variant="h6" color="text.secondary">날짜를 선택해주세요</Typography>
                 </Box>
               )
            ) : 
            sidebarTab === 'accommodation' ? (
               <Box sx={{ height: '100%', overflow: 'hidden' }}>
                  <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1, boxShadow: 1, overflow: 'auto', height: '100%' }}>
                       <AccommodationPlan displayInMain={true} ref={mainAccommodationPlanRef} formData={accommodationFormData} setFormData={setAccommodationFormData} travelPlans={travelPlans} setTravelPlans={setTravelPlans}/>
                  </Box>
               </Box>
             ) : 
             sidebarTab === 'flight' ? (
               <FlightPlan 
                 fullWidth={true} 
                 flights={flightResults} 
                 dictionaries={flightDictionaries}
                 airportInfoCache={airportInfoCache}
                 loadingAirportInfo={loadingAirportInfo}
                 isLoadingFlights={isLoadingFlights} 
                 error={flightError} 
                 onAddFlightToSchedule={handleAddFlightToSchedule}
                 searchParams={flightSearchParams} 
                 setSearchParams={setFlightSearchParams} 
                 originCities={originCities} 
                 destinationCities={destinationCities} 
                 handleCitySearch={handleCitySearch} 
                 isLoadingCities={isLoadingCities} 
                 handleFlightSearch={handleFlightSearch} />
             ) : (
                <Box sx={{ height: '100%', overflow: 'hidden' }}>
                  <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1, boxShadow: 1, overflow: 'auto', height: '100%' }}>
                       <AccommodationPlan displayInMain={true} ref={mainAccommodationPlanRef} formData={accommodationFormData} setFormData={setAccommodationFormData} travelPlans={travelPlans} setTravelPlans={setTravelPlans}/>
                  </Box>
               </Box>
             )
            } 
          </Box>
        </Box>

        {/* Dialogs */}
         <Dialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)} maxWidth="md" fullWidth>
             <DialogTitle>장소 검색</DialogTitle>
             <DialogContent><SearchPopup onSelect={handleAddPlace} onClose={() => setIsSearchOpen(false)} /></DialogContent>
         </Dialog>
         <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
             <DialogTitle>일정 수정</DialogTitle>
             <DialogContent>
                 {editSchedule && ( <Box sx={{ pt: 2 }}>
                   <TextField fullWidth label="이름" value={editSchedule.name} onChange={e => setEditSchedule({ ...editSchedule, name: e.target.value })} sx={{ mb: 2 }} />
                   <TextField fullWidth label="주소" value={editSchedule.address} onChange={e => setEditSchedule({ ...editSchedule, address: e.target.value })} sx={{ mb: 2 }} />
                   <TextField fullWidth label="카테고리" value={editSchedule.category} onChange={e => setEditSchedule({ ...editSchedule, category: e.target.value })} sx={{ mb: 2 }} />
                   <TextField fullWidth label="시간" value={editSchedule.time} onChange={e => setEditSchedule({ ...editSchedule, time: e.target.value })} sx={{ mb: 2 }} />
                   <TextField fullWidth label="소요 시간" value={editSchedule.duration} onChange={e => setEditSchedule({ ...editSchedule, duration: e.target.value })} sx={{ mb: 2 }} />
                   <TextField fullWidth multiline rows={4} label="메모" value={editSchedule.notes} onChange={e => setEditSchedule({ ...editSchedule, notes: e.target.value })} />
                 </Box> )}
             </DialogContent>
             <DialogActions>
                 <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
                 <Button onClick={handleUpdateSchedule} variant="contained">저장</Button>
             </DialogActions>
         </Dialog>

         {/* 날짜 수정 다이얼로그 수정 */}
         <Dialog open={isDateEditDialogOpen} onClose={() => setIsDateEditDialogOpen(false)}>
           <DialogTitle>여행 시작일 수정</DialogTitle>
           <DialogContent>
             <Box sx={{ pt: 2 }}>
               <DatePicker
                 label="시작일"
                 value={startDate}
                 onChange={handleDateChange}
                 slotProps={{ textField: { fullWidth: true } }}
               />
             </Box>
           </DialogContent>
           <DialogActions>
             <Button onClick={() => setIsDateEditDialogOpen(false)}>취소</Button>
           </DialogActions>
         </Dialog>

         {/* 저장 다이얼로그 추가 */}
         <Dialog open={isSaveDialogOpen} onClose={() => !isSaving && setIsSaveDialogOpen(false)}>
           <DialogTitle>여행 계획 저장</DialogTitle>
           <DialogContent>
             <Box sx={{ pt: 2 }}>
               <TextField
                 autoFocus
                 fullWidth
                 label="여행 계획 제목"
                 value={planTitle}
                 onChange={e => setPlanTitle(e.target.value)}
                 placeholder="예: 3박 4일 도쿄 여행"
                 sx={{ mb: 2 }}
                 disabled={isSaving}
               />
             </Box>
           </DialogContent>
           <DialogActions>
             <Button onClick={() => setIsSaveDialogOpen(false)} disabled={isSaving}>취소</Button>
             <Button 
               onClick={handleSaveConfirm} 
               variant="contained"
               disabled={isSaving}
               startIcon={isSaving ? <span className="loading-spinner" /> : null}
             >
               {isSaving ? '저장 중...' : '저장'}
             </Button>
           </DialogActions>
         </Dialog>

         {/* 여행 계획 탭에서 항공편 상세를 보기 위한 Dialog */}
         {selectedFlightForPlannerDialog && (
            <Dialog 
                open={isPlannerFlightDetailOpen} 
                onClose={handleClosePlannerFlightDetail} 
                fullWidth 
                maxWidth="md"
                scroll="paper"
            >
                <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    항공편 상세 정보 (여행 계획)
                    <IconButton aria-label="close" onClick={handleClosePlannerFlightDetail} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedFlightForPlannerDialog.flightOfferData.itineraries.map((itinerary, index) => (
                        <React.Fragment key={`planner-detail-itinerary-${index}`}>
                            {index > 0 && <Divider sx={{ my:2 }} />}
                            {renderItineraryDetails(
                                itinerary, 
                                selectedFlightForPlannerDialog.flightOfferData.id, 
                                flightDictionaries, 
                                selectedFlightForPlannerDialog.flightOfferData.itineraries.length > 1 ? (index === 0 ? "가는 여정" : "오는 여정") : "여정 상세 정보", 
                                airportInfoCache, 
                                loadingAirportInfo
                            )}
                        </React.Fragment>
                    ))}
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt:2 }}>가격 및 요금 정보</Typography>
                    <Typography variant="caption" display="block">총액 (1인): {formatPrice(selectedFlightForPlannerDialog.flightOfferData.price.grandTotal || selectedFlightForPlannerDialog.flightOfferData.price.total, selectedFlightForPlannerDialog.flightOfferData.price.currency)}</Typography>
                    <Typography variant="caption" display="block">기본 운임: {formatPrice(selectedFlightForPlannerDialog.flightOfferData.price.base, selectedFlightForPlannerDialog.flightOfferData.price.currency)}</Typography>
                    {selectedFlightForPlannerDialog.flightOfferData.price.fees && selectedFlightForPlannerDialog.flightOfferData.price.fees.length > 0 && (
                        <Typography variant="caption" display="block">수수료: 
                            {selectedFlightForPlannerDialog.flightOfferData.price.fees.map(fee => `${fee.type}: ${formatPrice(fee.amount, selectedFlightForPlannerDialog.flightOfferData.price.currency)}`).join(', ')}
                        </Typography>
                    )}
                    {selectedFlightForPlannerDialog.flightOfferData.price.taxes && selectedFlightForPlannerDialog.flightOfferData.price.taxes.length > 0 && (
                            <Typography variant="caption" display="block">세금: 
                            {selectedFlightForPlannerDialog.flightOfferData.price.taxes.map(tax => `${tax.code}: ${formatPrice(tax.amount, selectedFlightForPlannerDialog.flightOfferData.price.currency)}`).join(', ')}
                        </Typography>
                    )}
                     <Typography variant="caption" display="block">
                        마지막 발권일: {selectedFlightForPlannerDialog.flightOfferData.lastTicketingDate ? new Date(selectedFlightForPlannerDialog.flightOfferData.lastTicketingDate).toLocaleDateString('ko-KR') : '-'}
                        , 예약 가능 좌석: {selectedFlightForPlannerDialog.flightOfferData.numberOfBookableSeats || '-'}석
                    </Typography>
                    {renderFareDetails(selectedFlightForPlannerDialog.flightOfferData.travelerPricings, flightDictionaries)}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClosePlannerFlightDetail}>닫기</Button>
                </DialogActions>
            </Dialog>
         )}
      </Box>
    </LocalizationProvider>
  );
};

export default TravelPlanner;
