import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { Box, Button, Typography, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, TextField, Tabs, Tab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SearchPopup from '../components/SearchPopup';
import MapboxComponent from '../components/MapboxComponent';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import AccommodationPlan from '../components/AccommodationPlan';
import FlightPlan from '../components/FlightPlan';

const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
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

const TravelPlanner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [travelPlans, setTravelPlans] = useState({
    1: {
      title: '1일차',
      schedules: []
    }
  });
  const [selectedDay, setSelectedDay] = useState(1);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editSchedule, setEditSchedule] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [dayOrder, setDayOrder] = useState(['1']);
  const [sidebarTab, setSidebarTab] = useState('schedule');
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // 지도 리사이즈 핸들러 추가
  useEffect(() => {
    const map = document.querySelector('.mapboxgl-map');
    if (map) {
      map.style.transition = 'width 0.3s ease';
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    }
  }, [isSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const getDayTitle = (dayNumber) => {
    return `${dayNumber}일차`;
  };

  const addDay = () => {
    const newDayNumber = (dayOrder.length + 1).toString();
    
    setTravelPlans(prev => ({
      ...prev,
      [newDayNumber]: {
        title: `${newDayNumber}일차`,
        schedules: []
      }
    }));
    
    setDayOrder(prev => [...prev, newDayNumber]);
  };

  const handleDayDragEnd = (result) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    const oldDayOrder = Array.from(dayOrder);
    const [movedDay] = oldDayOrder.splice(sourceIndex, 1);
    oldDayOrder.splice(destIndex, 0, movedDay);

    // 새로운 순서대로 일차 번호 재할당
    const newTravelPlans = {};
    const newDayOrder = [];
    
    oldDayOrder.forEach((_, index) => {
      const newDayNumber = (index + 1).toString();
      const oldDay = oldDayOrder[index];
      
      // 새로운 일차 정보 생성
      newTravelPlans[newDayNumber] = {
        ...travelPlans[oldDay],
        title: `${newDayNumber}일차`
      };
      
      newDayOrder.push(newDayNumber);
    });

    // 선택된 일차도 새로운 번호로 업데이트
    if (selectedDay) {
      const oldSelectedDayIndex = oldDayOrder.indexOf(selectedDay.toString());
      if (oldSelectedDayIndex !== -1) {
        setSelectedDay(oldSelectedDayIndex + 1);
      }
    }

    setTravelPlans(newTravelPlans);
    setDayOrder(newDayOrder);
  };

  const removeDay = (dayToRemove) => {
    if (Object.keys(travelPlans).length <= 1) {
      alert('최소 하나의 날짜는 유지해야 합니다.');
      return;
    }

    const dayToRemoveStr = dayToRemove.toString();
    const oldDayOrder = dayOrder.filter(day => day !== dayToRemoveStr);
    
    // 일차 삭제 후 번호 재할당
    const newTravelPlans = {};
    const newDayOrder = [];
    
    oldDayOrder.forEach((_, index) => {
      const newDayNumber = (index + 1).toString();
      const oldDay = oldDayOrder[index];
      
      newTravelPlans[newDayNumber] = {
        ...travelPlans[oldDay],
        title: `${newDayNumber}일차`
      };
      
      newDayOrder.push(newDayNumber);
    });

    // 선택된 날짜 조정
    if (selectedDay === dayToRemove) {
      setSelectedDay(1); // 첫 번째 일차 선택
    } else if (selectedDay > dayToRemove) {
      setSelectedDay(selectedDay - 1); // 하루 앞당김
    }

    setTravelPlans(newTravelPlans);
    setDayOrder(newDayOrder);
  };

  const handleAddPlace = (place) => {
    if (!selectedDay) {
      alert('날짜를 선택해주세요.');
      return;
    }

    const newSchedule = {
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      category: place.category,
      time: '09:00',
      duration: '2시간',
      notes: ''
    };

    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: [...(prev[selectedDay]?.schedules || []), newSchedule]
      }
    }));
  };

  const handleEditSchedule = (schedule) => {
    setEditSchedule(schedule);
    setEditDialogOpen(true);
  };

  const handleUpdateSchedule = () => {
    if (!editSchedule) return;

    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: prev[selectedDay].schedules.map(schedule =>
          schedule.id === editSchedule.id ? editSchedule : schedule
        )
      }
    }));

    setEditDialogOpen(false);
    setEditSchedule(null);
  };

  const handleDeleteSchedule = (scheduleIndex) => {
    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: prev[selectedDay].schedules.filter((_, index) => index !== scheduleIndex)
      }
    }));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const daySchedules = [...travelPlans[selectedDay].schedules];
    const [reorderedItem] = daySchedules.splice(source.index, 1);
    daySchedules.splice(destination.index, 0, reorderedItem);

    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: daySchedules
      }
    }));
  };

  if (!user) return null;

  const currentPlan = travelPlans[selectedDay] || { title: '', schedules: [] };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* 사이드바 */}
      <Box
        sx={{
          width: isSidebarOpen ? '300px' : '0',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          bgcolor: 'background.paper',
          boxShadow: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ 
          width: '300px',
          visibility: isSidebarOpen ? 'visible' : 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* 사이드바 헤더 */}
          <Box sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="h6" noWrap>여행 플래너</Typography>
            <IconButton onClick={toggleSidebar}>
              <span className="text-2xl">☰</span>
            </IconButton>
          </Box>

          {/* 사이드바 탭 */}
          <Tabs
            value={sidebarTab}
            onChange={(e, newValue) => setSidebarTab(newValue)}
            variant="fullWidth"
            className="border-b border-gray-200"
          >
            <Tab label="여행 계획" value="schedule" />
            <Tab label="숙소 계획" value="accommodation" />
            <Tab label="비행 계획" value="flight" />
          </Tabs>

          {/* 사이드바 컨텐츠 */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'schedule' && (
              <>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addDay}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  날짜 추가
                </Button>
                <DragDropContext onDragEnd={handleDayDragEnd}>
                  <StrictModeDroppable droppableId="days">
                    {(provided) => (
                      <Box
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          p: 2
                        }}
                      >
                        {dayOrder.map((day, index) => (
                          <Draggable key={`day-${day}`} draggableId={`day-${day}`} index={index}>
                            {(provided, snapshot) => (
                              <Paper
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                elevation={snapshot.isDragging ? 6 : 1}
                                sx={{
                                  p: 1.5,
                                  cursor: 'pointer',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  transform: snapshot.isDragging ? 'scale(1.02)' : 'scale(1)',
                                  bgcolor: selectedDay === parseInt(day) ? 'primary.light' : 'background.paper',
                                  border: selectedDay === parseInt(day) ? 2 : 1,
                                  borderColor: selectedDay === parseInt(day) ? 'primary.main' : 'divider',
                                  '&:hover': {
                                    bgcolor: selectedDay === parseInt(day) 
                                      ? 'primary.light' 
                                      : 'action.hover',
                                    transform: snapshot.isDragging ? 'scale(1.02)' : 'scale(1.01)',
                                    boxShadow: (theme) => 
                                      snapshot.isDragging 
                                        ? theme.shadows[6]
                                        : theme.shadows[2]
                                  },
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  position: 'relative',
                                  '&::after': snapshot.isDragging ? {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    borderRadius: 1,
                                    animation: 'pulse 1.5s infinite',
                                    border: (theme) => `2px solid ${theme.palette.primary.main}`,
                                    opacity: 0.5
                                  } : {}
                                }}
                                onClick={() => setSelectedDay(parseInt(day))}
                              >
                                <Box 
                                  sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    gap: 1
                                  }}
                                >
                                  <DragIndicatorIcon 
                                    sx={{ 
                                      color: 'action.active',
                                      transition: 'transform 0.2s ease',
                                      transform: snapshot.isDragging ? 'rotate(-5deg)' : 'none'
                                    }} 
                                  />
                                  <Typography 
                                    variant="subtitle1"
                                    sx={{
                                      fontWeight: selectedDay === parseInt(day) ? 600 : 400,
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    {`${day}일차`}
                                  </Typography>
                                </Box>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeDay(parseInt(day));
                                  }}
                                  sx={{
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                      color: 'error.main',
                                      transform: 'scale(1.1)'
                                    }
                                  }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Paper>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Box>
                    )}
                  </StrictModeDroppable>
                </DragDropContext>
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant={showAllMarkers ? "contained" : "outlined"}
                    color="primary"
                    fullWidth
                    onClick={() => setShowAllMarkers(!showAllMarkers)}
                  >
                    {showAllMarkers ? "현재 날짜 마커만 보기" : "전체 날짜 마커 보기"}
                  </Button>
                </Box>
              </>
            )}

            {sidebarTab === 'accommodation' && (
              <AccommodationPlan isSearchTab={true} />
            )}

            {sidebarTab === 'flight' && (
              <FlightPlan isSearchTab={true} />
            )}

            {/* 지도 토글 버튼은 일정 계획과 숙소 계획 탭에서만 표시 */}
            <Box sx={{ mt: 2, display: 'flex', gap: 2, px: 2 }}>
              {sidebarTab !== 'flight' && (
                <Button
                  variant="outlined"
                  onClick={() => setShowMap(!showMap)}
                >
                  {showMap ? "지도 숨기기" : "지도 보기"}
                </Button>
              )}
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/cart')}
              >
                저장하기
              </Button>
            </Box>
          </div>
        </Box>
      </Box>

      {/* 메인 컨텐츠 */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-left 0.3s ease',
      }}>
        {/* 상단 바 */}
        <Box sx={{ 
          bgcolor: 'background.paper',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Button
            variant="outlined"
            onClick={toggleSidebar}
            startIcon={<span className="text-xl">☰</span>}
            sx={{ mr: 2 }}
          >
            메뉴
          </Button>
          <Typography variant="h6">여행 플래너</Typography>
        </Box>

        {/* 기존 메인 컨텐츠 유지 */}
        <Box sx={{ flex: 1, p: 2, overflow: 'hidden' }}>
          {sidebarTab === 'schedule' ? (
            selectedDay ? (
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5">
                    {currentPlan.title}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={() => setIsSearchOpen(true)}
                  >
                    장소 검색
                  </Button>
                </Box>
                <Box sx={{ 
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: showMap ? { xs: '1fr', md: '1fr 1fr' } : '1fr',
                  gap: 2,
                  overflow: 'hidden'
                }}>
                  {/* 일정 목록 */}
                  <Box sx={{ 
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    boxShadow: 1,
                    p: 2,
                    overflow: 'auto',
                    height: showMap ? 'auto' : '100%'
                  }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>일정 목록</Typography>
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <StrictModeDroppable droppableId="schedules">
                        {(provided, snapshot) => (
                          <List
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            sx={{
                              minHeight: '100px',
                              bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                              transition: 'background-color 0.2s ease',
                              '& > *:not(:last-child)': {
                                mb: 1
                              }
                            }}
                          >
                            {currentPlan.schedules.map((schedule, index) => (
                              <Draggable
                                key={`schedule-${index}`}
                                draggableId={`schedule-${index}`}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <ListItem
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    sx={{
                                      p: 2,
                                      bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                                      borderRadius: 1,
                                      border: 1,
                                      borderColor: 'divider',
                                      '&:hover': {
                                        bgcolor: 'action.hover',
                                      },
                                    }}
                                    secondaryAction={
                                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <IconButton
                                          edge="end"
                                          aria-label="edit"
                                          onClick={() => handleEditSchedule(schedule)}
                                          sx={{ mr: 1 }}
                                        >
                                          <EditIcon />
                                        </IconButton>
                                        <IconButton
                                          edge="end"
                                          aria-label="delete"
                                          onClick={() => handleDeleteSchedule(index)}
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </Box>
                                    }
                                  >
                                    <div {...provided.dragHandleProps} style={{ marginRight: 8 }}>
                                      <DragIndicatorIcon color="action" />
                                    </div>
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                          <Typography variant="subtitle1">
                                            {schedule.time}
                                          </Typography>
                                          <Typography variant="subtitle1" sx={{ ml: 2 }}>
                                            {schedule.name}
                                          </Typography>
                                        </Box>
                                      }
                                      secondary={
                                        <React.Fragment>
                                          <Typography component="span" variant="body2" color="text.primary">
                                            {schedule.address}
                                          </Typography>
                                          <br />
                                          <Typography component="span" variant="body2" color="text.secondary">
                                            {schedule.category}
                                            {schedule.duration && ` • ${schedule.duration}`}
                                          </Typography>
                                    </React.Fragment>
                                      }
                                    />
                                  </ListItem>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </List>
                        )}
                      </StrictModeDroppable>
                    </DragDropContext>
                  </Box>

                  {/* 지도 */}
                  {showMap && (
                    <Box sx={{ 
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      boxShadow: 1,
                      overflow: 'hidden',
                      height: '100%'
                    }}>
                      <MapboxComponent
                        selectedPlace={null}
                        travelPlans={travelPlans}
                        selectedDay={selectedDay}
                        showAllMarkers={showAllMarkers}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  날짜를 선택해주세요
                </Typography>
              </Box>
            )
          ) : sidebarTab === 'accommodation' ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">
                  숙소 검색
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => setIsSearchOpen(true)}
                >
                  숙소 검색
                </Button>
              </Box>
              <Box sx={{ 
                flex: 1,
                display: 'grid',
                gridTemplateColumns: showMap ? { xs: '1fr', md: '1fr 1fr' } : '1fr',
                gap: 2,
                overflow: 'hidden'
              }}>
                {/* 호텔 목록 */}
                <Box sx={{ 
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  boxShadow: 1,
                  p: 2,
                  overflow: 'auto',
                  height: showMap ? 'auto' : '100%'
                }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>호텔 목록</Typography>
                  <AccommodationPlan showMap={showMap} isSearchTab={false} />
                </Box>

                {/* 지도 */}
                {showMap && (
                  <Box sx={{ 
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    boxShadow: 1,
                    overflow: 'hidden',
                    height: '100%'
                  }}>
                    <MapboxComponent
                      selectedPlace={null}
                      travelPlans={travelPlans}
                      selectedDay={selectedDay}
                      showAllMarkers={showAllMarkers}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          ) : (
            // 비행 계획 탭
            <FlightPlan showMap={showMap} />
          )}
        </Box>
      </Box>

      {/* 검색 팝업 */}
      <Dialog
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>장소 검색</DialogTitle>
        <DialogContent>
          <SearchPopup
            onSelect={handleAddPlace}
            onClose={() => setIsSearchOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 일정 수정 다이얼로그 */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>일정 수정</DialogTitle>
        <DialogContent>
          {editSchedule && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="시간"
                value={editSchedule.time}
                onChange={(e) => setEditSchedule({ ...editSchedule, time: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="소요 시간"
                value={editSchedule.duration}
                onChange={(e) => setEditSchedule({ ...editSchedule, duration: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                multiline
                rows={4}
                label="메모"
                value={editSchedule.notes}
                onChange={(e) => setEditSchedule({ ...editSchedule, notes: e.target.value })}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
          <Button onClick={handleUpdateSchedule} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>

      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.02);
            opacity: 0.3;
          }
          100% {
            transform: scale(1);
            opacity: 0.5;
          }
        }
      `}</style>
    </Box>
  );
};

export default TravelPlanner; 