import React, { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "../lib/utils";
import { CalendarIcon, Minus, Plus, Plane, Hotel, MapPin, Loader2 } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export const PlanTravel = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [showPeopleSelector, setShowPeopleSelector] = useState(false);
  
  // API 데이터 관련 상태 추가
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [popularDestinations, setPopularDestinations] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [activeTab, setActiveTab] = useState('destinations'); // 'destinations', 'airlines', 'hotels'

  const processTextFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const processImageFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const sendToGemini = async (content, type) => {
    try {
      // TODO: Gemini API 엔드포인트로 실제 요청을 보내는 로직 구현
      const response = await fetch('YOUR_GEMINI_API_ENDPOINT', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          type, // 'text' or 'image'
        }),
      });

      if (!response.ok) {
        throw new Error('Gemini API request failed');
      }

      const result = await response.json();
      console.log('Gemini API response:', result);
      return result;
    } catch (error) {
      console.error('Error sending to Gemini:', error);
      throw error;
    }
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      for (const file of files) {
        const fileType = file.type;
        let content;

        if (fileType.startsWith('text/')) {
          // 텍스트 파일 처리
          content = await processTextFile(file);
          await sendToGemini(content, 'text');
        } else if (fileType.startsWith('image/')) {
          // 이미지 파일 처리
          content = await processImageFile(file);
          await sendToGemini(content, 'image');
        } else {
          console.warn('Unsupported file type:', fileType);
        }
      }
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;

    setIsProcessing(true);
    try {
      await sendToGemini(searchText, 'text');
    } catch (error) {
      console.error('Error sending search text to Gemini:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdultCountChange = (increment) => {
    setAdultCount(prev => {
      const newCount = prev + increment;
      return newCount >= 1 ? newCount : 1;
    });
  };

  const handleChildCountChange = (increment) => {
    setChildCount(prev => {
      const newCount = prev + increment;
      return newCount >= 0 ? newCount : 0;
    });
  };

  const CustomInput = React.forwardRef(({ value, onClick, placeholder }, ref) => (
    <Button
      variant="outline"
      className={cn(
        "w-[200px] justify-center text-center font-normal bg-white",
        !value && "text-gray-400"
      )}
      onClick={onClick}
      ref={ref}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {value || placeholder}
    </Button>
  ));

  // API 데이터 로딩 함수 (나중에 실제 API 호출로 대체)
  const loadApiData = async () => {
    setIsLoadingData(true);
    try {
      // 여기에 실제 API 호출 코드가 들어갈 예정
      // 임시 데이터로 UI 미리 구현
      setTimeout(() => {
        setPopularDestinations([
          { id: 1, name: '도쿄', image: 'https://images.unsplash.com/photo-1540959733332-eab4de381ee7?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '일본의 수도' },
          { id: 2, name: '파리', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '프랑스의 수도' },
          { id: 3, name: '뉴욕', image: 'https://images.unsplash.com/photo-1538970272646-f61fabb3a8a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '미국의 대도시' },
          { id: 4, name: '로마', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '이탈리아의 수도' },
          { id: 5, name: '시드니', image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60', description: '호주의 대도시' },
        ]);
        
        setAirlines([
          { id: 1, name: '대한항공', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Korean_Air_logo.svg/200px-Korean_Air_logo.svg.png', rating: 4.5 },
          { id: 2, name: '아시아나항공', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Asiana_Airlines_logo.svg/200px-Asiana_Airlines_logo.svg.png', rating: 4.3 },
          { id: 3, name: '제주항공', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Jeju_Air_logo.svg/200px-Jeju_Air_logo.svg.png', rating: 4.0 },
          { id: 4, name: '진에어', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Jin_Air_logo.svg/200px-Jin_Air_logo.svg.png', rating: 3.8 },
          { id: 5, name: '에어서울', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Air_Seoul_logo.svg/200px-Air_Seoul_logo.svg.png', rating: 3.7 },
        ]);
        
        setHotels([
          { id: 1, name: '그랜드 호텔', location: '서울', rating: 4.7, price: '150,000원/박', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
          { id: 2, name: '시티 호텔', location: '부산', rating: 4.5, price: '120,000원/박', image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
          { id: 3, name: '리버사이드 호텔', location: '강릉', rating: 4.3, price: '180,000원/박', image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
          { id: 4, name: '마운틴 뷰 호텔', location: '제주', rating: 4.6, price: '200,000원/박', image: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
          { id: 5, name: '오션 호텔', location: '여수', rating: 4.2, price: '130,000원/박', image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
        ]);
        
        setIsLoadingData(false);
      }, 1500); // 1.5초 후 데이터 로드 (실제 API 호출 시 제거)
    } catch (error) {
      console.error('Error loading API data:', error);
      setIsLoadingData(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  React.useEffect(() => {
    loadApiData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[1920px] min-h-screen">
        <div className="relative h-[766px]">
          {/* Hero background section */}
          <div 
            className="absolute w-full h-[692px] top-0 left-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80')",
              position: 'relative'
            }}
          >
            {/* 배경 이미지 위에 어두운 오버레이 추가 */}
            <div className="absolute inset-0 bg-black/40"></div>
          </div>

          {/* Main heading - 위로 올림 */}
          <h1 className="w-full max-w-[507px] top-[120px] left-1/2 -translate-x-1/2 text-white text-[50px] leading-[50px] absolute font-jua text-center">
            여행을 떠나시나요?
          </h1>

          {/* Stack View Container - 모든 입력 요소를 포함하는 컨테이너 */}
          <div className="absolute w-full max-w-[650px] top-[200px] left-1/2 -translate-x-1/2 bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-700">
            {/* 상단 바 추가 */}
            <div className="flex justify-end mb-4">
              <div 
                className="text-white text-base font-medium cursor-pointer hover:underline flex items-center"
                onClick={() => navigate("/planner")}
              >
                <span>AI의 도움없이 일정 만들기</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="ml-1"
                >
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </div>
            </div>
            
            {/* Search section */}
            <div className="mb-6">
              <div className="relative h-[88px]">
                <Card className="w-full border-gray-200 bg-white">
                  <CardContent className="p-0">
                    <div className="flex items-center">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".txt,.jpg,.jpeg,.png"
                        multiple
                        onChange={handleFileUpload}
                        disabled={isProcessing}
                      />
                      <Button
                        className="absolute w-[25px] h-[25px] top-[30px] left-[8px] bg-gray-50 rounded-full border border-primary/90 flex items-center justify-center z-10 p-0 min-w-0 hover:bg-gray-100"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM11.25 8.25H8.25V11.25H6.75V8.25H3.75V6.75H6.75V3.75H8.25V6.75H11.25V8.25Z"
                            fill="currentColor"
                            className="text-primary"
                          />
                        </svg>
                      </Button>
                      <Input
                        className="min-h-[60px] pl-10 text-gray-400 text-base tracking-normal leading-normal border-none bg-white placeholder:text-gray-400"
                        placeholder="+버튼을 눌러 이미지나 텍스트파일을 추가할 수 있습니다."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        disabled={isProcessing}
                      />
                      <Button
                        className="absolute right-0 w-[25px] h-[25px] top-[30px] right-[10px] bg-primary/90 rounded-full p-0 min-w-0 flex items-center justify-center hover:bg-primary-dark/90"
                        size="icon"
                        onClick={handleSearch}
                        disabled={isProcessing}
                      >
                        <img
                          className="w-[9px] h-2.5"
                          alt="SearchIcon arrow"
                          src="https://c.animaapp.com/m8mvwkhbmqwOZ5/img/polygon-1.svg"
                        />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Date selection section */}
            <div className="mb-6">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-2">
                  <label className="text-white text-sm font-medium">여행 시작일</label>
                  <DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    locale={ko}
                    dateFormat="yyyy년 MM월 dd일 (EEEE)"
                    placeholderText="날짜 선택"
                    customInput={<CustomInput placeholder="날짜 선택" />}
                    minDate={new Date()}
                    className="w-[200px]"
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-white text-sm font-medium">여행 종료일</label>
                  <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    locale={ko}
                    dateFormat="yyyy년 MM월 dd일 (EEEE)"
                    placeholderText="날짜 선택"
                    customInput={<CustomInput placeholder="날짜 선택" />}
                    minDate={startDate || new Date()}
                    className="w-[200px]"
                  />
                </div>
              </div>
            </div>
            
            {/* People selector button */}
            <div className="mb-2">
              <Button 
                className="w-full bg-white text-gray-700 hover:bg-gray-100"
                onClick={() => setShowPeopleSelector(!showPeopleSelector)}
              >
                {adultCount}명의 성인 {childCount > 0 ? `, ${childCount}명의 아동` : ''}
              </Button>
            </div>
            
            {/* People selector panel */}
            {showPeopleSelector && (
              <div className="bg-white rounded-md shadow-lg p-4 transition-all duration-300">
                <div className="flex flex-col gap-4">
                  {/* 성인 선택 */}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">성인</span>
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleAdultCountChange(-1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{adultCount}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleAdultCountChange(1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 아동 선택 */}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">아동</span>
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleChildCountChange(-1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{childCount}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleChildCountChange(1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* API 데이터 표시 섹션 */}
        <div className="w-full max-w-[1200px] mx-auto px-4 py-12">
          <h2 className="text-3xl font-bold text-center mb-8">여행 정보</h2>
          
          {/* 탭 네비게이션 */}
          <div className="flex justify-center mb-8 border-b">
            <button 
              className={`px-6 py-3 font-medium ${activeTab === 'destinations' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}
              onClick={() => setActiveTab('destinations')}
            >
              <MapPin className="inline-block mr-2" size={18} />
              인기 여행지
            </button>
            <button 
              className={`px-6 py-3 font-medium ${activeTab === 'airlines' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}
              onClick={() => setActiveTab('airlines')}
            >
              <Plane className="inline-block mr-2" size={18} />
              항공사 정보
            </button>
            <button 
              className={`px-6 py-3 font-medium ${activeTab === 'hotels' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}
              onClick={() => setActiveTab('hotels')}
            >
              <Hotel className="inline-block mr-2" size={18} />
              호텔 정보
            </button>
          </div>
          
          {/* 로딩 상태 표시 */}
          {isLoadingData && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-gray-500">데이터를 불러오는 중입니다...</p>
            </div>
          )}
          
          {/* 인기 여행지 섹션 */}
          {!isLoadingData && activeTab === 'destinations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularDestinations.map((destination) => (
                <Card key={destination.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={destination.image} 
                      alt={destination.name} 
                      className="w-full h-full object-cover"
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
          
          {/* 항공사 정보 섹션 */}
          {!isLoadingData && activeTab === 'airlines' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {airlines.map((airline) => (
                <Card key={airline.id} className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                      <img 
                        src={airline.logo} 
                        alt={airline.name} 
                        className="w-12 h-12 object-contain"
                      />
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
          {!isLoadingData && activeTab === 'hotels' && (
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
      </div>
    </div>
  );
};

export default PlanTravel;
