import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from './auth/AuthContext';
import './Cart.css';

// JWT 토큰 디코딩 함수
const decodeJWT = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }
    
    const payload = JSON.parse(atob(parts[1]));
    return { payload };
  } catch (error) {
    console.error('JWT 디코딩 오류:', error);
    throw error;
  }
};

const Cart = () => {
  const navigate = useNavigate();
  const { getJwtToken } = useAuth();
  
  // 상태 관리
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  
  // 드롭다운 ref 생성
  const voucherDropdownRef = React.useRef(null);

  const vouchers = [
    { id: 1, name: '5만원 상품권', amount: 50000 },
    { id: 2, name: '10만원 상품권', amount: 100000 },
    { id: 3, name: '20만원 상품권', amount: 200000 },
    { id: 4, name: '50만원 상품권', amount: 500000 },
  ];

  // 외부 클릭 감지를 위한 이벤트 리스너
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (voucherDropdownRef.current && !voucherDropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    // 이벤트 리스너 등록
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);

    // 컴포넌트 언마운트 시 이벤트 리스너 해제
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  // 컴포넌트 마운트 시 여행 계획 목록 가져오기
  useEffect(() => {
    fetchPlans();
  }, []);

  // 여행 계획 목록 가져오기
  const fetchPlans = async () => {
    try {
      setLoading(true);
      const tokenData = await getJwtToken();
      const token = tokenData?.token;
      const email = tokenData?.payload?.email || tokenData?.payload?.username || '';
      setUserEmail(email);
      
      if (!token) {
        setError('로그인이 필요합니다. 다시 로그인 해주세요.');
        setLoading(false);
        return;
      }
      
      const response = await axios.post(
        'https://9b5hbw9u25.execute-api.ap-northeast-2.amazonaws.com/Stage/travel/checklist', 
        { email },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setPlans(response.data.plans);
        
        // 기본적으로 첫 번째 계획 선택
        if (response.data.plans.length > 0) {
          const firstPlan = response.data.plans[0];
          setSelectedPlan(firstPlan);
          fetchPlanDetails(firstPlan.plan_id, token, email);
        }
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

  // 선택한 여행 계획의 상세 정보 가져오기
  const fetchPlanDetails = async (planId, token, email) => {
    try {
      setLoading(true);
      
      const response = await axios.post(
        'https://9b5hbw9u25.execute-api.ap-northeast-2.amazonaws.com/Stage/travel/checkplan',
        { plan_id: planId, email },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        // 다중 항공편 정보 파싱 (flight_info_1, flight_info_2, ...)
        const flightInfos = [];
        let flightIndex = 1;
        while (response.data.plan[`flight_info_${flightIndex}`]) {
          try {
            const flightData = typeof response.data.plan[`flight_info_${flightIndex}`] === 'string'
              ? JSON.parse(response.data.plan[`flight_info_${flightIndex}`])
              : response.data.plan[`flight_info_${flightIndex}`];
            flightInfos.push(flightData);
          } catch (e) {
            console.error(`[Cart] 항공편 ${flightIndex} 정보 파싱 오류:`, e);
          }
          flightIndex++;
        }

        // 다중 숙박편 정보 파싱 (accmo_info_1, accmo_info_2, ...)
        const accommodationInfos = [];
        let accmoIndex = 1;
        while (response.data.plan[`accmo_info_${accmoIndex}`]) {
          try {
            const accmoData = typeof response.data.plan[`accmo_info_${accmoIndex}`] === 'string'
              ? JSON.parse(response.data.plan[`accmo_info_${accmoIndex}`])
              : response.data.plan[`accmo_info_${accmoIndex}`];
            accommodationInfos.push(accmoData);
          } catch (e) {
            console.error(`[Cart] 숙박편 ${accmoIndex} 정보 파싱 오류:`, e);
          }
          accmoIndex++;
        }


        
        // 장바구니 아이템 구성
        const items = [];
        
        // 다중 항공편 데이터 추가
        flightInfos.forEach((flightInfo, index) => {
          const price = flightInfo?.price?.total || flightInfo?.flightOfferDetails?.flightOfferData?.price?.total;
          if (price) {
            // 항공편 정보 추출
            const itinerary = flightInfo?.itineraries?.[0] || flightInfo?.flightOfferDetails?.flightOfferData?.itineraries?.[0];
            const departure = itinerary?.segments?.[0];
            const arrival = itinerary?.segments?.[itinerary.segments.length - 1];
            
            items.push({
              id: `flight-${index}-${planId}`,
              name: `${departure?.departure?.iataCode || ''} → ${arrival?.arrival?.iataCode || ''} 항공편 ${index + 1}`,
              type: 'flight',
              quantity: 1,
              price: parseFloat(price),
              originalData: flightInfo,
              details: {
                departure: departure?.departure?.at ? new Date(departure.departure.at).toLocaleString('ko-KR') : '정보 없음',
                arrival: arrival?.arrival?.at ? new Date(arrival.arrival.at).toLocaleString('ko-KR') : '정보 없음',
                duration: itinerary?.duration || '정보 없음',
                carrier: departure?.carrierCode || '정보 없음',
                flightNumber: departure?.number || '정보 없음'
              }
            });
          }
        });
        
        // 다중 숙박편 데이터 추가
        accommodationInfos.forEach((accommodationInfo, index) => {
          if (accommodationInfo?.hotel) {
            const checkIn = new Date(accommodationInfo.checkIn);
            const checkOut = new Date(accommodationInfo.checkOut);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            
            // 가격 정보 추출
            let roomPrice = 0;
            const hotel = accommodationInfo.hotel;
            const room = accommodationInfo.room;
            
            // 다양한 가격 필드에서 가격 추출 시도
            if (room?.price) {
              roomPrice = typeof room.price === 'string' 
                ? parseFloat(room.price.replace(/[^0-9.]/g, ''))
                : parseFloat(room.price);
            } else if (room?.rates?.[0]?.price) {
              roomPrice = typeof room.rates[0].price === 'string'
                ? parseFloat(room.rates[0].price.replace(/[^0-9.]/g, ''))
                : parseFloat(room.rates[0].price);
            } else if (hotel?.composite_price_breakdown?.gross_amount?.value) {
              roomPrice = parseFloat(hotel.composite_price_breakdown.gross_amount.value);
            } else if (hotel?.price) {
              roomPrice = typeof hotel.price === 'string'
                ? parseFloat(hotel.price.replace(/[^0-9.]/g, ''))
                : parseFloat(hotel.price);
            }

                         items.push({
               id: `accommodation-${index}-${planId}`,
               name: `${hotel.hotel_name || hotel.hotel_name_trans || hotel.name || '숙소'} ${index + 1}`,
               type: 'accommodation',
               quantity: 1, // 숙박편 가격은 이미 전체 기간 총액이므로 수량은 1
               price: roomPrice, // 이미 전체 숙박 기간의 총 요금
               originalData: accommodationInfo,
               details: {
                 address: hotel.address || hotel.address_trans || '주소 정보 없음',
                 checkIn: checkIn.toLocaleString('ko-KR'),
                 checkOut: checkOut.toLocaleString('ko-KR'),
                 nights: nights,
                 roomType: room?.name || room?.room_type || '선택된 객실',
                 roomDescription: room?.description || room?.room_description || '',
                 amenities: room?.amenities || [],
                 hotelId: hotel.hotel_id || hotel.id
               }
             });
          }
        });
        
        setCartItems(items);
        
        // 기본적으로 모든 아이템 선택
        const newSelectedItems = items.map(item => item.id);
        setSelectedItems(newSelectedItems);
      } else {
        throw new Error(response.data.message || '계획 상세 정보를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('[Cart] 계획 상세 조회 오류:', err);
      setError(err.message || '계획 상세 정보를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 계획 선택 핸들러
  const handlePlanSelect = async (plan) => {
    console.log('[Cart] 선택된 여행 계획:', plan);
    setSelectedPlan(plan);
    
    const tokenData = await getJwtToken();
    const token = tokenData?.token;
    const email = tokenData?.payload?.email || tokenData?.payload?.username || '';
    
    if (token) {
      fetchPlanDetails(plan.plan_id, token, email);
    }
  };

  const handleCheckboxChange = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedItems(cartItems.map(item => item.id));
  };

  const handleDeselectAll = () => {
    setSelectedItems([]);
  };

  const handleDeleteItem = (itemId) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
    setSelectedItems(prev => prev.filter(id => id !== itemId));
  };

  const handleQuantityChange = (itemId, change) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const handleVoucherSelect = (voucher) => {
    setSelectedVoucher(voucher);
    setDiscountAmount(voucher.amount);
    setIsDropdownOpen(false);
  };

  const handleClearVoucher = () => {
    setSelectedVoucher(null);
    setDiscountAmount(0);
  };

  const calculateSubtotal = () => {
    return cartItems
      .filter(item => selectedItems.includes(item.id))
      .reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return Math.max(0, subtotal - discountAmount);
  };

  // 가격 포맷팅 함수 추가
  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(price);
  };

  // 숫자 포맷팅 함수 추가
  const formatNumber = (number) => {
    return new Intl.NumberFormat('ko-KR').format(number);
  };

  // 결제 처리 함수
  const handlePayment = async () => {
    try {
      const itemsToPay = cartItems
        .filter(item => selectedItems.includes(item.id));

      if (itemsToPay.length === 0) {
        alert('결제할 항목을 선택해주세요.');
        return;
      }

      // 이미 결제된 계획인지 확인
      if (selectedPlan?.paid_plan === 1) {
        alert('이미 결제된 계획입니다.\n결제 완료된 여행 계획은 다시 결제할 수 없습니다.');
        return;
      }

      const tokenData = await getJwtToken();
      const token = tokenData?.token;
      
      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }

      if (!selectedPlan?.plan_id) {
        alert('여행 계획 정보가 없습니다.');
        return;
      }

      // Lambda 함수가 기대하는 정확한 형태로 데이터 준비
      const planId = parseInt(selectedPlan.plan_id);

      // paid_plan을 1로 업데이트
      try {

        // 데이터 검증
        if (isNaN(planId)) {
          alert('계획 ID가 올바르지 않습니다.');
          return;
        }

        const requestPayload = {
          plan_id: planId
        };


        
        const updateResponse = await axios.post(
          'https://9b5hbw9u25.execute-api.ap-northeast-2.amazonaws.com/Stage/travel/change',
          {
            plan_id: planId,
            update_type: 'paid_plan',
            paid_plan: 1
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        


        // 응답 처리
        if (updateResponse.status === 200) {
          let responseData = updateResponse.data;
          
          // JSON 파싱
          if (typeof responseData === 'string') {
            try {
              responseData = JSON.parse(responseData);
            } catch (parseError) {
              alert('응답 데이터 파싱에 실패했습니다.');
              return;
            }
          }

          // Lambda 프록시 응답 처리
          if (responseData.body && typeof responseData.body === 'string') {
            try {
              responseData = JSON.parse(responseData.body);
            } catch (bodyParseError) {
              console.error('Body 파싱 실패:', bodyParseError);
            }
          }

          if (responseData.success === true) {
            alert(`결제가 완료되었습니다!\n총 결제금액: ${formatPrice(calculateTotal())}\n여행 계획이 결제 완료 상태로 업데이트되었습니다.`);
            navigate('/');
          } else {
            const errorMessage = responseData.message || 'paid_plan 업데이트에 실패했습니다.';
            alert(`결제 처리 중 오류가 발생했습니다: ${errorMessage}`);
          }
        } else {
          alert('결제 처리 중 예상치 못한 응답을 받았습니다.');
        }
              } catch (updateErr) {
          console.error('[Cart] paid_plan 업데이트 오류:', updateErr);
          console.error('[Cart] 오류 응답:', updateErr.response);
          console.error('[Cart] 오류 상태 코드:', updateErr.response?.status);
          console.error('[Cart] 오류 데이터:', updateErr.response?.data);
          
          let errorMessage = '알 수 없는 오류가 발생했습니다.';
          
          if (updateErr.response) {
            const status = updateErr.response.status;
            const data = updateErr.response.data;
            
            if (status === 400) {
              // Lambda 함수에서 400 에러가 발생하는 경우
              errorMessage = `요청 데이터 오류: ${data?.message || '필수 데이터가 누락되었습니다.'}`;
              console.error('[Cart] 400 에러 - 전송된 데이터:', { plan_id: planId });
            } else if (status === 404) {
              errorMessage = '해당 여행 계획을 찾을 수 없습니다. 계획이 존재하는지 확인해주세요.';
            } else if (status === 500) {
              // Lambda 함수 내부 오류
              if (data?.message) {
                if (data.message.includes('ValidationException')) {
                  errorMessage = 'DynamoDB Key 구조 오류: 데이터 타입을 확인해주세요.';
                } else if (data.message.includes('AccessDenied')) {
                  errorMessage = 'DynamoDB 접근 권한이 없습니다. 관리자에게 문의하세요.';
                } else if (data.message.includes('ResourceNotFound')) {
                  errorMessage = 'DynamoDB 테이블을 찾을 수 없습니다. 테이블 설정을 확인하세요.';
                } else {
                  errorMessage = `서버 내부 오류: ${data.message}`;
                }
              } else {
                errorMessage = '서버 내부 오류가 발생했습니다.';
              }
            } else {
              errorMessage = `서버 오류 (${status}): ${data?.message || updateErr.response.statusText}`;
            }
          } else if (updateErr.request) {
            errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
          } else {
            errorMessage = updateErr.message;
          }
          
          alert(`결제 처리 중 오류가 발생했습니다: ${errorMessage}`);
        }
    } catch (err) {
      alert(err.message || '결제 중 오류가 발생했습니다.');
      console.error('[Cart] 결제 실패:', err);
    }
  };

  if (loading && plans.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-content">
          <div className="text-center py-4">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cart-page">
        <div className="cart-content">
          <div className="text-red-500 text-center py-4">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-header-section">
        <div className="cart-content">
          <h1 className="cart-title">예약 및 결제</h1>
          <div className="divider"></div>
          
          {/* 여행 계획 선택 섹션 */}
          {plans.length > 0 && (
            <div className="travel-plans-section">
              <h2 className="section-title">
                여행 계획 선택
                {selectedPlan?.is_shared_with_me && (
                  <span 
                    style={{
                      marginLeft: '10px',
                      padding: '4px 8px',
                      backgroundColor: '#e6f3ff',
                      color: '#0066cc',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      border: '1px solid #b3d9ff'
                    }}
                  >
                    공유된 플랜
                  </span>
                )}
              </h2>
              <div className="plans-selector">
                <select 
                  className="plan-select" 
                  value={selectedPlan?.plan_id || ''}
                  onChange={(e) => {
                    const plan = plans.find(p => String(p.plan_id) === e.target.value);
                    if (plan) handlePlanSelect(plan);
                  }}
                >
                  {plans.map((plan) => (
                    <option 
                      key={plan.plan_id} 
                      value={plan.plan_id}
                      style={{
                        backgroundColor: plan.is_shared_with_me ? '#e6f3ff' : 'white',
                        color: plan.is_shared_with_me ? '#0066cc' : 'black'
                      }}
                    >
                      {plan.name} ({format(new Date(plan.last_updated), 'yyyy년 MM월 dd일', { locale: ko })})
                      {plan.is_shared_with_me ? ' (공유됨)' : ''}
                      {plan.paid_plan === 1 ? ' [결제완료]' : ' [미결제]'}
                    </option>
                  ))}
                </select>
              </div>
              {selectedPlan?.is_shared_with_me && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px',
                  backgroundColor: '#f0f8ff',
                  border: '1px solid #b3d9ff',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#0066cc'
                }}>
                  <strong>📤 공유받은 계획</strong>
                  <br />
                  원래 소유자: {selectedPlan.original_owner || selectedPlan.user_id || '알 수 없음'}
                </div>
              )}
              <div className="divider"></div>
            </div>
          )}
          
          <div className="select-all-section">
            <div className="select-all-buttons">
              <button 
                className="select-all-btn"
                onClick={handleSelectAll}
              >
                전체 선택
              </button>
              <button 
                className="deselect-all-btn"
                onClick={handleDeselectAll}
              >
                전체 취소
              </button>
            </div>
          </div>
          <div className="divider"></div>
          
          <div className="cart-items">
            {/* 항공권 섹션 */}
            <div className="category-section">
              <h3 className="category-title">
                <span className="icon">✈️</span>
                항공권
              </h3>
              <div className="cart-items-header">
                <div className="header-checkbox"></div>
                <span className="header-name">항공편</span>
                <span className="header-quantity">인원</span>
                <span className="header-price">결제금액</span>
                <div className="header-delete"></div>
              </div>
              <div className="divider"></div>
              {cartItems.filter(item => item.type === 'flight').map(item => (
                <div key={item.id} className="cart-item-card">
                  <div className="cart-item-header">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleCheckboxChange(item.id)}
                    />
                    <span className="item-type-icon">
                      {item.type === 'flight' ? '✈️' : '🏨'}
                    </span>
                    <span className="item-name">{item.name}</span>
                  </div>
                  <div className="cart-item-details">
                    {item.type === 'flight' && (
                      <>
                        <div>출발: {item.details.departure}</div>
                        <div>도착: {item.details.arrival}</div>
                        <div>소요시간: {item.details.duration}</div>
                      </>
                    )}
                  </div>
                  <div className="cart-item-price">
                    <div className="quantity-info">
                      {item.type === 'accommodation' ? (
                        <span className="nights-info">{formatNumber(item.details.nights)}박</span>
                      ) : (
                        <div className="quantity-controls">
                          <button 
                            className="quantity-btn"
                            onClick={() => handleQuantityChange(item.id, -1)}
                          >
                            -
                          </button>
                          <span className="item-quantity">{formatNumber(item.quantity)}</span>
                          <button 
                            className="quantity-btn"
                            onClick={() => handleQuantityChange(item.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="price-info">
                      <div className="unit-price">
                        {item.type === 'accommodation' ? `${item.details.nights}박 총액` : `1인 ${formatPrice(item.price)}`}
                      </div>
                      <div className="total-price">{formatPrice(item.price * item.quantity)}</div>
                    </div>
                  </div>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              {cartItems.filter(item => item.type === 'flight').length === 0 && (
                <div className="empty-category-message">
                  선택된 항공권이 없습니다.
                </div>
              )}
            </div>

            {/* 숙소 섹션 */}
            <div className="category-section">
              <h3 className="category-title">
                <span className="icon">🏨</span>
                숙소
              </h3>
              <div className="cart-items-header">
                <div className="header-checkbox"></div>
                <span className="header-name">숙소명</span>
                <span className="header-quantity">박수</span>
                <span className="header-price">결제금액</span>
                <div className="header-delete"></div>
              </div>
              <div className="divider"></div>
              {cartItems.filter(item => item.type === 'accommodation').map(item => (
                <div key={item.id} className="cart-item-card">
                  <div className="cart-item-header">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleCheckboxChange(item.id)}
                    />
                    <span className="item-type-icon">
                      {item.type === 'flight' ? '✈️' : '🏨'}
                    </span>
                    <span className="item-name">{item.name}</span>
                  </div>
                  <div className="cart-item-details">
                    {item.type === 'accommodation' && (
                      <>
                        <div>주소: {item.details.address}</div>
                        <div>체크인: {item.details.checkIn}</div>
                        <div>체크아웃: {item.details.checkOut}</div>
                        <div className="room-details">
                          <div className="room-type">객실 타입: {item.details.roomType}</div>
                          {item.details.roomDescription && (
                            <div className="room-description">{item.details.roomDescription}</div>
                          )}
                          {item.details.amenities && item.details.amenities.length > 0 && (
                            <div className="room-amenities">
                              <span>편의시설:</span>
                              <ul>
                                {item.details.amenities.map((amenity, index) => (
                                  <li key={index}>{amenity}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="cart-item-price">
                    <div className="quantity-info">
                      <span className="nights-info">{formatNumber(item.details.nights)}박</span>
                    </div>
                    <div className="price-info">
                      <div className="unit-price">
                        {item.details.nights}박 총액
                      </div>
                      <div className="total-price">{formatPrice(item.price)}</div>
                    </div>
                  </div>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              {cartItems.filter(item => item.type === 'accommodation').length === 0 && (
                <div className="empty-category-message">
                  선택된 숙소가 없습니다.
                </div>
              )}
            </div>

            {cartItems.length === 0 && (
              <div className="empty-cart-message">
                <p>장바구니가 비어있습니다.</p>
                <p className="empty-cart-help">여행 계획을 선택하여 항공편과 숙박 정보를 확인해보세요.</p>
                {plans.length === 0 && (
                  <p className="empty-plans-help">아직 여행 계획이 없습니다. 여행 계획을 먼저 생성해주세요.</p>
                )}
              </div>
            )}
          </div>

          {/* 카테고리별 소계 */}
          {cartItems.length > 0 && (
            <div className="category-subtotals">
              <div className="subtotal-item">
                <span className="icon">✈️</span>
                <span>항공권 소계:</span>
                <span className="amount">
                  {formatPrice(
                    cartItems
                      .filter(item => item.type === 'flight' && selectedItems.includes(item.id))
                      .reduce((total, item) => total + (item.price * item.quantity), 0)
                  )}
                </span>
              </div>
              <div className="subtotal-item">
                <span className="icon">🏨</span>
                <span>숙소 소계:</span>
                <span className="amount">
                  {formatPrice(
                    cartItems
                      .filter(item => item.type === 'accommodation' && selectedItems.includes(item.id))
                      .reduce((total, item) => total + (item.price * item.quantity), 0)
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="discount-section">
            <div className="discount-input">
              <label>상품권 할인</label>
              <div className="voucher-dropdown" ref={voucherDropdownRef}>
                <div className="voucher-input-wrapper">
                  <input
                    type="text"
                    value={selectedVoucher ? selectedVoucher.name : '상품권을 선택하세요'}
                    readOnly
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="voucher-input"
                  />
                  {selectedVoucher && (
                    <button 
                      className="clear-voucher-btn"
                      onClick={handleClearVoucher}
                      title="상품권 선택 취소"
                    >
                      ×
                    </button>
                  )}
                </div>
                {isDropdownOpen && (
                  <div className="voucher-options">
                    {vouchers.map(voucher => (
                      <div
                        key={voucher.id}
                        className="voucher-option"
                        onClick={() => handleVoucherSelect(voucher)}
                      >
                        {voucher.name} ({voucher.amount.toLocaleString()}원)
                      </div>
                    ))}
                    <div 
                      className="voucher-option voucher-cancel"
                      onClick={() => {
                        setIsDropdownOpen(false);
                      }}
                    >
                      취소
                    </div>
                  </div>
                )}
              </div>
              <span className="discount-amount">-{formatPrice(discountAmount)}</span>
            </div>
          </div>

          <div className="cart-summary">
            <div className="price-details">
              <div className="subtotal">
                <span>상품 금액</span>
                <span>{formatPrice(calculateSubtotal())}</span>
              </div>
              <div className="discount">
                <span>할인 금액</span>
                <span className="discount-amount">-{formatPrice(discountAmount)}</span>
              </div>
            </div>
            <div className="total-price">
              <span>총 결제금액</span>
              <span className="final-price">
                {formatPrice(calculateTotal())}
                {selectedPlan?.paid_plan === 1 && (
                  <span style={{ 
                    marginLeft: '10px', 
                    fontSize: '14px', 
                    color: '#28a745',
                    fontWeight: 'bold'
                  }}>
                    (결제완료)
                  </span>
                )}
              </span>
            </div>
            <div className="cart-buttons">
              <button 
                className="continue-shopping"
                onClick={() => navigate('/itinerary')}
              >
                쇼핑 계속하기
              </button>
              {selectedPlan?.paid_plan === 1 ? (
                <button 
                  className="checkout"
                  disabled
                  style={{
                    backgroundColor: '#6c757d',
                    cursor: 'not-allowed',
                    opacity: 0.6
                  }}
                >
                  이미 결제 완료
                </button>
              ) : (
                <button 
                  className="checkout"
                  onClick={handlePayment}
                >
                  결제하기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart; 