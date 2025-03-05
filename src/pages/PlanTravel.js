import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { travelApi } from '../services/api'; // AWS Lambda 호출 API
import { useAuth } from '../components/auth/AuthContext';

function PlanTravel() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // 여행 계획 생성 요청 제출
  async function onSubmit(data) {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // 변경: AWS Lambda 호출
      const response = await travelApi.createTravelPlan({
        destination: data.destination,
        prompt: data.prompt,
        budget: parseFloat(data.budget) || 0,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        preferences: data.preferences || [],
        travelers: parseInt(data.travelers) || 1
      });
      // Lambda 내부에서 DynamoDB에 저장했다는 응답을 받는다고 가정

      navigate(`/itinerary/${response.planId}`);
    } catch (err) {
      console.error('여행 계획 생성 실패:', err);
      setError('여행 계획을 생성하는데 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto my-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">AI 여행 계획 생성</h2>
      
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="prompt">
            여행 계획 요청 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="prompt"
            rows="4"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="예시: 200만원의 예산내에서 10월 15일 출국 10월 24일 귀국 일정으로 오사카로 가는 항공편과 숙소 추천해줘."
            {...register('prompt', { required: '여행 계획 요청을 입력해주세요.' })}
          ></textarea>
          {errors.prompt && <p className="mt-1 text-red-500 text-sm">{errors.prompt.message}</p>}
          <p className="mt-1 text-sm text-gray-500">
            여행지, 기간, 예산, 선호하는 활동 등 구체적으로 적을수록 더 정확한 계획을 받을 수 있습니다.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="destination">
              목적지
            </label>
            <input
              id="destination"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="예: 오사카, 일본"
              {...register('destination')}
            />
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="budget">
              예산 (원)
            </label>
            <input
              id="budget"
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="예: 2000000"
              {...register('budget')}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="startDate">
              출발일
            </label>
            <input
              id="startDate"
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('startDate')}
            />
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="endDate">
              귀국일
            </label>
            <input
              id="endDate"
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('endDate')}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="travelers">
              여행자 수
            </label>
            <input
              id="travelers"
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="예: 2"
              {...register('travelers')}
            />
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="preferences">
              여행 스타일
            </label>
            <select
              id="preferences"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('preferences')}
            >
              <option value="">선택하지 않음</option>
              <option value="nature">자연/경치</option>
              <option value="city">도시/번화가</option>
              <option value="beach">해변/바다</option>
              <option value="mountain">산/등산</option>
              <option value="culture">문화/역사</option>
              <option value="food">음식/미식</option>
              <option value="relaxation">휴양/힐링</option>
              <option value="adventure">모험/액티비티</option>
            </select>
          </div>
        </div>
        
        <button
          type="submit"
          className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-dark transition-colors"
          disabled={loading}
        >
          {loading ? '여행 계획 생성 중...' : 'AI로 여행 계획 생성하기'}
        </button>
      </form>
    </div>
  );
}

export default PlanTravel;
