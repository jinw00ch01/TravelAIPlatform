import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, TextField, Paper
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import useTravelPlanLoader from './hooks/useTravelPlanLoader';
import useFlightHandlers from './hooks/useFlightHandlers';
import usePlannerActions from './hooks/usePlannerActions';
import AccommodationPlan from '../components/AccommodationPlan';
import FlightPlan from '../components/FlightPlan';
import MapboxComponent from '../components/MapboxComponent';

const TravelPlanner = () => {
  const { user } = useAuth();
  const {
    travelPlans, setTravelPlans,
    dayOrder, setDayOrder,
    selectedDay, setSelectedDay,
    startDate, setStartDate,
    planId, setPlanId,
    isLoadingPlan, loadTravelPlan
  } = useTravelPlanLoader(user);

  const {
    flightSearchParams, setFlightSearchParams,
    originCities, destinationCities,
    isLoadingCities, isLoadingFlights,
    flightResults, flightDictionaries, flightError,
    handleCitySearch, handleFlightSearch
  } = useFlightHandlers();

  const {
    addDay, removeDay, handleDateChange, handleSaveConfirm
  } = usePlannerActions({
    travelPlans, setTravelPlans,
    dayOrder, setDayOrder,
    selectedDay, setSelectedDay,
    startDate, planId, setPlanId
  });

  const [openSaveDialog, setOpenSaveDialog] = useState(false);
  const [planTitle, setPlanTitle] = useState('');

  const currentPlan = travelPlans[selectedDay] || { title: '', schedules: [] };

  const handleAddPlace = () => {
    const newId = Date.now().toString();
    const newSchedule = {
      id: newId,
      name: '새 장소',
      time: '12:00',
      address: '',
      category: '',
      duration: '1시간',
      notes: '',
      lat: null,
      lng: null
    };
    const updatedSchedules = [...currentPlan.schedules, newSchedule];
    const updatedPlans = {
      ...travelPlans,
      [selectedDay]: {
        ...currentPlan,
        schedules: updatedSchedules
      }
    };
    setTravelPlans(updatedPlans);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const newOrder = Array.from(dayOrder);
    const [removed] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, removed);
    setDayOrder(newOrder);
  };

  return (
    <Box p={2}>
      <Typography variant="h4">여행 일정 관리</Typography>

      <Button variant="outlined" onClick={() => setOpenSaveDialog(true)}>여행 계획 저장</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={addDay}>일차 추가</Button>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="days-droppable">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {dayOrder.map((dayKey, index) => {
                const day = travelPlans[dayKey];
                return (
                  <Draggable key={dayKey} draggableId={dayKey} index={index}>
                    {(provided) => (
                      <Paper
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        sx={{ p: 2, mb: 2 }}
                      >
                        <Typography variant="h6">{day.title}</Typography>
                        {day.schedules.map((item, idx) => (
                          <Box key={item.id || idx} sx={{ border: '1px solid #ddd', p: 1, mb: 1 }}>
                            <Typography>{item.name}</Typography>
                            <Typography variant="body2">{item.time} / {item.duration}</Typography>
                          </Box>
                        ))}
                        <Button onClick={handleAddPlace}>일정 추가</Button>
                        <Button color="error" onClick={() => removeDay(parseInt(dayKey))}>일차 삭제</Button>
                      </Paper>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <AccommodationPlan plans={travelPlans} />
      <FlightPlan searchParams={flightSearchParams} results={flightResults} />
      <MapboxComponent />

      <Dialog open={openSaveDialog} onClose={() => setOpenSaveDialog(false)}>
        <DialogTitle>여행 계획 저장</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="제목"
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSaveDialog(false)}>취소</Button>
          <Button onClick={() => {
            handleSaveConfirm(planTitle);
            setOpenSaveDialog(false);
          }}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TravelPlanner;
