import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';

function ListPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // 강제 새로고침용 키
  const { getJwtToken } = useAuth();

  // 페이지 로드시 자동으로 API 호출
  useEffect(() => {
    async function fetchPlans() {
      console.log('[ListPage] fetchPlans 시작됨, refreshKey:', refreshKey);
      setLoading(true);
      setError(null);
      
      try {
        const tokenData = await getJwtToken();
        const token = tokenData?.token;
        console.log('[ListPage] 토큰:', token ? '토큰 있음' : '토큰 없음');
        
        if (!token) {
          console.warn('[ListPage] 토큰이 없어 API를 호출할 수 없습니다.');
          setError('인증 토큰이 없어 여행 계획을 불러올 수 없습니다.');
          setLoading(false);
          return;
        }

        // 체크리스트 API 호출 (모드 필드 추가)
        console.log('[ListPage] 체크리스트 API 호출 시작');
        
        const apiUrl = 'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/checklist';
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ mode: 'list' }) // 모드 필드 추가
        });
        
        // 응답 확인
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[ListPage] 체크리스트 API 응답:', data);
        
        if (data && data.success) {
          setPlans(data.plans || []);
        } else {
          console.warn('[ListPage] 체크리스트 API 응답 데이터 형식이 예상과 다릅니다:', data);
          setPlans([]);
        }
      } catch (err) {
        console.error('[ListPage] API 호출 오류:', err);
        const errorMsg = err.message || '여행 계획을 불러오는데 문제가 발생했습니다.';
        setError(errorMsg);
      } finally {
        setLoading(false);
        console.log('[ListPage] fetchPlans 종료됨 (loading false)');
      }
    }

    console.log('[ListPage] fetchPlans 호출 시도');
    fetchPlans();
  }, [getJwtToken, refreshKey]);

  // 페이지 새로고침 함수
  const handleRefresh = () => {
    console.log('[ListPage] 새로고침 요청');
    setRefreshKey(prevKey => prevKey + 1); // 상태 변경으로 useEffect 재실행
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">여행 계획 목록</h1>
        <div className="flex justify-center items-center h-40">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-8 bg-primary rounded-full mb-2"></div>
            <p className="text-gray-500">여행 계획을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">여행 계획 목록</h1>
        <div className="flex space-x-2">
          <button 
            onClick={handleRefresh} 
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            새로고침
          </button>
          <Link 
            to="/planner/newest" 
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            최근 생성된 계획 보기
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 p-4 rounded-md mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center">
          <p className="text-gray-600 mb-4">아직 저장된 여행 계획이 없습니다.</p>
          <Link 
            to="/planner/newest"
            className="text-primary hover:text-primary-dark font-medium"
          >
            첫 번째 여행 계획을 만들어보세요!
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, index) => {
            // 공유받은 플랜인지 확인
            const isSharedPlan = plan.is_shared_with_me === true;
            const ownerEmail = plan.original_owner || plan.user_id || '알 수 없음';
            // 결제 상태 확인
            const isPaidPlan = plan.paid_plan === 1 || plan.paid_plan === true;
            
            return (
              <div 
                key={plan.plan_id || index} 
                className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                  isSharedPlan 
                    ? 'bg-sky-50 border-sky-200' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-800 truncate">
                      {plan.name}
                    </h2>
                    {isSharedPlan && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                        공유된 플랜
                      </span>
                    )}
                    {isPaidPlan && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        결제됨
                      </span>
                    )}
                  </div>
                  {isSharedPlan && (
                    <p className="text-sky-700 text-sm mb-2">
                      공유자: {ownerEmail}
                    </p>
                  )}
                  <p className="text-gray-500 text-sm mb-4">
                    마지막 수정: {new Date(plan.last_updated || Date.now()).toLocaleDateString()}
                  </p>
                  <div className="flex justify-end">
                    <Link 
                      to={`/planner/${plan.plan_id}`}
                      className="text-primary hover:text-primary-dark font-medium"
                    >
                      자세히 보기
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ListPage; 