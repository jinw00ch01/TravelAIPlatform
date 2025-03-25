import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Transition } from '@headlessui/react';
import GoogleMapComponent from '../components/GoogleMapComponent';
import SearchPopup from '../components/SearchPopup';
import { useLoadScript } from '@react-google-maps/api';

// Google Maps API 라이브러리 정의
const libraries = ['places'];

const TravelPlanner = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showToggleButton, setShowToggleButton] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState(-1);
  const [travelPlans, setTravelPlans] = useState({
    1: {
      schedules: [],
      title: '첫째 날'
    },
    2: {
      schedules: [],
      title: '둘째 날'
    },
    3: {
      schedules: [],
      title: '셋째 날'
    },
  });

  const mapRef = useRef(null);

  // Google Maps 로드 설정
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
    language: 'ko',
    region: 'KR',
    version: 'weekly'
  });

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    if (isSidebarOpen) {
      setTimeout(() => setShowToggleButton(true), 80);
    } else {
      setShowToggleButton(false);
    }
  };

  const addPlaceToDay = useCallback((insertIndex = -1) => {
    if (!selectedPlace) return;

    setTravelPlans(prev => {
      const daySchedules = [...prev[selectedDay].schedules];
      const newSchedule = {
        name: selectedPlace.name,
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        address: selectedPlace.address
      };
      
      if (insertIndex === -1) {
        daySchedules.push(newSchedule);
      } else {
        daySchedules.splice(insertIndex, 0, newSchedule);
      }
      return {
        ...prev,
        [selectedDay]: {
          ...prev[selectedDay],
          schedules: daySchedules
        }
      };
    });
    setSelectedPlace(null);
  }, [selectedDay, selectedPlace]);

  const getDayTitle = (dayNumber) => {
    const titles = ['첫째 날', '둘째 날', '셋째 날', '넷째 날', '다섯째 날', '여섯째 날', '일곱째 날'];
    return titles[dayNumber - 1] || `${dayNumber}일차`;
  };

  const addNewDay = (afterDay = null) => {
    setTravelPlans(prev => {
      const days = Object.keys(prev).map(Number).sort((a, b) => a - b);
      
      if (afterDay === null) {
        const newDayNumber = days[days.length - 1] + 1;
        const dayTitle = getDayTitle(newDayNumber);
        return {
          ...prev,
          [newDayNumber]: {
            schedules: [],
            title: dayTitle
          }
        };
      } else {
        const reorderedPlans = {};
        let newDayNumber = 1;

        days.forEach(day => {
          if (day <= afterDay) {
            reorderedPlans[newDayNumber] = {
              ...prev[day],
              title: getDayTitle(newDayNumber)
            };
            newDayNumber++;
          }
        });

        reorderedPlans[newDayNumber] = {
          schedules: [],
          title: getDayTitle(newDayNumber)
        };
        newDayNumber++;

        days.forEach(day => {
          if (day > afterDay) {
            reorderedPlans[newDayNumber] = {
              ...prev[day],
              title: getDayTitle(newDayNumber)
            };
            newDayNumber++;
          }
        });

        return reorderedPlans;
      }
    });
  };

  const removeDay = (dayToRemove) => {
    if (Object.keys(travelPlans).length <= 1) {
      alert('최소 1일은 유지해야 합니다.');
      return;
    }
    
    setTravelPlans(prev => {
      const newTravelPlans = { ...prev };
      delete newTravelPlans[dayToRemove];
      
      const sortedDays = Object.keys(newTravelPlans)
        .sort((a, b) => parseInt(a) - parseInt(b));
      
      const reorderedPlans = {};
      sortedDays.forEach((oldDay, index) => {
        const newDay = index + 1;
        reorderedPlans[newDay] = {
          ...newTravelPlans[oldDay],
          title: getDayTitle(newDay)
        };
      });

      return reorderedPlans;
    });

    if (selectedDay === dayToRemove) {
      setSelectedDay(1);
    } else if (selectedDay > dayToRemove) {
      setSelectedDay(selectedDay - 1);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <SearchPopup
        isOpen={isSearchPopupOpen}
        onClose={() => {
          setIsSearchPopupOpen(false);
          setSelectedPlace(null);
          setSearchQuery('');
          setInsertIndex(-1);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedPlace={selectedPlace}
        setSelectedPlace={setSelectedPlace}
        addPlaceToDay={addPlaceToDay}
        selectedDay={selectedDay}
        insertIndex={insertIndex}
        mapRef={mapRef}
        isLoaded={isLoaded}
      />

      <Transition
        show={isSidebarOpen}
        enter="transition ease-out duration-300"
        enterFrom="-translate-x-full"
        enterTo="translate-x-0"
        leave="transition ease-in duration-300"
        leaveFrom="translate-x-0"
        leaveTo="-translate-x-full"
        className="fixed z-40 left-0 top-16 h-[calc(100vh-4rem)] bg-white shadow-lg transform"
      >
        <div className="relative w-80 h-full flex flex-col">
          <button
            className="absolute -right-20 top-2 transform bg-primary-dark text-white px-4 py-2 rounded-r-md whitespace-nowrap"
            onClick={toggleSidebar}
          >
            일정보기
          </button>

          <div className="p-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold">여행 일정</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {Object.entries(travelPlans)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([day, { schedules, title }]) => (
                  <React.Fragment key={day}>
                    <div
                      className={`p-4 rounded-lg cursor-pointer transition-colors relative ${
                        selectedDay === parseInt(day)
                          ? 'bg-primary-dark text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => setSelectedDay(parseInt(day))}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold">{title}</h3>
                        {Object.keys(travelPlans).length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeDay(parseInt(day));
                            }}
                            className="text-sm hover:text-red-500"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {schedules.length === 0 ? (
                        <p 
                          className="text-sm mt-2 hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInsertIndex(-1);
                            setIsSearchPopupOpen(true);
                          }}
                        >
                          새로운 일정 추가하기
                        </p>
                      ) : (
                        <div>
                          <ul className="mt-2 space-y-1">
                            <li>
                              <button
                                className="w-full text-sm py-1 px-2 rounded hover:bg-black hover:bg-opacity-10 text-left flex items-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInsertIndex(-1);
                                  setIsSearchPopupOpen(true);
                                }}
                              >
                                <span className="mr-2">+</span> 여기에 일정 추가
                              </button>
                            </li>
                            {schedules.map((schedule, index) => (
                              <React.Fragment key={index}>
                                <li className="flex items-center py-1">
                                  <span className="mr-2">{index + 1}.</span>
                                  <span className="flex-1">{schedule.name}</span>
                                </li>
                                <li>
                                  <button
                                    className="w-full text-sm py-1 px-2 rounded hover:bg-black hover:bg-opacity-10 text-left flex items-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInsertIndex(index + 1);
                                      setIsSearchPopupOpen(true);
                                    }}
                                  >
                                    <span className="mr-2">+</span> 여기에 일정 추가
                                  </button>
                                </li>
                              </React.Fragment>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => addNewDay(parseInt(day))}
                      className="w-full p-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center"
                    >
                      <span className="w-full border-b border-dashed border-gray-300 relative">
                        <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-white px-2 hover:bg-gray-100 rounded whitespace-nowrap">
                          + 새로운 날짜 추가
                        </span>
                      </span>
                    </button>
                  </React.Fragment>
                ))}
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  console.log('취소');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={() => {
                  console.log('저장');
                }}
                className="px-4 py-2 bg-primary-dark text-white rounded-md hover:bg-primary"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <Transition
        show={!isSidebarOpen && showToggleButton}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <button
          className="fixed z-50 left-0 top-[4.5rem] bg-primary-dark text-white px-4 py-2 rounded-r-md whitespace-nowrap"
          onClick={toggleSidebar}
        >
          일정보기
        </button>
      </Transition>

      <div className="flex-1 ml-0">
        <GoogleMapComponent
          selectedPlace={selectedPlace}
          travelPlans={travelPlans}
          selectedDay={selectedDay}
          mapRef={mapRef}
          isLoaded={isLoaded}
          loadError={loadError}
        />
      </div>
    </div>
  );
};

export default TravelPlanner; 