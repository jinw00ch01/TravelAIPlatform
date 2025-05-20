import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from './auth/AuthContext';



const PlanPayment = ({ planId, onClose }) => {
  const { getJwtToken } = useAuth();
  const [planDetails, setPlanDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItems, setSelectedItems] = useState({
    flight: false,
    accommodation: false
  });
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    fetchPlanDetails();
    // eslint-disable-next-line
  }, [planId]);

  const displayFlightInfo = useMemo(() => {
    if (planDetails && Array.isArray(planDetails.flightInfo) && planDetails.flightInfo.length > 0) {
      console.log('[PlanPayment] useMemo로 displayFlightInfo 계산 (데이터 있음):', planDetails.flightInfo);
      return planDetails.flightInfo;
    }
    console.log('[PlanPayment] useMemo로 displayFlightInfo 계산 (데이터 없음 또는 빈 배열). planDetails.flightInfo:', planDetails?.flightInfo);
    return [];
  }, [planDetails]);

  const fetchPlanDetails = async () => {
    try {
      setLoading(true);
      const tokenData = await getJwtToken();
      const token = tokenData?.token;
      const email = tokenData?.payload?.email || tokenData?.payload?.username || '';
      setUserEmail(email);
      console.log('[PlanPayment] 인증된 사용자 이메일:', email);
      if (!token) {
        setError('로그인이 필요합니다. 다시 로그인 해주세요.');
        setLoading(false);
        return;
      }
      const response = await axios.post(
        'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/checkplan',
        { plan_id: planId, email },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        // API 응답의 flight_details를 flightInfo로 매핑하여 데이터 일관성 유지
        const updatedPlanDetails = {
          ...response.data.plan,
          flightInfo: response.data.plan.flight_details,
          accommodationInfo: response.data.plan.accommodationInfo || response.data.plan.accommodation_details
        };
        setPlanDetails(updatedPlanDetails);
        console.log('[PlanPayment] setPlanDetails 이후 planDetails:', updatedPlanDetails); // 데이터 확인 로그
        console.log('[PlanPayment] API 응답 flight_details:', response.data.plan.flight_details);
        console.log('[PlanPayment] 매핑된 flightInfo:', updatedPlanDetails.flightInfo); // 매핑된 flightInfo 확인 로그
        // console.log('[PlanPayment] 상세 데이터:', response.data.plan); // 기존 로그 주석 처리 또는 필요시 유지
        // console.log('[PlanPayment] flightInfo:',  response.data.plan.flight_details); // 기존 로그 주석 처리
        // console.log('[PlanPayment] accommodationInfo:', response.data.plan.accommodationInfo || response.data.plan.accommodation_details); // 기존 로그 주석 처리
      } else {
        throw new Error(response.data.message || '계획 상세 정보를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError(err.message);
      console.error('계획 상세 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      const itemsToPay = [];
      const flight = planDetails.flightInfo;
        console.log('flight:', flight);
      if (selectedItems.flight && flight) {
        itemsToPay.push({
          type: 'flight',
          data: flight
        });
      }
      if (selectedItems.accommodation && planDetails.accommodationInfo) {
        itemsToPay.push({
          type: 'accommodation',
          data: planDetails.accommodationInfo
        });
      }

      if (itemsToPay.length === 0) {
        alert('결제할 항목을 선택해주세요.');
        return;
      }

      // 결제 API 호출
      const response = await axios.post('YOUR_PAYMENT_ENDPOINT', {
        planId,
        items: itemsToPay
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        alert('결제가 완료되었습니다.');
        onClose();
      } else {
        throw new Error(response.data.message || '결제에 실패했습니다.');
      }
    } catch (err) {
      alert(err.message);
      console.error('결제 실패:', err);
    }
  };

  if (loading) {
    return <div className="text-center py-4">로딩 중...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>;
  }

  if (!planDetails) {
    return <div className="text-center py-4">계획 정보를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">장바구니</h2>
      {userEmail && (
        <div className="mb-4 text-sm text-gray-500">인증된 이메일: <span className="font-semibold text-primary">{userEmail}</span></div>
      )}
      <h2 className="text-2xl font-bold mb-6">결제 정보</h2>
      {/* <pre>{JSON.stringify(planDetails.flightInfo, null, 2)}</pre> */}

      {/* 항공편 정보 */}
      {console.log('[PlanPayment] 렌더링 직전 displayFlightInfo:', displayFlightInfo)} {/* 렌더링 직전 데이터 확인 로그 */}
      {Array.isArray(displayFlightInfo) && displayFlightInfo.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="flight"
              checked={selectedItems.flight}
              onChange={(e) => setSelectedItems(prev => ({ ...prev, flight: e.target.checked }))}
              className="mr-3"
            />
            <label htmlFor="flight" className="text-lg font-semibold">항공편</label>
          </div>
          <div className="pl-8">
            {displayFlightInfo.map((flight, idx) => {
              const price = flight?.flightOfferDetails?.flightOfferData?.price?.grandTotal;
              return (
                <div key={flight.id || idx} className="mb-2">
                  <div className="text-gray-700">항공편명: {flight.name || '이름 없음'}</div>
                  <div className="text-primary font-semibold mt-1">
                    가격: {price ? Number(price).toLocaleString() : '-'}원
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 숙박 정보 */}
      {planDetails.accommodationInfo && (
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="accommodation"
              checked={selectedItems.accommodation}
              onChange={(e) => setSelectedItems(prev => ({ ...prev, accommodation: e.target.checked }))}
              className="mr-3"
            />
            <label htmlFor="accommodation" className="text-lg font-semibold">숙박</label>
          </div>
          <div className="pl-8">
            <p className="text-gray-700">{planDetails.accommodationInfo.hotel.name}</p>
            <p className="text-gray-600 text-sm">
              체크인: {format(new Date(planDetails.accommodationInfo.checkIn), 'yyyy년 MM월 dd일', { locale: ko })}
              <br />
              체크아웃: {format(new Date(planDetails.accommodationInfo.checkOut), 'yyyy년 MM월 dd일', { locale: ko })}
            </p>
            <p className="text-primary font-semibold mt-2">
              {planDetails.accommodationInfo.room.price.toLocaleString()} {planDetails.accommodationInfo.room.currency}
            </p>
          </div>
        </div>
      )}

      {/* 결제 버튼 */}
      <div className="flex justify-end gap-4 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          취소
        </button>
        <button
          onClick={handlePayment}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
        >
          결제하기
        </button>
      </div>
    </div>
  );
};

export default PlanPayment; 