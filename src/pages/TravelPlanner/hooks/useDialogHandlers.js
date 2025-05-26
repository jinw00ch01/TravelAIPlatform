import { useState, useCallback } from 'react';

const useDialogHandlers = () => {
  // 다이얼로그 상태들
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDateEditDialogOpen, setIsDateEditDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(null);
  const [selectedFlightForPlannerDialog, setSelectedFlightForPlannerDialog] = useState(null);
  const [isPlannerFlightDetailOpen, setIsPlannerFlightDetailOpen] = useState(false);
  const [selectedAccommodationForDialog, setSelectedAccommodationForDialog] = useState(null);
  const [isAccommodationDetailOpen, setIsAccommodationDetailOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [sharedEmail, setSharedEmail] = useState('');
  const [sharedEmails, setSharedEmails] = useState([]);
  const [shareMessage, setShareMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // 날짜 수정 다이얼로그 핸들러
  const handleOpenDateEditDialog = useCallback((startDate) => {
    setTempStartDate(startDate);
    setIsDateEditDialogOpen(true);
  }, []);

  const handleTempDateChange = useCallback((newDate) => {
    setTempStartDate(newDate);
  }, []);

  const handleConfirmDateChange = useCallback((plannerHandleDateChange) => {
    if (tempStartDate) {
      plannerHandleDateChange(tempStartDate);
    }
    setIsDateEditDialogOpen(false);
  }, [tempStartDate]);

  // 항공편 상세 다이얼로그 핸들러
  const handleOpenPlannerFlightDetail = useCallback((flightScheduleItem) => {
    if (flightScheduleItem?.flightOfferDetails?.flightOfferData) {
      setSelectedFlightForPlannerDialog(flightScheduleItem.flightOfferDetails);
      setIsPlannerFlightDetailOpen(true);
    } else {
      console.warn('Flight detail not found in schedule item:', flightScheduleItem);
    }
  }, []);
  
  const handleClosePlannerFlightDetail = useCallback(() => {
    setIsPlannerFlightDetailOpen(false);
    setSelectedFlightForPlannerDialog(null);
  }, []);

  // 숙박 상세 다이얼로그 핸들러
  const handleOpenAccommodationDetail = useCallback((accommodationData = null) => {
    if (accommodationData) {
      setSelectedAccommodationForDialog(accommodationData);
      setIsAccommodationDetailOpen(true);
    }
  }, []);

  const handleCloseAccommodationDetail = useCallback(() => {
    setIsAccommodationDetailOpen(false);
    setSelectedAccommodationForDialog(null);
  }, []);

  // 공유 다이얼로그 핸들러
  const handleOpenShareDialog = useCallback((currentSharedEmails = []) => {
    // 기존 공유된 이메일들을 로드
    const emailArray = Array.isArray(currentSharedEmails) 
      ? currentSharedEmails 
      : typeof currentSharedEmails === 'string' 
        ? currentSharedEmails.split(',').map(email => email.trim()).filter(email => email)
        : [];
    
    setSharedEmails(emailArray);
    setIsShareDialogOpen(true);
    setShareMessage('');
  }, []);

  const handleCloseShareDialog = useCallback(() => {
    setIsShareDialogOpen(false);
    setSharedEmail('');
    setSharedEmails([]);
    setShareMessage('');
  }, []);

  const handleAddSharedEmail = useCallback(() => {
    const email = sharedEmail.trim();
    if (!email) return;
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setShareMessage('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    
    // 중복 검사
    if (sharedEmails.includes(email)) {
      setShareMessage('이미 추가된 이메일입니다.');
      return;
    }
    
    setSharedEmails(prev => [...prev, email]);
    setSharedEmail('');
    setShareMessage('');
  }, [sharedEmail, sharedEmails]);

  const handleRemoveSharedEmail = useCallback((index) => {
    setSharedEmails(prev => prev.filter((_, i) => i !== index));
    setShareMessage('');
  }, []);

  const handleSharePlan = useCallback(async (plannerHandleSharePlan, planId) => {
    if (!planId || planId === 'new') {
      setShareMessage('저장된 계획만 공유할 수 있습니다. 먼저 계획을 저장해주세요.');
      return;
    }

    setIsSharing(true);
    setShareMessage('');

    try {
      // 현재 공유된 이메일 목록을 문자열로 변환 (비어있으면 null)
      const sharedEmailString = sharedEmails.length > 0 ? sharedEmails.join(',') : null;
      const result = await plannerHandleSharePlan(sharedEmailString);
      
      if (result.success) {
        setShareMessage(result.message || '공유 설정이 저장되었습니다.');
        setTimeout(() => {
          handleCloseShareDialog();
        }, 2000);
      } else {
        setShareMessage(result.message);
      }
    } catch (error) {
      console.error('플랜 공유 실패:', error);
      setShareMessage('플랜 공유 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSharing(false);
    }
  }, [sharedEmails, handleCloseShareDialog]);

  return {
    // 상태들
    isSearchOpen,
    setIsSearchOpen,
    isDateEditDialogOpen,
    setIsDateEditDialogOpen,
    tempStartDate,
    selectedFlightForPlannerDialog,
    isPlannerFlightDetailOpen,
    selectedAccommodationForDialog,
    isAccommodationDetailOpen,
    isShareDialogOpen,
    sharedEmail,
    setSharedEmail,
    sharedEmails,
    shareMessage,
    isSharing,
    
    // 핸들러들
    handleOpenDateEditDialog,
    handleTempDateChange,
    handleConfirmDateChange,
    handleOpenPlannerFlightDetail,
    handleClosePlannerFlightDetail,
    handleOpenAccommodationDetail,
    handleCloseAccommodationDetail,
    handleOpenShareDialog,
    handleCloseShareDialog,
    handleAddSharedEmail,
    handleRemoveSharedEmail,
    handleSharePlan
  };
};

export default useDialogHandlers; 