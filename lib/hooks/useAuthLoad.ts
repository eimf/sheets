'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { loadFromStorage } from '../slices/authSlice';

export const useAuthLoad = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);
};
