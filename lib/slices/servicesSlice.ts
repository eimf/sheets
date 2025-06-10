import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Cycle } from '../api';

interface ServicesState {
  currentCycle: Cycle | null;
  searchTerm: string;
}

const initialState: ServicesState = {
  currentCycle: null,
  searchTerm: '',
};

const servicesSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {
    setCurrentCycle: (state, action: PayloadAction<Cycle | null>) => {
      state.currentCycle = action.payload;
    },
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
  },
});

export const { setCurrentCycle, setSearchTerm } = servicesSlice.actions;

export default servicesSlice.reducer;