import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ApiClientError } from '../api/client';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { Card, EmptyState, PageHeader } from '../components';
import { LangProvider, useLang } from '../i18n';
import { Login } from '../screens/Login';
import { MemberProfileScreen } from '../screens/MemberProfileScreen';
import { Members } from '../screens/Members';
import { NewMember } from '../screens/NewMember';
import { Offerings } from '../screens/Offerings';
import { Schedule } from '../screens/Schedule';
import { SECTIONS, Shell } from './Shell';
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

/** A section that later milestones build. */
function ComingSoon({ title }: { title: string }) {
  const { t } = useLang();
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState title={t('shell.soon.title')}>{t('shell.soon.body')}</EmptyState>
      </Card>
    </>
  );
}

function SignedIn() {
  const { t } = useLang();
  const built = new Set(['members', 'schedule', 'offerings']);
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/clanovi" replace />} />
        <Route path="raspored" element={<Schedule />} />
        <Route path="vrste-satova" element={<Offerings />} />
        <Route path="clanovi" element={<Members />} />
        {/* Importing a scanned form arrives with M5; until then "Novi član" is the manual form. */}
        <Route path="clanovi/novi" element={<Navigate to="/clanovi/novi/rucno" replace />} />
        <Route path="clanovi/novi/rucno" element={<NewMember />} />
        <Route path="clanovi/:id" element={<MemberProfileScreen />} />
        {SECTIONS.filter((s) => !built.has(s.id)).map((s) => (
          <Route key={s.id} path={s.path} element={<ComingSoon title={t(s.label)} />} />
        ))}
        <Route path="*" element={<Navigate to="/clanovi" replace />} />
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
        <BrowserRouter>
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
