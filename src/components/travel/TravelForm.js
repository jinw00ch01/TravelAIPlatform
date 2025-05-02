import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { travelApi } from '../../services/api';

function TravelForm() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(data) {
    try {
      setLoading(true);
      setError('');
      
      // AWS Lambda API를 호출하여 AI 계획을 생성합니다.
      // 기존 Firebase Firestore 대신 AWS DynamoDB를 활용합니다.
      
      const travelPlan = {
        userId: currentUser.uid,
        prompt: data.prompt,
        budget: data.budget,
        startDate: data.startDate,
        endDate: data.endDate,
        preferences: data.preferences,
        status: 'pending', // pending, completed, failed
        createdAt: new Date().toISOString(),
      };
      
      // AWS API를 통한 여행 계획 생성
      const response = await travelApi.createTravelPlan(travelPlan);
      navigate(`/itinerary/${response.planId}`);
      
    } catch (err) {
      setError('여행 계획 생성에 실패했습니다. 다시 시도해주세요.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">AI 여행 계획 생성</h2>
      
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="prompt">
            여행 계획 요청 (목적지, 일정, 관심사 등을 자유롭게 입력해주세요)
          </label>
          <textarea
            id="prompt"
            rows="4"
            className="form-input"
            placeholder="예시: 200만원의 예산내에서 10월 15일 출국 10월 24일 귀국 일정으로 오사카로 가는 항공편과 숙소, 관광지 추천해줘."
            {...register('prompt', { required: '여행 계획 요청을 입력해주세요.' })}
          ></textarea>
          {errors.prompt && <p className="mt-1 text-red-500 text-sm">{errors.prompt.message}</p>}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="budget">예산 (원)</label>
            <input
              id="budget"
              type="number"
              className="form-input"
              placeholder="예산을 입력하세요"
              {...register('budget', { required: '예산을 입력해주세요.' })}
            />
            {errors.budget && <p className="mt-1 text-red-500 text-sm">{errors.budget.message}</p>}
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="preferences">여행 스타일</label>
            <select
              id="preferences"
              className="form-input"
              {...register('preferences')}
            >
              <option value="adventure">모험/액티비티</option>
              <option value="relaxation">휴식/힐링</option>
              <option value="culture">문화/역사</option>
              <option value="food">음식/미식</option>
              <option value="shopping">쇼핑</option>
              <option value="nature">자연/경치</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="startDate">출발일</label>
            <input
              id="startDate"
              type="date"
              className="form-input"
              {...register('startDate', { required: '출발일을 선택해주세요.' })}
            />
            {errors.startDate && <p className="mt-1 text-red-500 text-sm">{errors.startDate.message}</p>}
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="endDate">귀국일</label>
            <input
              id="endDate"
              type="date"
              className="form-input"
              {...register('endDate', { required: '귀국일을 선택해주세요.' })}
            />
            {errors.endDate && <p className="mt-1 text-red-500 text-sm">{errors.endDate.message}</p>}
          </div>
        </div>
        
        <button
          type="submit"
          className="w-full btn-primary"
          disabled={loading}
        >
          {loading ? '여행 계획 생성 중...' : 'AI로 여행 계획 생성하기'}
        </button>
      </form>
      
      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-medium mb-4">또는 이미지로 여행지 찾기</h3>
        <p className="text-gray-600 mb-4">
          찾고 싶은 여행지의 이미지가 있나요? 이미지를 업로드하면 AI가 비슷한 여행지를 찾아드립니다.
        </p>
        <button
          className="w-full btn-secondary"
          onClick={() => navigate('/plan/image')}
        >
          이미지로 여행지 찾기
        </button>
      </div>
    </div>
  );
}

export default TravelForm;