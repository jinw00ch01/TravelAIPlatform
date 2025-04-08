import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { travelApi } from '../services/api';

const Plan = () => {
  const { id } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        setLoading(true);
        
        // 먼저 세션 스토리지에서 계획 데이터 확인
        const storedPlan = sessionStorage.getItem(`travel-plan-${id}`);
        
        if (storedPlan) {
          // 세션 스토리지에 데이터가 있으면 사용
          setPlan(JSON.parse(storedPlan));
          setLoading(false);
          return;
        }
        
        // 세션 스토리지에 없으면 API로 조회
        const response = await travelApi.getTravelPlan(id);
        setPlan(response.plan);
      } catch (err) {
        console.error('여행 계획 조회 오류:', err);
        setError('여행 계획을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [id]);

  if (loading) {
    return <div className="text-center p-8">여행 계획을 불러오는 중...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">{error}</div>;
  }

  if (!plan) {
    return <div className="text-center p-8">여행 계획을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{plan.title || '여행 계획'}</h1>
      
      <div className="bg-white shadow-md rounded p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">여행 개요</h2>
        <p className="mb-2">{plan.summary}</p>
        <p className="mb-2"><strong>목적지:</strong> {plan.destination}</p>
        <p className="mb-2"><strong>기간:</strong> {plan.duration}</p>
      </div>
      
      <div className="bg-white shadow-md rounded p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">예산</h2>
        <p className="mb-2"><strong>총 예산:</strong> {plan.budget.total.toLocaleString()}원</p>
        <div className="grid grid-cols-2 gap-2">
          <p><strong>교통:</strong> {plan.budget.transportation.toLocaleString()}원</p>
          <p><strong>숙박:</strong> {plan.budget.accommodation.toLocaleString()}원</p>
          <p><strong>식비:</strong> {plan.budget.food.toLocaleString()}원</p>
          <p><strong>활동:</strong> {plan.budget.activities.toLocaleString()}원</p>
          {plan.budget.etc > 0 && (
            <p><strong>기타:</strong> {plan.budget.etc.toLocaleString()}원</p>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">일정</h2>
        {plan.itinerary.map((day, index) => (
          <div key={index} className="mb-4 border-b pb-4 last:border-b-0">
            <h3 className="text-lg font-medium mb-2">Day {day.day}: {day.title}</h3>
            <p className="mb-2">{day.description}</p>
            
            <div className="ml-4 mt-2">
              <h4 className="font-medium">활동</h4>
              <ul className="list-disc ml-4">
                {day.activities.map((activity, actIdx) => (
                  <li key={actIdx}>
                    <strong>{activity.time}</strong>: {activity.title} ({activity.location})
                    {activity.description && <p className="text-sm">{activity.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
            
            {day.meals && day.meals.length > 0 && (
              <div className="ml-4 mt-2">
                <h4 className="font-medium">식사</h4>
                <ul className="list-disc ml-4">
                  {day.meals.map((meal, mealIdx) => (
                    <li key={mealIdx}>
                      <strong>{meal.type}</strong>: {meal.suggestion} ({meal.cost.toLocaleString()}원)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {day.accommodation && (
              <div className="ml-4 mt-2">
                <h4 className="font-medium">숙박</h4>
                <p>
                  {day.accommodation.name} ({day.accommodation.location})
                  - {day.accommodation.cost.toLocaleString()}원
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {plan.tips && plan.tips.length > 0 && (
        <div className="bg-white shadow-md rounded p-4">
          <h2 className="text-xl font-semibold mb-2">여행 팁</h2>
          <ul className="list-disc ml-4">
            {plan.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Plan; 