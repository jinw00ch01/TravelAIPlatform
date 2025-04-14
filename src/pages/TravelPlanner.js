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
  const [dayOrder, setDayOrder] = useState(Object.keys(travelPlans));
  const [sidebarTab, setSidebarTab] = useState('schedule');

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

  const reorderDays = (plans) => {
    const orderedPlans = {};
    const days = Object.entries(plans)
      .sort(([a], [b]) => parseInt(a) - parseInt(b));

    days.forEach(([_, plan], index) => {
      orderedPlans[index + 1] = {
        ...plan,
        title: getDayTitle(index + 1)
      };
    });

    return orderedPlans;
  };

  const addDay = () => {
    const newDayNumber = Math.max(...Object.keys(travelPlans).map(Number)) + 1;
    const newPlans = {
      ...travelPlans,
          [newDayNumber]: {
        title: getDayTitle(newDayNumber),
        schedules: []
      }
    };
    setTravelPlans(newPlans);
    setDayOrder(prevOrder => [...prevOrder, newDayNumber.toString()]);
  };

  const removeDay = (dayToRemove) => {
    if (Object.keys(travelPlans).length <= 1) {
      alert('최소 하나의 날짜는 유지해야 합니다.');
      return;
    }
    
    // 남은 날짜들을 순서대로 정렬
    const remainingDays = Object.keys(travelPlans)
      .filter(day => day !== dayToRemove.toString())
      .map(Number)
      .sort((a, b) => a - b);

    // 새로운 여행 계획 객체 생성
    const newPlans = {};
    remainingDays.forEach((oldDay, index) => {
      const newDayNumber = index + 1;
      newPlans[newDayNumber] = {
        ...travelPlans[oldDay],
        title: `${newDayNumber}일차`
        };
      });

    // 새로운 dayOrder 생성
    const newDayOrder = Object.keys(newPlans);

    // 상태 업데이트
    setTravelPlans(newPlans);
    setDayOrder(newDayOrder);

    // 선택된 날짜 조정
    if (selectedDay === dayToRemove) {
      // 삭제된 날짜가 마지막 날짜였다면 마지막 날짜를 선택
      const newSelectedDay = Math.min(dayToRemove, Object.keys(newPlans).length);
      setSelectedDay(newSelectedDay);
    } else if (selectedDay > dayToRemove) {
      // 삭제된 날짜보다 큰 날짜를 선택중이었다면 하루 앞당김
      setSelectedDay(selectedDay - 1);
    }
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

  const handleDeleteSchedule = (scheduleId) => {
    setTravelPlans(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        schedules: prev[selectedDay].schedules.filter(schedule => schedule.id !== scheduleId)
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

  // 날짜 순서 변경 핸들러
  const handleDayDragEnd = (result) => {
    if (!result.destination) return;

    const newDayOrder = Array.from(dayOrder);
    const [reorderedDay] = newDayOrder.splice(result.source.index, 1);
    newDayOrder.splice(result.destination.index, 0, reorderedDay);

    // 새로운 순서로 여행 계획 재구성
    const newTravelPlans = {};
    newDayOrder.forEach((day) => {
      newTravelPlans[day] = travelPlans[day];
    });

    setDayOrder(newDayOrder);
    setTravelPlans(newTravelPlans);
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
                  <StrictModeDroppable droppableId="days" direction="vertical">
                    {(provided) => (
                      <Box
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1
                        }}
                      >
                        {/* 기존 일정 목록 유지 */}
                        {dayOrder.map((day, index) => (
                          <Draggable key={day} draggableId={`day-${day}`} index={index}>
                            {(provided, snapshot) => (
                              <Paper
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                sx={{
                                  p: 1.5,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  bgcolor: selectedDay === parseInt(day) ? 'primary.light' : 'background.paper',
                                  border: selectedDay === parseInt(day) ? 2 : 1,
                                  borderColor: selectedDay === parseInt(day) ? 'primary.main' : 'divider',
                                  '&:hover': {
                                    bgcolor: selectedDay === parseInt(day) ? 'primary.light' : 'action.hover',
                                  },
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                                onClick={() => setSelectedDay(parseInt(day))}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <DragIndicatorIcon sx={{ mr: 1, color: 'action.active' }} />
                                  <Typography variant="subtitle1">{getDayTitle(parseInt(day))}</Typography>
                                </Box>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeDay(parseInt(day));
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
              <AccommodationPlan />
            )}

            {sidebarTab === 'flight' && (
              <FlightPlan />
            )}
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
          {selectedDay ? (
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
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2,
                overflow: 'hidden'
              }}>
                {/* 일정 목록 */}
                <Box sx={{ 
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  boxShadow: 1,
                  p: 2,
                  overflow: 'auto'
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
                                        onClick={() => handleDeleteSchedule(schedule.id)}
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
              </Box>
            </Box>
          ) : (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                날짜를 선택해주세요
              </Typography>
            </Box>
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
    </Box>
  );
};

export default TravelPlanner; 