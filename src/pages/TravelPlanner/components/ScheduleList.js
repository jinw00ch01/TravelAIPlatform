import React from 'react';
import {
  Box, Typography, Paper, Grid, List
} from '@mui/material';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { format as formatDateFns } from 'date-fns';
import { formatPrice } from '../../../utils/flightFormatters';

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
  accommodationToShow,
  findSameDayAccommodations,
  handleOpenAccommodationDetail,
  startDate,
  selectedDay,
  currentPlan,
  handleScheduleDragEnd,
  renderScheduleItem,
  handleOpenPlannerFlightDetail
}) => {
  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, p: 2, overflow: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>일정 목록</Typography>
      
      {/* 고정된 숙박 정보 박스 */}
      {accommodationToShow && accommodationToShow.hotelDetails && (
        <Paper 
          elevation={1}
          sx={{ 
            p: 1.5, 
            mb: 1, 
            bgcolor: '#fff0e6', 
            border: 1, borderColor: 'divider', borderRadius: 1,      
            cursor: 'pointer',
            '&:hover': { boxShadow: 3, borderColor: 'primary.main' }
          }}
          onClick={() => {
            // 현재 날짜 계산
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + selectedDay - 1);
            
            // 같은 날의 다른 숙박편들 찾기
            const sameDayAccommodations = findSameDayAccommodations(currentDate);
            
            // 다중 숙박편 정보가 있으면 함께 전달
            const accommodationData = {
              ...accommodationToShow.hotelDetails,
              sameDayAccommodations: sameDayAccommodations.length > 1 ? sameDayAccommodations : null
            };
            
            handleOpenAccommodationDetail(accommodationData);
          }}
        >
          <Grid container spacing={1} alignItems="center">
            {(accommodationToShow.hotelDetails.hotel?.main_photo_url || accommodationToShow.hotelDetails.main_photo_url) && (
              <Grid item xs={12} sm={3}>
                <Box
                  component="img"
                  src={accommodationToShow.hotelDetails.hotel?.main_photo_url || accommodationToShow.hotelDetails.main_photo_url}
                  alt={accommodationToShow.hotelDetails.hotel?.hotel_name_trans || accommodationToShow.hotelDetails.hotel?.hotel_name || accommodationToShow.hotelDetails.hotel_name_trans || accommodationToShow.hotelDetails.hotel_name || '숙소 이미지'}
                  sx={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 1 }}
                />
              </Grid>
            )}
            <Grid item xs sm={(accommodationToShow.hotelDetails.hotel?.main_photo_url || accommodationToShow.hotelDetails.main_photo_url) ? 9 : 12}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#5D4037', fontSize: '0.9rem' }}>
                {accommodationToShow.hotelDetails.hotel?.hotel_name_trans || accommodationToShow.hotelDetails.hotel?.hotel_name || accommodationToShow.hotelDetails.hotel_name_trans || accommodationToShow.hotelDetails.hotel_name || '숙소 정보'}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{fontSize: '0.8rem'}}>
                {accommodationToShow.hotelDetails.hotel?.address || accommodationToShow.hotelDetails.hotel?.address_trans || accommodationToShow.hotelDetails.address || accommodationToShow.hotelDetails.address_trans || '주소 정보 없음'}
              </Typography>
              {(accommodationToShow.hotelDetails.hotel?.checkIn || accommodationToShow.hotelDetails.checkIn || accommodationToShow.hotelDetails.hotel?.checkOut || accommodationToShow.hotelDetails.checkOut) && (
                  <Typography component="div" variant="body2" color="text.secondary" sx={{mt: 0.5, fontSize: '0.8rem'}}>
                    체크인: {accommodationToShow.hotelDetails.hotel?.checkIn || accommodationToShow.hotelDetails.checkIn ? formatDateFns(new Date(accommodationToShow.hotelDetails.hotel?.checkIn || accommodationToShow.hotelDetails.checkIn), 'MM/dd') : '-'}
                    {' ~ '}
                    체크아웃: {accommodationToShow.hotelDetails.hotel?.checkOut || accommodationToShow.hotelDetails.checkOut ? formatDateFns(new Date(accommodationToShow.hotelDetails.hotel?.checkOut || accommodationToShow.hotelDetails.checkOut), 'MM/dd') : '-'}
                  </Typography>
              )}
              {(accommodationToShow.hotelDetails.hotel?.room?.name || accommodationToShow.hotelDetails.room?.name) && (
                  <Typography component="div" variant="body2" color="text.secondary" sx={{mt: 0.5, fontSize: '0.8rem'}}>
                  객실: {accommodationToShow.hotelDetails.hotel?.room?.name || accommodationToShow.hotelDetails.room?.name}
                  </Typography>
              )}
              {(accommodationToShow.hotelDetails.hotel?.price || accommodationToShow.hotelDetails.price) && (
                  <Typography variant="subtitle2" color="primary" sx={{ mt: 0.5, fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {accommodationToShow.hotelDetails.hotel?.price || accommodationToShow.hotelDetails.price}
                  </Typography>
              )}
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* 고정된 항공편 정보 박스 */}
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
              '&:hover': { boxShadow: 3, borderColor: 'primary.main' }
            }}
            onClick={() => flightSchedule.flightOfferDetails && handleOpenPlannerFlightDetail(flightSchedule)} // flightSchedule 객체를 그대로 전달
          >
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
        ))
      }

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
  );
};

export default ScheduleList; 