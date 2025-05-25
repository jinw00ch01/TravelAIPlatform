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
  const handleOpenShareDialog = useCallback(() => {
    setIsShareDialogOpen(true);
    setShareMessage('');
  }, []);

  const handleCloseShareDialog = useCallback(() => {
    setIsShareDialogOpen(false);
    setSharedEmail('');
    setShareMessage('');
  }, []);

  const handleSharePlan = useCallback(async (plannerHandleSharePlan, planId) => {
    if (!sharedEmail.trim()) {
      setShareMessage('공유할 이메일을 입력해주세요.');
      return;
    }

    if (!planId || planId === 'new') {
      setShareMessage('저장된 계획만 공유할 수 있습니다. 먼저 계획을 저장해주세요.');
      return;
    }

    setIsSharing(true);
    setShareMessage('');

    try {
      const result = await plannerHandleSharePlan(sharedEmail.trim());
      
      if (result.success) {
        setShareMessage(result.message);
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
  }, [sharedEmail, handleCloseShareDialog]);

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
    handleSharePlan
  };
};

export default useDialogHandlers; 