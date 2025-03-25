import React, { useRef, useEffect } from 'react';

const SearchPopup = ({ 
  isOpen, 
  onClose, 
  searchQuery, 
  setSearchQuery, 
  selectedPlace, 
  setSelectedPlace, 
  addPlaceToDay, 
  selectedDay, 
  insertIndex,
  mapRef,
  isLoaded 
}) => {
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    // 디버깅: 초기 조건 로깅
    console.log('SearchPopup Effect 조건:', {
      isOpen,
      isLoaded,
      hasSearchInput: !!searchInputRef.current,
      hasGoogleMaps: !!window.google,
      hasPlacesAPI: !!(window.google?.maps?.places),
      googleMapsObject: window.google?.maps,
      searchInputElement: searchInputRef.current
    });

    if (!isOpen || !isLoaded || !searchInputRef.current) {
      console.log('SearchPopup 초기화 중단:', {
        reason: !isOpen ? 'popup closed' : !isLoaded ? 'maps not loaded' : 'no search input'
      });
      return;
    }

    let autocomplete = null;
    let placeChangedListener = null;

    try {
      console.log('Places API 초기화 시작');

      // Places 서비스 초기화
      const options = {
        componentRestrictions: { country: 'kr' },
        fields: ['name', 'geometry', 'formatted_address'],
        types: ['establishment', 'geocode']
      };

      console.log('Autocomplete 옵션:', options);

      // Autocomplete 인스턴스 생성
      autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, options);
      console.log('Autocomplete 인스턴스 생성됨:', !!autocomplete);
      
      autocompleteRef.current = autocomplete;

      // place_changed 이벤트 리스너 추가
      placeChangedListener = autocomplete.addListener('place_changed', () => {
        console.log('place_changed 이벤트 발생');
        const place = autocomplete.getPlace();
        
        console.log('선택된 장소:', place);

        if (!place.geometry) {
          console.warn("선택한 장소에 대한 정보가 없습니다:", place);
          return;
        }

        const newPlace = {
          name: place.name,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address
        };

        console.log('처리된 장소 정보:', newPlace);

        setSelectedPlace(newPlace);

        if (mapRef.current) {
          console.log('지도 위치 업데이트');
          mapRef.current.panTo(place.geometry.location);
          mapRef.current.setZoom(15);
        }
      });

      // 입력 필드에 포커스
      searchInputRef.current.focus();
      console.log('검색 입력 필드에 포커스됨');

    } catch (error) {
      console.error("Places API 초기화 오류:", {
        error,
        errorMessage: error.message,
        errorStack: error.stack,
        googleMapsState: {
          hasGoogleObject: !!window.google,
          hasMapsObject: !!window.google?.maps,
          hasPlacesObject: !!window.google?.maps?.places
        }
      });
    }

    // Cleanup function
    return () => {
      console.log('SearchPopup cleanup 실행');
      if (placeChangedListener) {
        console.log('이벤트 리스너 제거');
        placeChangedListener.remove();
      }
      if (autocomplete) {
        console.log('Autocomplete 인스턴스 정리');
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
      if (autocompleteRef.current) {
        console.log('Autocomplete 참조 정리');
        autocompleteRef.current = null;
      }
    };
  }, [isOpen, isLoaded, mapRef, setSelectedPlace]);

  const handleInputChange = (event) => {
    if (event && event.target) {
      console.log('검색어 변경:', event.target.value);
      setSearchQuery(event.target.value);
    }
  };

  const handleClose = (event) => {
    if (event) {
      event.preventDefault();
    }
    console.log('SearchPopup 닫기');
    onClose();
  };

  const handleAddPlace = (event) => {
    if (event) {
      event.preventDefault();
    }
    console.log('선택한 장소 추가:', { selectedPlace, insertIndex });
    addPlaceToDay(insertIndex);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90%]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">장소 검색</h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="장소 검색..."
          className="w-full p-2 border border-gray-300 rounded-md mb-4"
          value={searchQuery}
          onChange={handleInputChange}
          autoComplete="off"
        />
        {selectedPlace && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">{selectedPlace.name}</p>
            <p className="text-xs text-gray-500">{selectedPlace.address}</p>
            <div className="flex justify-end mt-4 space-x-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddPlace}
                className="px-4 py-2 bg-primary-dark text-white rounded-md hover:bg-primary"
              >
                Day {selectedDay}에 추가
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPopup; 