import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, IconButton, Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
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
  sharedEmails,
  handleAddSharedEmail,
  handleRemoveSharedEmail,
  shareMessage,
  isSharing,
  handleSharePlan,
  isSharedPlan,
  // 로더에서 받은 실제 공유 이메일 목록
  sharedEmailsFromLoader,
  // 원래 소유자 정보
  originalOwner
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
            {/* 저장된 항공편과 일정 항공편의 데이터 구조가 다를 수 있으므로 안전하게 처리 */}
            {(selectedFlightForPlannerDialog.flightOfferData?.itineraries || selectedFlightForPlannerDialog.itineraries || []).map((itinerary, index) => (
              <React.Fragment key={`planner-detail-itinerary-${index}`}>
                {index > 0 && <Divider sx={{ my:2 }} />}
                {renderItineraryDetails(
                  itinerary, 
                  selectedFlightForPlannerDialog.flightOfferData?.id || selectedFlightForPlannerDialog.id || 'flight-detail', 
                  flightDictionaries, 
                  (selectedFlightForPlannerDialog.flightOfferData?.itineraries || selectedFlightForPlannerDialog.itineraries || []).length > 1 ? (index === 0 ? "가는 여정" : "오는 여정") : "여정 상세 정보", 
                  airportInfoCache, 
                  loadingAirportInfo
                )}
              </React.Fragment>
            ))}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt:2 }}>가격 및 요금 정보</Typography>
            {(() => {
              // 가격 정보 안전하게 추출
              const priceData = selectedFlightForPlannerDialog.flightOfferData?.price || selectedFlightForPlannerDialog.price;
              const lastTicketingDate = selectedFlightForPlannerDialog.flightOfferData?.lastTicketingDate || selectedFlightForPlannerDialog.lastTicketingDate;
              const numberOfBookableSeats = selectedFlightForPlannerDialog.flightOfferData?.numberOfBookableSeats || selectedFlightForPlannerDialog.numberOfBookableSeats;
              const travelerPricings = selectedFlightForPlannerDialog.flightOfferData?.travelerPricings || selectedFlightForPlannerDialog.travelerPricings;
              
              if (!priceData) {
                return <Typography variant="caption" display="block">가격 정보가 없습니다.</Typography>;
              }
              
              return (
                <>
                  <Typography variant="caption" display="block">총액 (1인): {formatPrice(priceData.grandTotal || priceData.total, priceData.currency)}</Typography>
                  {priceData.base && (
                    <Typography variant="caption" display="block">기본 운임: {formatPrice(priceData.base, priceData.currency)}</Typography>
                  )}
                  {priceData.fees && priceData.fees.length > 0 && (
                    <Typography variant="caption" display="block">수수료: 
                      {priceData.fees.map(fee => `${fee.type}: ${formatPrice(fee.amount, priceData.currency)}`).join(', ')}
                    </Typography>
                  )}
                  {priceData.taxes && priceData.taxes.length > 0 && (
                    <Typography variant="caption" display="block">세금: 
                      {priceData.taxes.map(tax => `${tax.code}: ${formatPrice(tax.amount, priceData.currency)}`).join(', ')}
                    </Typography>
                  )}
                  <Typography variant="caption" display="block">
                    마지막 발권일: {lastTicketingDate ? new Date(lastTicketingDate).toLocaleDateString('ko-KR') : '-'}
                    , 예약 가능 좌석: {numberOfBookableSeats || '-'}석
                  </Typography>
                  {travelerPricings && renderFareDetails(travelerPricings, flightDictionaries)}
                </>
              );
            })()}
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
            {/* 호텔 메인 이미지 */}
            {(selectedAccommodationForDialog.hotel?.main_photo_url || selectedAccommodationForDialog.main_photo_url) && (
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Box
                  component="img"
                  src={selectedAccommodationForDialog.hotel?.main_photo_url || selectedAccommodationForDialog.main_photo_url}
                  alt={selectedAccommodationForDialog.hotel?.hotel_name_trans || selectedAccommodationForDialog.hotel?.hotel_name || selectedAccommodationForDialog.hotel_name_trans || selectedAccommodationForDialog.hotel_name || '호텔 이미지'}
                  sx={{ 
                    width: '100%', 
                    maxHeight: 300, 
                    objectFit: 'cover', 
                    borderRadius: 2,
                    boxShadow: 2
                  }}
                />
              </Box>
            )}

            {/* 호텔 기본 정보 */} 
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#5D4037' }}>
              {selectedAccommodationForDialog.hotel?.hotel_name_trans || 
               selectedAccommodationForDialog.hotel?.hotel_name || 
               selectedAccommodationForDialog.hotel_name_trans || 
               selectedAccommodationForDialog.hotel_name || 
               '호텔 이름 정보 없음'}
            </Typography>
            
            <Typography variant="body1" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              📍 {selectedAccommodationForDialog.hotel?.address || 
                   selectedAccommodationForDialog.hotel?.address_trans || 
                   selectedAccommodationForDialog.address || 
                   selectedAccommodationForDialog.address_trans || 
                   '주소 정보 없음'}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              🏙️ {selectedAccommodationForDialog.hotel?.city_trans || 
                   selectedAccommodationForDialog.hotel?.city || 
                   '도시 정보 없음'} 
              ({selectedAccommodationForDialog.hotel?.countrycode || '국가 코드 없음'})
            </Typography>

            {/* 체크인/체크아웃 날짜 정보 */}
            <Box sx={{ my: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>📅 예약 정보</Typography>
              <Typography variant="body2" color="text.secondary">
                체크인: {selectedAccommodationForDialog.checkIn ? 
                  new Date(selectedAccommodationForDialog.checkIn).toLocaleDateString('ko-KR') : 
                  (selectedAccommodationForDialog.hotel?.checkIn ? 
                    new Date(selectedAccommodationForDialog.hotel.checkIn).toLocaleDateString('ko-KR') : '-')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                체크아웃: {selectedAccommodationForDialog.checkOut ? 
                  new Date(selectedAccommodationForDialog.checkOut).toLocaleDateString('ko-KR') : 
                  (selectedAccommodationForDialog.hotel?.checkOut ? 
                    new Date(selectedAccommodationForDialog.hotel.checkOut).toLocaleDateString('ko-KR') : '-')}
              </Typography>
            </Box>

            {/* 호텔 운영 시간 정보 */}
            {(selectedAccommodationForDialog.hotel?.checkin_from || selectedAccommodationForDialog.hotel?.checkout_until) && (
              <Box sx={{ my: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>🕐 운영 시간</Typography>
                {selectedAccommodationForDialog.hotel?.checkin_from && (
                  <Typography variant="body2" color="text.secondary">
                    체크인 시간: {selectedAccommodationForDialog.hotel.checkin_from}
                    {selectedAccommodationForDialog.hotel.checkin_until && selectedAccommodationForDialog.hotel.checkin_until !== "00:00" ? 
                      ` ~ ${selectedAccommodationForDialog.hotel.checkin_until}` : ''}
                  </Typography>
                )}
                {selectedAccommodationForDialog.hotel?.checkout_until && (
                  <Typography variant="body2" color="text.secondary">
                    체크아웃 시간: {selectedAccommodationForDialog.hotel.checkout_from && selectedAccommodationForDialog.hotel.checkout_from !== "00:00" ? 
                      `${selectedAccommodationForDialog.hotel.checkout_from} ~ ` : ''}
                    {selectedAccommodationForDialog.hotel.checkout_until}
                  </Typography>
                )}
              </Box>
            )}

            {/* 호텔 설명 */}
            {selectedAccommodationForDialog.hotel?.hotel_description && (
              <Box sx={{ my: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>📝 호텔 설명</Typography>
                <Typography variant="body2" paragraph sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                  {selectedAccommodationForDialog.hotel.hotel_description}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* 객실 정보 */} 
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
              🛏️ 선택된 객실 정보
            </Typography>
            {(selectedAccommodationForDialog.room || selectedAccommodationForDialog.hotel?.room) ? (
              <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {selectedAccommodationForDialog.room?.name || 
                   selectedAccommodationForDialog.hotel?.room?.name || 
                   '객실 이름 정보 없음'}
                </Typography>
                
                {/* 가격 정보 */}
                {(selectedAccommodationForDialog.room?.price || selectedAccommodationForDialog.hotel?.price || selectedAccommodationForDialog.price) && (
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                    💰 {selectedAccommodationForDialog.room?.price ? 
                         formatPrice(selectedAccommodationForDialog.room.price, selectedAccommodationForDialog.room.currency) :
                         (selectedAccommodationForDialog.hotel?.price || selectedAccommodationForDialog.price)}
                  </Typography>
                )}

                {/* 침대 정보 */}
                {selectedAccommodationForDialog.room?.bed_configurations && selectedAccommodationForDialog.room.bed_configurations.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    🛏️ 침대: {selectedAccommodationForDialog.room.bed_configurations.map(bc => `${bc.count} ${bc.name}(s)`).join(', ')}
                  </Typography>
                )}

                {/* 객실 크기 */}
                {selectedAccommodationForDialog.room?.room_surface_in_m2 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    📐 크기: {selectedAccommodationForDialog.room.room_surface_in_m2} m²
                  </Typography>
                )}

                {/* 객실 설명 */}
                {selectedAccommodationForDialog.room?.description && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>객실 상세 정보</Typography>
                    <Typography variant="body2" paragraph sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                      {selectedAccommodationForDialog.room.description}
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                선택된 객실 정보가 없습니다.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseAccommodationDetail}>닫기</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 공유 다이얼로그 */}
      <Dialog open={isShareDialogOpen} onClose={handleCloseShareDialog} maxWidth="sm" fullWidth>
        <DialogTitle>플랜 공유</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {isSharedPlan ? (
              // 공유받은 플랜인 경우
              <>
                <Box sx={{ 
                  p: 3, 
                  bgcolor: '#e3f2fd', 
                  borderRadius: 2, 
                  border: '1px solid #2196f3',
                  textAlign: 'center',
                  mb: 3
                }}>
                  <Typography variant="h6" sx={{ mb: 2, color: '#1976d2' }}>
                    공유받은 플랜입니다
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    이 플랜의 공유 설정은 원래 소유자만 수정할 수 있습니다.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    공유 설정을 변경하려면 공유자에게 문의하세요.
                  </Typography>
                </Box>

                {/* 현재 공유된 이메일 목록 표시 (읽기 전용) */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    공유 멤버
                  </Typography>
                  
                  {/* 원래 소유자 표시 */}
                  {originalOwner && (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 1, 
                      p: 1, 
                      bgcolor: '#e8f5e8', 
                      borderRadius: 1 
                    }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {originalOwner}
                      </Typography>
                      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold' }}>
                        (공유자)
                      </Typography>
                    </Box>
                  )}
                  
                  {/* 공유받은 사용자들 표시 */}
                  {sharedEmailsFromLoader && sharedEmailsFromLoader.map((email, index) => (
                    <Box key={index} sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 1, 
                      p: 1, 
                      bgcolor: '#f5f5f5', 
                      borderRadius: 1 
                    }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {email}
                      </Typography>
                    </Box>
                  ))}
                </Box>


              </>
            ) : (
              // 본인 소유 플랜인 경우
              <>
                {/* 기존 공유된 이메일 목록 */}
                {sharedEmails && sharedEmails.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                      현재 공유된 이메일
                    </Typography>
                    {sharedEmails.map((email, index) => (
                      <Box key={index} sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        mb: 1, 
                        p: 1, 
                        bgcolor: '#f5f5f5', 
                        borderRadius: 1 
                      }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {email}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={() => handleRemoveSharedEmail(index)}
                          disabled={isSharing}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* 새 이메일 추가 */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    label="새 이메일 주소 추가"
                    type="email"
                    value={sharedEmail}
                    onChange={e => setSharedEmail(e.target.value)}
                    placeholder="example@email.com"
                    disabled={isSharing}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && sharedEmail.trim()) {
                        handleAddSharedEmail();
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddSharedEmail}
                    disabled={isSharing || !sharedEmail.trim()}
                    sx={{ minWidth: 'auto', px: 2 }}
                  >
                    +
                  </Button>
                </Box>

                {shareMessage && (
                  <Typography 
                    variant="body2" 
                    color={shareMessage.includes('성공') ? 'success.main' : 'error.main'}
                    sx={{ mt: 1 }}
                  >
                    {shareMessage}
                  </Typography>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseShareDialog} disabled={isSharing}>
            닫기
          </Button>
          {!isSharedPlan && (
            <Button 
              onClick={handleSharePlan} 
              variant="contained" 
              disabled={isSharing}
            >
              {isSharing ? '저장 중...' : '저장'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TravelPlannerDialogs; 