import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox 토큰 설정
mapboxgl.accessToken = 'pk.eyJ1IjoibWlua2ltIiwiYSI6ImNsdWJ0d2J0YzBkY2QyaW1zN2R0dWJ0dW8ifQ.0QZQZQZQZQZQZQZQZQZQZQ';

const HotelMap = ({ hotels, center, zoom = 12 }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);

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
    if (!map.current || !hotels) return;

    // 기존 마커 제거
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // 새로운 마커 추가
    hotels.forEach(hotel => {
      if (hotel.latitude && hotel.longitude) {
        const marker = new mapboxgl.Marker({
          color: '#FF385C'
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
      }
    });

    // 동적 줌 레벨 조정
    if (markers.current.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.current.forEach(marker => {
        bounds.extend(marker.getLngLat());
      });

      // 마커가 1개일 경우 고정 줌 레벨 사용
      if (markers.current.length === 1) {
        map.current.flyTo({
          center: markers.current[0].getLngLat(),
          zoom: 15,
          essential: true
        });
      } else {
        // 여러 마커가 있는 경우 자동 줌 레벨 조정
        map.current.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 15,
          duration: 1000
        });
      }
    } else {
      // 검색 결과가 없을 때 서울 시청으로 이동
      map.current.flyTo({
        center: [126.9779692, 37.5662952],
        zoom: 12,
        essential: true
      });
    }
  }, [hotels]);

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