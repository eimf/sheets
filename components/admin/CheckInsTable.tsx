import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Typography, 
  Box,
  CircularProgress,
  TablePagination,
  Chip
} from '@mui/material';
import { useGetCheckInsQuery } from '../../lib/api';
import type { CheckIn } from '../../lib/api';

interface CheckInsTableProps {
  cycleId?: string;
}

const CheckInsTable: React.FC<CheckInsTableProps> = ({ cycleId }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Query all check-ins, optionally filtered by cycle
  const { data: checkIns, isLoading, error } = useGetCheckInsQuery(cycleId);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Format timestamp to readable date/time
  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Calculate duration between check-in and check-out
  const calculateDuration = (checkIn: CheckIn) => {
    if (!checkIn.check_out_time) return 'Not checked out';
    
    const start = new Date(checkIn.check_in_time).getTime();
    const end = new Date(checkIn.check_out_time).getTime();
    const diffMs = end - start;
    
    // Format as hours and minutes
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return <CircularProgress />;
  }

  if (error) {
    return (
      <Typography color="error">
        Error loading check-ins data
      </Typography>
    );
  }

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Employee Check-Ins
      </Typography>
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader aria-label="check-ins table">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Check-In Time</TableCell>
                <TableCell>Check-Out Time</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {checkIns && checkIns.length > 0 ? (
                checkIns
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((checkIn: CheckIn) => (
                    <TableRow key={checkIn.id} hover>
                      <TableCell>{checkIn.user_name || `User ${checkIn.user_id}`}</TableCell>
                      <TableCell>{checkIn.location_name || `Location ${checkIn.location_id}`}</TableCell>
                      <TableCell>{formatDateTime(checkIn.check_in_time)}</TableCell>
                      <TableCell>
                        {checkIn.check_out_time 
                          ? formatDateTime(checkIn.check_out_time)
                          : 'Not checked out'
                        }
                      </TableCell>
                      <TableCell>{calculateDuration(checkIn)}</TableCell>
                      <TableCell>
                        {checkIn.check_out_time ? (
                          <Chip size="small" label="Completed" color="success" />
                        ) : (
                          <Chip size="small" label="Active" color="primary" />
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: '200px', overflowWrap: 'break-word' }}>
                        {checkIn.notes || '-'}
                      </TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No check-ins found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {checkIns && checkIns.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={checkIns.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}
      </Paper>
    </Box>
  );
};

export default CheckInsTable;
