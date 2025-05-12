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

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const SCRIPT_ID = 'google-maps-script';
const RAPIDAPI_KEY = process.env.REACT_APP_RAPIDAPI_KEY;
const NAVITIME_API_URL = 'https://navitime-route-totalnavi.p.rapidapi.com/route_transit';

// 일본 좌표 범위 정의
const JAPAN_BOUNDS = {
  west: 129.0,    // 최서단 (쓰시마)
  east: 146.0,    // 최동단 (홋카이도)
  south: 24.0,    // 최남단 (오키나와)
  north: 46.0     // 최북단 (홋카이도)
};

// 좌표가 일본 영역 내에 있는지 확인하는 함수
const isJapanLocation = (coord) => {
  return coord[0] >= JAPAN_BOUNDS.west && 
         coord[0] <= JAPAN_BOUNDS.east && 
         coord[1] >= JAPAN_BOUNDS.south && 
         coord[1] <= JAPAN_BOUNDS.north;
};

const MapboxComponent = ({ travelPlans, selectedDay, showAllMarkers }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const routeSource = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [transportMode, setTransportMode] = useState('walking');
  const [isRouteInfoOpen, setIsRouteInfoOpen] = useState(false);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [selectingLocationType, setSelectingLocationType] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);

  // Google Maps API 스크립트 로드
  useEffect(() => {
    let isSubscribed = true;
    let timeoutId;

    const loadGoogleMapsScript = () => {
      return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
          return;
        }

        let script = document.getElementById(SCRIPT_ID);
        
        if (!script) {
          script = document.createElement('script');
          script.id = SCRIPT_ID;
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,directions&language=ko&region=kr`;
          script.async = true;
          script.defer = true;
          
          script.onload = () => {
            if (window.google && window.google.maps) {
              resolve(window.google.maps);
            } else {
              console.error('Google Maps API가 올바르게 초기화되지 않았습니다.');
              reject(new Error('Google Maps API가 올바르게 로드되지 않았습니다.'));
            }
          };

          script.onerror = (error) => {
            console.error('Google Maps API 로드 실패:', error);
            reject(new Error('Google Maps API를 로드할 수 없습니다.'));
          };

          document.head.appendChild(script);
        } else {
          const checkGoogleMaps = setInterval(() => {
            if (window.google && window.google.maps) {
              clearInterval(checkGoogleMaps);
              resolve(window.google.maps);
            }
          }, 100);

          timeoutId = setTimeout(() => {
            clearInterval(checkGoogleMaps);
            console.error('Google Maps API 초기화 타임아웃');
            reject(new Error('Google Maps API 로드 타임아웃'));
          }, 5000);
        }
      });
    };

    loadGoogleMapsScript()
      .then(() => {
        if (isSubscribed) {
          setIsGoogleMapsLoaded(true);
        }
      })
      .catch(error => {
        console.error('Google Maps API 로드 오류:', error);
        if (isSubscribed) {
          setIsGoogleMapsLoaded(false);
        }
      });

    return () => {
      isSubscribed = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Google Maps Directions API를 사용하여 대중교통 경로를 가져오는 함수
  const getTransitRoute = async (start, end) => {
    if (!window.google || !window.google.maps) {
      throw new Error('Google Maps API가 로드되지 않았습니다.');
    }

    const googleMaps = window.google.maps;
    const directionsService = new googleMaps.DirectionsService();
    
    return new Promise((resolve, reject) => {
      directionsService.route(
        {
          origin: { lat: start[1], lng: start[0] },
          destination: { lat: end[1], lng: end[0] },
          travelMode: googleMaps.TravelMode.TRANSIT,
          transitOptions: {
            modes: [googleMaps.TransitMode.BUS, googleMaps.TransitMode.SUBWAY, googleMaps.TransitMode.TRAIN],
            routingPreference: googleMaps.TransitRoutePreference.FEWER_TRANSFERS
          },
          provideRouteAlternatives: false
        },
        (result, status) => {
          if (status === 'OK') {
            resolve(result);
          } else {
            console.error('Google Maps Directions API 요청 실패:', status);
            reject(new Error(`Directions request failed: ${status}`));
          }
        }
      );
    });
  };

  // Google Maps 경로를 Mapbox 형식으로 변환하는 함수
  const convertGoogleRouteToMapbox = (googleRoute) => {
    try {
      if (!googleRoute) {
        console.error('Google Maps 경로 데이터가 없습니다.');
        return null;
      }

      if (!googleRoute.routes || !googleRoute.routes[0]) {
        console.error('Google Maps 경로 데이터가 올바른 형식이 아닙니다.');
        return null;
      }

      const route = googleRoute.routes[0];
      const path = [];
      const steps = [];

      if (route.legs && route.legs.length > 0) {
        route.legs.forEach(leg => {
          if (leg.steps && leg.steps.length > 0) {
            leg.steps.forEach(step => {
              if (step.path) {
                step.path.forEach(point => {
                  path.push([point.lng(), point.lat()]);
                });
              }

              let mode = 'walking';
              let details = {};

              if (step.travel_mode === 'TRANSIT') {
                mode = 'transit';
                const transit = step.transit;
                details = {
                  line_name: transit.line.name || transit.line.short_name,
                  company: transit.line.agencies?.[0]?.name || '',
                  vehicle_type: transit.line.vehicle?.type || '',
                  departure_stop: transit.departure_stop?.name || '',
                  arrival_stop: transit.arrival_stop?.name || '',
                  departure_platform: transit.departure_platform || '',
                  arrival_platform: transit.arrival_platform || '',
                  num_stops: transit.num_stops,
                  headsign: transit.headsign || '',
                  departure_time: transit.departure_time?.text || '',
                  arrival_time: transit.arrival_time?.text || ''
                };
              } else if (step.travel_mode === 'DRIVING') {
                mode = 'driving';
              }

              let instruction = step.instructions;
              if (step.transit) {
                const transit = step.transit;
                const lineName = transit.line.name || transit.line.short_name;
                const stopName = transit.departure_stop?.name;
                instruction = `${stopName}에서 ${lineName} 탑승`;
                if (transit.headsign) {
                  instruction += ` (${transit.headsign} 방면)`;
                }
              }

              steps.push({
                type: mode,
                instruction: instruction,
                distance: Math.round(step.distance.value / 1000 * 10) / 10,
                duration: Math.round(step.duration.value / 60),
                mode: mode,
                name: step.transit?.line.name || '',
                from_time: step.transit?.departure_time?.text || '',
                to_time: step.transit?.arrival_time?.text || '',
                details: details
              });
            });
          }
        });
      }

      if (path.length === 0) {
        console.error('경로 좌표를 추출할 수 없습니다.');
        return null;
      }

      const routeInfo = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: path
        },
        originalRoute: {
          steps: steps,
          duration: Math.round(route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60),
          distance: Math.round(route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000 * 10) / 10
        }
      };

      return routeInfo;
    } catch (error) {
      console.error('경로 변환 중 오류 발생:', error);
      return null;
    }
  };

  // Navitime API를 사용하여 대중교통 경로를 가져오는 함수
  const getNavitimeTransitRoute = async (start, end) => {
    try {
      console.log('Navitime API 호출:', { start, end });
      
      const currentTime = new Date();
      const formattedTime = currentTime.toISOString().split('.')[0];
      
      const params = new URLSearchParams({
        start: `${start[1]},${start[0]}`,
        goal: `${end[1]},${end[0]}`,
        start_time: formattedTime,
        format: 'json',
        term: '1440',
        limit: '1',
        datum: 'wgs84',
        coord_unit: 'degree',
        shape: 'true'
      });

      const response = await fetch(`${NAVITIME_API_URL}?${params}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Navitime API 오류:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Navitime API 요청 실패: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        throw new Error('Navitime API에서 경로 데이터를 찾을 수 없습니다.');
      }
      
      return data;
    } catch (error) {
      console.error('Navitime API 오류:', error);
      throw error;
    }
  };

  // Navitime 경로를 Mapbox 형식으로 변환하는 함수
  const convertNavitimeRouteToMapbox = (navitimeRoute, start, end) => {
    try {
      if (!navitimeRoute || !navitimeRoute.items || navitimeRoute.items.length === 0) {
        console.error('Navitime 경로 데이터가 없습니다.');
        return null;
      }

      const route = navitimeRoute.items[0];
      const path = [];
      const steps = [];

      if (route.sections && route.sections.length > 0) {
        route.sections.forEach((section, index) => {
          if (section.type === 'point' && section.coord) {
            path.push([section.coord.lon, section.coord.lat]);
          }

          if (section.type === 'move' && section.shape) {
            section.shape.forEach(coord => {
              path.push([coord.lon, coord.lat]);
            });
          }

          if (section.type === 'move') {
            let instruction = '';
            let name = '';
            let mode = 'transit';
            let details = {};

            if (section.move === 'walk') {
              instruction = `${section.distance ? Math.round(section.distance / 1000 * 10) / 10 : 0}km 도보 이동`;
              mode = 'walking';
              if (section.start_point && section.end_point) {
                details = {
                  start_name: section.start_point.name,
                  end_name: section.end_point.name
                };
              }
            } else if (section.transport) {
              const transport = section.transport;
              switch (section.move) {
                case 'local_train':
                case 'rapid_train':
                case 'express_train':
                  name = transport.name || '';
                  instruction = `${transport.name || '열차'} 탑승`;
                  details = {
                    line_name: transport.name,
                    platform: section.platform || '',
                    departure_platform: section.departure_platform || '',
                    arrival_platform: section.arrival_platform || '',
                    train_number: transport.train_number || '',
                    fare: section.fare ? `${section.fare}엔` : '',
                    start_station: section.start_point?.name || '',
                    end_station: section.end_point?.name || ''
                  };
                  break;
                case 'bus':
                  name = transport.name || '';
                  instruction = `${transport.name || '버스'} 탑승`;
                  details = {
                    line_name: transport.name,
                    bus_number: transport.bus_number || '',
                    platform: section.platform || '',
                    fare: section.fare ? `${section.fare}엔` : '',
                    start_stop: section.start_point?.name || '',
                    end_stop: section.end_point?.name || ''
                  };
                  break;
                default:
                  if (transport.name) {
                    instruction = `${transport.name} 탑승`;
                    name = transport.name;
                  }
              }
            }

            if (instruction) {
              const step = {
                type: mode,
                instruction: instruction,
                distance: section.distance ? Math.round(section.distance / 1000 * 10) / 10 : 0,
                duration: section.time ? Math.round(section.time) : 0,
                mode: mode,
                name: name,
                from_time: section.from_time,
                to_time: section.to_time,
                details: details,
                shape: section.shape
              };
              
              steps.push(step);
            }
          }
        });
      }
      
      if (path.length === 0) {
        console.error('경로 좌표를 추출할 수 없습니다.');
        return null;
      }

      const totalDuration = route.sections
        .filter(section => section.type === 'move')
        .reduce((sum, section) => sum + (section.time || 0), 0);
      const totalDistance = route.sections
        .filter(section => section.type === 'move')
        .reduce((sum, section) => sum + (section.distance || 0), 0);

      const routeInfo = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: path
        },
        originalRoute: {
          ...route,
          steps: steps,
          duration: Math.round(totalDuration),
          distance: Math.round(totalDistance / 1000 * 10) / 10
        }
      };

      return routeInfo;
    } catch (error) {
      console.error('경로 변환 중 오류 발생:', error);
      return null;
    }
  };

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
        // 소스가 이미 존재하는지 확인
        if (!map.current.getSource('route')) {
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
        }
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 경로 초기화 및 업데이트 로직 개선
  useEffect(() => {
    if (map.current && map.current.getSource('route')) {
      map.current.getSource('route').setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      });
      setRouteInfo(null);
    }
  }, [selectedDay, travelPlans, transportMode]);

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

    const waitForMap = () => {
      if (map.current && map.current.isStyleLoaded() && map.current.getSource('route')) {
    const coordinates = travelPlans[selectedDay].schedules.map(schedule => [
      schedule.lng,
      schedule.lat
    ]);

        const routePromises = [];
        for (let i = 0; i < coordinates.length - 1; i++) {
          const start = coordinates[i];
          const end = coordinates[i + 1];
          
          if (transportMode === 'transit') {
            // 일본 지역인 경우에만 Navitime API 사용
            const startInJapan = isJapanLocation(start);
            const endInJapan = isJapanLocation(end);
            
            if (startInJapan && endInJapan) {
              console.log('일본 지역 경로: Navitime API 시도');
              routePromises.push(
                getNavitimeTransitRoute(start, end)
                  .then(route => {
                    console.log('Navitime API 응답 성공');
                    const mapboxRoute = convertNavitimeRouteToMapbox(route, start, end);
                    if (!mapboxRoute) {
                      console.warn('Navitime 경로 변환 실패, Google Maps API로 전환');
                      return getTransitRoute(start, end)
                        .then(googleRoute => ({
                          data: { routes: [convertGoogleRouteToMapbox(googleRoute)] },
                          startIndex: i,
                          endIndex: i + 1
                        }));
                    }
                    return {
                      data: { routes: [mapboxRoute] },
                      startIndex: i,
                      endIndex: i + 1
                    };
                  })
                  .catch(error => {
                    console.error('Navitime API 실패, Google Maps API로 전환:', error);
                    return getTransitRoute(start, end)
                      .then(googleRoute => ({
                        data: { routes: [convertGoogleRouteToMapbox(googleRoute)] },
                        startIndex: i,
                        endIndex: i + 1
                      }))
                      .catch(error => {
                        console.error('Google Maps API도 실패:', error);
                        return null;
                      });
                  })
              );
            } else {
              // 일본 외 지역은 Google Maps API 사용
              console.log(`일본 외 지역 경로: Google Maps API 사용 (출발: ${start.join(',')}, 도착: ${end.join(',')})`);
              if (!isGoogleMapsLoaded) {
                console.warn('Google Maps API가 로드되지 않았습니다. 대중교통 경로를 가져올 수 없습니다.');
                continue;
              }

              routePromises.push(
                getTransitRoute(start, end)
                  .then(route => {
                    const mapboxRoute = convertGoogleRouteToMapbox(route);
                    if (!mapboxRoute) {
                      console.warn(`경로 변환 실패: ${start.join(',')} -> ${end.join(',')}`);
                      return null;
                    }
                    return {
                      data: { routes: [mapboxRoute] },
                      startIndex: i,
                      endIndex: i + 1
                    };
                  })
                  .catch(error => {
                    console.error('Error fetching transit route:', error);
                    return null;
                  })
              );
            }
          } else {
            // 기존 Mapbox 경로
    let profile = transportMode === 'driving' ? 'mapbox/driving' : 'mapbox/walking';
            const url = `https://api.mapbox.com/directions/v5/${profile}/${start.join(',')};${end.join(',')}?` + 
      new URLSearchParams({
        geometries: 'geojson',
        steps: 'true',
        language: 'ko',
        overview: 'full',
        annotations: 'distance,duration,speed',
        access_token: mapboxgl.accessToken
      });

            routePromises.push(
    fetch(url)
      .then(response => response.json())
                .then(data => ({
                  data,
                  startIndex: i,
                  endIndex: i + 1
                }))
            );
          }
        }

        Promise.all(routePromises)
          .then(results => {
            const validRoutes = results.filter(result => result && result.data && result.data.routes && result.data.routes[0]);
            
            if (validRoutes.length === 0) {
              console.warn('유효한 경로가 없습니다.');
              return;
            }

            const routeColor = transportMode === 'driving' ? '#1976d2' : 
                             transportMode === 'walking' ? '#c62828' : '#2e7d32';
          
            // 모든 경로의 좌표를 하나의 배열로 합침
            const allCoordinates = validRoutes.reduce((acc, result) => {
              const route = result.data.routes[0];
              if (route.geometry && route.geometry.coordinates) {
                // 이전 경로의 마지막 좌표와 현재 경로의 첫 좌표가 같지 않은 경우에만 null을 추가
                if (acc.length > 0 && !coordinatesAreEqual(acc[acc.length - 1], route.geometry.coordinates[0])) {
                  acc.push(null); // null을 추가하여 경로 분리
                }
                acc.push(...route.geometry.coordinates);
              }
              return acc;
            }, []);

            // 경로 데이터 업데이트
            const source = map.current.getSource('route');
            if (source) {
              source.setData({
            type: 'Feature',
            properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: allCoordinates
                }
          });
          map.current.setPaintProperty('route', 'line-color', routeColor);
            }

          // 경로 정보 업데이트
            if (transportMode === 'transit') {
          const routeInfo = {
                duration: validRoutes.reduce((total, result) => {
                  const route = result.data.routes[0];
                  return total + (route.originalRoute?.duration || 0);
                }, 0),
                distance: validRoutes.reduce((total, result) => {
                  const route = result.data.routes[0];
                  return total + (route.originalRoute?.distance || 0);
                }, 0),
                steps: validRoutes.flatMap((result, routeIndex) => {
                  const route = result.data.routes[0];
                  if (!route.originalRoute?.steps) return [];
                  
                  return route.originalRoute.steps.map((step, stepIndex) => {
                    let instruction = step.instruction;
                    if (stepIndex === 0) {
                      instruction = `${travelPlans[selectedDay].schedules[result.startIndex].name}에서 출발`;
                    } else if (stepIndex === route.originalRoute.steps.length - 1) {
                      instruction = `${travelPlans[selectedDay].schedules[result.endIndex].name}에 도착`;
                    }

                    return {
                      ...step,
                      instruction: instruction
                    };
                  });
                })
              };

              console.log('대중교통 경로 정보:', routeInfo);
              console.log('경로 단계 수:', routeInfo.steps.length);
              
              if (routeInfo.steps && routeInfo.steps.length > 0) {
                setRouteInfo(routeInfo);
              } else {
                console.warn('대중교통 경로 정보가 없습니다.');
                setRouteInfo(null);
              }
            } else {
              // 기존 Mapbox 경로 정보 업데이트 로직
              const routeInfo = {
                duration: validRoutes.reduce((total, result) => total + Math.round(result.data.routes[0].duration / 60), 0),
                distance: validRoutes.reduce((total, result) => total + Math.round(result.data.routes[0].distance / 1000 * 10) / 10, 0),
                steps: validRoutes.flatMap((result, routeIndex) => {
                  const leg = result.data.routes[0].legs[0];
              return leg.steps.map((step, stepIndex) => {
                let instruction = '';
                if (stepIndex === 0) {
                      instruction = `${travelPlans[selectedDay].schedules[result.startIndex].name}에서 출발`;
                } else if (stepIndex === leg.steps.length - 1) {
                      instruction = `${travelPlans[selectedDay].schedules[result.endIndex].name}에 도착`;
                } else {
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
          setRouteInfo(routeInfo);
        }
      })
      .catch(error => {
            console.error('Error fetching routes:', error);
          });
      } else {
        setTimeout(waitForMap, 100);
      }
    };

    waitForMap();
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
      
      // 마커가 하나일 경우 (첫 번째 일정 추가 시)
      if (markers.current.length === 1) {
        const center = markers.current[0].getLngLat();
        map.current.flyTo({
          center: [center.lng, center.lat],
          zoom: 13, // 도시 수준의 줌 레벨
          duration: 1000,
          essential: true
        });
      } else {
        // 여러 마커가 있는 경우 모든 마커가 보이도록 범위 조정
      map.current.fitBounds(bounds, { 
          padding: { top: 100, bottom: 100, left: 100, right: 100 },
          duration: 1000,
          maxZoom: 15 // 최대 줌 레벨 제한
      });
      }
    }
  }, [travelPlans, selectedDay, showAllMarkers]);

  // 좌표가 동일한지 확인하는 헬퍼 함수 추가
  const coordinatesAreEqual = (coord1, coord2) => {
    if (!coord1 || !coord2) return false;
    return coord1[0] === coord2[0] && coord1[1] === coord2[1];
  };

  const handleRouteClick = async () => {
    if (!startLocation || !endLocation) {
      console.error('출발지와 도착지를 모두 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setRouteInfo(null);

    try {
      const start = [startLocation.lng, startLocation.lat];
      const end = [endLocation.lng, endLocation.lat];

      let routeData;
      if (isJapanLocation(start) && isJapanLocation(end)) {
        routeData = await getNavitimeTransitRoute(start, end);
      } else {
        const googleRoute = await getTransitRoute(start, end);
        routeData = convertGoogleRouteToMapbox(googleRoute);
      }

      if (!routeData) {
        console.error('경로를 찾을 수 없습니다.');
        return;
      }

      setRouteInfo(routeData);
      setRouteGeometry(routeData.geometry);
    } catch (error) {
      console.error('경로 검색 중 오류 발생:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (location, type) => {
    if (!location) {
      console.error('선택된 위치 정보가 없습니다.');
      return;
    }

    const coordinates = location.center || [location.lng, location.lat];
    const locationInfo = {
      lng: coordinates[0],
      lat: coordinates[1],
      name: location.place_name || location.text || ''
    };

    if (type === 'start') {
      setStartLocation(locationInfo);
    } else {
      setEndLocation(locationInfo);
    }
  };

  const handleMapClick = (event) => {
    if (!isSelectingLocation) return;

    const coordinates = event.lngLat;
    const locationInfo = {
      lng: coordinates.lng,
      lat: coordinates.lat,
      name: `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`
    };

    if (selectingLocationType === 'start') {
      setStartLocation(locationInfo);
    } else {
      setEndLocation(locationInfo);
    }

    setIsSelectingLocation(false);
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
          onClick={() => setTransportMode('walking')}
          variant={transportMode === 'walking' ? 'contained' : 'outlined'}
          title="도보"
        >
          <DirectionsWalkIcon />
        </Button>
        <Button
          onClick={() => setTransportMode('transit')}
          variant={transportMode === 'transit' ? 'contained' : 'outlined'}
          title="대중교통"
        >
          <TrainIcon />
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
              {transportMode === 'driving' ? '자동차' : transportMode === 'walking' ? '도보' : '대중교통'} 경로 정보
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
                  {step.mode === 'driving' ? <DirectionsCarIcon color="primary" /> : 
                   step.mode === 'walking' ? <DirectionsWalkIcon color="error" /> : 
                   <DirectionsBusIcon color="info" />}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                      {step.instruction || ''}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                      {step.distance > 0 ? `${step.distance}km` : ''} 
                      {step.duration > 0 ? ` • 약 ${step.duration}분` : ''}
                    </Typography>
                      {step.mode === 'transit' && step.details && (
                        <Box sx={{ mt: 1 }}>
                          {step.details.line_name && (
                            <Typography variant="body2" color="text.secondary">
                              노선: {String(step.details.line_name)}
                            </Typography>
                          )}
                          {(step.details.platform || step.details.departure_platform) && (
                            <Typography variant="body2" color="text.secondary">
                              승강장: {String(step.details.platform || step.details.departure_platform)}
                            </Typography>
                          )}
                          {step.from_time && step.to_time && (
                            <Typography variant="body2" color="text.secondary">
                              시간: {String(step.from_time)} → {String(step.to_time)}
                            </Typography>
                          )}
                          {step.details.fare && (
                            <Typography variant="body2" color="text.secondary">
                              요금: {String(step.details.fare)}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
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