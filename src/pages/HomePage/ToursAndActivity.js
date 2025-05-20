import React, { useState, useRef, useEffect } from "react";
import { travelApi } from "../../services/api";
import { format } from "date-fns";

const EUR_TO_KRW = 1480; 

// 주요 도시 좌표 정보 추가
const CITIES = [
  { name: "서울", latitude: 37.5662952, longitude: 126.9779692 },
  { name: "부산", latitude: 35.1795543, longitude: 129.0756416 },
  { name: "도쿄", latitude: 35.6761919, longitude: 139.6503106 },
  { name: "오사카", latitude: 34.6937378, longitude: 135.5021651 },
  { name: "뉴욕", latitude: 40.7127753, longitude: -74.0059728 },
  { name: "파리", latitude: 48.8566969, longitude: 2.3514616 },
  { name: "방콕", latitude: 13.7563309, longitude: 100.5017651 },
  { name: "로마", latitude: 41.9027835, longitude: 12.4963655 }
];

// 유로 가격 문자열에서 숫자만 추출 후 원화로 변환
const euroToKrw = (euroStr) => {
  if (!euroStr) return "가격 정보 없음";
  const match = euroStr.match(/[\d,.]+/);
  if (!match) return euroStr;
  const euro = parseFloat(match[0].replace(/,/g, ""));
  if (isNaN(euro)) return euroStr;
  return `${(euro * EUR_TO_KRW).toLocaleString()}원`;
};

const today = format(new Date(), "yyyy-MM-dd");
const tomorrow = format(new Date(Date.now() + 24 * 60 * 60 * 1000), "yyyy-MM-dd");

const ToursAndActivity = () => {
  // 서울을 기본값으로 설정
  const [selectedCity, setSelectedCity] = useState("서울");
  const [latitude, setLatitude] = useState(CITIES[0].latitude);
  const [longitude, setLongitude] = useState(CITIES[0].longitude);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [radius, setRadius] = useState(2);
  const [liked, setLiked] = useState({}); // 각 액티비티별 찜 상태

  const scrollRef = useRef();
  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  // 하트(찜) 토글 함수
  const toggleLike = (id) => {
    setLiked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 도시 변경 핸들러
  const handleCityChange = (city) => {
    setSelectedCity(city.name);
    setLatitude(city.latitude);
    setLongitude(city.longitude);
  };

  const fetchActivities = async () => {
    setLoading(true);
    setError("");
    try {
      const formattedStartDate = startDate ? format(new Date(startDate), "yyyy-MM-dd") : "";
      const formattedEndDate = endDate ? format(new Date(endDate), "yyyy-MM-dd") : "";

      console.log('API 요청 파라미터:', {
        latitude,
        longitude,
        radius,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      });

      const res = await travelApi.getToursAndActivities({
        latitude,
        longitude,
        radius,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      });

      console.log('API 응답:', res);

      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("❌ API Error:", e);
      console.error("에러 상세:", {
        message: e.message,
        response: e.response?.data,
        status: e.response?.status
      });
      setError("액티비티 데이터를 불러오지 못했습니다.");
      setActivities([]); // 실패 시 안전하게 초기화
    }
    setLoading(false);
  };

  // 컴포넌트 마운트 시 액티비티 데이터 로드
  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line
  }, []);

  // 선택된 도시가 변경될 때 액티비티 다시 로드
  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line
  }, [latitude, longitude]);

  return (
    <section className="w-full bg-[#f5f3ea] py-12 relative">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">주요 투어/액티비티 추천</h2>
        
        {/* 도시 필터 버튼 추가 */}
        <div className="flex flex-wrap justify-start gap-2 mb-6">
          {CITIES.map((city) => (
            <button
              key={city.name}
              className={`px-4 py-2 rounded-full ${selectedCity === city.name ? "bg-primary text-white" : "bg-gray-100 hover:bg-gray-200"}`}
              onClick={() => handleCityChange(city)}
            >
              {city.name}
            </button>
          ))}
        </div>
        
        {loading && <div className="text-sky-600 font-semibold mb-4">로딩 중...</div>}
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div className="relative">
          {/* 왼쪽 화살표 - 위치 상단으로 조정 */}
          <button
            className="absolute left-[-30px] top-[30%] -translate-y-1/2 z-10 bg-white border rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-100"
            onClick={() => scroll(-1)}
            aria-label="왼쪽으로 스크롤"
            type="button"
          >
            <span className="text-2xl">←</span>
          </button>
          {/* 카드 리스트 */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollBehavior: "smooth" }}
          >
            {activities.filter(act => act.images && act.images[0]).map(act => (
              <div
                key={act.id}
                className="flex flex-col items-center min-w-[300px] max-w-[300px] flex-shrink-0 relative"
              >
                {/* 하트(찜) 버튼 */}
                <button
                  className="absolute top-3 right-3 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-gray-100"
                  aria-label="찜하기"
                  type="button"
                  onClick={() => toggleLike(act.id)}
                  style={{ right: '16px', zIndex: 2 }}
                >
                  <span className={`text-xl ${liked[act.id] ? 'text-red-500' : 'text-gray-500'}`}> 
                    {liked[act.id] ? '♥' : '♡'}
                  </span>
                </button>
                {/* 이미지 (클릭 시 bookingLink로 이동) */}
                <div className="relative w-full">
                  {act.bookingLink ? (
                    <a
                      href={act.bookingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={act.images[0]}
                        alt={act.name || "activity image"}
                        className="w-full h-56 object-cover rounded-2xl cursor-pointer"
                      />
                    </a>
                  ) : (
                    <img
                      src={act.images[0]}
                      alt={act.name || "activity image"}
                      className="w-full h-56 object-cover rounded-2xl"
                    />
                  )}
                </div>
                {/* 이름/설명/가격/링크 - 배경 위에 노출 */}
                <div className="flex flex-col items-center mt-4">
                  <div className="font-bold text-base mb-2 text-center">{act.translatedName || act.name || "이름 없음"}</div>
                  {act.shortDescription && (
                    <div className="text-gray-600 text-sm mb-2 text-center">{act.shortDescription}</div>
                  )}
                  <div className="text-sky-700 font-semibold mb-2 text-center">
                    {act.price ? euroToKrw(act.price) : "가격 정보 없음"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* 오른쪽 화살표 - 위치 상단으로 조정 */}
          <button
            className="absolute right-[-30px] top-[30%] -translate-y-1/2 z-10 bg-white border rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-100"
            onClick={() => scroll(1)}
            aria-label="오른쪽으로 스크롤"
            type="button"
          >
            <span className="text-2xl">→</span>
          </button>
        </div>
        {activities.filter(act => act.images && act.images[0]).length === 0 && !loading && (
          <div className="text-gray-400 text-center mt-8">검색 결과가 없습니다.</div>
        )}
      </div>
    </section>
  );
};

export default ToursAndActivity;
