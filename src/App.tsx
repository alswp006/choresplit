import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Chores from './pages/Chores';
import Members from './pages/Members';
import Report from './pages/Report';
import ReportDetail from './pages/ReportDetail';
import Settle from './pages/Settle';
import Streak from './pages/Streak';
import Settings from './pages/Settings';
import { AppStateProvider } from './lib/store';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

export default function App() {
  return (
    <AppStateProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/chores" element={<Chores />} />
        <Route path="/members" element={<Members />} />
        <Route path="/report" element={<Report />} />
        <Route path="/report/detail" element={<ReportDetail />} />
        <Route path="/settle" element={<Settle />} />
        <Route path="/streak" element={<Streak />} />
        <Route path="/settings" element={<Settings />} />
        {DevTdsGallery && (
          <Route
            path="/__tds-gallery"
            element={
              <Suspense fallback={null}>
                <DevTdsGallery />
              </Suspense>
            }
          />
        )}
      </Routes>
    </AppStateProvider>
  );
}
