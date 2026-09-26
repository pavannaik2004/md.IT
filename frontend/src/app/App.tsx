import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { MissingPage } from './MissingPage';
import { ProjectList } from './ProjectList';
import { requestPersistentStorage } from './storage';
import { useApplyTheme } from './theme';

export function App() {
  useApplyTheme();
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<ProjectList />} />
      <Route path="*" element={<MissingPage title="This page doesn’t exist" text="Check the address, or go back to your projects." />} />
    </Routes>
  );
}
