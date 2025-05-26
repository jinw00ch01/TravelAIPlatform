import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import axios from 'axios';
import { useAuth } from './auth/AuthContext';

const TravelPlansList = ({ onSelectPlan }) => {
  const { getJwtToken } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlans = async () => {
      const tokenData = await getJwtToken();
      const token = tokenData?.token;
      const email = tokenData?.payload?.email || tokenData?.payload?.username || '';
      if (!token) {
        setError('로그인이 필요합니다. 다시 로그인 해주세요.');
        setLoading(false);
        return;
      }
      fetchPlansWithToken(token, email);
    };
    fetchPlans();
    // eslint-disable-next-line
  }, []);

  const fetchPlansWithToken = async (token, email) => {
    try {
      setLoading(true);
      const response = await axios.post('https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/checklist', {
        email
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setPlans(response.data.plans);
      } else {
        throw new Error(response.data.message || '계획 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError('인증이 만료되었습니다. 다시 로그인 해주세요.');
      } else {
        setError(err.message);
      }
      console.error('계획 목록 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">로딩 중...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => {
        // 공유받은 플랜인지 확인
        const isSharedPlan = plan.is_shared_with_me === true;
        const ownerEmail = plan.original_owner || plan.user_id || '알 수 없음';
        
        return (
          <div
            key={plan.plan_id}
            className={`rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow ${
              isSharedPlan 
                ? 'bg-sky-50 border-2 border-sky-200' 
                : 'bg-white'
            }`}
            onClick={() => onSelectPlan(plan)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {isSharedPlan && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                    공유된 플랜
                  </span>
                )}
              </div>
            </div>
            {isSharedPlan && (
              <p className="text-sky-700 text-sm mb-1">
                공유자: {ownerEmail}
              </p>
            )}
            <p className="text-gray-600 text-sm">
              마지막 수정: {format(new Date(plan.last_updated), 'yyyy년 MM월 dd일', { locale: ko })}
            </p>
          </div>
        );
      })}
      {plans.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          저장된 여행 계획이 없습니다.
        </div>
      )}
    </div>
  );
};

export default TravelPlansList; 