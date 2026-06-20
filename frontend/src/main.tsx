import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/dropzone/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter, Route, Routes } from 'react-router';

import i18n from '../i18n';
import { BracketSpotlight } from './components/modals/spotlight';
import HomePage from './pages';
import NotFoundPage from './pages/404';
import DashboardSchedulePage from './pages/tournaments/[id]/dashboard';
import DashboardBracketPage from './pages/tournaments/[id]/dashboard/bracket';
import DashboardNotFoundPage from './pages/tournaments/[id]/dashboard/dashboard_404';
import CourtsPresentPage from './pages/tournaments/[id]/dashboard/present/courts';
import StandingsPresentPage from './pages/tournaments/[id]/dashboard/present/standings';
import DashboardStandingsPage from './pages/tournaments/[id]/dashboard/standings';
import DashboardTeamsPage from './pages/tournaments/[id]/dashboard/teams';
import PlayersPage from './pages/tournaments/[id]/players';
import ResultsPage from './pages/tournaments/[id]/results';
import SchedulePage from './pages/tournaments/[id]/schedule';
import SeedingPage from './pages/tournaments/[id]/seeding';
import SettingsPage from './pages/tournaments/[id]/settings';
import SetupWizardPage from './pages/tournaments/[id]/setup';
import StagesPage from './pages/tournaments/[id]/stages';
import SwissTournamentPage from './pages/tournaments/[id]/stages/swiss/[stage_item_id]';
import TeamsPage from './pages/tournaments/[id]/teams';
import { ensureAutoLogin } from './services/adapter';

const theme = createTheme({
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5c5f66',
      '#373A40',
      '#2C2E33',
      '#25262b',
      '#1A1B1E',
      '#141517',
      '#101113',
    ],
  },
});

function AnalyticsScript() {
  if (import.meta.env.VITE_ANALYTICS_SCRIPT_SRC == null) {
    return null;
  }

  var script = document.createElement('script');
  script.setAttribute('async', '');
  script.setAttribute('data-domain', import.meta.env.VITE_ANALYTICS_DATA_DOMAIN);
  script.setAttribute('data-website-id', import.meta.env.VITE_ANALYTICS_DATA_WEBSITE_ID);
  script.setAttribute('src', import.meta.env.VITE_ANALYTICS_SCRIPT_SRC);
  document.head.appendChild(script);
}

// Silently authenticate as the seeded organizer before rendering, so there is no login page.
ensureAutoLogin().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <NuqsAdapter>
        <BrowserRouter>
          <I18nextProvider i18n={i18n}>
            <MantineProvider defaultColorScheme="auto" theme={theme}>
              <BracketSpotlight />
              <Notifications />
              <Routes>
                <Route index element={<HomePage />} />

                <Route path="/tournaments">
                  <Route path=":id">
                    <Route path="setup" element={<SetupWizardPage />} />
                    <Route path="seeding" element={<SeedingPage />} />
                    <Route path="players" element={<PlayersPage />} />
                    <Route path="teams" element={<TeamsPage />} />
                    <Route path="schedule" element={<SchedulePage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="results" element={<ResultsPage />} />
                    <Route path="stages">
                      <Route index element={<StagesPage />} />
                      <Route path="swiss/:stage_item_id" element={<SwissTournamentPage />} />
                    </Route>
                    <Route path="dashboard">
                      <Route index element={<DashboardSchedulePage />} />
                      <Route path="bracket" element={<DashboardBracketPage />} />
                      <Route path="teams" element={<DashboardTeamsPage />} />
                      <Route path="standings" element={<DashboardStandingsPage />} />
                      <Route path="present">
                        <Route path="courts" element={<CourtsPresentPage />} />
                        <Route path="standings" element={<StandingsPresentPage />} />
                      </Route>
                      <Route path="*" element={<DashboardNotFoundPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </MantineProvider>
          </I18nextProvider>
        </BrowserRouter>
      </NuqsAdapter>
    </StrictMode>
  );

  AnalyticsScript();
});
