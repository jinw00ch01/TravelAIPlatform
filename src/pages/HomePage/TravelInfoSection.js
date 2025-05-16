import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Loader2, MapPin, Plane, Hotel } from "lucide-react";
import { format, differenceInDays } from "date-fns";

// 도시코드 → 한글명 매핑
const cityCodeToKorean = {
  CJU: '제주도',
  OSA: '오사카',
  TYO: '도쿄',
  ULN: '울란바토르',
  BKK: '방콕',
  PAR: '파리',
  BCN: '바르셀로나',
  DPS: '발리',
  SPK: '삿포로',
  FUK: '후쿠오카',
  LAX: '로스앤젤레스'
};

// 도시코드 → 국가명 매핑
const cityCodeToCountry = {
  CJU: '대한민국',
  OSA: '일본',
  TYO: '일본',
  ULN: '몽골',
  BKK: '태국',
  PAR: '프랑스',
  BCN: '스페인',
  DPS: '인도네시아',
  SPK: '일본',
  FUK: '일본',
  LAX: '미국'
};

// 인기 여행지 데이터를 가져오는 함수
const fetchPopularDestinations = async () => {
  try {
    console.log('인기 여행지 데이터 요청 시작');
    const response = await fetch('https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/amadeus/Flight_Most_Traveled_Destinations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originCityCode: 'SEL',
        period: '2023-07',
        max: 10
      })
    });

    if (!response.ok) {
      throw new Error('인기 여행지 데이터를 가져오는데 실패했습니다.');
    }

    const data = await response.json();
    console.log('API 응답 데이터:', data);
    return data;
  } catch (error) {
    console.error('인기 여행지 데이터 조회 실패:', error);
    return [];
  }
};

// 여행지 추천 데이터를 가져오는 함수
const fetchFlightInspiration = async (params) => {
  try {
    const response = await fetch('https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/amadeus/Flight_Inspiration_Search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('여행지 추천 데이터를 가져오는데 실패했습니다.');
    }

    return await response.json();
  } catch (error) {
    console.error('여행지 추천 데이터 조회 실패:', error);
    throw error;
  }
};

