import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, Alert } from '@mui/material';
import { Location, useGetLocationsQuery } from '../../lib/api';

interface DebugPanelProps {
  onSetLocation?: (lat: number, lng: number) => void;
  visible: boolean;
}

/**
 * A debugging panel for the check-in feature that allows setting mock coordinates
 * and displays available check-in locations for testing.
 * Only visible in development mode.
 */
const CheckInDebugPanel: React.FC<DebugPanelProps> = ({ onSetLocation, visible }) => {
  const { data: locations } = useGetLocationsQuery();
  const [showPanel, setShowPanel] = useState<boolean>(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  
  // Don't render in production or if not visible
  if (process.env.NODE_ENV === 'production' || !visible) {
    return null;
  }

  const togglePanel = () => {
    setShowPanel(prev => !prev);
  };

  const mockLocationNearby = (location: Location) => {
    if (!onSetLocation) return;
    
    // Create coordinates that are within the location's radius
    // This adds a small offset to the location coordinates (approximately 50-100 meters)
    const smallLatOffset = 0.0005 * (Math.random() > 0.5 ? 1 : -1);
    const smallLngOffset = 0.0005 * (Math.random() > 0.5 ? 1 : -1);
    
    const nearbyLat = location.latitude + smallLatOffset;
    const nearbyLng = location.longitude + smallLngOffset;
    
    onSetLocation(nearbyLat, nearbyLng);
    setDebugMessage(`Set mock location near ${location.name}: ${nearbyLat.toFixed(6)}, ${nearbyLng.toFixed(6)}`);
    
    // Clear message after 3 seconds
    setTimeout(() => setDebugMessage(null), 3000);
  };

  const mockLocationFarAway = (location: Location) => {
    if (!onSetLocation) return;
    
    // Create coordinates that are outside the location's radius
    // This adds a large offset to the location coordinates (approximately 1-2 km)
    const largeLatOffset = 0.01 * (Math.random() > 0.5 ? 1 : -1);
    const largeLngOffset = 0.01 * (Math.random() > 0.5 ? 1 : -1);
    
    const farLat = location.latitude + largeLatOffset;
    const farLng = location.longitude + largeLngOffset;
    
    onSetLocation(farLat, farLng);
    setDebugMessage(`Set mock location FAR from ${location.name}: ${farLat.toFixed(6)}, ${farLng.toFixed(6)}`);
    
    // Clear message after 3 seconds
    setTimeout(() => setDebugMessage(null), 3000);
  };

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Button 
        variant="outlined" 
        color="warning" 
        size="small"
        onClick={togglePanel}
        sx={{ mb: 1 }}
      >
        {showPanel ? 'Hide Debug Panel' : 'Show Debug Panel'}
      </Button>
      
      {showPanel && (
        <Paper sx={{ p: 2, border: '1px dashed orange' }}>
          <Typography variant="h6" gutterBottom>Check-In Debug Panel</Typography>
          
          {debugMessage && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {debugMessage}
            </Alert>
          )}

          <Typography variant="subtitle2" gutterBottom>Available Check-In Locations:</Typography>
          
          {!locations || locations.length === 0 ? (
            <Typography variant="body2">No locations found</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {locations.map((loc: Location) => (
                <Box key={loc.id} sx={{ border: '1px solid #eee', p: 1 }}>
                  <Typography variant="body2"><strong>{loc.name}</strong></Typography>
                  <Typography variant="body2" color="text.secondary">
                    Coordinates: {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Radius: {loc.radius} meters
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="success"
                      onClick={() => mockLocationNearby(loc)}
                    >
                      Mock Nearby
                    </Button>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="error"
                      onClick={() => mockLocationFarAway(loc)}
                    >
                      Mock Far Away
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default CheckInDebugPanel;
