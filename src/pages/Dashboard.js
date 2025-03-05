import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { travelApi } from '../services/api';

function Dashboard() {
  const [travelPlans, setTravelPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // 여행 계획 불러오기
  useEffect(() => {
    async function fetchTravelPlans() {
      try {
        // AWS Lambda API를 호출하여 사용자의 여행 계획 목록을 가져옵니다.
        const plans = await travelApi.getUserTravelPlans();
        setTravelPlans(plans);
      } catch (err) {
        console.error('여행 계획 불러오기 실패:', err);
        setError('여행 계획을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    
    if (currentUser) {
      fetchTravelPlans();
    } else {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // 여행 계획 삭제
  async function handleDelete(planId) {
    if (window.confirm('정말로 이 여행 계획을 삭제하시겠습니까?')) {
      try {
        // AWS Lambda API를 호출하여 여행 계획을 삭제합니다.
        await travelApi.deleteTravelPlan(planId);
        // 삭제 후 목록 업데이트
        setTravelPlans(travelPlans.filter(plan => plan.id !== planId));
      } catch (err) {
        console.error('여행 계획 삭제 실패:', err);
        alert('여행 계획 삭제에 실패했습니다.');
      }
    }
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

  // 상태 배지 렌더링 함수
  function renderStatusBadge(status) {
    const statusConfig = {
      'pending': { text: '처리 중', color: 'bg-yellow-100 text-yellow-800' },
      'generated': { text: '생성됨', color: 'bg-blue-100 text-blue-800' },
      'completed': { text: '완료됨', color: 'bg-green-100 text-green-800' },
      'failed': { text: '실패', color: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status] || { text: '상태 알 수 없음', color: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            내 여행 계획
          </h2>
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
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-500">여행 계획을 불러오고 있습니다...</p>
        </div>
      ) : travelPlans.length === 0 ? (
        <div className="text-center py-12 bg-white shadow rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">여행 계획이 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500">새로운 여행 계획을 만들어보세요.</p>
          <div className="mt-6">
            <Link to="/plan" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              첫 여행 계획 만들기
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {travelPlans.map((plan) => (
              <li key={plan.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-primary truncate">
                        {plan.destination || '목적지 미정'}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        {renderStatusBadge(plan.status)}
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0 flex">
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {plan.startDate && plan.endDate 
                          ? `${formatDate(plan.startDate)} - ${formatDate(plan.endDate)}`
                          : '날짜 미정'}
                      </p>
                      {plan.budget && (
                        <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                          <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          예산: {plan.budget.toLocaleString()} 원
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>
                        생성일: {formatDate(plan.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Link
                      to={`/itinerary/${plan.id}`}
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-dark hover:bg-primary-light hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      상세 보기
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
