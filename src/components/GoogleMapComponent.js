import React, { useCallback } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const center = {
  lat: 37.5665,
  lng: 126.9780,
};

const mapOptions = {
  zoomControl: true,
  mapTypeControl: true,
  scaleControl: true,
  streetViewControl: true,
  rotateControl: true,
  fullscreenControl: true,
  gestureHandling: 'greedy'
};

const GoogleMapComponent = ({ selectedPlace, travelPlans, selectedDay, mapRef, isLoaded, loadError }) => {
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, [mapRef]);

  if (loadError) {
    console.error('Maps API 로드 오류:', loadError);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">지도를 불러오는데 실패했습니다</p>
          <p className="text-sm">
            {loadError.message === 'ApiNotActivatedMapError' 
              ? 'Google Cloud Console에서 Places API가 활성화되어 있는지 확인해주세요.'
              : loadError.message}
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">지도를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={center}
        options={mapOptions}
        onLoad={onMapLoad}
      >
        {selectedPlace && (
          <Marker
            position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
          />
        )}

        {travelPlans[selectedDay]?.schedules.map((place, index) => (
          <Marker
            key={index}
            position={{ lat: place.lat, lng: place.lng }}
            label={{
              text: `${index + 1}`,
              color: 'white',
              fontWeight: 'bold',
            }}
          />
        ))}
      </GoogleMap>
    </div>
  );
};

export default GoogleMapComponent; 