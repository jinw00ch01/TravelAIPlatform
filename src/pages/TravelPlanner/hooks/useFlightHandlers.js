import { useState, useCallback, useEffect } from 'react';
import amadeusApi from '../../../utils/amadeusApi';

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
    destinationSearchQuery, setDestinationSearchQuery
  };
};

export default useFlightHandlers;
