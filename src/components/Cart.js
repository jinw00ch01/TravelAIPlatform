import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from './auth/AuthContext';
import './Cart.css';

const Cart = () => {
  const navigate = useNavigate();
  const { getJwtToken } = useAuth();
  
  // 상태 관리
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planDetails, setPlanDetails] = useState(null);
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
        'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/checklist', 
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
      console.log('[Cart] 여행 계획 상세 정보 요청:', { planId, email });
      
      const response = await axios.post(
        'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/checkplan',
        { plan_id: planId, email },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('[Cart] 여행 계획 상세 응답:', response.data);

      if (response.data.success) {
        // API 응답의 flight_details를 flightInfo로 매핑하여 데이터 일관성 유지
        const updatedPlanDetails = {
          ...response.data.plan,
          flightInfo: typeof response.data.plan.flight_details === 'string' 
            ? JSON.parse(response.data.plan.flight_details)
            : response.data.plan.flight_details,
          accommodationInfo: response.data.plan.accommodationInfo || response.data.plan.accommodation_details
        };
        setPlanDetails(updatedPlanDetails);
        console.log('[Cart] 변환된 계획 상세:', updatedPlanDetails);
        console.log('[Cart] 항공편 정보:', updatedPlanDetails.flightInfo);
        console.log('[Cart] 숙박 정보:', updatedPlanDetails.accommodationInfo);
        
        // 장바구니 아이템 구성
        const items = [];
        
        // 항공편 데이터 추가
        if (updatedPlanDetails.flightInfo) {
          console.log('[Cart] 항공편 데이터 처리 중...');
          try {
            // 항공편 정보가 배열인지 확인하고 아니면 배열로 변환
            const flights = Array.isArray(updatedPlanDetails.flightInfo) 
              ? updatedPlanDetails.flightInfo 
              : JSON.parse(updatedPlanDetails.flightInfo);
              
            console.log('[Cart] 파싱된 항공편 데이터:', flights);
            
            if (Array.isArray(flights) && flights.length > 0) {
              flights.forEach((flight, index) => {
                const price = flight?.flightOfferDetails?.flightOfferData?.price?.grandTotal;
                console.log(`[Cart] 항공편 ${index + 1} 가격:`, price);
                if (price) {
                  items.push({
                    id: `flight-${index}-${planId}`,
                    name: flight.name || `항공편 ${index + 1}`,
                    type: 'flight',
                    quantity: 1,
                    price: Number(price),
                    originalData: flight
                  });
                }
              });
            } else {
              console.log('[Cart] 항공편 데이터가 배열 형식이 아닙니다.');
            }
          } catch (error) {
            console.error('[Cart] 항공편 데이터 파싱 오류:', error);
          }
        } else {
          console.log('[Cart] 유효한 항공편 데이터가 없습니다.');
        }
        
        // 숙박 데이터 추가
        if (updatedPlanDetails.accommodationInfo) {
          console.log('[Cart] 숙박 데이터 처리 중...');
          // 숙박 정보가 문자열이면 파싱
          const accommodation = typeof updatedPlanDetails.accommodationInfo === 'string' 
            ? JSON.parse(updatedPlanDetails.accommodationInfo) 
            : updatedPlanDetails.accommodationInfo;
            
          console.log('[Cart] 파싱된 숙박 정보:', accommodation);
          
          if (accommodation && accommodation.hotel) {
            console.log('[Cart] 호텔 이름:', accommodation.hotel?.name);
            console.log('[Cart] 숙박 가격:', accommodation.room?.price);
            
            const hotelName = accommodation.hotel?.name || '숙박';
            const roomPrice = accommodation.room?.price || 0;
            
            if (roomPrice !== undefined && roomPrice !== null) {
              items.push({
                id: `accommodation-${planId}`,
                name: hotelName,
                type: 'accommodation',
                quantity: 1,
                price: typeof roomPrice === 'string' ? parseFloat(roomPrice) : roomPrice,
                originalData: accommodation
              });
            }
          }
        } else {
          console.log('[Cart] 유효한 숙박 데이터가 없습니다.');
        }
        
        console.log('[Cart] 생성된 장바구니 아이템:', items);
        setCartItems(items);
        
        // 기본적으로 모든 아이템 선택
        const newSelectedItems = items.map(item => item.id);
        console.log('[Cart] 선택된 아이템 IDs:', newSelectedItems);
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

  // 결제 처리 함수
  const handlePayment = async () => {
    try {
      const itemsToPay = cartItems
        .filter(item => selectedItems.includes(item.id))
        .map(item => ({
          type: item.type,
          data: item.originalData
        }));

      if (itemsToPay.length === 0) {
        alert('결제할 항목을 선택해주세요.');
        return;
      }

      // 결제 API 호출
      const tokenData = await getJwtToken();
      const token = tokenData?.token;
      
      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      console.log('[Cart] 결제 요청 데이터:', {
        plan_id: selectedPlan?.plan_id,
        items: itemsToPay,
        email: userEmail,
        total_amount: calculateTotal(),
        discount: discountAmount
      });
      
      const response = await axios.post(
        'https://lngdadu778.execute-api.ap-northeast-2.amazonaws.com/Stage/api/travel/payment', 
        {
          plan_id: selectedPlan?.plan_id,
          items: itemsToPay,
          email: userEmail,
          total_amount: calculateTotal(),
          discount: discountAmount
        }, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('[Cart] 결제 응답:', response.data);

      if (response.data.success) {
        alert('결제가 완료되었습니다.');
        // 결제 완료 후 홈으로 이동
        navigate('/');
      } else {
        throw new Error(response.data.message || '결제에 실패했습니다.');
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
              <h2 className="section-title">여행 계획 선택</h2>
              <div className="plans-selector">
                <select 
                  className="plan-select" 
                  value={selectedPlan?.plan_id || ''}
                  onChange={(e) => {
                    const planId = e.target.value;
                    console.log('[Cart] 드롭다운에서 선택된 plan_id:', planId);
                    console.log('[Cart] 사용 가능한 plans:', plans);
                    const plan = plans.find(p => String(p.plan_id) === String(planId));
                    console.log('[Cart] 찾은 plan 객체:', plan);
                    if (plan) handlePlanSelect(plan);
                  }}
                >
                  {plans.map((plan) => (
                    <option key={plan.plan_id} value={plan.plan_id}>
                      {plan.name} ({format(new Date(plan.last_updated), 'yyyy년 MM월 dd일', { locale: ko })})
                    </option>
                  ))}
                </select>
              </div>
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
            <div className="cart-items-header">
              <div className="header-checkbox"></div>
              <span className="header-name">상품명</span>
              <span className="header-quantity">수량</span>
              <span className="header-price">결제금액</span>
              <div className="header-delete"></div>
            </div>
            <div className="divider"></div>
            {cartItems.map(item => (
              <div key={item.id}>
                <div className="cart-item">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={() => handleCheckboxChange(item.id)}
                  />
                  <span className="item-name">{item.name}</span>
                  <div className="quantity-controls">
                    <button 
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(item.id, -1)}
                    >
                      -
                    </button>
                    <span className="item-quantity">{item.quantity}</span>
                    <button 
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className="item-price">{item.price.toLocaleString()}원</span>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    ×
                  </button>
                </div>
                <div className="divider"></div>
              </div>
            ))}
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
              <span className="discount-amount">-{discountAmount.toLocaleString()}원</span>
            </div>
          </div>

          <div className="cart-summary">
            <div className="price-details">
              <div className="subtotal">
                <span>상품 금액</span>
                <span>{calculateSubtotal().toLocaleString()}원</span>
              </div>
              <div className="discount">
                <span>할인 금액</span>
                <span className="discount-amount">-{discountAmount.toLocaleString()}원</span>
              </div>
            </div>
            <div className="total-price">
              <span>총 결제금액</span>
              <span className="final-price">{calculateTotal().toLocaleString()}원</span>
            </div>
            <div className="cart-buttons">
              <button 
                className="continue-shopping"
                onClick={() => navigate('/')}
              >
                쇼핑 계속하기
              </button>
              <button 
                className="checkout"
                onClick={handlePayment}
              >
                결제하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart; 