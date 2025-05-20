import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import TravelItinerary from '../components/travel/TravelItinerary';
import { travelApi } from '../services/api';

function ViewItinerary() {
  const [travelPlan, setTravelPlan] = useState(null);
  const [paidPlans, setPaidPlans] = useState([]); // 결제된 여행 계획 목록
  const [allPlanDetails, setAllPlanDetails] = useState({}); // 모든 계획의 상세 정보
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('day-1'); // 활성화된 일자 탭
  const [calendarView, setCalendarView] = useState(false); // 캘린더 뷰 상태
  const { id: planIdFromUrl } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // 여행 계획 목록 조회
  useEffect(() => {
    async function fetchPlanList() {
      if (!currentUser) {
        navigate('/login');
        return;
      }
      
      setLoading(true);
      setError('');

      try {
        // 1. checklistfunction 호출하여 여행 계획 목록 가져오기
        const checklistResponse = await travelApi.invokeChecklist();
        console.log('ViewItinerary - 여행 계획 목록 응답:', checklistResponse);

        if (!checklistResponse || !checklistResponse.success || !Array.isArray(checklistResponse.plans)) {
          throw new Error('사용자의 여행 계획 목록을 불러오는데 실패했습니다.');
        }

        // 2. 유료 계획만 필터링
        const filteredPaidPlans = checklistResponse.plans.filter(plan => plan.paid_plan === 1 || plan.paid_plan === true);
        
        if (filteredPaidPlans.length === 0) {
          setError('결제된 여행 계획이 없습니다.');
            setLoading(false);
            return;
          }
          
        setPaidPlans(filteredPaidPlans);
        console.log('ViewItinerary - 결제된 계획 목록:', filteredPaidPlans);
        
        // 3. 모든 결제된 계획의 상세 정보 가져오기
        const planDetailsPromises = filteredPaidPlans.map(plan => {
          console.log(`%c[DEBUG] 체크플랜 함수 호출 시작 - plan_id: ${plan.plan_id}`, 'background: #ffc107; color: black; font-weight: bold;');
          
          // API URL과 파라미터 로깅
          const apiUrl = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/checkplan';
          const apiParams = { plan_id: plan.plan_id.toString(), mode: 'detail' };
          console.log('체크플랜 API URL:', apiUrl);
          console.log('체크플랜 API 파라미터:', apiParams);
          
          return travelApi.invokeCheckplan(plan.plan_id.toString())
            .then(response => {
              console.log(`%c[DEBUG] 체크플랜 응답 (${plan.plan_id}):`, 'background: #4caf50; color: white; font-weight: bold;', response);
              if (response && response.success && response.plan) {
                console.log(`[DEBUG] Plan ${plan.plan_id} 상세 정보:`, response.plan);
                return { [plan.plan_id]: response.plan };
              }
              console.error(`[DEBUG] Plan ${plan.plan_id} 상세 정보 실패:`, response);
              return null;
            })
            .catch(err => {
              console.error(`%c[DEBUG] Plan ${plan.plan_id} 상세 정보 오류:`, 'background: #f44336; color: white; font-weight: bold;', err);
              // 추가 디버깅을 위한 네트워크 직접 요청
              console.log('[DEBUG] 네트워크 요청 직접 시도...');
              
              // 일반 fetch로 직접 시도
              fetch('https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/checkplan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: plan.plan_id.toString(), mode: 'detail' })
              })
                .then(res => {
                  console.log(`[DEBUG] 직접 fetch 상태: ${res.status} ${res.statusText}`);
                  return res.json();
                })
                .then(data => console.log('[DEBUG] 직접 fetch 결과:', data))
                .catch(fetchErr => console.error('[DEBUG] 직접 fetch 오류:', fetchErr));
                
              return null;
            });
        });
        
        const planDetailsResults = await Promise.all(planDetailsPromises);
        const planDetailsMap = planDetailsResults
          .filter(result => result !== null)
          .reduce((acc, curr) => ({ ...acc, ...curr }), {});
        
        setAllPlanDetails(planDetailsMap);
        console.log('ViewItinerary - 모든 계획 상세 정보:', planDetailsMap);
        
        // 4. URL의 ID와 일치하는 항목 상세 정보 설정
        const currentPlanId = planIdFromUrl || filteredPaidPlans[0]?.plan_id;
        if (currentPlanId && planDetailsMap[currentPlanId]) {
          const planDetail = planDetailsMap[currentPlanId];
          
          // 계획 데이터 처리 (필요한 경우 JSON 문자열을 파싱)
          const processedPlan = {
            id: planDetail.plan_id,
            name: planDetail.name,
            itinerary_schedules: typeof planDetail.itinerary_schedules === 'string' 
              ? JSON.parse(planDetail.itinerary_schedules) 
              : planDetail.itinerary_schedules,
            flight_details: typeof planDetail.flight_details === 'string'
              ? JSON.parse(planDetail.flight_details)
              : planDetail.flight_details,
            accommodation_details: typeof planDetail.accommodation_details === 'string'
              ? JSON.parse(planDetail.accommodation_details)
              : planDetail.accommodation_details
          };
          
          setTravelPlan(processedPlan);
          
          // 첫 번째 일자를 활성화 탭으로 설정
          if (processedPlan.itinerary_schedules) {
            const days = Object.keys(processedPlan.itinerary_schedules);
            if (days.length > 0) {
              setActiveTab(`day-${days[0]}`);
            }
          }
        }
      } catch (error) {
        console.error('여행 계획 불러오기 실패:', error);
        setError('여행 계획을 불러오는데 실패했습니다: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchPlanList();
  }, [planIdFromUrl, currentUser, navigate]);

  // 선택한 여행 계획 변경 처리 함수
  const handlePlanChange = (planId) => {
    navigate(`/itinerary/${planId}`);
  };
  
  // 일자 탭 변경 처리 함수 
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };
  
  // 캘린더 뷰 토글 함수
  const toggleCalendarView = () => {
    setCalendarView(!calendarView);
  };

  // 여행 계획 저장
  const handleSaveItinerary = async (updatedItinerary) => {
    try {
      await travelApi.updateTravelPlan(planIdFromUrl, {
        itinerary: updatedItinerary,
        status: 'completed'
      });
      
      setTravelPlan(prev => ({
        ...prev,
        itinerary: updatedItinerary,
        status: 'completed'
      }));
      
      alert('여행 계획이 저장되었습니다.');
    } catch (err) {
      console.error('여행 계획 저장 실패:', err);
      alert('여행 계획 저장에 실패했습니다.');
    }
  };

  // 여행 일정 데이터를 렌더링 가능한 형태로 변환
  const getProcessedScheduleData = (planData) => {
    if (!planData || !planData.itinerary_schedules) return null;
    
    // 이미 객체 형태면 그대로 사용
    if (typeof planData.itinerary_schedules === 'object' && !Array.isArray(planData.itinerary_schedules)) {
      return planData.itinerary_schedules;
    }
    
    // 문자열이면 파싱
    if (typeof planData.itinerary_schedules === 'string') {
      try {
        return JSON.parse(planData.itinerary_schedules);
      } catch (e) {
        console.error('일정 데이터 파싱 실패:', e);
        return null;
      }
    }
    
    return null;
  };

  // 더미 일정 생성 (실제 프로젝트에서는 AI API 응답으로 대체)
  function generateDummyItinerary(plan) {
    const days = [];
    if (plan.startDate && plan.endDate) {
      const diffTime = Math.abs(plan.endDate - plan.startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      for (let i = 0; i < diffDays; i++) {
        const date = new Date(plan.startDate);
        date.setDate(date.getDate() + i);
        
        days.push({
          date: date,
          title: `${i + 1}일차`,
          description: "AI가 생성한 여행 일정입니다.",
          activities: [
            {
              time: "09:00",
              description: "호텔 아침 식사",
              location: "숙소",
              notes: "조식 포함"
            },
            {
              time: "10:30",
              description: `${plan.destination || '여행지'} 주요 관광지 방문`,
              location: "주요 관광지",
              notes: "교통편: 대중교통"
            },
            {
              time: "13:00",
              description: "현지 맛집에서 점심 식사",
              location: "현지 맛집",
              notes: "예상 비용: 1인당 15,000원"
            },
            {
              time: "15:00",
              description: "쇼핑 및 자유 시간",
              location: "쇼핑 거리",
              notes: ""
            },
            {
              time: "18:30",
              description: "저녁 식사",
              location: "추천 레스토랑",
              notes: "예상 비용: 1인당 25,000원"
            }
          ]
        });
      }
    }
    
    return {
      title: `${plan.destination || '목적지'} 여행 계획`,
      summary: `${plan.prompt}에 대한 AI 여행 계획입니다.`,
      days: days,
      tips: [
        "현지 화폐로 환전하는 것이 유리합니다.",
        "주요 관광지는 미리 입장권을 예매하세요.",
        "현지 음식을 다양하게 경험해보세요."
      ]
    };
  }

  // 상태 배지 렌더링 함수
  function renderStatusBadge(status) {
    const statusConfig = {
      'pending': { text: '생성 중...', color: 'bg-yellow-100 text-yellow-800' },
      'generated': { text: '계획 완료', color: 'bg-blue-100 text-blue-800' },
      'completed': { text: '확정됨', color: 'bg-green-100 text-green-800' },
      'failed': { text: '생성 실패', color: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status] || { text: '상태 알 수 없음', color: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  }

  // 날짜 포맷 함수
  function formatDate(date) {
    if (!date) return '날짜 없음';
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // 현재 선택된 계획의 일정 정보
  const scheduleData = travelPlan ? getProcessedScheduleData(travelPlan) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-primary hover:text-primary-dark mr-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              여행 계획 상세
            </h2>
            {travelPlan && (
              <div className="ml-3">
                {renderStatusBadge(travelPlan.status)}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          {/* 여행 계획 선택 드롭다운 */}
          {paidPlans.length > 1 && (
            <div className="relative inline-block text-left mr-3">
              <select 
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                value={planIdFromUrl || paidPlans[0]?.plan_id}
                onChange={(e) => handlePlanChange(e.target.value)}
              >
                {paidPlans.map(plan => (
                  <option key={plan.plan_id} value={plan.plan_id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* 캘린더/목록 뷰 전환 버튼 */}
          <button 
            onClick={toggleCalendarView}
            className="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            {calendarView ? '목록 보기' : '캘린더 보기'}
          </button>
          
          <Link
            to="/plan"
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            새 여행 계획
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <div className="mt-2">
                <Link to="/dashboard" className="text-sm font-medium text-red-700 hover:text-red-600">
                  대시보드로 돌아가기
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 bg-white shadow rounded-lg">
          <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-500">여행 계획을 불러오고 있습니다...</p>
        </div>
      ) : travelPlan && (
        <>
          {/* 여행 정보 요약 */}
          <div className="bg-white shadow sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {travelPlan.name || '목적지 미정'} 여행 계획
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                여행 요약 정보
              </p>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    여행 기간
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {travelPlan.startDate && travelPlan.endDate 
                      ? `${formatDate(travelPlan.startDate)} - ${formatDate(travelPlan.endDate)}`
                      : '날짜 미정'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    예산
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {travelPlan.budget ? `${travelPlan.budget.toLocaleString()} 원` : '미정'}
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    여행자 수
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {travelPlan.travelers || 1}명
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    요청 내용
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {travelPlan.prompt || '정보 없음'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          
          {/* 일자별 여행 계획 */}
          {scheduleData ? (
            <div className="bg-white shadow sm:rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  일자별 여행 일정
                </h3>
              </div>
              
              {/* 일자 선택 탭 */}
              <div className="border-b border-gray-200">
                <nav className="flex overflow-x-auto" aria-label="Tabs">
                  {Object.keys(scheduleData).map((day) => (
                    <button
                      key={`day-${day}`}
                      onClick={() => handleTabChange(`day-${day}`)}
                      className={`
                        px-3 py-2 text-sm font-medium whitespace-nowrap
                        ${activeTab === `day-${day}` 
                          ? 'border-primary text-primary border-b-2' 
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2'}
                      `}
                    >
                      {scheduleData[day].title || `${day}일차`}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* 일자별 일정 내용 */}
              <div className="px-4 py-5 sm:p-6">
                {Object.keys(scheduleData).map((day) => (
                  <div 
                    key={`schedule-${day}`} 
                    className={activeTab === `day-${day}` ? 'block' : 'hidden'}
                  >
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      {scheduleData[day].title || `${day}일차`}
                    </h4>
                    
                    <ul className="space-y-4">
                      {scheduleData[day].schedules && scheduleData[day].schedules.map((schedule, index) => (
                        <li key={schedule.id || `${day}-${index}`} className="bg-gray-50 p-4 rounded-md">
                          <div className="flex items-start">
                            <div className="min-w-16 text-sm font-medium text-gray-900">
                              {schedule.time}
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-900">{schedule.name}</p>
                              <p className="text-sm text-gray-500">{schedule.notes}</p>
                              <div className="mt-1 flex items-center text-xs text-gray-500">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">
                                  {schedule.category || '기타'}
                                </span>
                                {schedule.duration && (
                                  <span className="ml-2 bg-gray-100 px-2 py-0.5 rounded">
                                    소요 시간: {schedule.duration}
                                  </span>
                                )}
                                {schedule.cost && (
                                  <span className="ml-2 bg-gray-100 px-2 py-0.5 rounded">
                                    비용: {Number(schedule.cost).toLocaleString()}원
                                  </span>
                                )}
                              </div>
                              {schedule.address && (
                                <p className="mt-1 text-xs text-gray-500">{schedule.address}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
            </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow sm:rounded-lg p-6 text-center">
              <p className="text-gray-500">여행 일정이 아직 없습니다.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ViewItinerary;
