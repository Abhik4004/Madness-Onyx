import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useWsConnect } from './lib/websocket';

function WsGate() {
  useWsConnect(); // connects WS when token is present, disconnects on logout
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WsGate />
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              fontSize: '0.875rem',
              fontFamily: 'var(--font-sans)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
