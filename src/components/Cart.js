import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Cart.css';

const Cart = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([
    { id: 1, name: '제주도 호텔', quantity: 1, price: 150000 },
    { id: 2, name: '제주도 항공권', quantity: 2, price: 200000 },
    { id: 3, name: '제주도 투어', quantity: 1, price: 80000 },
  ]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const vouchers = [
    { id: 1, name: '5만원 상품권', amount: 50000 },
    { id: 2, name: '10만원 상품권', amount: 100000 },
    { id: 3, name: '20만원 상품권', amount: 200000 },
    { id: 4, name: '50만원 상품권', amount: 500000 },
  ];

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

  const calculateSubtotal = () => {
    return cartItems
      .filter(item => selectedItems.includes(item.id))
      .reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return Math.max(0, subtotal - discountAmount);
  };

  return (
    <div className="cart-page">
      <div className="cart-header-section">
        <div className="cart-content">
          <h1 className="cart-title">예약 및 결제</h1>
          <div className="divider"></div>
          
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
          </div>

          <div className="discount-section">
            <div className="discount-input">
              <label>상품권 할인</label>
              <div className="voucher-dropdown">
                <input
                  type="text"
                  value={selectedVoucher ? selectedVoucher.name : '상품권을 선택하세요'}
                  readOnly
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="voucher-input"
                />
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
                onClick={() => navigate('/checkout')}
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