import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import TravelItinerary from '../components/travel/TravelItinerary';
import { travelApi } from '../services/api';

function ViewItinerary() {
  const [travelPlan, setTravelPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // 여행 계획 조회
  useEffect(() => {
    async function fetchTravelPlan() {
      try {
        const planData = await travelApi.getTravelPlan(id);
        
        if (planData) {
          // 권한 확인
          if (planData.userId !== currentUser?.uid) {
            setError('접근 권한이 없습니다.');
            setLoading(false);
            return;
          }
          
          // 날짜 변환
          const plan = {
            id: planData.id,
            ...planData,
            createdAt: planData.createdAt?.toDate() || new Date(),
            startDate: planData.startDate?.toDate() || null,
            endDate: planData.endDate?.toDate() || null
          };
          
          setTravelPlan(plan);
          
          // 실제 프로젝트에서는 여기서 itinerary가 없고 status가 'pending'인 경우,
          // 백엔드 API를 호출하여 실시간으로 여행 계획을 생성받아야 함
          // 이 예제에서는 더미 데이터로 시뮬레이션
          
          if (!plan.itinerary && plan.status === 'pending') {
            // API 호출 시뮬레이션 (실제로는 백엔드 API 호출)
            setTimeout(async () => {
              const dummyItinerary = generateDummyItinerary(plan);
              
              // Firestore 업데이트
              await travelApi.updateTravelPlan(id, {
                itinerary: dummyItinerary,
                status: 'generated'
              });
              
              setTravelPlan(prev => ({
                ...prev,
                itinerary: dummyItinerary,
                status: 'generated'
              }));
            }, 3000);
          }
        } else {
          setError('해당 여행 계획을 찾을 수 없습니다.');
        }
      } catch (err) {
        console.error('여행 계획 조회 실패:', err);
        setError('여행 계획을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    
    if (currentUser) {
      fetchTravelPlan();
    } else {
      navigate('/login');
    }
  }, [id, currentUser, navigate]);

  // 여행 계획 저장
  const handleSaveItinerary = async (updatedItinerary) => {
    try {
      await travelApi.updateTravelPlan(id, {
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
                {travelPlan.destination || '목적지 미정'} 여행 계획
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
                    {travelPlan.prompt}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          
          {/* 상태에 따른 다른 내용 표시 */}
          {travelPlan.status === 'pending' ? (
            <div className="bg-white shadow sm:rounded-lg p-6 text-center">
              <svg className="animate-spin h-10 w-10 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">AI가 여행 계획을 생성하고 있습니다</h3>
              <p className="mt-2 text-sm text-gray-500">잠시만 기다려 주세요. 일반적으로 30초에서 1분 정도 소요됩니다.</p>
            </div>
          ) : travelPlan.status === 'failed' ? (
            <div className="bg-white shadow sm:rounded-lg p-6 text-center">
              <svg className="h-10 w-10 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">여행 계획 생성에 실패했습니다</h3>
              <p className="mt-2 text-sm text-gray-500">다시 시도하거나 다른 검색어로 시도해 보세요.</p>
              <div className="mt-6">
                <Link to="/plan" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                  다시 시도하기
                </Link>
              </div>
            </div>
          ) : travelPlan.itinerary ? (
            <TravelItinerary 
              itinerary={travelPlan.itinerary} 
              onSave={handleSaveItinerary}
            />
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
