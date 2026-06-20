import { Grid } from '@mantine/core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import CourtsLarge, { CourtBadge } from '@components/brackets/courts_large';
import {
  TournamentLogo,
  TournamentQRCode,
  TournamentTitle,
  getTournamentHeadTitle,
} from '@components/dashboard/layout';
import { isMatchHappening, isMatchInTheFuture } from '@components/utils/match';
import { TableSkeletonTwoColumns } from '@components/utils/skeletons';
import { responseIsValid, setTitle } from '@components/utils/util';
import { Court, MatchWithDetails } from '@openapi';
import { getCourtsLive, getStagesLive } from '@services/adapter';
import { getTournamentResponseByEndpointName } from '@services/dashboard';
import { getMatchLookupByCourt, getStageItemLookup, getTeamsLookup } from '@services/lookups';

export default function CourtsPresentPage() {
  const { t } = useTranslation();
  const tournamentDataFull = getTournamentResponseByEndpointName();
  const tournamentValid = !React.isValidElement(tournamentDataFull);

  const swrCourtsResponse = getCourtsLive(tournamentValid ? tournamentDataFull.id : null);
  const swrStagesResponse = getStagesLive(tournamentValid ? tournamentDataFull.id : null);
  const teamsLookup = getTeamsLookup(tournamentValid ? tournamentDataFull.id : null);

  if (!tournamentValid) {
    return tournamentDataFull;
  }

  if (swrStagesResponse.isLoading || swrCourtsResponse.data == null || !tournamentValid) {
    return <TableSkeletonTwoColumns />;
  }

  setTitle(getTournamentHeadTitle(tournamentDataFull));

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);

  const isDynamic = tournamentDataFull.scheduling_mode === 'DYNAMIC';
  const showPlayerNames = tournamentDataFull.show_player_names;

  const courts = responseIsValid(swrCourtsResponse) ? swrCourtsResponse.data.data : [];
  const matchesByCourtId = responseIsValid(swrStagesResponse)
    ? getMatchLookupByCourt(swrStagesResponse)
    : [];

  const rows = courts.map((court: Court) => {
    const matchesForCourt = matchesByCourtId[court.id] || [];
    // In dynamic mode the lifecycle status is authoritative; in timed mode fall back to the clock.
    const activeMatch = isDynamic
      ? matchesForCourt.filter((m: MatchWithDetails) => m.status === 'PLAYING')[0]
      : matchesForCourt.filter((m: MatchWithDetails) => isMatchHappening(m))[0];
    const futureMatch = isDynamic
      ? null
      : matchesForCourt
          .filter((m: MatchWithDetails) => isMatchInTheFuture(m))
          .sort((m1: MatchWithDetails, m2: MatchWithDetails) =>
            (m1.start_time || '') > (m2.start_time || '') ? 1 : -1
          )[0];

    return (
      <CourtsLarge
        key={court.id}
        court={court}
        activeMatch={activeMatch}
        nextMatch={futureMatch}
        stageItemsLookup={stageItemsLookup}
        teamsLookup={teamsLookup}
        showPlayerNames={showPlayerNames}
        showTime={!isDynamic}
      />
    );
  });

  return (
    <>
      <Grid style={{ margin: '1rem' }} gutter="2rem">
        <Grid.Col span={{ base: 12, lg: 2 }}>
          <TournamentTitle tournamentDataFull={tournamentDataFull} />
          <TournamentLogo tournamentDataFull={tournamentDataFull} />
          <TournamentQRCode tournamentDataFull={tournamentDataFull} />
        </Grid.Col>
        <Grid.Col span="auto">
          <Grid align="center" gutter="2rem">
            <Grid.Col span={{ sm: 2 }} />
            <Grid.Col span={{ sm: 5 }}>
              <CourtBadge name={t('current_matches_badge')} color="teal" />
            </Grid.Col>
            <Grid.Col span={{ sm: 5 }}>
              <CourtBadge name={t('next_matches_badge')} color="gray" />
            </Grid.Col>
          </Grid>
          {rows}
        </Grid.Col>
      </Grid>
    </>
  );
}
