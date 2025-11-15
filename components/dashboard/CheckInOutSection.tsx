import React, { useState, useEffect } from 'react';
import CheckInDebugPanel from './CheckInDebugPanel';
import { useSelector } from 'react-redux';
import { 
    useGetLocationQuery, 
    useGetLocationsQuery, 
    useGetCheckInStatusQuery,
    useCreateCheckInMutation,
    useCheckOutMutation
} from '../../lib/api';
import { Location, CheckInStatus } from '../../lib/api';
import { RootState } from '../../lib/store';
import { useParams } from 'next/navigation';
import { Button, Box, Typography, Paper, Select, MenuItem, FormControl, InputLabel, TextField, Alert, CircularProgress } from '@mui/material';

const CheckInOutSection: React.FC = () => {
    const params = useParams();
    const cycleId = params?.cycleId as string;
    const { data: locations, isLoading: locationsLoading } = useGetLocationsQuery();
    const { data: checkInStatus, isLoading: statusLoading, refetch: refetchStatus } = useGetCheckInStatusQuery();
    const [createCheckIn, { isLoading: checkingIn }] = useCreateCheckInMutation();
    const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();
    
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const user = useSelector((state: RootState) => state.auth.user);
    const isHourlyUser = user?.role === 'hourly' || user?.role === 'admin';

    // Get user's current location
    // Set mock coordinates for testing purposes
    const setMockCoordinates = (latitude: number, longitude: number) => {
        setCoordinates({ latitude, longitude });
        // Clear any previous location errors
        setLocationError(null);
    };

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            setLocationError(null);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setCoordinates({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    setLocationError(`Error getting location: ${error.message}`);
                },
                { enableHighAccuracy: true }
            );
        } else {
            setLocationError('Geolocation is not supported by this browser');
        }
    };

    useEffect(() => {
        if (isHourlyUser) {
            getCurrentLocation();
        }
    }, [isHourlyUser]);

    const handleCheckIn = async () => {
        if (!coordinates || !selectedLocation || !cycleId) {
            setLocationError('Location, cycle, and check-in point are required');
            return;
        }

        try {
            await createCheckIn({
                cycleId: cycleId as string,
                locationId: selectedLocation,
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                notes: notes || undefined
            }).unwrap();
            
            setSuccessMessage('Successfully checked in!');
            setNotes('');
            refetchStatus();
            
            // Clear success message after 5 seconds
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (error) {
            setLocationError('Failed to check in. You may be too far from the specified location.');
        }
    };

    const handleCheckOut = async () => {
        if (!coordinates || !checkInStatus?.checkIn?.id) {
            setLocationError('Location is required for check-out');
            return;
        }

        try {
            await checkOut({
                checkInId: checkInStatus.checkIn.id,
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                notes: notes || undefined
            }).unwrap();
            
            setSuccessMessage('Successfully checked out!');
            setNotes('');
            refetchStatus();
            
            // Clear success message after 5 seconds
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (error) {
            setLocationError('Failed to check out. You may be too far from the check-in location.');
        }
    };

    if (!isHourlyUser) {
        return null; // Don't render for non-hourly users
    }

    return (
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" component="h2" gutterBottom>
                Location Check-In/Out
            </Typography>
            
            {/* Debug panel for testing - only visible in development */}
            <CheckInDebugPanel 
                onSetLocation={setMockCoordinates} 
                visible={process.env.NODE_ENV !== 'production'} 
            />
            
            {locationError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {locationError}
                </Alert>
            )}
            
            {successMessage && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {successMessage}
                </Alert>
            )}

            <Box sx={{ mb: 2 }}>
                <Button 
                    variant="outlined" 
                    onClick={getCurrentLocation} 
                    sx={{ mr: 2 }}
                >
                    Update My Location
                </Button>
                {coordinates && (
                    <Typography variant="body2" color="text.secondary">
                        Current coordinates: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                    </Typography>
                )}
            </Box>

            {statusLoading ? (
                <CircularProgress size={24} />
            ) : checkInStatus?.active ? (
                // User is checked in, show check-out UI
                <Box sx={{ mt: 3 }}>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        You are checked in at: <strong>{checkInStatus.checkIn?.location_name}</strong> since{' '}
                        {new Date(checkInStatus.checkIn?.check_in_time || '').toLocaleString()}
                    </Typography>
                    
                    <TextField
                        label="Notes for check-out"
                        multiline
                        rows={2}
                        fullWidth
                        value={notes}
                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNotes(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleCheckOut}
                        disabled={checkingOut || !coordinates}
                    >
                        {checkingOut ? <CircularProgress size={24} /> : 'Check Out'}
                    </Button>
                </Box>
            ) : (
                // User is not checked in, show check-in UI
                <Box sx={{ mt: 3 }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Check-In Location</InputLabel>
                        <Select
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value as string)}
                            label="Check-In Location"
                        >
                            {locationsLoading ? (
                                <MenuItem disabled>Loading locations...</MenuItem>
                            ) : locations && locations.length > 0 ? (
                                locations.map((loc: Location) => (
                                    <MenuItem key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </MenuItem>
                                ))
                            ) : (
                                <MenuItem disabled>No locations available</MenuItem>
                            )}
                        </Select>
                    </FormControl>
                    
                    <TextField
                        label="Notes for check-in"
                        multiline
                        rows={2}
                        fullWidth
                        value={notes}
                        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNotes(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleCheckIn}
                        disabled={checkingIn || !selectedLocation || !coordinates}
                    >
                        {checkingIn ? <CircularProgress size={24} /> : 'Check In'}
                    </Button>
                </Box>
            )}
        </Paper>
    );
};

export default CheckInOutSection;
