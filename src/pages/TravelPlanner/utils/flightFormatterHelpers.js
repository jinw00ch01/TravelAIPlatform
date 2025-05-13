export const calculateFlightDuration = (departure, arrival) => {
  const start = new Date(departure);
  const end = new Date(arrival);
  const diffMs = end - start;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}시간 ${minutes}분`;
};

export const formatScheduleFromFlight = (flightOffer, type = 'Flight_Departure') => {
  try {
    const itineraryIndex = (type === 'Flight_Return' && flightOffer.itineraries?.length > 1) ? 1 : 0;
    const itinerary = flightOffer.itineraries[itineraryIndex];
    const firstSegment = itinerary.segments[0];
    const lastSegment = itinerary.segments[itinerary.segments.length - 1];

    const schedule = {
      id: `${type.toLowerCase()}-${Date.now()}`,
      type,
      category: '항공편',
      name: `${firstSegment.departure?.iataCode || ''} → ${lastSegment.arrival?.iataCode || ''} 항공편`,
      time: new Date(firstSegment.departure?.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      address: `${firstSegment.departure?.iataCode || ''} 공항`,
      duration: calculateFlightDuration(firstSegment.departure?.at, lastSegment.arrival?.at),
      notes: `가격: ${parseFloat(flightOffer.price?.total || 0).toLocaleString()} ${flightOffer.price?.currency || 'KRW'}`,
      lat: null,
      lng: null,
      flightOfferDetails: {
        flightOfferData: flightOffer,
        departureAirportInfo: {},
        arrivalAirportInfo: {}
      }
    };

    return schedule;
  } catch (err) {
    console.error('항공편 포맷 오류:', err);
    return null;
  }
};
