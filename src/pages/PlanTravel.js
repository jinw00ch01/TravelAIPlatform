import React, { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";

export const PlanTravel = () => {
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

  return (
    <div className="bg-[#f8f8f8] flex flex-row justify-center w-full">
      <div className="bg-[#f8f8f8] overflow-x-hidden w-full max-w-[1920px] h-[1080px]">
        <div className="relative w-full h-[766px]">
          {/* Blue background section */}
          <div className="absolute w-full h-[692px] top-0 left-0 bg-[#0048ffe6]" />

          {/* Main heading */}
          <h1 className="w-full max-w-[507px] top-[208px] left-1/2 -translate-x-1/2 text-white text-[50px] leading-[50px] absolute [font-family:'Jua',Helvetica] font-normal text-center tracking-[0]">
            여행을 떠나시나요?
          </h1>

          {/* SearchIcon section */}
          <div className="absolute w-full max-w-[650px] h-[88px] top-[350px] left-1/2 -translate-x-1/2">
            <div className="relative h-[88px]">
              <Card className="w-full border-[#d9d9d9]">
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
                      className="absolute w-[25px] h-[25px] top-[30px] left-[8px] bg-[#f8f8f8] rounded-[12.5px] border border-solid border-[#0048ffe6] flex items-center justify-center z-10 p-0 min-w-0"
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
                          fill="#0048FF"
                        />
                      </svg>
                    </Button>
                    <Input
                      className="min-h-[60px] pl-10 text-[#b3b3b3] font-single-line-body-base text-[length:var(--single-line-body-base-font-size)] tracking-[var(--single-line-body-base-letter-spacing)] leading-[var(--single-line-body-base-line-height)] border-none bg-white"
                      placeholder="+버튼을 눌러 이미지나 텍스트파일을 추가할 수 있습니다."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      disabled={isProcessing}
                    />
                    <Button
                      className="absolute right-0 w-[25px] h-[25px] top-[30px] right-[10px] bg-[#0048ffe6] rounded-[12.5px] p-0 min-w-0 flex items-center justify-center"
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
            onClick={() => console.log("Manual planning clicked")}
          >
             {'AI의 도움없이 일정 만들기>>'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanTravel;
