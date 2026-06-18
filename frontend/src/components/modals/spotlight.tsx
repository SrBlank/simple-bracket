import { rem } from '@mantine/core';
import { Spotlight, SpotlightActionData } from '@mantine/spotlight';
import {
  IconBrackets,
  IconCalendarEvent,
  IconHome,
  IconSearch,
  IconSettings,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { getTournamentIdFromRouter } from '@components/utils/util';

export function BracketSpotlight() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: tournamentId } = getTournamentIdFromRouter();

  const actions: SpotlightActionData[] = [
    {
      id: 'home',
      title: t('home_title'),
      description: t('home_spotlight_description'),
      onClick: () => navigate('/'),
      leftSection: <IconHome size="1.2rem" />,
    },
  ];

  const tournamentActions: SpotlightActionData[] = [
    {
      id: 'results',
      title: t('results_title'),
      description: t('results_spotlight_description'),
      onClick: () => navigate(`/tournaments/${tournamentId}/results`),
      leftSection: <IconBrackets size="1.2rem" />,
    },
    {
      id: 'planning',
      title: t('planning_title'),
      description: t('planning_spotlight_description'),
      onClick: () => navigate(`/tournaments/${tournamentId}/schedule`),
      leftSection: <IconCalendarEvent size="1.2rem" />,
    },
    {
      id: 'teams',
      title: t('teams_title'),
      description: t('teams_spotlight_description'),
      onClick: () => navigate(`/tournaments/${tournamentId}/teams`),
      leftSection: <IconUsers size="1.2rem" />,
    },
    {
      id: 'players',
      title: t('players_title'),
      description: t('players_spotlight_description'),
      onClick: () => navigate(`/tournaments/${tournamentId}/players`),
      leftSection: <IconUsers size="1.2rem" />,
    },
    {
      id: 'stages',
      title: t('stage_title'),
      description: t('stage_spotlight_description'),
      onClick: () => navigate(`/tournaments/${tournamentId}/stages`),
      leftSection: <IconTrophy size="1.2rem" />,
    },
    {
      id: 'tournament settings',
      title: t('tournament_setting_title'),
      description: t('tournament_setting_spotlight_description'),
      onClick: () => navigate(`/tournaments/${tournamentId}/settings`),
      leftSection: <IconSettings size="1.2rem" />,
    },
  ];
  const allActions = tournamentId >= 0 ? actions.concat(tournamentActions) : actions;
  return (
    <Spotlight
      actions={allActions}
      shortcut={['mod + k', 'mod + y', '/']}
      nothingFound={t('nothing_found_placeholder')}
      highlightQuery
      searchProps={{
        leftSection: <IconSearch style={{ width: rem(20), height: rem(20) }} stroke={1.5} />,
        placeholder: t('search_placeholder'),
      }}
    />
  );
}
