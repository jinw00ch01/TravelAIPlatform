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
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
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

const MapboxComponent = ({ selectedPlace, travelPlans, selectedDay, showAllMarkers = false }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [transportMode, setTransportMode] = useState('driving');
  const routeLayer = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [openRouteDialog, setOpenRouteDialog] = useState(false);

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

  // 이동 수단 변경 시 경로 업데이트
  useEffect(() => {
    if (!map.current || !travelPlans[selectedDay]?.schedules.length > 1) return;

    const coordinates = travelPlans[selectedDay].schedules.map(schedule => [
      schedule.lng,
      schedule.lat
    ]);

    if (transportMode === 'transit') {
      // Here Maps Transit API 호출
      const origin = coordinates[0];
      const destination = coordinates[coordinates.length - 1];
      const waypoints = coordinates.slice(1, -1); // 중간 경유지들

      const HERE_API_KEY = process.env.REACT_APP_HERE_API_KEY;
      const baseUrl = 'https://transit.router.hereapi.com/v8/routes';
      
      // 출발지와 도착지 설정
      let url = `${baseUrl}?apiKey=${HERE_API_KEY}&origin=${origin[1]},${origin[0]}&destination=${destination[1]},${destination[0]}`;
      
      // 경유지 추가
      if (waypoints.length > 0) {
        const viaString = waypoints.map(point => `${point[1]},${point[0]}`).join('&via=');
        url += `&via=${viaString}`;
      }

      // 추가 파라미터
      url += '&return=polyline,actions,instructions&alternatives=1';

      fetch(url)
        .then(response => response.json())
        .then(data => {
          if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            
            // 경로 라인 업데이트
            const coordinates = decode(route.sections[0].polyline);
            map.current.getSource('route').setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coordinates.map(coord => [coord[1], coord[0]])
              }
            });

            // 경로 라인 스타일 업데이트
            map.current.setPaintProperty('route', 'line-color', '#2e7d32');

            // 경로 정보 업데이트
            const routeInfo = {
              duration: Math.round(route.sections[0].summary.duration / 60),
              distance: Math.round(route.sections[0].summary.length / 1000),
              steps: route.sections[0].actions.map(action => ({
                type: action.action,
                instruction: action.instruction,
                distance: Math.round(action.length / 1000 * 10) / 10,
                duration: Math.round(action.duration / 60),
                mode: action.type === 'TRANSIT' ? 'transit' : 'walking',
                transitInfo: action.type === 'TRANSIT' ? {
                  line: action.line,
                  headsign: action.headsign,
                  stops: action.stops
                } : null
              }))
            };

            setRouteInfo(routeInfo);
          }
        })
        .catch(error => {
          console.error('Error fetching transit route:', error);
          alert('대중교통 경로를 가져오는 중 오류가 발생했습니다. 다시 시도해주세요.');
        });
    } else {
      // 기존 Mapbox API 호출 (운전, 도보)
      let profile = transportMode === 'driving' ? 'mapbox/driving' : 'mapbox/walking';
      let additionalParams = transportMode === 'driving' ? 
        '&annotations=duration,distance,speed&overview=full' : 
        '&annotations=duration,distance&overview=full';

      const waypoints = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
      const url = `https://api.mapbox.com/directions/v5/${profile}/${waypoints}?geometries=geojson&language=ko&access_token=${mapboxgl.accessToken}${additionalParams}`;

      fetch(url)
        .then(response => response.json())
        .then(data => {
          if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            
            // 경로 라인 색상 설정
            const routeColor = transportMode === 'driving' ? '#1976d2' : 
                             transportMode === 'transit' ? '#2e7d32' : '#c62828';
            
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
              distance: Math.round(route.distance / 1000),
              steps: route.legs.flatMap(leg => 
                leg.steps.map(step => ({
                  type: step.maneuver.type,
                  instruction: step.maneuver.instruction,
                  distance: Math.round(step.distance / 1000 * 10) / 10, // 소수점 1자리까지 표시
                  duration: Math.round(step.duration / 60),
                  mode: transportMode
                }))
              )
            };

            setRouteInfo(routeInfo);
          }
        })
        .catch(error => {
          console.error('Error fetching route:', error);
          // 에러 발생 시 사용자에게 알림
          alert('경로를 가져오는 중 오류가 발생했습니다. 다시 시도해주세요.');
        });
    }
  }, [transportMode, travelPlans, selectedDay]);

  // Here Maps 폴리라인 디코딩 함수
  function decode(encoded) {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lat * 1e-5, lng * 1e-5]);
    }

    return points;
  }

  // 마커 표시
  useEffect(() => {
    // 기존 마커 제거
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    if (!map.current) return;

    const plansToShow = showAllMarkers ? travelPlans : { [selectedDay]: travelPlans[selectedDay] };

    Object.entries(plansToShow).forEach(([day, plan]) => {
      const dayNumber = parseInt(day);
      const color = dayColors[dayNumber % dayColors.length];
      
      plan.schedules.forEach((schedule, index) => {
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        markerElement.innerHTML = `
          <div class="marker-content">
            <div class="marker-number" style="background-color: ${color}">${dayNumber}-${index + 1}</div>
            <div class="marker-dot" style="background-color: ${color}"></div>
          </div>
        `;

        const marker = new mapboxgl.Marker(markerElement)
          .setLngLat([schedule.lng, schedule.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 10px;">
                  <h3 style="margin: 0 0 5px 0; color: ${color};">${dayNumber}일차 ${index + 1}번째 장소</h3>
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
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [travelPlans, selectedDay, showAllMarkers]);

  const getTransportIcon = (step) => {
    if (step.mode === 'transit') {
      // 대중교통 종류에 따른 아이콘 선택
      const transitType = step.transitInfo?.line?.type?.toLowerCase() || '';
      if (transitType.includes('subway') || transitType.includes('train')) {
        return <TrainIcon />;
      }
      return <DirectionsBusIcon />;
    }
    return step.mode === 'driving' ? <DirectionsCarIcon /> : <DirectionsWalkIcon />;
  };

  const handleOpenRouteDialog = () => {
    setOpenRouteDialog(true);
  };

  const handleCloseRouteDialog = () => {
    setOpenRouteDialog(false);
  };

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
          onClick={() => setTransportMode('transit')}
          variant={transportMode === 'transit' ? 'contained' : 'outlined'}
          title="대중교통"
        >
          <DirectionsTransitIcon />
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
          onClick={handleOpenRouteDialog}
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
        open={openRouteDialog}
        onClose={handleCloseRouteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AccessTimeIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              {transportMode === 'driving' ? '자동차' :
               transportMode === 'transit' ? '도보' :
               '도보'} 경로 정보
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={handleCloseRouteDialog}
            sx={{ color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" color="primary">
              예상 소요 시간: {routeInfo?.duration}분
            </Typography>
            <Typography variant="body1" color="text.secondary">
              총 거리: {routeInfo?.distance}km
            </Typography>
          </Box>
          <Divider sx={{ my: 2 }} />
          <List>
            {routeInfo?.steps.map((step, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {getTransportIcon(step)}
                </ListItemIcon>
                <ListItemText
                  primary={step.instruction}
                  secondary={`${step.distance}km (약 ${step.duration}분)`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRouteDialog}>닫기</Button>
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