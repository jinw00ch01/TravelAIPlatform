import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { travelApi } from '../services/api';

const Planner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 텍스트만 표시할지, 구조화된 데이터도 표시할지 선택
  const [viewMode, setViewMode] = useState('text');
  // 일자별 표시 또는 전체 표시 선택
  const [viewType, setViewType] = useState('daily');
  // 선택된 일자 (기본값: 1일차)
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    // 위치 상태에서 여행 계획 데이터 가져오기
    const fetchPlanData = () => {
      try {
        setLoading(true);
        
        // location.state에서 데이터 확인
        if (location.state && location.state.planData) {
          setPlanData(location.state.planData);
          setLoading(false);
          return;
        }
        
        // 세션 스토리지에서 가장 최근 계획 확인
        const storedPlanId = sessionStorage.getItem('lastPlanId');
        if (storedPlanId) {
          const storedPlan = sessionStorage.getItem(`travel-plan-${storedPlanId}`);
          if (storedPlan) {
            try {
              const parsedPlan = JSON.parse(storedPlan);
              setPlanData(parsedPlan);
              setLoading(false);
              return;
            } catch (e) {
              console.error('저장된 계획 파싱 오류:', e);
            }
          }
        }
        
        // 데이터를 찾을 수 없는 경우
        setError('여행 계획 데이터를 찾을 수 없습니다. 다시 시도해주세요.');
        setLoading(false);
      } catch (err) {
        console.error('여행 계획 로딩 오류:', err);
        setError('여행 계획을 로드하는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    fetchPlanData();
  }, [location]);

  // 여행 계획 텍스트 추출
  const extractPlanText = () => {
    if (!planData) return '여행 계획 내용을 불러올 수 없습니다.';
    
    // Python Lambda 함수 응답 구조 체크
    if (planData.plan) {
      return JSON.stringify(planData.plan, null, 2);
    }
    
    // 새로운 API 응답 구조 체크
    if (planData.original && planData.daily) {
      return JSON.stringify(planData.original, null, 2);
    }
    
    // 기존 Gemini API 응답 구조 체크
    if (planData.candidates && planData.candidates[0]?.content?.parts?.[0]) {
      return planData.candidates[0].content.parts[0].text;
    }
    
    return '여행 계획 내용을 불러올 수 없습니다.';
  };

  // 새 여행 계획 생성 페이지로 이동
  const handleCreateNewPlan = () => {
    navigate('/plan-travel');
  };
  
  // Python Lambda 함수로 여행 계획 불러오기
  const handleLoadPythonPlan = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 사용자 입력 데이터 준비
      const requestData = {
        query: `여행지: ${location.state?.destination || '도쿄'}, 기간: ${location.state?.duration || '1일'}, 예산: ${location.state?.budget || '10만원'}`,
        preferences: {
          accommodation: location.state?.accommodation || '게스트하우스',
          transportation: location.state?.transportation || '대중교통',
          activities: location.state?.activities || ['관광']
        }
      };
      
      const response = await travelApi.loadPlanPython(requestData);
      
      if (response && response.plan) {
        setPlanData(response.plan);
        sessionStorage.setItem('planData', JSON.stringify(response.plan));
      } else {
        throw new Error('여행 계획 데이터가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('Python 여행 계획 로드 중 오류:', error);
      setError('여행 계획을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // JSON을 보기 좋게 표시하는 함수
  const formatJSON = (obj) => {
    return JSON.stringify(obj, null, 2);
  };
  
  // 일자별 데이터 가져오기
  const getDailyData = () => {
    if (!planData) return [];
    
    // Python Lambda 함수 응답 구조 체크
    if (planData.plan && planData.plan.itinerary) {
      return planData.plan.itinerary.map(day => ({
        day: day.day,
        title: day.title || `${day.day}일차`,
        date: day.date || '',
        description: day.description || '',
        schedule: [
          ...(day.activities || []).map(activity => ({
            time: activity.time || '',
            title: activity.title || '',
            description: activity.description || '',
            location: activity.location || '',
            cost: activity.cost || 0,
            type: 'activity'
          })),
          // 숙박 정보도 스케줄에 추가
          day.accommodation && day.accommodation.name ? {
            time: '22:00',
            title: `숙박 - ${day.accommodation.name}`,
            description: '',
            location: day.accommodation.location || '',
            cost: day.accommodation.cost || 0,
            type: 'accommodation'
          } : null
        ].filter(Boolean) // null 항목 제거
      }));
    }
    
    // 새로운 API 응답 구조 체크
    if (planData.daily) {
      return planData.daily;
    }
    
    // 기존 데이터 구조에서 일자별 데이터 생성
    if (planData.candidates && planData.candidates[0]?.content?.parts?.[0]) {
      try {
        const text = planData.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                           text.match(/```\n([\s\S]*?)\n```/);
        
        if (jsonMatch && jsonMatch[1]) {
          const parsedData = JSON.parse(jsonMatch[1]);
          if (parsedData.itinerary) {
            return parsedData.itinerary.map(day => ({
              day: day.day,
              title: day.title || `${day.day}일차`,
              date: day.date || '',
              description: day.description || '',
              schedule: [
                ...(day.activities || []).map(activity => ({
                  time: activity.time || '',
                  title: activity.title || '',
                  description: activity.description || '',
                  location: activity.location || '',
                  cost: activity.cost || 0,
                  type: 'activity'
                })),
                // 숙박 정보도 스케줄에 추가
                day.accommodation && day.accommodation.name ? {
                  time: '22:00',
                  title: `숙박 - ${day.accommodation.name}`,
                  description: '',
                  location: day.accommodation.location || '',
                  cost: day.accommodation.cost || 0,
                  type: 'accommodation'
                } : null
              ].filter(Boolean) // null 항목 제거
            }));
          }
        }
      } catch (e) {
        console.error('여행 계획 파싱 오류:', e);
      }
    }
    
    return [];
  };
  
  // 선택된 일자의 데이터 가져오기
  const getSelectedDayData = () => {
    const dailyData = getDailyData();
    return dailyData.find(day => day.day === selectedDay) || null;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">여행 계획을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="text-red-500 text-5xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={handleCreateNewPlan}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition duration-200"
          >
            새 여행 계획 만들기
          </button>
        </div>
      </div>
    );
  }

  // 일차별 데이터 가져오기
  const dailyData = getDailyData();
  const selectedDayData = getSelectedDayData();
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">여행 계획</h1>
          <div className="flex space-x-2">
            <button 
              onClick={handleLoadPythonPlan}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200"
            >
              Python 계획 불러오기
            </button>
            <button 
              onClick={handleCreateNewPlan}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition duration-200"
            >
              새 계획 만들기
            </button>
          </div>
        </div>
        
        {/* 보기 모드 선택 */}
        <div className="mb-4 flex space-x-2">
          <button 
            onClick={() => setViewMode('text')}
            className={`px-3 py-1 rounded ${viewMode === 'text' 
              ? 'bg-primary text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            텍스트 보기
          </button>
          <button 
            onClick={() => setViewMode('json')}
            className={`px-3 py-1 rounded ${viewMode === 'json' 
              ? 'bg-primary text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            JSON 보기
          </button>
          <button 
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1 rounded ${viewMode === 'daily' 
              ? 'bg-primary text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            일차별 보기
          </button>
        </div>
        
        {/* 일차별 보기 일 때만 일차 선택 탭 표시 */}
        {viewMode === 'daily' && dailyData.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {dailyData.map(day => (
              <button
                key={day.day}
                onClick={() => setSelectedDay(day.day)}
                className={`px-3 py-1 rounded ${selectedDay === day.day
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {day.day}일차
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          {planData ? (
            viewMode === 'text' ? (
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-base">
                  {extractPlanText()}
                </pre>
              </div>
            ) : viewMode === 'json' ? (
              <div className="overflow-auto">
                <pre className="text-xs bg-gray-100 p-4 rounded-md">
                  {formatJSON(planData)}
                </pre>
              </div>
            ) : selectedDayData ? (
              <div className="prose max-w-none">
                <h2 className="text-xl font-bold mb-2">{selectedDayData.title}</h2>
                {selectedDayData.date && (
                  <p className="text-gray-600 mb-4">{selectedDayData.date}</p>
                )}
                {selectedDayData.description && (
                  <p className="mb-6">{selectedDayData.description}</p>
                )}
                
                {/* 일정 타임라인 */}
                <div className="space-y-6 mt-6">
                  {selectedDayData.schedule && selectedDayData.schedule.map((item, index) => (
                    <div key={index} className="flex">
                      {item.time && (
                        <div className="w-20 flex-shrink-0 font-medium">
                          {item.time}
                        </div>
                      )}
                      <div className="ml-4 relative pb-6 flex-grow">
                        {index < selectedDayData.schedule.length - 1 && (
                          <div className="absolute left-0 top-0 h-full w-[2px] bg-gray-300" />
                        )}
                        <div className="absolute left-[-8px] top-0 h-4 w-4 rounded-full bg-primary" />
                        <div className="pl-6">
                          <h3 className="font-bold text-lg">{item.title}</h3>
                          {item.description && (
                            <p className="mt-1 text-gray-700">{item.description}</p>
                          )}
                          {item.location && (
                            <p className="mt-1 text-gray-600">📍 {item.location}</p>
                          )}
                          {item.cost > 0 && (
                            <p className="mt-1 text-gray-600">💰 {item.cost.toLocaleString()}원</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 일일 예산 표시 */}
                {selectedDayData.budget && (
                  <div className="mt-8 p-4 bg-gray-100 rounded-md">
                    <h3 className="font-bold text-lg">일일 예산</h3>
                    <p className="text-xl text-primary font-bold">
                      {selectedDayData.budget.toLocaleString()}원
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-500">일자별 여행 계획 데이터가 없습니다.</p>
              </div>
            )
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500">여행 계획 데이터가 없습니다.</p>
            </div>
          )}
        </div>
        
        {/* 활용 버튼 */}
        {planData && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200">
              여행 일정 저장하기
            </button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition duration-200">
              공유하기
            </button>
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition duration-200">
              인쇄하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Planner; 