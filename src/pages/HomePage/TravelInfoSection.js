import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Loader2, MapPin, Plane, Hotel } from "lucide-react";

// Travel information section containing popular destinations, airlines and hotels
const TravelInfoSection = () => {
  // Loading and tab state
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("destinations");

  // Mocked API data
  const [popularDestinations, setPopularDestinations] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [hotels, setHotels] = useState([]);

  // Mimic API loading
  useEffect(() => {
    setIsLoadingData(true);
    // Simulate async load
    const timer = setTimeout(() => {
      setPopularDestinations([
        { id: 1, name: "도쿄", image: "https://images.unsplash.com/photo-1498036882173-b41c28a8ba34?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", description: "일본의 수도" },
        { id: 2, name: "파리", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", description: "프랑스의 수도" },
        { id: 3, name: "뉴욕", image: "https://images.unsplash.com/photo-1538970272646-f61fabb3a8a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", description: "미국의 대도시" },
        { id: 4, name: "로마", image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", description: "이탈리아의 수도" },
        { id: 5, name: "시드니", image: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60", description: "호주의 대도시" }
      ]);
      setAirlines([
        { id: 1, name: "대한항공", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Korean_Air_logo.svg/200px-Korean_Air_logo.svg.png", rating: 4.5 },
        { id: 2, name: "아시아나항공", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Asiana_Airlines_logo.svg/200px-Asiana_Airlines_logo.svg.png", rating: 4.3 },
        { id: 3, name: "제주항공", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Jeju_Air_logo.svg/200px-Jeju_Air_logo.svg.png", rating: 4.0 },
        { id: 4, name: "진에어", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Jin_Air_logo.svg/200px-Jin_Air_logo.svg.png", rating: 3.8 },
        { id: 5, name: "에어서울", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Air_Seoul_logo.svg/200px-Air_Seoul_logo.svg.png", rating: 3.7 }
      ]);
      setHotels([
        { id: 1, name: "그랜드 호텔", location: "서울", rating: 4.7, price: "150,000원/박", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60" },
        { id: 2, name: "시티 호텔", location: "부산", rating: 4.5, price: "120,000원/박", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60" },
        { id: 3, name: "리버사이드 호텔", location: "강릉", rating: 4.3, price: "180,000원/박", image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60" },
        { id: 4, name: "마운틴 뷰 호텔", location: "제주", rating: 4.6, price: "200,000원/박", image: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60" },
        { id: 5, name: "오션 호텔", location: "여수", rating: 4.2, price: "130,000원/박", image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60" }
      ]);
      setIsLoadingData(false);
    }, 1500);
    return () => clearTimeout(timer);
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
          className={`px-6 py-3 font-medium ${activeTab === "airlines" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}
          onClick={() => setActiveTab("airlines")}
        >
          <Plane className="inline-block mr-2" size={18} />
          항공사 정보
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
              <div className="h-48 overflow-hidden">
                <img src={destination.image} alt={destination.name} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-4">
                <h3 className="text-xl font-bold mb-2">{destination.name}</h3>
                <p className="text-gray-600">{destination.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 항공사 정보 섹션 */}
      {activeTab === "airlines" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {airlines.map((airline) => (
            <Card key={airline.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                  <img src={airline.logo} alt={airline.name} className="w-12 h-12 object-contain" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{airline.name}</h3>
                  <div className="flex items-center">
                    <span className="text-yellow-500 mr-1">★</span>
                    <span>{airline.rating}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 호텔 정보 섹션 */}
      {activeTab === "hotels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotels.map((hotel) => (
            <Card key={hotel.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 overflow-hidden">
                <img src={hotel.image} alt={hotel.name} className="w-full h-full object-cover" />
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