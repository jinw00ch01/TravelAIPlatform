import React, { useState, useEffect, useCallback } from 'react';
import { weatherApi } from '../../services/api';

const ItineraryDetail = ({ itinerary, onTitleUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState(null); // "1", "2"와 같은 내부 키
  const [itineraryData, setItineraryData] = useState(null);
  const [weatherData, setWeatherData] = useState({}); // 날씨 데이터 저장
  const [loadingWeather, setLoadingWeather] = useState(false); // 날씨 로딩 상태
  
  useEffect(() => {
    console.log('[ItineraryDetail] useEffect[itinerary] - START. Received itinerary prop:', itinerary ? JSON.parse(JSON.stringify(itinerary)) : itinerary);
    if (itinerary && typeof itinerary === 'object') {
      // itinerary 객체에서 숫자 키를 가진 일차별 데이터만 추출 시도
      const dailyPlans = Object.entries(itinerary)
        .filter(([key]) => !isNaN(parseInt(key)))
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});

      if (Object.keys(dailyPlans).length > 0) {
        console.log('[ItineraryDetail] Extracted dailyPlans:', JSON.parse(JSON.stringify(dailyPlans)));
        setItineraryData(dailyPlans);

        const validNumericKeys = Object.keys(dailyPlans).sort((a, b) => parseInt(a) - parseInt(b));
        if (validNumericKeys.length > 0) {
          // 기존 selectedDateKey가 새로운 dailyPlans에도 유효한 키인지 확인
          // 그렇지 않다면 첫 번째 유효한 키로 설정
          if (selectedDateKey && dailyPlans[selectedDateKey]) {
            console.log('[ItineraryDetail] Keeping existing selectedDateKey:', selectedDateKey);
          } else {
            const firstDayKey = validNumericKeys[0];
            setSelectedDateKey(firstDayKey);
            console.log('[ItineraryDetail] useEffect[itinerary] - set selectedDateKey to (first day):', firstDayKey);
          }
        } else {
          setSelectedDateKey(null);
          console.warn('[ItineraryDetail] No valid numeric keys found in extracted dailyPlans. Setting selectedDateKey to null.');
        }
      } else {
        // 숫자 키로 구성된 일차 데이터가 없는 경우, itinerary 전체를 사용하되 경고
        console.warn('[ItineraryDetail] No numeric keys found for daily plans in itinerary prop. Using itinerary object as is for itineraryData, but this might be incorrect.');
        setItineraryData(itinerary); // 폴백 또는 다른 구조를 기대하는 경우일 수 있음
        setSelectedDateKey(null); // 이 경우 자동 날짜 선택 어려움
      }
      
      const mainTitle = itinerary.name || itinerary.title || "여행 일정";
      setTitle(mainTitle);
      console.log('[ItineraryDetail] useEffect[itinerary] - set mainTitle to:', mainTitle);

    } else {
      console.log('[ItineraryDetail] itinerary prop is null, undefined, or not an object. Resetting states.');
      setItineraryData(null);
      setSelectedDateKey(null);
      setTitle('선택된 일정 없음');
    }
    console.log('[ItineraryDetail] useEffect[itinerary] - END.');
  }, [itinerary]); // itinerary 객체의 참조가 변경될 때만 실행

  useEffect(() => {
    // 이 useEffect는 selectedDateKey나 itineraryData가 실제로 변경되었을 때만 실행되어야 함
    console.log('[ItineraryDetail] selectedDateKey changed to:', selectedDateKey);
    if (itineraryData && selectedDateKey && itineraryData[selectedDateKey]) {
      console.log('[ItineraryDetail] Corresponding data for selectedDateKey:', JSON.parse(JSON.stringify(itineraryData[selectedDateKey])));
    } else if (itineraryData && selectedDateKey) {
      console.warn('[ItineraryDetail] No data found in itineraryData for selectedDateKey:', selectedDateKey);
    }
  }, [selectedDateKey, itineraryData]);
  
  const handleDateSelect = useCallback((dateKey) => {
    console.log('[ItineraryDetail] Date button clicked, new date key:', dateKey);
    setSelectedDateKey(dateKey);
  }, []);

  // 날씨 데이터 가져오기
  useEffect(() => {
    const fetchWeatherData = async () => {
      if (!selectedDateKey || !itineraryData || !itineraryData[selectedDateKey] || 
          !itineraryData[selectedDateKey].schedules) {
        console.log('[ItineraryDetail] 날씨 데이터를 가져오기 위한 기본 조건이 충족되지 않음:', {
          selectedDateKey,
          hasItineraryData: !!itineraryData,
          hasSelectedDateData: itineraryData ? !!itineraryData[selectedDateKey] : false,
          hasSchedules: itineraryData && itineraryData[selectedDateKey] ? !!itineraryData[selectedDateKey].schedules : false
        });
        return;
      }
      
      try {
        setLoadingWeather(true);
        console.log('[ItineraryDetail] 날씨 데이터 로드 시작:', selectedDateKey);
        
        const schedules = itineraryData[selectedDateKey].schedules;
        // 일정 정보에 위도/경도 데이터가 있는지 확인
        const hasLocationData = schedules.some(item => item.lat && item.lng);
        
        // 시작 날짜 결정
        let startDate = itinerary.start_date;
        
        // 시작 날짜가 없는 경우 대체 방법으로 날짜 추출
        if (!startDate) {
          console.log('[ItineraryDetail] start_date가 없음, 대체 방법 사용');
          
          // 방법 1: 일정 제목에서 날짜 추출 시도 (예: "5/31 1일차: ...")
          if (itineraryData[selectedDateKey].title) {
            const dateMatch = itineraryData[selectedDateKey].title.match(/(\d+)\/(\d+)/);
            if (dateMatch) {
              const month = parseInt(dateMatch[1]);
              const day = parseInt(dateMatch[2]);
              const currentYear = new Date().getFullYear();
              startDate = new Date(currentYear, month - 1, day).toISOString();
              console.log(`[ItineraryDetail] 일정 제목에서 날짜 추출: ${startDate}`);
            }
          }
          
          // 방법 2: 위 방법으로 추출 실패 시 현재 날짜 사용
          if (!startDate) {
            startDate = new Date().toISOString();
            console.log(`[ItineraryDetail] 현재 날짜를 시작 날짜로 사용: ${startDate}`);
          }
        }
        
        console.log('[ItineraryDetail] 일정 데이터:', {
          schedulesCount: schedules.length,
          hasLocationData,
          firstSchedule: schedules[0],
          startDate
        });
        
        if (!hasLocationData) {
          console.warn('[ItineraryDetail] 위치 정보(위도/경도)가 있는 일정이 없습니다.');
          setLoadingWeather(false);
          return;
        }
        
        // 날씨 API 호출
        console.log('[ItineraryDetail] 날씨 API 호출 직전', {
          scheduleCount: schedules.length,
          startDate,
          selectedDateKey
        });
        
        try {
          // 직접 첫 번째 위치 데이터로 API 호출 테스트
          const testSchedule = schedules.find(item => item.lat && item.lng);
          if (testSchedule) {
            console.log('[ItineraryDetail] 테스트 API 호출:', {
              lat: testSchedule.lat,
              lng: testSchedule.lng
            });
            
            const testResult = await weatherApi.getWeatherByCoordinates(
              testSchedule.lat,
              testSchedule.lng
            );
            console.log('[ItineraryDetail] 테스트 API 응답:', testResult);
          }
        } catch (testError) {
          console.error('[ItineraryDetail] 테스트 API 호출 실패:', testError);
        }
        
        const weatherResults = await weatherApi.getWeatherForSchedules(
          schedules, 
          startDate, 
          selectedDateKey
        );
        
        console.log('[ItineraryDetail] 날씨 데이터 로드 완료:', Object.keys(weatherResults).length);
        console.log('[ItineraryDetail] 전체 날씨 데이터:', weatherResults);
        
        // 각 일정별 날씨 정보 상세 출력
        Object.entries(weatherResults).forEach(([scheduleId, weatherInfo]) => {
          const schedule = schedules.find(s => s.id === scheduleId);
          console.log(`[ItineraryDetail] 일정 "${schedule?.name || scheduleId}" 날씨 정보:`, {
            scheduleId,
            scheduleName: schedule?.name,
            scheduleTime: schedule?.time,
            weatherTemp: weatherInfo.main?.temp,
            weatherDescription: weatherInfo.weather?.[0]?.description,
            forecastTime: new Date(weatherInfo.dt * 1000).toLocaleString('ko-KR'),
            scheduleDateTime: weatherInfo.scheduleTime ? new Date(weatherInfo.scheduleTime).toLocaleString('ko-KR') : 'N/A',
            fullWeatherData: weatherInfo
          });
        });
        
        setWeatherData(weatherResults);
      } catch (error) {
        console.error('[ItineraryDetail] 날씨 데이터 로드 실패:', error);
      } finally {
        setLoadingWeather(false);
      }
    };
    
    fetchWeatherData();
  }, [selectedDateKey, itineraryData, itinerary.start_date]);

  if (!itineraryData || Object.keys(itineraryData).filter(key => !isNaN(parseInt(key))).length === 0) {
    // 숫자 키를 가진 일차 데이터가 없으면 로딩 또는 정보 없음 메시지 표시 강화
    return <div className="p-6 text-center">여행 정보를 불러오는 중이거나 표시할 일차별 정보가 없습니다...</div>;
  }
  
  const availableDates = Object.keys(itineraryData)
    .filter(key => {
      const K = parseInt(key);
      return !isNaN(K) && itineraryData[key] && typeof itineraryData[key] === 'object' && itineraryData[key].title;
    }) 
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(dayNumber => {
      const dayData = itineraryData[dayNumber];
      
      // 실제 날짜 계산
      let displayDateStr = `${dayNumber}일차`;
      let actualDate = null;
      
      // 방법 1: start_date가 있으면 사용
      if (itinerary?.start_date) {
        const startDate = new Date(itinerary.start_date);
        actualDate = new Date(startDate);
        actualDate.setDate(startDate.getDate() + parseInt(dayNumber) - 1);
        displayDateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
      }
      // 방법 2: 숙소 체크인 날짜에서 추출
      else if (itinerary?.accommodationInfos?.length > 0) {
        const firstAccommodation = itinerary.accommodationInfos.find(acc => acc.checkIn);
        if (firstAccommodation) {
          const checkInDate = new Date(firstAccommodation.checkIn);
          actualDate = new Date(checkInDate);
          actualDate.setDate(checkInDate.getDate() + parseInt(dayNumber) - 1);
          displayDateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;
        }
      }
      // 방법 3: 제목에서 날짜 패턴 찾기 (기존 방식)
      else if (dayData.title && typeof dayData.title === 'string') {
        const dateMatch = dayData.title.match(/(\d+\/\d+)/);
        if (dateMatch && dateMatch[1]) {
          displayDateStr = dateMatch[1];
        }
      }
      
      return {
        date: dayNumber, 
        displayDate: displayDateStr,
        day: `${dayNumber}일차`,
        actualDate: actualDate
      };
    });
  // console.log('[ItineraryDetail] Computed availableDates:', JSON.parse(JSON.stringify(availableDates)));
  
  const handleTitleSubmit = (e) => {
    e.preventDefault();
    const itineraryId = itinerary?.plan_id || itinerary?.id || 'unknown_id'; 
    onTitleUpdate(itineraryId, title);
    setIsEditing(false);
  };
  
  const currentDateData = selectedDateKey && itineraryData && itineraryData[selectedDateKey] ? itineraryData[selectedDateKey] : null;
  // console.log('[ItineraryDetail] Computed currentDateData for key:', selectedDateKey, currentDateData ? JSON.parse(JSON.stringify(currentDateData)) : currentDateData);

  const schedules = currentDateData?.schedules || [];

  // 날씨 아이콘 매핑 함수
  const getWeatherIcon = (weatherId) => {
    if (weatherId >= 200 && weatherId < 300) return '⛈️'; // 뇌우
    if (weatherId >= 300 && weatherId < 400) return '🌧️'; // 이슬비
    if (weatherId >= 500 && weatherId < 600) return '🌧️'; // 비
    if (weatherId >= 600 && weatherId < 700) return '❄️'; // 눈
    if (weatherId >= 700 && weatherId < 800) return '🌫️'; // 안개
    if (weatherId === 800) return '☀️'; // 맑음
    if (weatherId > 800) return '☁️'; // 구름
    return '🌡️'; // 기본값
  };
  
  // 날씨 정보 표시 컴포넌트
  const WeatherInfo = ({ scheduleId }) => {
    const weatherInfo = weatherData[scheduleId];
    
    if (!weatherInfo || !weatherInfo.weather || weatherInfo.weather.length === 0) {
      return null;
    }
    
    // 예보 범위를 벗어나는 경우 처리
    if (weatherInfo.isOutOfRange) {
      return (
        <div className="flex flex-wrap items-center text-sm mt-2 bg-gray-50 rounded-md p-1.5 px-2 border border-gray-200">
          <span className="text-lg mr-1">❓</span>
          <span className="font-medium text-gray-600">예측불가</span>
          <span className="ml-1 text-xs text-gray-500">예보 범위 초과</span>
        </div>
      );
    }
    
    // 날씨 정보 추출
    const weatherId = weatherInfo.weather[0].id;
    const icon = getWeatherIcon(weatherId);
    const temp = weatherInfo.main.temp ? Math.round(weatherInfo.main.temp) : null;
    const description = weatherInfo.weather[0].description;
    
    // 예보 시간
    let forecastTime;
    if (weatherInfo.dt) {
      // Unix 타임스탬프 (초)
      forecastTime = new Date(weatherInfo.dt * 1000);
    } else if (weatherInfo.forecastTime) {
      // ISO 문자열
      forecastTime = new Date(weatherInfo.forecastTime);
    } else {
      forecastTime = new Date();
    }
    
    // 한국어 날짜 포맷 옵션
    const timeFormatOptions = { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false  // 24시간제로 표시
    };
    
    return (
      <div className="flex flex-wrap items-center text-sm mt-2 bg-blue-50 rounded-md p-1.5 px-2">
        <span className="text-lg mr-1">{icon}</span>
        {temp !== null ? (
          <span className="font-medium">{temp}°C</span>
        ) : (
          <span className="font-medium text-gray-500">-°C</span>
        )}
        <span className="ml-1 text-xs text-gray-600">{description}</span>
        <div className="ml-auto text-xs text-gray-500 flex items-center">
          <span>{forecastTime.toLocaleTimeString('ko-KR', timeFormatOptions)} 기준</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* 헤더 섹션 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {isEditing ? (
                <form onSubmit={handleTitleSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-3xl font-bold text-gray-800 border-b-2 border-blue-500 focus:outline-none"
                    autoFocus
                  />
                  <button type="submit" className="text-blue-500 hover:text-blue-700">저장</button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setTitle(itinerary?.name || itinerary?.title || "제목 없음"); 
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >취소</button>
                </form>
              ) : (
                <>
                  <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
                  {itinerary && Object.keys(itinerary).length > 0 && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="ml-3 text-gray-500 hover:text-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
            {/* 여행 기간 표시 */}
            {(() => {
              // 전체 숙소 정보에서 여행 기간 계산
              const allAccommodations = itinerary?.accommodationInfos || [];
              
              if (allAccommodations.length > 0) {
                const checkInDates = allAccommodations
                  .filter(acc => acc.checkIn)
                  .map(acc => new Date(acc.checkIn));
                const checkOutDates = allAccommodations
                  .filter(acc => acc.checkOut)
                  .map(acc => new Date(acc.checkOut));
                
                if (checkInDates.length > 0 && checkOutDates.length > 0) {
                  const earliestCheckIn = new Date(Math.min(...checkInDates));
                  const latestCheckOut = new Date(Math.max(...checkOutDates));
                  
                  return (
                    <div className="text-right">
                      <div className="text-sm text-gray-600">여행 기간</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {earliestCheckIn.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                        {' - '}
                        {latestCheckOut.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  );
                }
              }
              
              // 대체: start_date가 있으면 사용
              if (itinerary?.start_date) {
                return (
                  <div className="text-right">
                    <div className="text-sm text-gray-600">여행 시작일</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {new Date(itinerary.start_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                );
              }
              
              return null;
            })()}
          </div>
        </div>

        {/* 숙소 및 항공권 요약 섹션 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 숙소 요약 - 선택된 날짜의 숙박 정보 표시 */}
          {(() => {
            // 방법 1: 선택된 날짜의 스케줄에서 숙박 정보 찾기
            const currentSchedules = currentDateData?.schedules || [];
            let currentAccommodations = currentSchedules.filter(item => 
              item.type === 'accommodation'
            );
            
            // 방법 2: 전체 숙소 정보에서 해당 날짜에 맞는 숙소들 찾기
            if (currentAccommodations.length === 0 && selectedDateKey && itinerary?.accommodationInfos) {
              const dayNumber = parseInt(selectedDateKey);
              if (!isNaN(dayNumber)) {
                // 해당 날짜 계산
                let targetDate = null;
                if (itinerary.start_date) {
                  const startDate = new Date(itinerary.start_date);
                  targetDate = new Date(startDate);
                  targetDate.setDate(startDate.getDate() + dayNumber - 1);
                } else if (itinerary.accommodationInfos[0]?.checkIn) {
                  const firstCheckIn = new Date(itinerary.accommodationInfos[0].checkIn);
                  targetDate = new Date(firstCheckIn);
                  targetDate.setDate(firstCheckIn.getDate() + dayNumber - 1);
                }
                
                if (targetDate) {
                  // 해당 날짜에 관련된 모든 숙소 찾기 (체크인, 체크아웃, 숙박 중)
                  const matchingAccommodations = itinerary.accommodationInfos.filter(acc => {
                    if (!acc.checkIn || !acc.checkOut) return false;
                    
                    const checkInDate = new Date(acc.checkIn);
                    const checkOutDate = new Date(acc.checkOut);
                    
                    // 체크인 날짜 <= 대상 날짜 <= 체크아웃 날짜
                    return targetDate >= checkInDate && targetDate <= checkOutDate;
                  });
                  
                  currentAccommodations = matchingAccommodations.map(acc => ({
                    hotelDetails: acc
                  }));
                }
                
                // 위 방법으로도 안 되면 인덱스로 시도
                if (currentAccommodations.length === 0 && itinerary.accommodationInfos[dayNumber - 1]) {
                  const accommodationInfo = itinerary.accommodationInfos[dayNumber - 1];
                  currentAccommodations = [{
                    hotelDetails: accommodationInfo
                  }];
                }
              }
            }
            
            console.log(`[ItineraryDetail] ${selectedDateKey}일차 숙소 정보:`, {
              currentSchedules: currentSchedules.length,
              accommodationsFromSchedule: currentSchedules.filter(item => item.type === 'accommodation'),
              foundAccommodations: currentAccommodations.length,
              allAccommodations: itinerary?.accommodationInfos?.length || 0
            });
            
            return currentAccommodations.length > 0 ? (
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-2 flex items-center">
                  <span className="mr-2">🏨</span>
                  숙소 정보 ({(() => {
                    const selectedDate = availableDates.find(d => d.date === selectedDateKey);
                    return selectedDate ? selectedDate.displayDate : `${selectedDateKey}일차`;
                  })()})
                </h3>
                <div className="space-y-4">
                  {currentAccommodations.map((accommodation, index) => {
                    const accommodationDetails = accommodation.hotelDetails;
                    
                    return (
                      <div key={index} className={`space-y-2 ${index > 0 ? 'pt-4 border-t border-green-200' : ''}`}>
                        <div className="font-medium">{accommodationDetails.hotel.hotel_name || accommodationDetails.hotel.name}</div>
                        <div className="text-sm text-gray-600">{accommodationDetails.hotel.address || accommodationDetails.hotel.address_trans}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">체크인:</span>
                            <div className="font-medium">
                              {accommodationDetails.checkIn ? 
                                new Date(accommodationDetails.checkIn).toLocaleString('ko-KR', { 
                                  month: 'numeric', 
                                  day: 'numeric', 
                                  hour: 'numeric', 
                                  minute: 'numeric' 
                                }) : 
                                '정보 없음'
                              }
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">체크아웃:</span>
                            <div className="font-medium">
                              {accommodationDetails.checkOut ? 
                                new Date(accommodationDetails.checkOut).toLocaleString('ko-KR', { 
                                  month: 'numeric', 
                                  day: 'numeric', 
                                  hour: 'numeric', 
                                  minute: 'numeric' 
                                }) : 
                                '정보 없음'
                              }
                            </div>
                          </div>
                        </div>
                        {accommodationDetails.hotel.price && (
                          <div className="text-green-600 font-medium">
                            가격: {(() => {
                              const price = accommodationDetails.hotel.price;
                              let numericPrice = null;
                              
                              if (typeof price === 'number') {
                                numericPrice = price;
                              } else if (typeof price === 'string') {
                                // 숫자가 아닌 문자 제거 후 파싱
                                const cleanedPrice = price.replace(/[^0-9.]/g, '');
                                numericPrice = parseFloat(cleanedPrice);
                              }
                              
                              if (numericPrice && !isNaN(numericPrice)) {
                                return new Intl.NumberFormat('ko-KR', {
                                  style: 'currency',
                                  currency: 'KRW',
                                  maximumFractionDigits: 0
                                }).format(numericPrice);
                              } else {
                                return price; // 원본 가격 그대로 표시
                              }
                            })()}
                          </div>
                        )}
                        {accommodationDetails.room && (
                          <div className="text-sm text-gray-600">
                            객실: {accommodationDetails.room.name || accommodationDetails.room.room_type || '선택된 객실'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;
          })()}

          {/* 항공권 요약 */}
          {(() => {
            // 선택된 날짜에 해당하는 항공편 찾기
            if (!itinerary?.flightInfo || itinerary.flightInfo.length === 0) return null;
            
            const dayNumber = parseInt(selectedDateKey);
            let targetDate = null;
            
            // 해당 날짜 계산
            if (itinerary.start_date) {
              const startDate = new Date(itinerary.start_date);
              targetDate = new Date(startDate);
              targetDate.setDate(startDate.getDate() + dayNumber - 1);
            } else if (itinerary.accommodationInfos?.[0]?.checkIn) {
              const firstCheckIn = new Date(itinerary.accommodationInfos[0].checkIn);
              targetDate = new Date(firstCheckIn);
              targetDate.setDate(firstCheckIn.getDate() + dayNumber - 1);
            }
            
            if (!targetDate) return null;
            
            // 해당 날짜의 항공편들 찾기
            const relevantFlights = [];
            
            itinerary.flightInfo.forEach((flight, flightIndex) => {
              let allItineraries = [];
              
              // 구조 1: flightOfferDetails.flightOfferData.itineraries
              if (flight.flightOfferDetails?.flightOfferData?.itineraries) {
                allItineraries = flight.flightOfferDetails.flightOfferData.itineraries;
              }
              // 구조 2: itineraries 직접 접근
              else if (flight.itineraries) {
                allItineraries = flight.itineraries;
              }
              // 구조 3: 단순화된 형태
              else if (flight.departure || flight.origin) {
                allItineraries = [{
                  segments: [{
                    departure: flight.departure || { iataCode: flight.origin, at: flight.departureTime },
                    arrival: flight.arrival || { iataCode: flight.destination, at: flight.arrivalTime }
                  }],
                  duration: flight.duration
                }];
              }
              
              // 해당 날짜의 여정들 필터링
              const relevantItineraries = allItineraries.filter((itinerary, itineraryIndex) => {
                const segments = itinerary.segments || [];
                const firstSegment = segments[0];
                const lastSegment = segments[segments.length - 1];
                
                if (!firstSegment?.departure?.at && !lastSegment?.arrival?.at) return false;
                
                // 출발 날짜 또는 도착 날짜가 선택된 날짜와 일치하는지 확인
                let matchesDate = false;
                
                if (firstSegment?.departure?.at) {
                  const departureDate = new Date(firstSegment.departure.at);
                  if (departureDate.toDateString() === targetDate.toDateString()) {
                    matchesDate = true;
                  }
                }
                
                if (lastSegment?.arrival?.at) {
                  const arrivalDate = new Date(lastSegment.arrival.at);
                  if (arrivalDate.toDateString() === targetDate.toDateString()) {
                    matchesDate = true;
                  }
                }
                
                return matchesDate;
              });
              
              if (relevantItineraries.length > 0) {
                relevantFlights.push({
                  ...flight,
                  relevantItineraries,
                  flightIndex
                });
              }
            });
            
            return relevantFlights.length > 0 ? (
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center">
                  <span className="mr-2">✈️</span>
                  항공권 정보 ({(() => {
                    const selectedDate = availableDates.find(d => d.date === selectedDateKey);
                    return selectedDate ? selectedDate.displayDate : `${selectedDateKey}일차`;
                  })()})
                </h3>
                <div className="space-y-3">
                  {relevantFlights.map((flight, index) => {
                    const basePrice = flight.flightOfferDetails?.flightOfferData?.price?.total || 
                                    flight.price?.total;
                    
                    return (
                      <div key={index} className="border border-blue-200 rounded-lg p-3 mb-3 last:mb-0">
                        <div className="font-medium text-blue-800 mb-2">항공편 {flight.flightIndex + 1}</div>
                        
                        {flight.relevantItineraries.map((itinerary, itineraryIndex) => {
                          const segments = itinerary.segments || [];
                          const firstSegment = segments[0];
                          const lastSegment = segments[segments.length - 1];
                          
                          let departureTime = null;
                          let arrivalTime = null;
                          
                          // 출발 시간 처리
                          if (firstSegment?.departure?.at) {
                            try {
                              departureTime = new Date(firstSegment.departure.at);
                              if (isNaN(departureTime.getTime())) {
                                departureTime = null;
                              }
                            } catch (error) {
                              departureTime = null;
                            }
                          }
                          
                          // 도착 시간 처리
                          if (lastSegment?.arrival?.at) {
                            try {
                              arrivalTime = new Date(lastSegment.arrival.at);
                              if (isNaN(arrivalTime.getTime())) {
                                arrivalTime = null;
                              }
                            } catch (error) {
                              arrivalTime = null;
                            }
                          }
                          
                          const isRoundTrip = flight.relevantItineraries.length > 1;
                          const tripDirection = isRoundTrip ? (itineraryIndex === 0 ? '가는편' : '오는편') : '';
                          
                          return (
                            <div key={itineraryIndex} className="border-b border-blue-100 pb-2 last:border-0 mb-2 last:mb-0">
                              <div className="font-medium flex items-center">
                                <span>{firstSegment?.departure?.iataCode || '출발지'} → {lastSegment?.arrival?.iataCode || '도착지'}</span>
                                {tripDirection && (
                                  <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                                    {tripDirection}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                <div>
                                  출발: {departureTime ? 
                                    departureTime.toLocaleString('ko-KR', {
                                      month: 'numeric',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: 'numeric'
                                    }) : 
                                    '시간 정보 없음'
                                  }
                                </div>
                                <div>
                                  도착: {arrivalTime ? 
                                    arrivalTime.toLocaleString('ko-KR', {
                                      month: 'numeric',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: 'numeric'
                                    }) : 
                                    '시간 정보 없음'
                                  }
                                </div>
                                {itinerary.duration && (
                                  <div>소요시간: {itinerary.duration}</div>
                                )}
                                {segments.length > 1 && (
                                  <div className="text-orange-600">경유 {segments.length - 1}회</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        
                        {basePrice && (
                          <div className="text-blue-600 text-sm font-medium mt-2 pt-2 border-t border-blue-100">
                            총 가격: {new Intl.NumberFormat('ko-KR', {
                              style: 'currency',
                              currency: 'KRW',
                              maximumFractionDigits: 0
                            }).format(parseFloat(basePrice))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;
          })()}
        </div>

        {/* 캘린더 네비게이션 */}
        {availableDates.length > 0 ? (
          <div className="flex mb-6 space-x-2 overflow-x-auto pb-2">
            {availableDates.map(dateInfo => (
              <button
                key={dateInfo.date}
                onClick={() => handleDateSelect(dateInfo.date)}
                className={`px-4 py-2 rounded-full flex-shrink-0 ${
                  selectedDateKey === dateInfo.date
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="font-medium">{dateInfo.displayDate}</span>
                <span className="ml-1 text-xs opacity-75">{dateInfo.day}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-6 text-center text-gray-500">표시할 날짜 정보가 없습니다.</div>
        )}

        {/* 날씨 데이터 로딩 인디케이터 */}
        {loadingWeather && (
          <div className="text-center text-sm text-blue-500 mb-2">
            <span className="inline-block animate-spin mr-1">🔄</span> 날씨 정보 로딩 중...
          </div>
        )}

        {/* 일정 타임라인 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            {currentDateData && currentDateData.title ? `${currentDateData.title} 상세 일정` : (itineraryData ? '상세 일정' : '정보 없음')}
          </h3>
          
          {currentDateData && schedules && schedules.length > 0 ? (
            <div className="space-y-4">
              {/* 항공편 정보 */}
              {schedules.filter(item => item.type === 'Flight_Departure' || item.type === 'Flight_Return').length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h4 className="text-lg font-semibold text-blue-800 mb-3">✈️ 항공편 정보</h4>
                  <div className="space-y-3">
                    {schedules
                      .filter(item => item.type === 'Flight_Departure' || item.type === 'Flight_Return')
                      .map((item, index) => (
                        <div key={item.id || index} className="flex items-start p-3 bg-white rounded-lg shadow-sm">
                          <div className="flex-grow">
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              <div>시간: {item.time}</div>
                              {item.duration && <div>소요시간: {item.duration}</div>}
                              {item.notes && <div className="text-blue-600">{item.notes}</div>}
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 숙박 정보 */}
              {schedules.filter(item => item.type === 'accommodation').length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <h4 className="text-lg font-semibold text-green-800 mb-3">🏨 숙박 정보</h4>
                  <div className="space-y-3">
                    {schedules
                      .filter(item => item.type === 'accommodation')
                      .map((item, index) => (
                        <div key={item.id || index} className="flex items-start p-3 bg-white rounded-lg shadow-sm">
                          <div className="flex-grow">
                            <div className="font-medium text-gray-800">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              <div>{item.time === '체크인' ? '체크인' : '체크아웃'} 시간: {item.time}</div>
                              {item.address && <div>주소: {item.address}</div>}
                              {item.hotelDetails?.hotel?.price && (
                                <div className="text-green-600">
                                  가격: {(() => {
                                    const price = item.hotelDetails.hotel.price;
                                    let numericPrice = null;
                                    
                                    if (typeof price === 'number') {
                                      numericPrice = price;
                                    } else if (typeof price === 'string') {
                                      // 숫자가 아닌 문자 제거 후 파싱
                                      const cleanedPrice = price.replace(/[^0-9.]/g, '');
                                      numericPrice = parseFloat(cleanedPrice);
                                    }
                                    
                                    if (numericPrice && !isNaN(numericPrice)) {
                                      return new Intl.NumberFormat('ko-KR', {
                                        style: 'currency',
                                        currency: 'KRW',
                                        maximumFractionDigits: 0
                                      }).format(numericPrice);
                                    } else {
                                      return price; // 원본 가격 그대로 표시
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 일반 일정 */}
              <div className="space-y-3">
                {schedules
                  .filter(item => item.type !== 'Flight_Departure' && item.type !== 'Flight_Return' && item.type !== 'accommodation')
                  .map((item, index) => {
                    const icon = getIconByCategory(item.category);
                    return (
                      <div key={item.id || index} className="flex items-start p-4 bg-white rounded-lg shadow-sm">
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full mr-4">
                          {icon}
                        </div>
                        <div className="flex-grow">
                          <div className="font-medium text-gray-800">{item.name}</div>
                          <div className="text-sm text-gray-600">
                            <div>시간: {item.time}</div>
                            {item.duration && <div>소요시간: {item.duration}</div>}
                            {item.address && <div>주소: {item.address}</div>}
                            {item.notes && <div className="text-gray-500">{item.notes}</div>}
                            
                            {/* 날씨 정보 표시 */}
                            {item.id && <WeatherInfo scheduleId={item.id} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">선택된 날짜의 일정이 없습니다.</div>
          )}
        </div>

        {/* 하단 팁 섹션 */}
        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">여행 팁</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">준비물</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>여권</li><li>현지 통화 </li><li>여행 보험</li><li>필수 의류</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">주의사항</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>날씨 확인</li><li>지하철/교통 정보 확인</li><li>비상 연락처</li><li>여행자 에티켓 준수</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 카테고리별 아이콘 매핑
const getIconByCategory = (category) => {
  switch (category?.toLowerCase()) {
    case '항공편': return '✈️';
    case '식당': return '🍱';
    case '장소': return '🏛️';
    case '호텔': return '🏨';
    case '쇼핑': return '🛍️';
    default: return '📍';
  }
};

export default ItineraryDetail; 