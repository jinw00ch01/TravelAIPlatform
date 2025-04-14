import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  Box, 
  Button, 
  ButtonGroup, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Typography, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Divider,
  IconButton
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import TrainIcon from '@mui/icons-material/Train';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const center = [127.0016985, 37.5642135]; // 서울 중심 좌표

// 날짜별 색상 설정
const dayColors = [
  '#1976d2', // 파랑
  '#2e7d32', // 초록
  '#c62828', // 빨강
  '#6a1b9a', // 보라
  '#ef6c00', // 주황
  '#4527a0', // 진보라
  '#00838f', // 청록
];

const MapboxComponent = ({ travelPlans, selectedDay, showAllMarkers }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const routeSource = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [transportMode, setTransportMode] = useState('walking');
  const [isRouteInfoOpen, setIsRouteInfoOpen] = useState(false);

  useEffect(() => {
    if (!map.current) {
      mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_API_KEY;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: 12
      });

      // 지도 로드 완료 후 경로 레이어 추가
      map.current.on('load', () => {
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#1976d2',
            'line-width': 4
          }
        });
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 일차 변경 시 경로 초기화
  useEffect(() => {
    if (map.current && map.current.getSource('route')) {
      // 경로 데이터 초기화
      map.current.getSource('route').setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      });
      // 경로 정보 상태 초기화
      setRouteInfo(null);
    }
  }, [selectedDay]);

  // 이동 수단 변경 시 경로 업데이트
  useEffect(() => {
    if (!map.current || !travelPlans[selectedDay]?.schedules.length > 1) return;

    const coordinates = travelPlans[selectedDay].schedules.map(schedule => [
      schedule.lng,
      schedule.lat
    ]);

    let profile = transportMode === 'driving' ? 'mapbox/driving' : 'mapbox/walking';
    const url = `https://api.mapbox.com/directions/v5/${profile}/${coordinates.map(coord => coord.join(',')).join(';')}?` + 
      new URLSearchParams({
        geometries: 'geojson',
        steps: 'true',
        language: 'ko',
        overview: 'full',
        annotations: 'distance,duration,speed',
        access_token: mapboxgl.accessToken
      });

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          console.log('Mapbox API Response:', route);
          
          // 경로 라인 색상 설정
          const routeColor = transportMode === 'driving' ? '#1976d2' : '#c62828';
          
          map.current.getSource('route').setData({
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          });

          // 경로 라인 스타일 업데이트
          map.current.setPaintProperty('route', 'line-color', routeColor);

          // 경로 정보 업데이트
          const routeInfo = {
            duration: Math.round(route.duration / 60),
            distance: Math.round(route.distance / 1000 * 10) / 10,
            steps: route.legs.flatMap((leg, legIndex) => {
              console.log(`Processing leg ${legIndex}:`, leg);
              
              return leg.steps.map((step, stepIndex) => {
                console.log(`Processing step ${stepIndex}:`, step);

                // 방향 텍스트 생성
                let instruction = '';
                if (stepIndex === 0) {
                  // 출발지
                  instruction = `${travelPlans[selectedDay].schedules[legIndex].name}에서 출발`;
                } else if (stepIndex === leg.steps.length - 1) {
                  // 도착지
                  instruction = `${travelPlans[selectedDay].schedules[legIndex + 1].name}에 도착`;
                } else {
                  // 중간 경로
                  let direction = '';
                  switch (step.maneuver.modifier) {
                    case 'right': direction = '우회전'; break;
                    case 'left': direction = '좌회전'; break;
                    case 'straight': direction = '직진'; break;
                    case 'slight right': direction = '우측 방향'; break;
                    case 'slight left': direction = '좌측 방향'; break;
                    case 'sharp right': direction = '급우회전'; break;
                    case 'sharp left': direction = '급좌회전'; break;
                    case 'uturn': direction = 'U턴'; break;
                    default: direction = step.maneuver.type; break;
                  }

                  instruction = direction;
                  if (step.name) {
                    instruction += ` - ${step.name}`;
                  }
                  if (step.maneuver.instruction) {
                    instruction = step.maneuver.instruction
                      .replace('Turn right', '우회전')
                      .replace('Turn left', '좌회전')
                      .replace('Continue straight', '직진')
                      .replace('Arrive at', '도착:')
                      .replace('Head', '시작:')
                      .replace('north', '북쪽')
                      .replace('south', '남쪽')
                      .replace('east', '동쪽')
                      .replace('west', '서쪽')
                      .replace('destination', '목적지');
                  }
                }

                return {
                  type: step.maneuver.type,
                  instruction: instruction,
                  distance: Math.round(step.distance / 1000 * 10) / 10,
                  duration: Math.round(step.duration / 60),
                  mode: transportMode,
                  modifier: step.maneuver.modifier,
                  name: step.name || ''
                };
              });
            })
          };

          console.log('Processed Route Info:', routeInfo);
          setRouteInfo(routeInfo);
        }
      })
      .catch(error => {
        console.error('Error fetching route:', error);
        alert('경로를 가져오는 중 오류가 발생했습니다. 다시 시도해주세요.');
      });
  }, [transportMode, travelPlans, selectedDay]);

  // 마커 표시
  useEffect(() => {
    // 기존 마커 제거
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    if (!map.current || !travelPlans) return;

    // 표시할 일정 결정
    let plansToShow = {};
    if (showAllMarkers) {
      // 전체 일정 표시
      plansToShow = travelPlans;
    } else if (travelPlans[selectedDay]) {
      // 선택된 일차만 표시
      plansToShow = { [selectedDay]: travelPlans[selectedDay] };
    } else {
      return; // 유효하지 않은 일차면 마커 표시하지 않음
    }

    // 마커 생성 및 표시
    Object.entries(plansToShow).forEach(([day, plan]) => {
      if (!plan || !plan.schedules) return;

      const dayNumber = parseInt(day);
      const color = dayColors[dayNumber % dayColors.length];
      
      plan.schedules.forEach((schedule, index) => {
        if (!schedule.lng || !schedule.lat) return; // 좌표가 없는 경우 건너뛰기

        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        markerElement.innerHTML = `
          <div class="marker-content">
            <div class="marker-number" style="background-color: ${color}">
              ${showAllMarkers ? `${dayNumber}-${index + 1}` : `${index + 1}`}
            </div>
            <div class="marker-dot" style="background-color: ${color}"></div>
          </div>
        `;

        const marker = new mapboxgl.Marker(markerElement)
          .setLngLat([schedule.lng, schedule.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 10px;">
                  <h3 style="margin: 0 0 5px 0; color: ${color};">
                    ${showAllMarkers ? `${dayNumber}일차 ${index + 1}번째 장소` : `${index + 1}번째 장소`}
                  </h3>
                  <p style="margin: 0; font-size: 14px;">${schedule.name}</p>
                  <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">${schedule.address}</p>
                </div>
              `)
          )
          .addTo(map.current);

        markers.current.push(marker);
      });
    });

    // 모든 마커가 보이도록 지도 범위 조정
    if (markers.current.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.current.forEach(marker => bounds.extend(marker.getLngLat()));
      map.current.fitBounds(bounds, { 
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 1000 // 부드러운 이동을 위한 애니메이션 시간
      });
    }
  }, [travelPlans, selectedDay, showAllMarkers]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={mapContainerStyle} />
      <ButtonGroup
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          bgcolor: 'white',
          boxShadow: 2,
          '& .MuiButton-root': {
            minWidth: '40px',
            px: 1,
          }
        }}
      >
        <Button
          onClick={() => setTransportMode('driving')}
          variant={transportMode === 'driving' ? 'contained' : 'outlined'}
          title="자동차"
        >
          <DirectionsCarIcon />
        </Button>
        <Button
          onClick={() => setTransportMode('walking')}
          variant={transportMode === 'walking' ? 'contained' : 'outlined'}
          title="도보"
        >
          <DirectionsWalkIcon />
        </Button>
      </ButtonGroup>

      {/* 경로 정보 버튼 */}
      {routeInfo && (
        <Button
          variant="contained"
          startIcon={<AccessTimeIcon />}
          onClick={() => setIsRouteInfoOpen(true)}
          sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'white',
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'grey.100',
            },
          }}
        >
          경로 정보 보기
        </Button>
      )}

      {/* 경로 정보 다이얼로그 */}
      <Dialog
        open={isRouteInfoOpen}
        onClose={() => setIsRouteInfoOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AccessTimeIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              {transportMode === 'driving' ? '자동차' : '도보'} 경로 정보
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={() => setIsRouteInfoOpen(false)}
            sx={{ color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              총 예상 소요 시간: {routeInfo?.duration}분
            </Typography>
            <Typography variant="h6" color="primary">
              총 이동 거리: {routeInfo?.distance}km
            </Typography>
          </Box>
          <Divider sx={{ my: 2 }} />
          <List>
            {routeInfo?.steps.map((step, index) => (
              <ListItem key={index} sx={{ 
                py: 2,
                borderBottom: index < (routeInfo.steps.length - 1) ? '1px solid rgba(0, 0, 0, 0.12)' : 'none'
              }}>
                <ListItemIcon>
                  {step.mode === 'driving' ? <DirectionsCarIcon color="primary" /> : <DirectionsWalkIcon color="error" />}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                      {step.instruction}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {step.distance > 0 ? `${step.distance}km` : ''} 
                      {step.duration > 0 ? ` • 약 ${step.duration}분` : ''}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRouteInfoOpen(false)} variant="contained">닫기</Button>
        </DialogActions>
      </Dialog>

      <style>
        {`
          .custom-marker {
            cursor: pointer;
          }
          .marker-content {
            position: relative;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
          }
          .marker-number {
            position: absolute;
            top: -10px;
            left: -10px;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .marker-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
          }
          .mapboxgl-popup {
            max-width: 300px;
          }
          .mapboxgl-popup-content {
            padding: 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
        `}
      </style>
    </Box>
  );
};

export default MapboxComponent; 