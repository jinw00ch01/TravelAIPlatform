import React, { useState, useEffect } from 'react';
import { TextField, List, ListItem, ListItemText, CircularProgress, Typography, Box } from '@mui/material';
import debounce from 'lodash/debounce';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const SCRIPT_ID = 'google-maps-script';

const SearchPopup = ({ onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const [geocoder, setGeocoder] = useState(null);

  useEffect(() => {
    let isSubscribed = true;
    let mapInstance = null;
    let mapDiv = null;

    const loadGoogleMapsScript = () => {
      return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
          console.log('Google Maps API already loaded');
          resolve(window.google.maps);
          return;
        }

        let script = document.getElementById(SCRIPT_ID);
        
        if (!script) {
          console.log('Loading Google Maps API script...');
          script = document.createElement('script');
          script.id = SCRIPT_ID;
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=ko&region=kr&loading=async`;
          script.async = true;
          
          script.onload = () => {
            console.log('Google Maps API script loaded');
            if (window.google && window.google.maps) {
              resolve(window.google.maps);
            } else {
              console.error('Google Maps API not properly initialized');
              reject(new Error('Google Maps API가 올바르게 로드되지 않았습니다.'));
            }
          };

          script.onerror = (error) => {
            console.error('Failed to load Google Maps API:', error);
            reject(new Error('Google Maps API를 로드할 수 없습니다.'));
          };

          document.head.appendChild(script);
        } else {
          console.log('Waiting for existing Google Maps API script to initialize...');
          const checkGoogleMaps = setInterval(() => {
            if (window.google && window.google.maps) {
              console.log('Existing Google Maps API script initialized');
              clearInterval(checkGoogleMaps);
              resolve(window.google.maps);
            }
          }, 100);

          setTimeout(() => {
            clearInterval(checkGoogleMaps);
            console.error('Google Maps API initialization timeout');
            reject(new Error('Google Maps API 로드 타임아웃'));
          }, 10000);
        }
      });
    };

    const initializeServices = async () => {
      try {
        console.log('Initializing Google Maps services...');
        const maps = await loadGoogleMapsScript();
        
        if (!isSubscribed) return;

        if (mapInstance) {
          console.log('Cleaning up previous map instance');
          mapDiv.remove();
          mapInstance = null;
        }

        console.log('Creating new map instance');
        mapDiv = document.createElement('div');
        mapDiv.style.visibility = 'hidden';
        mapDiv.style.position = 'absolute';
        mapDiv.style.left = '-9999px';
        document.body.appendChild(mapDiv);

        mapInstance = new maps.Map(mapDiv, {
          center: { lat: 37.5665, lng: 126.9780 },
          zoom: 15
        });

        if (isSubscribed) {
          console.log('Initializing Places Service and Geocoder');
          setPlacesService(new maps.places.PlacesService(mapInstance));
          setGeocoder(new maps.Geocoder());
        }
      } catch (err) {
        console.error('Service initialization failed:', err);
        if (isSubscribed) {
          setError('Google Maps 서비스를 초기화하는데 실패했습니다. API 키를 확인해주세요.');
        }
      }
    };

    initializeServices();

    return () => {
      isSubscribed = false;
      if (mapDiv) {
        mapDiv.remove();
      }
      setPlacesService(null);
      setGeocoder(null);
    };
  }, []);

  const handleSearch = debounce(async (query) => {
    if (!query.trim() || !placesService || !geocoder) return;

    setLoading(true);
    setError(null);

    try {
      const request = {
        query: query,
        language: 'ko',
        region: 'kr'
      };

      placesService.textSearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          const processedResults = results.map(result => ({
            name: result.name,
            address: result.formatted_address,
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
            category: result.types.join(', ')
          }));
          setResults(processedResults);
          console.log('최종 결과:', processedResults);
        } else {
          setError('검색 결과를 찾을 수 없습니다.');
          setResults([]);
        }
        setLoading(false);
      });
    } catch (err) {
      console.error('검색 오류:', err);
      setError('검색 중 오류가 발생했습니다.');
      setResults([]);
      setLoading(false);
    }
  }, 300);

  const handleSelect = (place) => {
    onSelect(place);
    onClose();
  };

  return (
    <Box sx={{ p: 2 }}>
      <TextField
        fullWidth
        placeholder="장소를 검색하세요"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          handleSearch(e.target.value);
        }}
        sx={{ mb: 2 }}
      />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ my: 2 }}>
          {error}
        </Typography>
      )}

      <List>
        {results.map((place, index) => (
          <ListItem
            key={`${place.name}-${index}`}
            onClick={() => handleSelect(place)}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ListItemText
              primary={place.name}
              secondary={
                <React.Fragment>
                  <Typography component="span" variant="body2" color="text.primary">
                    {place.address}
                  </Typography>
                  <br />
                  <Typography component="span" variant="body2" color="text.secondary">
                    {place.category}
                  </Typography>
                </React.Fragment>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default SearchPopup; 