// Travel information section containing popular destinations, airlines and hotels
const TravelInfoSection = () => {
  // Loading and tab state
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("destinations");

  // API 데이터 관련 상태
  const [popularDestinations, setPopularDestinations] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [flightInspiration, setFlightInspiration] = useState([]);
  const [isLoadingInspiration, setIsLoadingInspiration] = useState(false);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        // 인기 여행지 데이터 가져오기
        const destinationsData = await fetchPopularDestinations();
        console.log('받아온 여행지 데이터:', destinationsData);
        
        const dataArray = destinationsData.data;

        if (dataArray && Array.isArray(dataArray)) {
          const mappedDestinations = dataArray.map((dest, index) => {
            const code = dest.destination || dest.name;
            const cityName = cityCodeToKorean[code] || code;
            return {
              id: index + 1,
              code, // 도시코드
              name: cityName,
              image: `/city-images/${code}.jpg`,
              description: `${index + 1}위`
            };
          });
          console.log('매핑된 여행지 데이터:', mappedDestinations);
          setPopularDestinations(mappedDestinations);
        } else {
          console.log('유효한 여행지 데이터가 없습니다');
          setPopularDestinations([]);
        }
      } catch (error) {
        console.error('데이터 로딩 중 오류 발생:', error);
        setPopularDestinations([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, []);

  // 여행지 추천 데이터 로드
  useEffect(() => {
    const loadInspiration = async () => {
      setIsLoadingInspiration(true);
      try {
        console.log('여행지 추천 API 호출 시작');
        const params = {
          origin: 'SEL',
          //departureDate: '2025-05-08,2025-05-12',
          // duration: '7',
          // maxPrice: 1000000,
          // oneWay: false,  
          // currencyCode: 'KRW',
          // viewBy: 'DESTINATION'
        };
        console.log('API 요청 파라미터:', params);
        
        const data = await fetchFlightInspiration(params);
        console.log('API 응답 데이터:', data);
        
        if (data && data.data) {
          console.log('처리된 여행지 추천 데이터:', data.data);
          setFlightInspiration(data.data || []);
        } else {
          console.warn('API 응답에 data 필드가 없습니다:', data);
          setFlightInspiration([]);
        }
      } catch (error) {
        console.error('여행지 추천 API 호출 중 오류 발생:', error);
        setFlightInspiration([]);
      } finally {
        setIsLoadingInspiration(false);
        console.log('여행지 추천 데이터 로딩 완료');
      }
    };

    loadInspiration();
  }, []);

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-gray-500">데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-12">
      <h2 className="text-3xl font-bold text-center mb-8">여행 정보</h2>

      {/* 탭 네비게이션 */}
      <div className="flex justify-center mb-8 border-b">
        <button
          className={`px-6 py-3 font-medium ${activeTab === "destinations" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}
          onClick={() => setActiveTab("destinations")}
        >
          <MapPin className="inline-block mr-2" size={18} />
          인기 여행지
        </button>
        <button
          className={`px-6 py-3 font-medium ${activeTab === "inspiration" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}
          onClick={() => setActiveTab("inspiration")}
        >
          ✈️ 여행지 추천
        </button>
        <button
          className={`px-6 py-3 font-medium ${activeTab === "hotels" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}
          onClick={() => setActiveTab("hotels")}
        >
          <Hotel className="inline-block mr-2" size={18} />
          호텔 정보
        </button>
      </div>

      {/* 인기 여행지 섹션 */}
      {activeTab === "destinations" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularDestinations.map((destination) => (
            <Card key={destination.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 w-200 flex items-center justify-center bg-gray-100">
                <img
                  src={`/city-images/${destination.code}.jpg`}
                  alt={destination.name}
                  className="max-w-full max-h-full object-contain"
                  onError={e => { e.target.onerror = null; e.target.src = '/city-images/default.jpg'; }}
                />
              </div>
              <CardContent className="p-4">
                <h3 className="text-xl font-bold mb-2">{destination.name}</h3>
                <p className="text-gray-600">{destination.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 여행지 추천 섹션 */}
      {activeTab === "inspiration" && (
        <div className="w-full max-w-2xl mx-auto">
          {/* 상단 파란 배경 */}
          <div className="rounded-t-2xl bg-gradient-to-r from-sky-500 to-sky-400 p-8 flex flex-col gap-2 relative overflow-hidden">
            <div className="text-white font-bold text-lg mb-1">제일 빠른 항공권!</div>
            <div className="text-white text-2xl font-extrabold mb-1">땡처리 항공권이 곧 마감됩니다.</div>
            
            {/* 비행기 날개 이미지 자리 (원하는 경우 public에 이미지 추가 후 src 교체) */}
            <div className="absolute right-0 bottom-0 w-1/2 h-24 opacity-30 bg-no-repeat bg-right bg-contain pointer-events-none" style={{backgroundImage: "url()"}}></div>
          </div>
          {/* 리스트 카드 */}
          <div className="bg-white rounded-b-2xl shadow-lg px-6 py-4 -mt-2">
            {/* 더미 데이터 반복 */}
            {[
              {
                from: '인천', to: '방콕', date: '2025.05.13~2025.10.25', type: '왕복 · 직항', price: '209,000원~', logo: '',
              },
              {
                from: '인천', to: '방콕', date: '2025.05.14~2025.10.22', type: '왕복 · 직항', price: '199,000원~', logo: '',
              },
              {
                from: '인천', to: '방콕', date: '2025.07.01~2025.10.22', type: '왕복 · 직항', price: '269,000원~', logo: '',
              },
              {
                from: '인천', to: '괌', date: '2025.05.13~2025.10.21', type: '왕복 · 직항', price: '209,000원~', logo: '',
              },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-4 border-b last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-lg text-gray-800">{item.from} - {item.to}</div>
                  <div className="text-gray-500 text-sm mb-1">{item.date} · {item.type}</div>
                  <div className="font-bold text-xl text-sky-700">{item.price}</div>
                </div>
                {/* 항공사 로고 자리 */}
                <div className="w-16 h-10 flex items-center justify-center">
                  {/* <img src={item.logo} alt="항공사" className="h-8" /> */}
                </div>
              </div>
            ))}
            {/* 더보기 버튼 */}
            <div className="flex justify-center mt-4">
              <button className="w-full py-3 rounded-lg bg-gray-50 text-lg font-semibold text-gray-700 hover:bg-gray-100 transition">상품 더보기</button>
            </div>
          </div>
        </div>
      )}

      {/* 호텔 정보 섹션 */}
      {activeTab === "hotels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotels.map((hotel) => (
            <Card key={hotel.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 overflow-hidden">
                <img 
                  src={hotel.image} 
                  alt={hotel.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="text-xl font-bold mb-1">{hotel.name}</h3>
                <p className="text-gray-600 mb-2">{hotel.location}</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-yellow-500 mr-1">★</span>
                    <span>{hotel.rating}</span>
                  </div>
                  <span className="font-bold text-primary">{hotel.price}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TravelInfoSection; 