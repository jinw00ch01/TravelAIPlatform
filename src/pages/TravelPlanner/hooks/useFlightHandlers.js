import { useState, useCallback } from 'react';
import amadeusApi from '../../utils/amadeusApi';

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
      setFlightError(err.message || '도시 검색 실패');
    } finally {
      setIsLoadingCities(false);
    }
  }, []);

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
  }, [flightSearchParams]);

  return {
    flightSearchParams, setFlightSearchParams,
    originCities, destinationCities,
    isLoadingCities, isLoadingFlights,
    flightResults, flightDictionaries, flightError,
    handleCitySearch, handleFlightSearch
  };
};

export default useFlightHandlers;
