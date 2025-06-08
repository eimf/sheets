import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ServicesState {
  currentCycle: {
    startDate: string;
    endDate: string;
  };
  searchTerm: string;
  filterType: string;
}

// Helper function to get current bi-weekly cycle
const getCurrentCycle = () => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  
  // Find the Monday of this week
  const mondayOfThisWeek = new Date(today);
  mondayOfThisWeek.setDate(today.getDate() + daysToMonday);
  
  // Determine if we're in the first or second week of the bi-weekly cycle
  const weekNumber = Math.floor(mondayOfThisWeek.getTime() / (1000 * 60 * 60 * 24 * 7));
  const isFirstWeek = weekNumber % 2 === 0;
  
  let startDate: Date;
  if (isFirstWeek) {
    startDate = new Date(mondayOfThisWeek);
  } else {
    startDate = new Date(mondayOfThisWeek);
    startDate.setDate(startDate.getDate() - 7);
  }
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13); // 14 days - 1
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

const initialState: ServicesState = {
  currentCycle: getCurrentCycle(),
  searchTerm: '',
  filterType: 'all',
};

const servicesSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {
    setCycle: (state, action: PayloadAction<{ startDate: string; endDate: string }>) => {
      state.currentCycle = action.payload;
    },
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
    setFilterType: (state, action: PayloadAction<string>) => {
      state.filterType = action.payload;
    },
    goToPreviousCycle: (state) => {
      const currentStart = new Date(state.currentCycle.startDate);
      const newStart = new Date(currentStart);
      newStart.setDate(currentStart.getDate() - 14);
      
      const newEnd = new Date(newStart);
      newEnd.setDate(newStart.getDate() + 13);
      
      state.currentCycle = {
        startDate: newStart.toISOString().split('T')[0],
        endDate: newEnd.toISOString().split('T')[0],
      };
    },
    goToNextCycle: (state) => {
      const currentStart = new Date(state.currentCycle.startDate);
      const newStart = new Date(currentStart);
      newStart.setDate(currentStart.getDate() + 14);
      
      const newEnd = new Date(newStart);
      newEnd.setDate(newStart.getDate() + 13);
      
      state.currentCycle = {
        startDate: newStart.toISOString().split('T')[0],
        endDate: newEnd.toISOString().split('T')[0],
      };
    },
    goToCurrentCycle: (state) => {
      state.currentCycle = getCurrentCycle();
    },
  },
});

export const { 
  setCycle, 
  setSearchTerm, 
  setFilterType, 
  goToPreviousCycle, 
  goToNextCycle, 
  goToCurrentCycle 
} = servicesSlice.actions;

export default servicesSlice.reducer;