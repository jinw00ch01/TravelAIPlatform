import React from 'react';
import {
  Box, Button, Typography, TextField, IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

const TravelPlannerHeader = ({
  toggleSidebar,
  sidebarTab,
  isEditingPlanTitle,
  setIsEditingPlanTitle,
  tempPlanTitle,
  setTempPlanTitle,
  planTitle,
  setPlanTitle,
  setPlanName,
  planId,
  plannerHandleUpdatePlanTitle
}) => {
  return (
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
      {sidebarTab === 'schedule' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          {isEditingPlanTitle ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                value={tempPlanTitle}
                onChange={e => setTempPlanTitle(e.target.value)}
                size="small"
                autoFocus
                onBlur={async () => {
                  if (planId && !isNaN(Number(planId))) {
                    const success = await plannerHandleUpdatePlanTitle(tempPlanTitle);
                    if (success) {
                      setPlanTitle(tempPlanTitle);
                      setPlanName(tempPlanTitle);
                    }
                  } else {
                    setPlanTitle(tempPlanTitle);
                  }
                  setIsEditingPlanTitle(false);
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    if (planId && !isNaN(Number(planId))) {
                      const success = await plannerHandleUpdatePlanTitle(tempPlanTitle);
                      if (success) {
                        setPlanTitle(tempPlanTitle);
                        setPlanName(tempPlanTitle);
                      }
                    } else {
                      setPlanTitle(tempPlanTitle);
                    }
                    setIsEditingPlanTitle(false);
                  } else if (e.key === 'Escape') {
                    setTempPlanTitle(planTitle);
                    setIsEditingPlanTitle(false);
                  }
                }}
              />
              <Button
                size="small"
                onClick={async () => {
                  if (planId && !isNaN(Number(planId))) {
                    const success = await plannerHandleUpdatePlanTitle(tempPlanTitle);
                    if (success) {
                      setPlanTitle(tempPlanTitle);
                      setPlanName(tempPlanTitle);
                    }
                  } else {
                    setPlanTitle(tempPlanTitle);
                  }
                  setIsEditingPlanTitle(false);
                }}
              >
                저장
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setTempPlanTitle(planTitle);
                  setIsEditingPlanTitle(false);
                }}
              >
                취소
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">{planTitle}</Typography>
              <IconButton
                size="small"
                onClick={() => {
                  setTempPlanTitle(planTitle);
                  setIsEditingPlanTitle(true);
                }}
              >
                <EditIcon />
              </IconButton>
            </Box>
          )}
        </Box>
      ) : (
        <Typography variant="h6">
          {sidebarTab === 'accommodation' ? '숙소 검색 결과' : '항공편 검색 결과'}
        </Typography>
      )}
    </Box>
  );
};

export default TravelPlannerHeader; 