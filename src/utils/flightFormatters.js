// src/utils/flightFormatters.js

import React from 'react'; // React 임포트
import { Box, Typography, Divider } from '@mui/material'; // 필요한 MUI 컴포넌트 임포트

// 가격 포맷 함수
export const formatPrice = (priceString, currency = 'KRW') => {
    const price = parseFloat(priceString);
    if (isNaN(price)) {
      return '-';
    }
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: currency
    }).format(price);
  };
  
// 기간 포맷 함수
export const formatDuration = (durationString) => {
    if (!durationString) return '';
    const match = durationString.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return durationString;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    let formatted = '';
    if (hours > 0) formatted += `${hours}시간 `;
    if (minutes > 0) formatted += `${minutes}분`;
    return formatted.trim();
};
  
// 주요 항공사 한글 이름 매핑
export const airlineKoreanNames = {
    "KE": "대한항공",
    "OZ": "아시아나항공",
    "7C": "제주항공",
    "LJ": "진에어",
    "TW": "티웨이항공",
    "BX": "에어부산",
    "RS": "에어서울",
    "MU": "중국동방항공",
    // 필요에 따라 추가
};
  
// 요금 상세 렌더링 함수 (JSX 사용)
export const renderFareDetails = (travelerPricings, dictionaries) => {
    if (!travelerPricings || travelerPricings.length === 0) return null;
    return travelerPricings.map((travelerPricing, tpIndex) => (
        <Box key={`tp-${tpIndex}`} sx={{ mb: 1, borderBottom: '1px solid #eee', pb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                승객 {travelerPricing.travelerId} ({travelerPricing.travelerType}) - 요금 옵션: {travelerPricing.fareOption}
            </Typography>
            {travelerPricing.fareDetailsBySegment.map((fareDetail, fdIndex) => (
                <Box key={`fd-${tpIndex}-${fdIndex}`} sx={{ pl: 1 }}>
                    <Typography variant="caption" display="block">
                        - 구간 {fareDetail.segmentId}: {fareDetail.cabin} ({fareDetail.class}), 운임 기준: {fareDetail.fareBasis}
                        {fareDetail.brandedFare && `, 브랜드: ${fareDetail.brandedFare}`}
                    </Typography>
                    {fareDetail.includedCheckedBags && (
                        <Typography variant="caption" display="block" sx={{ pl: 2 }}>
                            포함 수하물: 
                            {fareDetail.includedCheckedBags.quantity ? ` ${fareDetail.includedCheckedBags.quantity}개` : ''}
                            {fareDetail.includedCheckedBags.weight ? ` (개당 ${fareDetail.includedCheckedBags.weight}${fareDetail.includedCheckedBags.weightUnit || 'KG'})` : ''}
                        </Typography>
                    )}
                </Box>
            ))}
        </Box>
    ));
};
  
// 여정 상세 렌더링 함수 (JSX 사용)
export const renderItineraryDetails = (itinerary, flightId, dictionaries, itineraryTitle, airportInfoCache, loadingAirportInfo) => {
    if (!itinerary) return null;

    const getAirportDisplay = (iataCode) => {
        if (loadingAirportInfo && loadingAirportInfo.has(iataCode)) {
            return `${iataCode} (정보 로딩 중...)`;
        }
        const info = airportInfoCache?.[iataCode];
        if (info && Object.keys(info).length > 0 && !info.warning) {
            const airportName = info.koreanName || info.name || iataCode;
            const cityName = info.koreanAddress?.cityName || info.address?.cityName || '';
            const amadeusCityCode = dictionaries?.locations?.[iataCode]?.cityCode || '';
            let displayCity = cityName;
            if (amadeusCityCode && cityName && cityName !== amadeusCityCode && !cityName.includes(amadeusCityCode)) {
                displayCity += ` / ${amadeusCityCode}`;
            } else if (!cityName && amadeusCityCode) {
                displayCity = amadeusCityCode;
            }
            return `${airportName} / ${iataCode} (${displayCity || iataCode})`;
        } else if (info && info.warning) {
            return `${iataCode} (상세 정보 없음)`;
        } else {
            const cityCode = dictionaries?.locations?.[iataCode]?.cityCode || iataCode;
            const airportNameFromDict = dictionaries?.locations?.[iataCode]?.detailedName || dictionaries?.locations?.[iataCode]?.name || iataCode;
            return `${airportNameFromDict} (${cityCode})`;
        }
    };

    const getCarrierDisplay = (carrierCode) => {
        const koreanName = airlineKoreanNames[carrierCode];
        const englishName = dictionaries?.carriers?.[carrierCode] || carrierCode;
        return koreanName ? `${koreanName} / ${englishName}` : englishName;
    };

    return (
        <Box sx={{ mb: 2 }}>
            {itineraryTitle && 
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {itineraryTitle}
                </Typography>
            }
            {itinerary.segments.map((segment, index) => (
                <Box key={`segment-${flightId}-${segment.id || index}`} sx={{ mb: 1.5, pl:1, borderLeft: '2px solid #1976d2', ml:1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        구간 {index + 1}: {getAirportDisplay(segment.departure.iataCode)} → {getAirportDisplay(segment.arrival.iataCode)}
                    </Typography>
                    <Typography variant="caption" display="block">
                        출발: {new Date(segment.departure.at).toLocaleString('ko-KR', { year:'numeric', month:'short', day:'numeric', hour: '2-digit', minute: '2-digit', timeZoneName:'short' })} (터미널: {segment.departure.terminal || '-'})
                    </Typography>
                    <Typography variant="caption" display="block">
                        도착: {new Date(segment.arrival.at).toLocaleString('ko-KR', { year:'numeric', month:'short', day:'numeric', hour: '2-digit', minute: '2-digit', timeZoneName:'short' })} (터미널: {segment.arrival.terminal || '-'})
                    </Typography>
                    <Typography variant="caption" display="block">
                        항공편: {getCarrierDisplay(segment.carrierCode)} {segment.number}
                        {segment.operating?.carrierCode && segment.operating.carrierCode !== segment.carrierCode && 
                        ` (운항: ${getCarrierDisplay(segment.operating.carrierCode)})`}
                    </Typography>
                    <Typography variant="caption" display="block">
                        기종: {segment.aircraft?.code ? (dictionaries?.aircraft?.[segment.aircraft.code] || segment.aircraft.code) : '-'}
                        , 소요시간: {formatDuration(segment.duration)}
                        {segment.numberOfStops > 0 && `, 경유 ${segment.numberOfStops}회`}
                    </Typography>
                    {segment.stops && segment.stops.length > 0 && (
                        <Box sx={{pl: 2, mt:0.5}}>
                            {segment.stops.map((stop, stopIndex) => (
                                <Typography variant="caption" display="block" key={`stop-${flightId}-${segment.id || index}-${stopIndex}`}>
                                    경유지 {stopIndex+1}: {getAirportDisplay(stop.iataCode)} - {formatDuration(stop.duration)} 체류
                                    <br/>
                                    도착: {new Date(stop.arrivalAt).toLocaleTimeString('ko-KR')} / 출발: {new Date(stop.departureAt).toLocaleTimeString('ko-KR')}
                                </Typography>
                            ))}
                        </Box>
                    )}
                </Box>
            ))}
        </Box>
    );
}; 