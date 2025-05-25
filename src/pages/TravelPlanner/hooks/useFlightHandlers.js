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

  const handleAddFlightToSchedule = useCallback((flightOffer, newDictionaries, newAirportCache, travelPlans, dayOrder, getDayTitle, setTravelPlans) => {
    if (!flightOffer || !flightOffer.itineraries || flightOffer.itineraries.length === 0) {
      console.error('Invalid flightOffer data for adding to schedule');
      return;
    }
    
    if (newDictionaries) {
      setFlightDictionaries(prevDict => ({ ...prevDict, ...newDictionaries }));
    }
    if (newAirportCache) {
      setAirportInfoCache(prevCache => ({ ...prevCache, ...newAirportCache }));
    }
    
    const findExistingFlightSchedule = (plans, flightType) => {
      for (const dayKey of Object.keys(plans)) {
        const daySchedules = plans[dayKey]?.schedules || [];
        const existingFlight = daySchedules.find(s => s.type === flightType);
        if (existingFlight) return existingFlight;
      }
      return null;
    };

    const findDayKeyForSchedule = (plans, scheduleId) => {
      for (const dayKey of Object.keys(plans)) {
        const daySchedules = plans[dayKey]?.schedules || [];
        if (daySchedules.some(s => s.id === scheduleId)) return dayKey;
      }
      return null;
    };

    const existingDepartureSchedule = findExistingFlightSchedule(travelPlans, 'Flight_Departure');
    const existingReturnSchedule = findExistingFlightSchedule(travelPlans, 'Flight_Return');
    
    const newTravelPlans = { ...travelPlans };
    const isRoundTrip = flightOffer.itineraries.length > 1;
    const outboundItinerary = flightOffer.itineraries[0];
    const outboundLastSegment = outboundItinerary.segments[outboundItinerary.segments.length - 1];
    
    const normalizeData = (data) => JSON.parse(JSON.stringify(data, (k, v) => (typeof v === 'number' && !Number.isFinite(v)) ? null : v));

    const departureSchedule = {
      id: existingDepartureSchedule?.id || `flight-departure-${flightOffer.id}-${Date.now()}`,
      name: `${outboundItinerary.segments[0].departure.iataCode} → ${outboundLastSegment.arrival.iataCode} 항공편`,
      time: new Date(outboundLastSegment.arrival.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      address: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.koreanFullName || airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.name || outboundLastSegment.arrival.iataCode,
      category: '항공편', type: 'Flight_Departure', duration: formatDuration(outboundItinerary.duration),
      notes: `가격: ${formatPrice(flightOffer.price.grandTotal || flightOffer.price.total, flightOffer.price.currency)}`,
      lat: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.geoCode?.latitude || flightDictionaries?.locations?.[outboundLastSegment.arrival.iataCode]?.geoCode?.latitude || null,
      lng: airportInfoCache?.[outboundLastSegment.arrival.iataCode]?.geoCode?.longitude || flightDictionaries?.locations?.[outboundLastSegment.arrival.iataCode]?.geoCode?.longitude || null,
      flightOfferDetails: {
        flightOfferData: normalizeData(flightOffer),
        departureAirportInfo: normalizeData(airportInfoCache?.[outboundItinerary.segments[0].departure.iataCode]),
        arrivalAirportInfo: normalizeData(airportInfoCache?.[outboundLastSegment.arrival.iataCode]),
      }
    };

    let departureDayKey = dayOrder[0] || '1';
    if (existingDepartureSchedule) {
      const foundDayKey = findDayKeyForSchedule(travelPlans, existingDepartureSchedule.id);
      if (foundDayKey) departureDayKey = foundDayKey;
    }
    const departureDaySchedules = [...(newTravelPlans[departureDayKey]?.schedules || [])];
    const depIndex = departureDaySchedules.findIndex(s => s.id === existingDepartureSchedule?.id);
    if (depIndex !== -1) departureDaySchedules[depIndex] = departureSchedule;
    else departureDaySchedules.unshift(departureSchedule);
    newTravelPlans[departureDayKey] = { ...(newTravelPlans[departureDayKey] || { title: getDayTitle(parseInt(departureDayKey)), schedules: [] }), schedules: departureDaySchedules };

    if (isRoundTrip) {
      const inboundItinerary = flightOffer.itineraries[1];
      const inboundFirstSegment = inboundItinerary.segments[0];
      const inboundLastSegment = inboundItinerary.segments[inboundItinerary.segments.length - 1];
      const returnSchedule = {
        id: existingReturnSchedule?.id || `flight-return-${flightOffer.id}-${Date.now()}`,
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
      let returnDayKey = dayOrder[dayOrder.length - 1] || '1';
      if (existingReturnSchedule) {
        const foundDayKey = findDayKeyForSchedule(travelPlans, existingReturnSchedule.id);
        if (foundDayKey) returnDayKey = foundDayKey;
      }
      const returnDaySchedules = [...(newTravelPlans[returnDayKey]?.schedules || [])];
      const retIndex = returnDaySchedules.findIndex(s => s.id === existingReturnSchedule?.id);
      if (retIndex !== -1) returnDaySchedules[retIndex] = returnSchedule;
      else returnDaySchedules.push(returnSchedule);
      newTravelPlans[returnDayKey] = { ...(newTravelPlans[returnDayKey] || { title: getDayTitle(parseInt(returnDayKey)), schedules: [] }), schedules: returnDaySchedules };
    }
    
    setTravelPlans(newTravelPlans);
    alert(existingDepartureSchedule || existingReturnSchedule ? '기존 항공편이 새 항공편으로 교체되었습니다!' : '항공편이 여행 계획에 추가되었습니다!');
  }, [airportInfoCache, flightDictionaries, setFlightDictionaries, setAirportInfoCache]);

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
    updateFlightScheduleDetails
  };
};

export default useFlightHandlers;
