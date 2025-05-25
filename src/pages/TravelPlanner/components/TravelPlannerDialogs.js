import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, IconButton, Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import SearchPopup from '../../../components/SearchPopup';
import {
  formatPrice,
  renderFareDetails,
  renderItineraryDetails
} from '../../../utils/flightFormatters';

const TravelPlannerDialogs = ({
  // 검색 다이얼로그
  isSearchOpen,
  setIsSearchOpen,
  onAddPlace,
  // 일정 수정 다이얼로그
  editDialogOpen,
  setEditDialogOpen,
  editSchedule,
  setEditSchedule,
  handleUpdateSchedule,
  // 날짜 수정 다이얼로그
  isDateEditDialogOpen,
  setIsDateEditDialogOpen,
  tempStartDate,
  handleTempDateChange,
  handleConfirmDateChange,
  // 저장 다이얼로그
  isSaveDialogOpen,
  closeSaveDialog,
  planTitleForSave,
  setPlanTitleForSave,
  isSaving,
  plannerHandleSaveConfirm,
  // 항공편 상세 다이얼로그
  isPlannerFlightDetailOpen,
  handleClosePlannerFlightDetail,
  selectedFlightForPlannerDialog,
  flightDictionaries,
  airportInfoCache,
  loadingAirportInfo,
  // 숙박 상세 다이얼로그
  isAccommodationDetailOpen,
  handleCloseAccommodationDetail,
  selectedAccommodationForDialog,
  // 공유 다이얼로그
  isShareDialogOpen,
  handleCloseShareDialog,
  sharedEmail,
  setSharedEmail,
  shareMessage,
  isSharing,
  handleSharePlan
}) => {
  return (
    <>
      {/* 장소 검색 다이얼로그 */}
      <Dialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>장소 검색</DialogTitle>
        <DialogContent><SearchPopup onSelect={onAddPlace} onClose={() => setIsSearchOpen(false)} /></DialogContent>
      </Dialog>

      {/* 일정 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>일정 수정</DialogTitle>
        <DialogContent>
          {editSchedule && ( <Box sx={{ pt: 2 }}>
            <TextField fullWidth label="이름" value={editSchedule.name} onChange={e => setEditSchedule({ ...editSchedule, name: e.target.value })} sx={{ mb: 2 }} />
            <TextField fullWidth label="주소" value={editSchedule.address} onChange={e => setEditSchedule({ ...editSchedule, address: e.target.value })} sx={{ mb: 2 }} />
            <TextField fullWidth label="카테고리" value={editSchedule.category} onChange={e => setEditSchedule({ ...editSchedule, category: e.target.value })} sx={{ mb: 2 }} />
            <TextField fullWidth label="시간" value={editSchedule.time} onChange={e => setEditSchedule({ ...editSchedule, time: e.target.value })} sx={{ mb: 2 }} />
            <TextField fullWidth label="소요 시간" value={editSchedule.duration} onChange={e => setEditSchedule({ ...editSchedule, duration: e.target.value })} sx={{ mb: 2 }} />
            <TextField fullWidth multiline rows={4} label="메모" value={editSchedule.notes} onChange={e => setEditSchedule({ ...editSchedule, notes: e.target.value })} />
          </Box> )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
          <Button onClick={handleUpdateSchedule} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>

      {/* 날짜 수정 다이얼로그 */}
      <Dialog open={isDateEditDialogOpen} onClose={() => setIsDateEditDialogOpen(false)}>
        <DialogTitle>여행 시작일 수정</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <DatePicker
              label="시작일"
              value={tempStartDate}
              onChange={handleTempDateChange}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDateEditDialogOpen(false)}>취소</Button>
          <Button onClick={handleConfirmDateChange} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      {/* 저장 다이얼로그 */}
      <Dialog open={isSaveDialogOpen} onClose={closeSaveDialog}>
        <DialogTitle>여행 계획 저장</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              autoFocus
              fullWidth
              label="여행 계획 제목"
              value={planTitleForSave}
              onChange={e => setPlanTitleForSave(e.target.value)}
              placeholder="예: 3박 4일 도쿄 여행"
              sx={{ mb: 2 }}
              disabled={isSaving}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSaveDialog} disabled={isSaving}>취소</Button>
          <Button
            onClick={async () => {
              const success = await plannerHandleSaveConfirm(planTitleForSave);
            }}
            variant="contained"
            disabled={isSaving || !planTitleForSave?.trim()}
          >
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 항공편 상세 다이얼로그 */}
      {selectedFlightForPlannerDialog && (
        <Dialog 
          open={isPlannerFlightDetailOpen} 
          onClose={handleClosePlannerFlightDetail} 
          fullWidth 
          maxWidth="md"
          scroll="paper"
        >
          <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            항공편 상세 정보 (여행 계획)
            <IconButton aria-label="close" onClick={handleClosePlannerFlightDetail} sx={{ position: 'absolute', right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {selectedFlightForPlannerDialog.flightOfferData.itineraries.map((itinerary, index) => (
              <React.Fragment key={`planner-detail-itinerary-${index}`}>
                {index > 0 && <Divider sx={{ my:2 }} />}
                {renderItineraryDetails(
                  itinerary, 
                  selectedFlightForPlannerDialog.flightOfferData.id, 
                  flightDictionaries, 
                  selectedFlightForPlannerDialog.flightOfferData.itineraries.length > 1 ? (index === 0 ? "가는 여정" : "오는 여정") : "여정 상세 정보", 
                  airportInfoCache, 
                  loadingAirportInfo
                )}
              </React.Fragment>
            ))}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt:2 }}>가격 및 요금 정보</Typography>
            <Typography variant="caption" display="block">총액 (1인): {formatPrice(selectedFlightForPlannerDialog.flightOfferData.price.grandTotal || selectedFlightForPlannerDialog.flightOfferData.price.total, selectedFlightForPlannerDialog.flightOfferData.price.currency)}</Typography>
            <Typography variant="caption" display="block">기본 운임: {formatPrice(selectedFlightForPlannerDialog.flightOfferData.price.base, selectedFlightForPlannerDialog.flightOfferData.price.currency)}</Typography>
            {selectedFlightForPlannerDialog.flightOfferData.price.fees && selectedFlightForPlannerDialog.flightOfferData.price.fees.length > 0 && (
              <Typography variant="caption" display="block">수수료: 
                {selectedFlightForPlannerDialog.flightOfferData.price.fees.map(fee => `${fee.type}: ${formatPrice(fee.amount, selectedFlightForPlannerDialog.flightOfferData.price.currency)}`).join(', ')}
              </Typography>
            )}
            {selectedFlightForPlannerDialog.flightOfferData.price.taxes && selectedFlightForPlannerDialog.flightOfferData.price.taxes.length > 0 && (
              <Typography variant="caption" display="block">세금: 
                {selectedFlightForPlannerDialog.flightOfferData.price.taxes.map(tax => `${tax.code}: ${formatPrice(tax.amount, selectedFlightForPlannerDialog.flightOfferData.price.currency)}`).join(', ')}
              </Typography>
            )}
            <Typography variant="caption" display="block">
              마지막 발권일: {selectedFlightForPlannerDialog.flightOfferData.lastTicketingDate ? new Date(selectedFlightForPlannerDialog.flightOfferData.lastTicketingDate).toLocaleDateString('ko-KR') : '-'}
              , 예약 가능 좌석: {selectedFlightForPlannerDialog.flightOfferData.numberOfBookableSeats || '-'}석
            </Typography>
            {renderFareDetails(selectedFlightForPlannerDialog.flightOfferData.travelerPricings, flightDictionaries)}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePlannerFlightDetail}>닫기</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 숙박 상세 다이얼로그 */}
      {selectedAccommodationForDialog && (
        <Dialog 
          open={isAccommodationDetailOpen} 
          onClose={handleCloseAccommodationDetail} 
          fullWidth 
          maxWidth="md"
          scroll="paper"
        >
          <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            숙소 상세 정보
            <IconButton aria-label="close" onClick={handleCloseAccommodationDetail} sx={{ position: 'absolute', right: 8, top: 8 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {/* 같은 날 다중 숙박편이 있는 경우 표시 */}
            {selectedAccommodationForDialog.sameDayAccommodations && (
              <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom sx={{ color: '#1976d2' }}>
                  같은 날 숙박편 ({selectedAccommodationForDialog.sameDayAccommodations.length}개)
                </Typography>
                {selectedAccommodationForDialog.sameDayAccommodations.map((accommodation, index) => {
                  const hotel = accommodation.hotel || {};
                  const room = accommodation.room || {};
                  
                  return (
                    <Box key={index} sx={{ mb: 2, p: 1.5, bgcolor: 'white', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {accommodation.isCheckOut && accommodation.isCheckIn ? '체크아웃 → 체크인' : 
                         accommodation.isCheckOut ? '체크아웃' : '체크인'}: {hotel.hotel_name_trans || hotel.hotel_name || '호텔'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        객실: {room.name || '정보 없음'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        주소: {hotel.address || hotel.address_trans || '주소 정보 없음'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        체크인: {accommodation.checkIn ? new Date(accommodation.checkIn).toLocaleDateString('ko-KR') : '-'} | 
                        체크아웃: {accommodation.checkOut ? new Date(accommodation.checkOut).toLocaleDateString('ko-KR') : '-'}
                      </Typography>
                      {room.price && (
                        <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold', mt: 1 }}>
                          가격: {room.price.toLocaleString()} {room.currency || 'KRW'}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
                <Divider sx={{ my: 2 }} />
              </Box>
            )}

            {/* 메인 호텔 정보 */} 
            <Typography variant="h6" gutterBottom>
              {selectedAccommodationForDialog.hotel?.hotel_name_trans || selectedAccommodationForDialog.hotel?.hotel_name || '호텔 이름 정보 없음'}
            </Typography>
            <Typography variant="body1" gutterBottom>
              주소: {selectedAccommodationForDialog.hotel?.address || selectedAccommodationForDialog.hotel?.address_trans || '주소 정보 없음'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              도시: {selectedAccommodationForDialog.hotel?.city_trans || selectedAccommodationForDialog.hotel?.city || '도시 정보 없음'}
               ({selectedAccommodationForDialog.hotel?.countrycode || '국가 코드 없음'})
            </Typography>
            {selectedAccommodationForDialog.hotel?.checkin_from && (
              <Typography variant="body2" color="text.secondary">
                체크인 시간: {selectedAccommodationForDialog.hotel.checkin_from}
                {selectedAccommodationForDialog.hotel.checkin_until && selectedAccommodationForDialog.hotel.checkin_until !== "00:00" ? ` ~ ${selectedAccommodationForDialog.hotel.checkin_until}` : ''}
              </Typography>
            )}
            {selectedAccommodationForDialog.hotel?.checkout_until && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                체크아웃 시간: {selectedAccommodationForDialog.hotel.checkout_from && selectedAccommodationForDialog.hotel.checkout_from !== "00:00" ? `${selectedAccommodationForDialog.hotel.checkout_from} ~ ` : ''}
                {selectedAccommodationForDialog.hotel.checkout_until}
              </Typography>
            )}
            {selectedAccommodationForDialog.hotel?.hotel_description && (
              <Box sx={{my: 2}}>
                <Typography variant="subtitle2" sx={{fontWeight: 'bold'}}>호텔 설명</Typography>
                <Typography variant="body2" paragraph sx={{whiteSpace: 'pre-line'}}>
                  {selectedAccommodationForDialog.hotel.hotel_description}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* 객실 정보 */} 
            <Typography variant="h6" gutterBottom>선택된 객실 정보</Typography>
            {selectedAccommodationForDialog.room ? (
              <Box>
                <Typography variant="subtitle1">{selectedAccommodationForDialog.room.name || '객실 이름 정보 없음'}</Typography>
                {selectedAccommodationForDialog.room.price && selectedAccommodationForDialog.room.currency && (
                   <Typography variant="body1" sx={{fontWeight: 'bold', color: 'primary.main'}}>
                     가격: {formatPrice(selectedAccommodationForDialog.room.price, selectedAccommodationForDialog.room.currency)}
                   </Typography>
                )}
                {selectedAccommodationForDialog.room.bed_configurations && selectedAccommodationForDialog.room.bed_configurations.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    침대: {selectedAccommodationForDialog.room.bed_configurations.map(bc => `${bc.count} ${bc.name}(s)`).join(', ')}
                  </Typography>
                )}
                {selectedAccommodationForDialog.room.room_surface_in_m2 && (
                   <Typography variant="body2" color="text.secondary">크기: {selectedAccommodationForDialog.room.room_surface_in_m2} m²</Typography>
                )}
                {selectedAccommodationForDialog.room.description && (
                  <Typography variant="body2" paragraph sx={{whiteSpace: 'pre-line', mt:1}}>
                    {selectedAccommodationForDialog.room.description}
                  </Typography>
                )}
              </Box>
            ) : (
              <Typography>선택된 객실 정보가 없습니다.</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAccommodationDetail}>닫기</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 공유 다이얼로그 */}
      <Dialog open={isShareDialogOpen} onClose={handleCloseShareDialog}>
        <DialogTitle>플랜 공유</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              autoFocus
              fullWidth
              label="공유할 이메일 주소"
              type="email"
              value={sharedEmail}
              onChange={e => setSharedEmail(e.target.value)}
              placeholder="example@email.com"
              sx={{ mb: 2 }}
              disabled={isSharing}
            />
            {shareMessage && (
              <Typography 
                variant="body2" 
                color={shareMessage.includes('성공') ? 'success.main' : 'error.main'}
                sx={{ mt: 1 }}
              >
                {shareMessage}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseShareDialog} disabled={isSharing}>
            취소
          </Button>
          <Button 
            onClick={handleSharePlan} 
            variant="contained" 
            disabled={isSharing || !sharedEmail.trim()}
          >
            {isSharing ? '공유 중...' : '공유하기'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TravelPlannerDialogs; 