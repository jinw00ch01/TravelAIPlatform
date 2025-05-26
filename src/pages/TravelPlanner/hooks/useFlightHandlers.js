import { useState, useCallback, useEffect } from 'react';
import amadeusApi from '../../../utils/amadeusApi';
import { formatPrice, formatDuration } from '../../../utils/flightFormatters'; 
import { format as formatDateFns } from 'date-fns';

const useFlightHandlers = () => {
  const [flightSearchParams, setFlightSearchParams] = useState({
    selectedOrigin: null,
    selectedDestination: null,
    departureDate: null,
    returnDate: null,
    adults: 1,
    children: 0,
    infants: 0,
    travelClass: 'ECONOMY',
    nonStop: false,
    currencyCode: 'KRW',
    maxPrice: '',
    max: 10
  });

  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);
  const [flightResults, setFlightResults] = useState([]);
  const [flightDictionaries, setFlightDictionaries] = useState(null);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingFlights, setIsLoadingFlights] = useState(false);
  const [flightError, setFlightError] = useState(null);

  const [airportInfoCache, setAirportInfoCache] = useState({});
  const [loadingAirportInfo, setLoadingAirportInfo] = useState(new Set());

  const [originSearchQuery, setOriginSearchQuery] = useState('');
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');

  const handleCitySearch = useCallback(async (value, type) => {
    if (!value || value.length < 2) {
      if (type === 'origin') setOriginCities([]);
      else setDestinationCities([]);
      return;
    }

    setIsLoadingCities(true);
    try {
      const response = await amadeusApi.searchCities(value);
      const options = response.data?.map(location => ({
        name: location.name,
        iataCode: location.iataCode,
        address: location.address?.cityName || '',
        id: location.id || `${location.iataCode}-${location.name}`
      })) || [];
      if (type === 'origin') setOriginCities(options);
      else setDestinationCities(options);
    } catch (err) {
      console.error('[AmadeusApi] City/Airport search error:', err);
      setFlightError(err.message || '도시 검색 실패');
      if (type === 'origin') setOriginCities([]);
      else setDestinationCities([]);
    } finally {
      setIsLoadingCities(false);
    }
  }, [setFlightError]);

  const handleFlightSearch = useCallback(async () => {
    const {
      selectedOrigin, selectedDestination, departureDate, returnDate,
      adults, children, infants, travelClass, nonStop, currencyCode,
      maxPrice, max
    } = flightSearchParams;

    const missing = [];
    if (!selectedOrigin) missing.push('출발지');
    if (!selectedDestination) missing.push('도착지');
    if (!departureDate) missing.push('출발일');
    if (adults < 1) missing.push('성인');

    if (missing.length) {
      setFlightError(`${missing.join(', ')} 입력 필요`);
      return;
    }

    if (infants > adults) {
      setFlightError('유아 수는 성인보다 많을 수 없습니다.');
      return;
    }

    const total = (adults || 0) + (children || 0);
    if (total > 9) {
      setFlightError('총 인원은 9명을 초과할 수 없습니다.');
      return;
    }
    setFlightError(null);
    setIsLoadingFlights(true);
    try {
      const params = {
        originCode: selectedOrigin.iataCode,
        destinationCode: selectedDestination.iataCode,
        departureDate: departureDate.toISOString().split('T')[0],
        returnDate: returnDate ? returnDate.toISOString().split('T')[0] : null,
        adults: parseInt(adults),
        ...(children > 0 && { children }),
        ...(infants > 0 && { infants }),
        ...(travelClass && { travelClass }),
        ...(nonStop && { nonStop }),
        currencyCode: currencyCode || 'KRW',
        ...(maxPrice && { maxPrice: parseInt(maxPrice, 10) }),
        max: max || 10
      };

      const response = await amadeusApi.searchFlights(params);
      if (Array.isArray(response.data)) {
        setFlightResults(response.data);
        setFlightDictionaries(response.dictionaries || null);
        if (response.data.length === 0) {
          setFlightError('검색 결과가 없습니다.');
        }
      } else {
        setFlightError('검색 실패 또는 형식 오류');
        setFlightResults([]);
      }
    } catch (err) {
      setFlightError(err.message || '항공편 검색 오류');
      setFlightResults([]);
    } finally {
      setIsLoadingFlights(false);
    }
  }, [flightSearchParams, setFlightError, setIsLoadingFlights, setFlightResults, setFlightDictionaries]);

  // 항공편 추가 전 검증 함수
  const validateFlightAddition = useCallback((flightOffer, travelPlans, dayOrder, startDate) => {
    if (!flightOffer || !flightOffer.itineraries || flightOffer.itineraries.length === 0) {
      return { isValid: false, message: '유효하지 않은 항공편 데이터입니다.' };
    }

    const isRoundTrip = flightOffer.itineraries.length > 1;
    const outboundItinerary = flightOffer.itineraries[0];
    const outboundFirstSegment = outboundItinerary.segments[0];
    const outboundLastSegment = outboundItinerary.segments[outboundItinerary.segments.length - 1];
    
    // 가는날 도착시간 계산
    const outboundArrivalDate = new Date(outboundLastSegment.arrival.at);
    const outboundArrivalDateOnly = new Date(outboundArrivalDate.getFullYear(), outboundArrivalDate.getMonth(), outboundArrivalDate.getDate());
    
    // 여행 시작일과 마지막일 계산
    const tripStartDate = new Date(startDate);
    const tripStartDateOnly = new Date(tripStartDate.getFullYear(), tripStartDate.getMonth(), tripStartDate.getDate());
    const tripEndDate = new Date(tripStartDate);
    tripEndDate.setDate(tripStartDate.getDate() + dayOrder.length - 1);
    const tripEndDateOnly = new Date(tripEndDate.getFullYear(), tripEndDate.getMonth(), tripEndDate.getDate());

    // 1. 여행 기간 검증 - 가는날 도착시간
    if (outboundArrivalDateOnly < tripStartDateOnly || outboundArrivalDateOnly > tripEndDateOnly) {
      return { 
        isValid: false, 
        message: `가는날 도착시간(${outboundArrivalDate.toLocaleDateString('ko-KR')})이 여행 기간(${tripStartDate.toLocaleDateString('ko-KR')} ~ ${tripEndDate.toLocaleDateString('ko-KR')})을 벗어납니다.` 
      };
    }

    // 왕복편인 경우 오는날 출발시간도 검증
    if (isRoundTrip) {
      const inboundItinerary = flightOffer.itineraries[1];
      const inboundFirstSegment = inboundItinerary.segments[0];
      const inboundDepartureDate = new Date(inboundFirstSegment.departure.at);
      const inboundDepartureDateOnly = new Date(inboundDepartureDate.getFullYear(), inboundDepartureDate.getMonth(), inboundDepartureDate.getDate());
      
      if (inboundDepartureDateOnly < tripStartDateOnly || inboundDepartureDateOnly > tripEndDateOnly) {
        return { 
          isValid: false, 
          message: `오는날 출발시간(${inboundDepartureDate.toLocaleDateString('ko-KR')})이 여행 기간(${tripStartDate.toLocaleDateString('ko-KR')} ~ ${tripEndDate.toLocaleDateString('ko-KR')})을 벗어납니다.` 
        };
      }
    }

    // 2. 기존 항공편 분석
    const existingFlights = [];
    Object.keys(travelPlans).forEach(dayKey => {
      const dayPlan = travelPlans[dayKey];
      if (dayPlan?.schedules) {
        dayPlan.schedules.forEach(schedule => {
          if (schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return' || schedule.type === 'Flight_OneWay') {
            existingFlights.push({
              ...schedule,
              dayKey,
              isRoundTripPart: schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return'
            });
          }
        });
      }
    });

    // 기존 항공편 타입 분석
    const hasRoundTrip = existingFlights.some(flight => flight.isRoundTripPart);
    const hasOneWay = existingFlights.some(flight => flight.type === 'Flight_OneWay');

    // 3. 편도/왕복 혼재 검증
    if (isRoundTrip && hasOneWay) {
      return { 
        isValid: false, 
        message: '왕복 항공편과 편도 항공편은 동시에 존재할 수 없습니다. 기존 편도 항공편을 먼저 삭제해주세요.' 
      };
    }

    if (!isRoundTrip && hasRoundTrip) {
      return { 
        isValid: false, 
        message: '편도 항공편과 왕복 항공편은 동시에 존재할 수 없습니다. 기존 왕복 항공편을 먼저 삭제해주세요.' 
      };
    }

    // 4. 왕복 항공편 중복 검증
    if (isRoundTrip && hasRoundTrip) {
      return { 
        isValid: false, 
        message: '왕복 항공편은 하나만 존재할 수 있습니다. 기존 왕복 항공편을 먼저 삭제해주세요.' 
      };
    }

    // 5. 편도 항공편 하루 일정 중복 검증
    if (!isRoundTrip) {
      // 가는날 도착시간에 해당하는 일차 계산
      const dayDifference = Math.floor((outboundArrivalDateOnly.getTime() - tripStartDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      const targetDayNumber = dayDifference + 1;
      const targetDayKey = targetDayNumber.toString();

      // 해당 일차에 이미 편도 항공편이 있는지 확인
      const sameDayOneWayFlights = existingFlights.filter(flight => 
        flight.type === 'Flight_OneWay' && flight.dayKey === targetDayKey
      );

      if (sameDayOneWayFlights.length > 0) {
        return { 
          isValid: false, 
          message: `${targetDayNumber}일차에 이미 편도 항공편이 존재합니다. 하루 일정에는 편도 항공편을 두 개 이상 배치할 수 없습니다.` 
        };
      }
    }

    return { isValid: true, message: '항공편 추가가 가능합니다.' };
  }, []);

  const handleAddFlightToSchedule = useCallback((flightOffer, newDictionaries, newAirportCache, travelPlans, dayOrder, getDayTitle, setTravelPlans, startDate) => {
    if (!flightOffer || !flightOffer.itineraries || flightOffer.itineraries.length === 0) {
      console.error('Invalid flightOffer data for adding to schedule');
      return;
    }

    // 검증 수행
    const validation = validateFlightAddition(flightOffer, travelPlans, dayOrder, startDate);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }
    
    if (newDictionaries) {
      setFlightDictionaries(prevDict => ({ ...prevDict, ...newDictionaries }));
    }
    if (newAirportCache) {
      setAirportInfoCache(prevCache => ({ ...prevCache, ...newAirportCache }));
    }

    const newTravelPlans = { ...travelPlans };
    const isRoundTrip = flightOffer.itineraries.length > 1;
    const outboundItinerary = flightOffer.itineraries[0];
    const outboundFirstSegment = outboundItinerary.segments[0];
    const outboundLastSegment = outboundItinerary.segments[outboundItinerary.segments.length - 1];
    
    // 가는날 도착시간으로 일차 계산
    const outboundArrivalDate = new Date(outboundLastSegment.arrival.at);
    const tripStartDate = new Date(startDate);
    const dayDifference = Math.floor((outboundArrivalDate.getTime() - tripStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const departureDayNumber = dayDifference + 1;
    const departureDayKey = departureDayNumber.toString();
    
    const normalizeData = (data) => JSON.parse(JSON.stringify(data, (k, v) => (typeof v === 'number' && !Number.isFinite(v)) ? null : v));

    // 출발편 스케줄 생성
    const departureSchedule = {
      id: `flight-${isRoundTrip ? 'departure' : 'oneway'}-${flightOffer.id}-${Date.now()}`,
      name: `${outboundFirstSegment.departure.iataCode} → ${outboundLastSegment.arrival.iataCode} 항공편`,
      time: new Date(outboundLastSegment.arrival.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      address: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.koreanFullName || airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.name || outboundLastSegment.arrival.iataCode,
      category: '항공편', 
      type: isRoundTrip ? 'Flight_Departure' : 'Flight_OneWay',
      duration: formatDuration(outboundItinerary.duration),
      notes: `가격: ${formatPrice(flightOffer.price.grandTotal || flightOffer.price.total, flightOffer.price.currency)}`,
      lat: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.geoCode?.latitude || flightDictionaries?.locations?.[outboundLastSegment.arrival.iataCode]?.geoCode?.latitude || null,
      lng: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.geoCode?.longitude || flightDictionaries?.locations?.[outboundLastSegment.arrival.iataCode]?.geoCode?.longitude || null,
      flightOfferDetails: {
        flightOfferData: normalizeData(flightOffer),
        departureAirportInfo: normalizeData(airportInfoCache?.[outboundFirstSegment.departure.iataCode]),
        arrivalAirportInfo: normalizeData(airportInfoCache?.[outboundLastSegment.arrival.iataCode]),
      }
    };

    // 출발편을 해당 일차에 추가
    const finalDepartureDayKey = dayOrder.includes(departureDayKey) ? departureDayKey : (dayOrder[0] || '1');
    const departureDaySchedules = [...(newTravelPlans[finalDepartureDayKey]?.schedules || [])];
    departureDaySchedules.unshift(departureSchedule);
    newTravelPlans[finalDepartureDayKey] = { 
      ...(newTravelPlans[finalDepartureDayKey] || { title: getDayTitle(parseInt(finalDepartureDayKey)), schedules: [] }), 
      schedules: departureDaySchedules 
    };

    // 왕복편인 경우 귀국편도 추가
    if (isRoundTrip) {
      const inboundItinerary = flightOffer.itineraries[1];
      const inboundFirstSegment = inboundItinerary.segments[0];
      const inboundLastSegment = inboundItinerary.segments[inboundItinerary.segments.length - 1];
      
      // 오는날 출발시간으로 일차 계산
      const inboundDepartureDate = new Date(inboundFirstSegment.departure.at);
      const returnDayDifference = Math.floor((inboundDepartureDate.getTime() - tripStartDate.getTime()) / (1000 * 60 * 60 * 24));
      const returnDayNumber = returnDayDifference + 1;
      const returnDayKey = returnDayNumber.toString();
      
      const returnSchedule = {
        id: `flight-return-${flightOffer.id}-${Date.now()}`,
        name: `${inboundFirstSegment.departure.iataCode} → ${inboundLastSegment.arrival.iataCode} 항공편`,
        time: new Date(inboundFirstSegment.departure.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        address: airportInfoCache?.[inboundFirstSegment.departure.iataCode]?.koreanFullName || airportInfoCache?.[inboundFirstSegment.departure.iataCode]?.name || inboundFirstSegment.departure.iataCode,
        category: '항공편', type: 'Flight_Return', duration: formatDuration(inboundItinerary.duration),
        notes: `가격: ${formatPrice(flightOffer.price.grandTotal || flightOffer.price.total, flightOffer.price.currency)}`,
        lat: airportInfoCache?.[inboundFirstSegment.departure.iataCode]?.geoCode?.latitude || flightDictionaries?.locations?.[inboundFirstSegment.departure.iataCode]?.geoCode?.latitude || null,
        lng: airportInfoCache?.[inboundFirstSegment.departure.iataCode]?.geoCode?.longitude || flightDictionaries?.locations?.[inboundFirstSegment.departure.iataCode]?.geoCode?.longitude || null,
        flightOfferDetails: {
          flightOfferData: normalizeData(flightOffer),
          departureAirportInfo: normalizeData(airportInfoCache?.[inboundFirstSegment.departure.iataCode]),
          arrivalAirportInfo: normalizeData(airportInfoCache?.[inboundLastSegment.arrival.iataCode]),
        }
      };
      
      const finalReturnDayKey = dayOrder.includes(returnDayKey) ? returnDayKey : (dayOrder[dayOrder.length - 1] || '1');
      const returnDaySchedules = [...(newTravelPlans[finalReturnDayKey]?.schedules || [])];
      returnDaySchedules.push(returnSchedule);
      newTravelPlans[finalReturnDayKey] = { 
        ...(newTravelPlans[finalReturnDayKey] || { title: getDayTitle(parseInt(finalReturnDayKey)), schedules: [] }), 
        schedules: returnDaySchedules 
      };
    }
    
    setTravelPlans(newTravelPlans);
    alert(isRoundTrip ? '왕복 항공편이 여행 계획에 추가되었습니다!' : '편도 항공편이 여행 계획에 추가되었습니다!');
  }, [airportInfoCache, flightDictionaries, setFlightDictionaries, setAirportInfoCache, validateFlightAddition]);

  // useTravelPlanLoader에서 가져온 항공편 스케줄 생성 함수
  const createFlightSchedules = useCallback((flightInfo, startDate, dayOrder, formatDateTitle = (d) => formatDateFns(d, 'M/d')) => {
    if (!flightInfo || !flightInfo.itineraries || flightInfo.itineraries.length === 0) {
      return { schedules: [], isRoundTrip: false };
    }

    const isRoundTrip = flightInfo.itineraries.length > 1;
    const departureItinerary = flightInfo.itineraries[0];
    const depFirstSegment = departureItinerary.segments[0];
    const depLastSegment = departureItinerary.segments[departureItinerary.segments.length - 1];
    
    const schedules = [];
    const schedulesByDay = {};
    
    // 항공편 출발 날짜 계산
    const flightDepartureDate = new Date(depFirstSegment.departure.at);
    const tripStartDate = new Date(startDate);
    
    // 출발 날짜와 여행 시작일의 차이를 계산하여 올바른 day 찾기
    const dayDifference = Math.floor((flightDepartureDate.getTime() - tripStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const targetDayNumber = dayDifference + 1; // 1일차부터 시작
    const targetDayKey = targetDayNumber.toString();
    
    console.log(`[createFlightSchedules] 항공편 출발일: ${flightDepartureDate.toISOString().split('T')[0]}, 여행 시작일: ${tripStartDate.toISOString().split('T')[0]}, 목표 Day: ${targetDayKey}`);
    
    // 출발 스케줄 생성
    const departureSchedule = {
      id: `flight-departure-${flightInfo.id || Date.now()}`,
      name: `${depFirstSegment.departure.iataCode} → ${depLastSegment.arrival.iataCode} 항공편`,
      time: new Date(depLastSegment.arrival.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      address: depLastSegment.arrival.iataCode,
      category: '항공편', 
      type: isRoundTrip ? 'Flight_Departure' : 'Flight_OneWay', // 편도/왕복 구분
      duration: formatDuration(departureItinerary.duration),
      notes: `가격: ${formatPrice(flightInfo.price.grandTotal || flightInfo.price.total, flightInfo.price.currency)}`,
      lat: null, lng: null,
      flightOfferDetails: { flightOfferData: flightInfo, departureAirportInfo: {}, arrivalAirportInfo: {} }
    };
    
    schedules.push(departureSchedule);
    
    // 계산된 날짜에 항공편 추가 (dayOrder에 없는 날짜라면 첫 번째 날에 추가)
    const finalDayKey = dayOrder.includes(targetDayKey) ? targetDayKey : (dayOrder[0] || '1');
    if (!schedulesByDay[finalDayKey]) {
      schedulesByDay[finalDayKey] = [];
    }
    schedulesByDay[finalDayKey].push(departureSchedule);
    
    console.log(`[createFlightSchedules] 편도 항공편을 Day ${finalDayKey}에 추가`);
    
    // 왕복이라면 귀국 스케줄도 생성
    if (isRoundTrip && flightInfo.itineraries.length > 1) {
      const returnItinerary = flightInfo.itineraries[1];
      const retFirstSegment = returnItinerary.segments[0];
      const retLastSegment = returnItinerary.segments[returnItinerary.segments.length - 1];
      
      // 귀국편 출발 날짜 계산
      const returnDepartureDate = new Date(retFirstSegment.departure.at);
      const returnDayDifference = Math.floor((returnDepartureDate.getTime() - tripStartDate.getTime()) / (1000 * 60 * 60 * 24));
      const returnTargetDayNumber = returnDayDifference + 1;
      const returnTargetDayKey = returnTargetDayNumber.toString();
      
      const returnSchedule = {
        id: `flight-return-${flightInfo.id || Date.now()}`,
        name: `${retFirstSegment.departure.iataCode} → ${retLastSegment.arrival.iataCode} 항공편`,
        time: new Date(retFirstSegment.departure.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        address: retFirstSegment.departure.iataCode,
        category: '항공편', type: 'Flight_Return', duration: formatDuration(returnItinerary.duration),
        notes: `가격: ${formatPrice(flightInfo.price.grandTotal || flightInfo.price.total, flightInfo.price.currency)}`,
        lat: null, lng: null,
        flightOfferDetails: { flightOfferData: flightInfo, departureAirportInfo: {}, arrivalAirportInfo: {} }
      };
      
      schedules.push(returnSchedule);
      
      const finalReturnDayKey = dayOrder.includes(returnTargetDayKey) ? returnTargetDayKey : (dayOrder[dayOrder.length - 1] || '1');
      if (!schedulesByDay[finalReturnDayKey]) {
        schedulesByDay[finalReturnDayKey] = [];
      }
      schedulesByDay[finalReturnDayKey].push(returnSchedule);
      
      console.log(`[createFlightSchedules] 왕복 귀국편을 Day ${finalReturnDayKey}에 추가`);
    }
    
    return { schedules, schedulesByDay, isRoundTrip };
  }, []);

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

    const currentAirportInfoCache = airportInfoCache;
    const currentLoadingAirportInfo = loadingAirportInfo;

    const codesToFetch = [...uniqueIataCodes].filter(code => {
      return code && !currentAirportInfoCache[code] && !currentLoadingAirportInfo.has(code);
    });

    if (codesToFetch.length > 0) {
        setLoadingAirportInfo(prevLoadingCodes => {
          const newLoadingCodes = new Set(prevLoadingCodes);
          let added = false;
          codesToFetch.forEach(code => {
            if (!newLoadingCodes.has(code)) {
              newLoadingCodes.add(code);
              added = true;
            }
          });
          return added ? newLoadingCodes : prevLoadingCodes;
        });
        setFlightError(null);
        
        const fetchPromises = codesToFetch.map(iataCode => 
            amadeusApi.getAirportDetails(iataCode)
              .then(info => ({ [iataCode]: info || { warning: 'Failed to fetch details'} }))
              .catch(error => {
                console.error(`Error fetching airport details for ${iataCode}:`, error);
                setFlightError(prevError => {
                  const newErrorMessage = `공항 정보(${iataCode}) 로딩 실패.`;
                  return prevError ? `${prevError}\n${newErrorMessage}` : newErrorMessage;
                });
                return { [iataCode]: { error: `Failed to fetch details for ${iataCode}` } };
              })
        );

        Promise.all(fetchPromises)
          .then(results => {
            const newCacheEntries = results.reduce((acc, current) => ({ ...acc, ...current }), {});
            setAirportInfoCache(prevCache => ({ ...prevCache, ...newCacheEntries }));
          })
          .catch(error => {
            console.error("Error fetching airport details in hook (Promise.all):", error);
            setFlightError("일부 공항 정보를 가져오는 중 문제가 발생했습니다.");
          })
          .finally(() => {
            setLoadingAirportInfo(prevLoadingCodes => {
                const nextLoadingCodes = new Set(prevLoadingCodes);
                let changed = false;
                codesToFetch.forEach(code => {
                  if (nextLoadingCodes.has(code)) {
                    nextLoadingCodes.delete(code);
                    changed = true;
                  }
                });
                return changed ? nextLoadingCodes : prevLoadingCodes;
            });
        });
    }
  }, [flightResults, setAirportInfoCache, setLoadingAirportInfo, setFlightError]);

  // 항공편 스케줄의 상세 정보 업데이트 (TravelPlanner.js에서 이동)
  const updateFlightScheduleDetails = useCallback((travelPlansData, airportInfoCacheData, loadedFlightInfoData) => {
    // 기본 조건: travelPlans, airportInfoCache, loadedFlightInfo 중 하나라도 없으면 실행 안 함
    if (!travelPlansData || Object.keys(travelPlansData).length === 0 || 
        !airportInfoCacheData || Object.keys(airportInfoCacheData).length === 0 || 
        !loadedFlightInfoData) {
      return null;
    }

    let plansUpdated = false;
    // travelPlans를 직접 수정하지 않기 위해 깊은 복사 사용
    const updatedTravelPlans = JSON.parse(JSON.stringify(travelPlansData));

    Object.keys(updatedTravelPlans).forEach(dayKey => {
      const dayPlan = updatedTravelPlans[dayKey];
      if (dayPlan && dayPlan.schedules && Array.isArray(dayPlan.schedules)) {
        dayPlan.schedules.forEach((schedule, index) => {
          if (schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return') {
            const offerDetails = schedule.flightOfferDetails;
            // offerDetails와 그 내부의 flightOfferData, itineraries가 모두 존재해야 함
            if (offerDetails && offerDetails.flightOfferData?.itineraries) {
              const itinerary = schedule.type === 'Flight_Departure' 
                ? offerDetails.flightOfferData.itineraries[0]
                : (offerDetails.flightOfferData.itineraries.length > 1 ? offerDetails.flightOfferData.itineraries[1] : offerDetails.flightOfferData.itineraries[0]);

              if (itinerary && itinerary.segments && itinerary.segments.length > 0) {
                const firstSegment = itinerary.segments[0];
                const lastSegment = itinerary.segments[itinerary.segments.length - 1];
                
                const departureAirportCode = firstSegment.departure?.iataCode;
                const arrivalAirportCode = lastSegment.arrival?.iataCode;

                // airportInfoCache에서 공항 정보 가져오기
                const departureAirport = departureAirportCode ? airportInfoCacheData[departureAirportCode] : null;
                const arrivalAirport = arrivalAirportCode ? airportInfoCacheData[arrivalAirportCode] : null;

                let changedInEffect = false;
                // 귀국편: 출발 공항 정보 기준 (주소, 위경도)
                if (departureAirport && schedule.type === 'Flight_Return') { 
                  if (schedule.address !== (departureAirport.koreanName || departureAirport.name)) {
                    updatedTravelPlans[dayKey].schedules[index].address = departureAirport.koreanName || departureAirport.name || departureAirportCode;
                    changedInEffect = true;
                  }
                  if (schedule.lat !== departureAirport.geoCode?.latitude) {
                    updatedTravelPlans[dayKey].schedules[index].lat = departureAirport.geoCode?.latitude || null;
                    changedInEffect = true;
                  }
                  if (schedule.lng !== departureAirport.geoCode?.longitude) {
                    updatedTravelPlans[dayKey].schedules[index].lng = departureAirport.geoCode?.longitude || null;
                    changedInEffect = true;
                  }
                  // flightOfferDetails 내 공항 정보도 업데이트 (없거나 비어있을 경우)
                  if (!offerDetails.departureAirportInfo || Object.keys(offerDetails.departureAirportInfo).length === 0) {
                     updatedTravelPlans[dayKey].schedules[index].flightOfferDetails.departureAirportInfo = departureAirport;
                     changedInEffect = true;
                  }
                  if (arrivalAirport && (!offerDetails.arrivalAirportInfo || Object.keys(offerDetails.arrivalAirportInfo).length === 0) ){
                     updatedTravelPlans[dayKey].schedules[index].flightOfferDetails.arrivalAirportInfo = arrivalAirport;
                     changedInEffect = true;
                  }
                // 출발편: 도착 공항 정보 기준 (주소, 위경도)
                } else if (arrivalAirport && schedule.type === 'Flight_Departure') { 
                  if (schedule.address !== (arrivalAirport.koreanName || arrivalAirport.name)) {
                    updatedTravelPlans[dayKey].schedules[index].address = arrivalAirport.koreanName || arrivalAirport.name || arrivalAirportCode;
                    changedInEffect = true;
                  }
                  if (schedule.lat !== arrivalAirport.geoCode?.latitude) {
                    updatedTravelPlans[dayKey].schedules[index].lat = arrivalAirport.geoCode?.latitude || null;
                    changedInEffect = true;
                  }
                  if (schedule.lng !== arrivalAirport.geoCode?.longitude) {
                    updatedTravelPlans[dayKey].schedules[index].lng = arrivalAirport.geoCode?.longitude || null;
                    changedInEffect = true;
                  }
                  // flightOfferDetails 내 공항 정보도 업데이트
                  if (departureAirport && (!offerDetails.departureAirportInfo || Object.keys(offerDetails.departureAirportInfo).length === 0)){
                     updatedTravelPlans[dayKey].schedules[index].flightOfferDetails.departureAirportInfo = departureAirport;
                     changedInEffect = true;
                  }
                   if (!offerDetails.arrivalAirportInfo || Object.keys(offerDetails.arrivalAirportInfo).length === 0) {
                     updatedTravelPlans[dayKey].schedules[index].flightOfferDetails.arrivalAirportInfo = arrivalAirport;
                     changedInEffect = true;
                  }
                }
                if (changedInEffect) plansUpdated = true;
              }
            }
          }
        });
      }
    });

    return plansUpdated ? updatedTravelPlans : null;
  }, []);

  return {
    flightSearchParams, setFlightSearchParams,
    originCities, destinationCities,
    isLoadingCities, isLoadingFlights,
    flightResults, flightDictionaries, flightError,
    handleCitySearch, handleFlightSearch,
    airportInfoCache,
    loadingAirportInfo,
    setFlightDictionaries,
    setAirportInfoCache,
    originSearchQuery, setOriginSearchQuery,
    destinationSearchQuery, setDestinationSearchQuery,
    handleAddFlightToSchedule,
    createFlightSchedules,
    updateFlightScheduleDetails,
    validateFlightAddition
  };
};

export default useFlightHandlers;
