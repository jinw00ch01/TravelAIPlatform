import React, { useState, useRef, useEffect } from "react";
import { travelApi } from "../../services/api";
import { format } from "date-fns";

const EUR_TO_KRW = 1480; 

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
  const [latitude, setLatitude] = useState(37.5512); // 서울 남산으로 고정정
  const [longitude, setLongitude] = useState(126.9882);
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

  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line
  }, []);

  return (
    <section className="w-full bg-[#f5f3ea] py-12 relative">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">주요 투어/액티비티 추천</h2>
        
        {loading && <div className="text-sky-600 font-semibold mb-4">로딩 중...</div>}
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div className="relative">
          {/* 왼쪽 화살표 */}
          <button
            className="absolute left-[-30px] top-1/2 -translate-y-1/2 z-10 bg-white border rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-100"
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
          {/* 오른쪽 화살표 */}
          <button
            className="absolute right-[-30px] top-1/2 -translate-y-1/2 z-10 bg-white border rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-100"
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
