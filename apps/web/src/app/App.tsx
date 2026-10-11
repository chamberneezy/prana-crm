import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ApiClientError } from '../api/client';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { LangProvider, useLang } from '../i18n';
import { ImportMember } from '../screens/ImportMember';
import { Login } from '../screens/Login';
import { MemberProfileScreen } from '../screens/MemberProfileScreen';
import { Members } from '../screens/Members';
import { NewMember } from '../screens/NewMember';
import { Offerings } from '../screens/Offerings';
import { Overview } from '../screens/Overview';
import { Payments } from '../screens/Payments';
import { Plans } from '../screens/Plans';
import { Schedule } from '../screens/Schedule';
import { Shell } from './Shell';
import { ToastProvider } from './ToastProvider';

// The component demo is a development aid; it is loaded only when opened.
const DemoPage = lazy(() => import('../demo/DemoPage').then((m) => ({ default: m.DemoPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying won't fix "not found" or "no access"; it only helps with a dropped connection.
      retry: (failures, error) => error instanceof ApiClientError && error.code === 'network' && failures < 2,
    },
  },
});

function SignedIn() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/pregled" replace />} />
        <Route path="pregled" element={<Overview />} />
        <Route path="raspored" element={<Schedule />} />
        <Route path="vrste-satova" element={<Offerings />} />
        <Route path="clanovi" element={<Members />} />
        <Route path="clanovi/novi" element={<ImportMember />} />
        <Route path="clanovi/novi/rucno" element={<NewMember />} />
        <Route path="clanovi/:id" element={<MemberProfileScreen />} />
        <Route path="karte" element={<Plans />} />
        <Route path="uplate" element={<Payments />} />
        <Route path="*" element={<Navigate to="/pregled" replace />} />
      </Route>
    </Routes>
  );
}

function Gate() {
  const { state } = useAuth();
  const { t } = useLang();
  if (state.status === 'loading') return <div aria-busy="true" aria-label={t('common.loading')} />;
  if (state.status === 'signedOut') return <Login notice={state.notice} />;
  return <SignedIn />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Routes>
            <Route
              path="/demo"
              element={
                <Suspense fallback={null}>
                  <DemoPage />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <AuthProvider>
                  <ToastProvider>
                    <Gate />
                  </ToastProvider>
                </AuthProvider>
              }
            />
          </Routes>
        </BrowserRouter>
      </LangProvider>
    </QueryClientProvider>
  );
}
