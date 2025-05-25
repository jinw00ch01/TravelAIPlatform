import React from 'react';
import {
  Box, Typography, Paper, Grid, List, IconButton, Tooltip
} from '@mui/material';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { format as formatDateFns } from 'date-fns';
import { formatPrice } from '../../../utils/flightFormatters';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';

const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props}>{children}</Droppable>;
};

const ScheduleList = ({
  accommodationsToShow,
  findSameDayAccommodations,
  handleOpenAccommodationDetail,
  startDate,
  selectedDay,
  currentPlan,
  handleScheduleDragEnd,
  renderScheduleItem,
  handleOpenPlannerFlightDetail,
  handleDeleteAccommodation,
  handleDeleteFlight
}) => {


  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, p: 2, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6">일정 목록</Typography>
        <Tooltip title="숙박편(주황색)과 항공편(파란색)은 고정 일정이며, 일반 일정은 드래그하여 순서를 변경할 수 있습니다.">
          <InfoIcon fontSize="small" color="action" />
        </Tooltip>
      </Box>
      
      {/* 고정된 숙박 정보 박스들 */}
      {accommodationsToShow && accommodationsToShow.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#5D4037', fontWeight: 'bold' }}>
            📍 숙박편 ({accommodationsToShow.length}개)
          </Typography>
          {accommodationsToShow.map((accommodation, index) => (
        <Paper 
          key={accommodation.id || `accommodation-${index}`}
          elevation={1}
          sx={{ 
            p: 1.5, 
            mb: 1, 
            bgcolor: '#fff0e6', 
            border: 1, borderColor: 'divider', borderRadius: 1,      
            cursor: 'pointer',
            '&:hover': { boxShadow: 3, borderColor: 'primary.main' },
            position: 'relative'
          }}
          onClick={() => {
            const accommodationData = {
              ...accommodation,
              sameDayAccommodations: null
            };
            handleOpenAccommodationDetail(accommodationData);
          }}
        >
          {/* 삭제 버튼 */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              if (handleDeleteAccommodation && window.confirm('이 숙박편을 삭제하시겠습니까?')) {
                handleDeleteAccommodation(accommodation);
              }
            }}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' },
              zIndex: 1
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Grid container spacing={1} alignItems="center">
            {(accommodation.hotel?.main_photo_url || accommodation.main_photo_url) && (
              <Grid item xs={12} sm={3}>
                <Box
                  component="img"
                  src={accommodation.hotel?.main_photo_url || accommodation.main_photo_url}
                  alt={accommodation.hotel?.hotel_name_trans || accommodation.hotel?.hotel_name || accommodation.hotel_name_trans || accommodation.hotel_name || '숙소 이미지'}
                  sx={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 1 }}
                />
              </Grid>
            )}
            <Grid item xs sm={(accommodation.hotel?.main_photo_url || accommodation.main_photo_url) ? 9 : 12}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#5D4037', fontSize: '0.9rem' }}>
                {accommodation.hotel?.hotel_name_trans || accommodation.hotel?.hotel_name || accommodation.hotel_name_trans || accommodation.hotel_name || '숙소 정보'}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{fontSize: '0.8rem'}}>
                {accommodation.hotel?.address || accommodation.hotel?.address_trans || accommodation.address || accommodation.address_trans || '주소 정보 없음'}
              </Typography>
              {(accommodation.hotel?.checkIn || accommodation.checkIn || accommodation.hotel?.checkOut || accommodation.checkOut) && (
                  <Typography component="div" variant="body2" color="text.secondary" sx={{mt: 0.5, fontSize: '0.8rem'}}>
                                         {(() => {
                       // 날짜 파싱 함수 (로컬 시간대 기준)
                       const parseDate = (dateInput) => {
                         if (!dateInput) return null;
                         if (dateInput instanceof Date) return dateInput;
                         
                         // YYYY-MM-DD 형식의 문자열인 경우 로컬 시간대로 파싱
                         if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                           const [year, month, day] = dateInput.split('-').map(Number);
                           return new Date(year, month - 1, day); // 월은 0부터 시작
                         }
                         
                         return new Date(dateInput);
                       };

                       const checkInStr = accommodation.hotel?.checkIn || accommodation.checkIn;
                       const checkOutStr = accommodation.hotel?.checkOut || accommodation.checkOut;
                       const checkInDate = parseDate(checkInStr);
                       const checkOutDate = parseDate(checkOutStr);
                       
                       console.log('[ScheduleList] 숙박편 날짜 표시:', {
                         accommodation_id: accommodation.id,
                         hotel_name: accommodation.hotel?.hotel_name || accommodation.hotel_name,
                         checkInStr,
                         checkOutStr,
                         checkInDate,
                         checkOutDate,
                         checkInFormatted: checkInDate ? formatDateFns(checkInDate, 'MM/dd') : '-',
                         checkOutFormatted: checkOutDate ? formatDateFns(checkOutDate, 'MM/dd') : '-'
                       });
                       
                       return (
                         <>
                           체크인: {checkInDate ? formatDateFns(checkInDate, 'MM/dd') : '-'}
                           {' ~ '}
                           체크아웃: {checkOutDate ? formatDateFns(checkOutDate, 'MM/dd') : '-'}
                         </>
                       );
                     })()}
                  </Typography>
              )}
              {(accommodation.hotel?.room?.name || accommodation.room?.name) && (
                  <Typography component="div" variant="body2" color="text.secondary" sx={{mt: 0.5, fontSize: '0.8rem'}}>
                  객실: {accommodation.hotel?.room?.name || accommodation.room?.name}
                  </Typography>
              )}
              {(accommodation.hotel?.price || accommodation.price) && (
                  <Typography variant="subtitle2" color="primary" sx={{ mt: 0.5, fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {accommodation.hotel?.price || accommodation.price}
                  </Typography>
              )}
            </Grid>
          </Grid>
        </Paper>
      ))}
        </Box>
      )}

      {/* 고정된 항공편 정보 박스 */}
      {currentPlan.schedules
        .filter(schedule => schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return' || schedule.type === 'Flight_OneWay')
        .length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#0277bd', fontWeight: 'bold' }}>
            ✈️ 항공편 ({currentPlan.schedules.filter(schedule => schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return' || schedule.type === 'Flight_OneWay').length}개)
          </Typography>
          {currentPlan.schedules
            .filter(schedule => schedule.type === 'Flight_Departure' || schedule.type === 'Flight_Return' || schedule.type === 'Flight_OneWay')
            .map((flightSchedule, index) => (
          <Paper
            key={`fixed-flight-${flightSchedule.id || index}`}
            elevation={1}
            sx={{
              p: 1.5,
              mb: 1,
              bgcolor: '#e3f2fd', // 항공편 배경색
              border: 1, borderColor: 'divider', borderRadius: 1,
              cursor: 'pointer',
              '&:hover': { boxShadow: 3, borderColor: 'primary.main' },
              position: 'relative'
            }}
            onClick={() => flightSchedule.flightOfferDetails && handleOpenPlannerFlightDetail(flightSchedule)} // flightSchedule 객체를 그대로 전달
          >
            {/* 삭제 버튼 */}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (handleDeleteFlight && window.confirm('이 항공편을 삭제하시겠습니까?')) {
                  handleDeleteFlight(flightSchedule);
                }
              }}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' },
                zIndex: 1
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0277bd' }}>
                  {flightSchedule.time} {flightSchedule.name}
                  {flightSchedule.type === 'Flight_OneWay' && (
                    <span style={{ fontSize: '0.8rem', marginLeft: '8px', color: '#ff9800' }}>(편도)</span>
                  )}
                </Typography>
                <Typography variant="body2" color="info.main" sx={{fontSize: '0.8rem'}}>
                  {flightSchedule.address} {/* 출발지 -> 도착지 공항 코드 등 */}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{fontSize: '0.8rem'}}>
                  {flightSchedule.category} {/* 항공사 및 편명 */}
                  {flightSchedule.flightOfferDetails?.flightOfferData?.price && 
                    ` • ${formatPrice(flightSchedule.flightOfferDetails.flightOfferData.price.grandTotal || 
                    flightSchedule.flightOfferDetails.flightOfferData.price.total, 
                    flightSchedule.flightOfferDetails.flightOfferData.price.currency)}`}
                </Typography>
                {flightSchedule.notes && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5, whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                    {flightSchedule.notes}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Paper>
        ))}
        </Box>
      )}

      {/* 일반 일정 섹션 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.primary', fontWeight: 'bold' }}>
          📋 일반 일정 (드래그하여 순서 변경 가능)
        </Typography>
        <DragDropContext onDragEnd={handleScheduleDragEnd}>
          <StrictModeDroppable droppableId="schedules-main">
            {(providedList) => (
              <List 
                ref={providedList.innerRef} 
                {...providedList.droppableProps} 
                sx={{ 
                  minHeight: '100px', // 드롭 영역 확보
                  bgcolor: providedList.isDraggingOver ? 'action.hover' : 'transparent', 
                  transition: 'background-color 0.2s ease', 
                }}
              >
              {currentPlan.schedules
                .filter(schedule => 
                  schedule.type !== 'Flight_Departure' && 
                  schedule.type !== 'Flight_Return' && 
                  schedule.type !== 'Flight_OneWay' && // 편도 항공편 제외
                  schedule.type !== 'accommodation'  // 숙소 일정 제외
                )
                .map((schedule, index) => renderScheduleItem(schedule, index))}
              {providedList.placeholder}
            </List>
          )}
        </StrictModeDroppable>
      </DragDropContext>
      </Box>
    </Box>
  );
};

export default ScheduleList; 