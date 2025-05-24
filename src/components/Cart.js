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
        // 항공권 정보 파싱
        let flightInfo = null;
        try {
          flightInfo = typeof response.data.plan.flight_details === 'string' 
            ? JSON.parse(response.data.plan.flight_details)
            : response.data.plan.flight_details;
          console.log('[Cart] 파싱된 항공권 정보:', flightInfo);
        } catch (e) {
          console.error('[Cart] 항공권 정보 파싱 오류:', e);
        }

        // 숙소 정보 파싱
        let accommodationInfo = null;
        try {
          accommodationInfo = typeof response.data.plan.accmo_info === 'string'
            ? JSON.parse(response.data.plan.accmo_info)
            : response.data.plan.accmo_info;
          console.log('[Cart] 파싱된 숙소 정보:', accommodationInfo);
        } catch (e) {
          console.error('[Cart] 숙소 정보 파싱 오류:', e);
        }

        const updatedPlanDetails = {
          ...response.data.plan,
          flightInfo,
          accommodationInfo
        };
        setPlanDetails(updatedPlanDetails);
        
        // 장바구니 아이템 구성
        const items = [];
        
        // 항공권 데이터 추가
        if (flightInfo && Array.isArray(flightInfo)) {
          flightInfo.forEach((flight, index) => {
            const price = flight?.flightOfferDetails?.flightOfferData?.price?.total;
            if (price) {
              const departure = flight.flightOfferDetails?.flightOfferData?.itineraries?.[0]?.segments?.[0];
              items.push({
                id: `flight-${index}-${planId}`,
                name: `${departure?.departure?.iataCode || ''} → ${departure?.arrival?.iataCode || ''} 항공편`,
                type: 'flight',
                quantity: 1,
                price: parseFloat(price),
                details: {
                  departure: departure?.departure?.at ? new Date(departure.departure.at).toLocaleString('ko-KR') : '정보 없음',
                  arrival: departure?.arrival?.at ? new Date(departure.arrival.at).toLocaleString('ko-KR') : '정보 없음',
                  duration: flight.flightOfferDetails?.flightOfferData?.itineraries?.[0]?.duration || '정보 없음'
                }
              });
            }
          });
        }
        
        // 숙소 데이터 추가
        if (accommodationInfo?.hotel) {
          const checkIn = new Date(accommodationInfo.checkIn);
          const checkOut = new Date(accommodationInfo.checkOut);
          const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
          
          // 선택된 룸 정보 가져오기
          const selectedRoom = accommodationInfo.room || accommodationInfo.selectedRoom;
          console.log('[Cart] 선택된 룸 정보:', selectedRoom);

          // 룸 가격 계산
          let roomPrice = 0;
          if (selectedRoom?.price) {
            roomPrice = typeof selectedRoom.price === 'string' 
              ? parseFloat(selectedRoom.price.replace(/[^0-9.]/g, ''))
              : selectedRoom.price;
          } else if (selectedRoom?.rates?.[0]?.price) {
            roomPrice = typeof selectedRoom.rates[0].price === 'string'
              ? parseFloat(selectedRoom.rates[0].price.replace(/[^0-9.]/g, ''))
              : selectedRoom.rates[0].price;
          }

          items.push({
            id: `accommodation-${planId}`,
            name: accommodationInfo.hotel.hotel_name || accommodationInfo.hotel.name || '숙소',
            type: 'accommodation',
            quantity: nights,
            price: roomPrice,
            details: {
              address: accommodationInfo.hotel.address,
              checkIn: checkIn.toLocaleString('ko-KR'),
              checkOut: checkOut.toLocaleString('ko-KR'),
              nights: nights,
              roomType: selectedRoom?.name || selectedRoom?.room_type || '선택된 객실',
              roomDescription: selectedRoom?.description || selectedRoom?.room_description,
              amenities: selectedRoom?.amenities || []
            }
          });
        }
        
        console.log('[Cart] 생성된 장바구니 아이템:', items);
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
                    const plan = plans.find(p => String(p.plan_id) === e.target.value);
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
                        <span className="nights-info">{formatNumber(item.quantity)}박</span>
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
                        1{item.type === 'accommodation' ? '박' : '인'} {formatPrice(item.price)}
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
                      <div className="quantity-controls">
                        <button 
                          className="quantity-btn"
                          onClick={() => handleQuantityChange(item.id, -1)}
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="item-quantity">{formatNumber(item.quantity)}박</span>
                        <button 
                          className="quantity-btn"
                          onClick={() => handleQuantityChange(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="price-info">
                      <div className="unit-price">
                        1박 {formatPrice(item.price)}
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
              <span className="final-price">{formatPrice(calculateTotal())}</span>
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