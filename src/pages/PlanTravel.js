import React, { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useNavigate } from "react-router-dom";
import { travelApi } from "../services/api";

export const PlanTravel = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchText, setSearchText] = useState("");

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
      setIsProcessing(true);
      
      // 간단하고 구체적인 쿼리 사용
      const query = typeof content === 'string' && content.trim().length > 10 
        ? content.trim() 
        : "도쿄 1일 여행 계획을 만들어주세요. 예산은 10만원입니다.";
      
      console.log('요청할 쿼리:', query);
      
      // travelApi 사용하여 여행 계획 생성 요청
      const result = await travelApi.createTravelPlan({
        query: query,
        preferences: {
          accommodation: "게스트하우스",
          transportation: "대중교통",
          activities: ["관광"]
        }
      });
      
      console.log('Travel API response:', result);
      
      // 성공 시 여행 계획 데이터 저장 및 페이지 이동
      if (result && (result.planId || (result.plan && result.message))) {
        // Planner 페이지로 이동하기 위한 정보 준비
        const planId = result.planId || `temp-${Date.now()}`;
        
        // 세션 스토리지에 여행 계획 데이터 저장
        if (result.plan) {
          // 플랜 데이터 저장
          sessionStorage.setItem(`travel-plan-${planId}`, JSON.stringify(result.plan));
          // 마지막으로 생성된 planId 저장 (최신 플랜 조회용)
          sessionStorage.setItem('lastPlanId', planId);
        }
        
        // Planner 페이지로 이동 (상태와 함께)
        navigate('/planner', { 
          state: { 
            planData: result.plan,
            planId: planId 
          } 
        });
        
        return result;
      } else {
        console.warn('API 응답에 필요한 데이터가 없습니다:', result);
        alert('여행 계획 데이터가 올바르게 생성되지 않았습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Error sending to Gemini:', error);
      
      // 오류 메시지 상세 정보 추가
      let errorMessage = '여행 계획 생성 중 오류가 발생했습니다.';
      let errorDetail = '';
      
      if (error.response) {
        // 서버가 응답을 반환한 경우
        console.error('서버 응답:', error.response.data);
        errorDetail = `${error.response.status} - ${error.response.data?.message || error.response.data?.error || '알 수 없는 오류'}`;
        
        // 특정 오류 코드에 따른 메시지
        if (error.response.status === 502) {
          errorMessage = '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.response.status === 403) {
          errorMessage = '접근 권한이 없습니다. 로그인 상태를 확인해주세요.';
        } else if (error.response.status === 400) {
          errorMessage = '요청 형식이 올바르지 않습니다. 여행 계획을 다시 작성해주세요.';
        }
      } else if (error.request) {
        // 요청이 전송되었지만 응답을 받지 못한 경우
        errorMessage = '서버에서 응답이 없습니다. 네트워크 연결을 확인하세요.';
      }
      
      // 사용자에게 오류 알림
      alert(`${errorMessage}\n\n${errorDetail ? `상세 오류: ${errorDetail}` : ''}`);
      throw error;
    } finally {
      setIsProcessing(false);
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

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[1920px] min-h-screen">
        <div className="relative h-[766px]">
          {/* Hero background section */}
          <div className="absolute w-full h-[692px] top-0 left-0 bg-primary-dark" />

          {/* Main heading */}
          <h1 className="w-full max-w-[507px] top-[208px] left-1/2 -translate-x-1/2 text-white text-[50px] leading-[50px] absolute font-jua text-center">
            여행을 떠나시나요?
          </h1>

          {/* Search section */}
          <div className="absolute w-full max-w-[650px] h-[88px] top-[350px] left-1/2 -translate-x-1/2">
            <div className="relative h-[88px]">
              <Card className="w-full border-gray-200">
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

          {/* Manual planning text */}
          <div 
            className="absolute w-full text-right top-[458px] right-[100px] text-white text-base font-medium cursor-pointer hover:underline"
            onClick={() => navigate("/planner")}
          >
             {'AI의 도움없이 일정 만들기>>'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanTravel;
