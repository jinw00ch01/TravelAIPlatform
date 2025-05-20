import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox 토큰 설정
mapboxgl.accessToken = 'pk.eyJ1IjoibWlua2ltIiwiYSI6ImNsdWJ0d2J0YzBkY2QyaW1zN2R0dWJ0dW8ifQ.0QZQZQZQZQZQZQZQZQZQZQ';

const HotelMap = ({ hotels, center, zoom = 12, selectedHotelId = null, searchLocation = null, resizeTrigger }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const searchMarker = useRef(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // 지도 초기화
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: center || [126.9779692, 37.5662952], // 서울 시청 좌표
      zoom: zoom
    });

    // 지도 컨트롤 추가
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (map.current) {
      map.current.resize();
    }
  }, [resizeTrigger]);

  useEffect(() => {
    if (!map.current || !hotels) return;

    // 기존 마커 제거
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
    
    if (searchMarker.current) {
      searchMarker.current.remove();
    }

    // 검색 위치 마커 추가
    if (searchLocation && searchLocation.latitude && searchLocation.longitude) {
      searchMarker.current = new mapboxgl.Marker({
        color: '#00FF00',  // 초록색
        scale: 1.2  // 마커 크기를 20% 크게
      })
        .setLngLat([parseFloat(searchLocation.longitude), parseFloat(searchLocation.latitude)])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div style="padding: 10px;">
                <h3 style="margin: 0;">검색 위치</h3>
                <p style="margin: 5px 0 0 0;">${searchLocation.name || '선택한 위치'}</p>
              </div>
            `)
        )
        .addTo(map.current);
    }

    // 호텔 마커 추가
    hotels.forEach(hotel => {
      if (hotel.latitude && hotel.longitude) {
        const marker = new mapboxgl.Marker({
          color: hotel.hotel_id === selectedHotelId ? '#4169E1' : '#FF385C'  // 선택된 호텔은 파란색
        })
          .setLngLat([parseFloat(hotel.longitude), parseFloat(hotel.latitude)])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 10px;">
                  <h3 style="margin: 0 0 5px 0;">${hotel.hotel_name}</h3>
                  <p style="margin: 0;">${hotel.price}</p>
                </div>
              `)
          )
          .addTo(map.current);

        markers.current.push(marker);

        // 선택된 호텔로 지도 이동
        if (hotel.hotel_id === selectedHotelId) {
          map.current.flyTo({
            center: [parseFloat(hotel.longitude), parseFloat(hotel.latitude)],
            zoom: 15,
            essential: true
          });
        }
      }
    });

    // 동적 줌 레벨 조정 (선택된 호텔이 없을 때만)
    if (markers.current.length > 0 && !selectedHotelId) {
      const bounds = new mapboxgl.LngLatBounds();
      
      // 검색 위치도 bounds에 포함
      if (searchMarker.current) {
        bounds.extend(searchMarker.current.getLngLat());
      }
      
      // 모든 호텔 마커를 bounds에 포함
      markers.current.forEach(marker => {
        bounds.extend(marker.getLngLat());
      });

      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15,
        duration: 1000
      });
    }
  }, [hotels, selectedHotelId, searchLocation]);

  return (
    <div
      ref={mapContainer}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    />
  );
};

export default HotelMap; 