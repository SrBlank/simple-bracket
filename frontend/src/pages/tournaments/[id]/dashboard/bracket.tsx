import { Center, Group, Stack, Title } from '@mantine/core';
import { AiOutlineHourglass } from '@react-icons/all-files/ai/AiOutlineHourglass';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SingleEliminationBracket } from '@components/brackets/bracket_view';
import { FindMyMatch } from '@components/dashboard/find_my_match';
import { DashboardFooter } from '@components/dashboard/footer';
import { DoubleHeader, getTournamentHeadTitle } from '@components/dashboard/layout';
import { NoContent } from '@components/no_content/empty_table_info';
import { responseIsValid, setTitle } from '@components/utils/util';
import { MatchWithDetails, StageItemWithRounds } from '@openapi';
import { getStagesLive } from '@services/adapter';
import { getTournamentResponseByEndpointName } from '@services/dashboard';
import { getMatchLookup, getStageItemLookup, getTeamsLookup } from '@services/lookups';

export default function DashboardBracketPage() {
  const { t } = useTranslation();
  const tournamentDataFull = getTournamentResponseByEndpointName();
  const tournamentValid = !React.isValidElement(tournamentDataFull);

  const swrStagesResponse = getStagesLive(tournamentValid ? tournamentDataFull.id : null);
  const teamsLookup = getTeamsLookup(tournamentValid ? tournamentDataFull.id : null);

  if (!tournamentValid) {
    return tournamentDataFull;
  }

  setTitle(getTournamentHeadTitle(tournamentDataFull));

  if (!responseIsValid(swrStagesResponse)) return null;

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const matchesLookup = getMatchLookup(swrStagesResponse);
  const showPlayerNames = tournamentDataFull.show_player_names;
  const isDynamic = tournamentDataFull.scheduling_mode === 'DYNAMIC';
  const allMatches: MatchWithDetails[] = Object.values(matchesLookup).map((x: any) => x.match);

  const eliminationStageItems: StageItemWithRounds[] = (swrStagesResponse.data?.data ?? [])
    .flatMap((stage: any) => stage.stage_items)
    .filter((stageItem: StageItemWithRounds) => stageItem.type === 'SINGLE_ELIMINATION');

  return (
    <>
      <DoubleHeader tournamentData={tournamentDataFull} />
      <Center>
        <Stack style={{ width: '100%' }} px="1rem" gap="xl">
          {eliminationStageItems.length > 0 && (
            <FindMyMatch
              matches={allMatches}
              teamsLookup={teamsLookup}
              stageItemsLookup={stageItemsLookup}
              matchesLookup={matchesLookup}
              isDynamic={isDynamic}
            />
          )}
          {eliminationStageItems.length < 1 ? (
            <NoContent
              title="No bracket yet"
              description="The organizer hasn't generated the bracket yet. Check back soon."
              icon={<AiOutlineHourglass />}
            />
          ) : (
            eliminationStageItems.map((stageItem) => (
              <Stack key={stageItem.id} gap="sm">
                <Group>
                  <Title order={3}>{stageItem.name}</Title>
                </Group>
                <SingleEliminationBracket
                  stageItem={stageItem}
                  stageItemsLookup={stageItemsLookup}
                  matchesLookup={matchesLookup}
                  teamsLookup={teamsLookup}
                  showPlayerNames={showPlayerNames}
                  zoomable
                />
              </Stack>
            ))
          )}
        </Stack>
      </Center>
      <DashboardFooter />
    </>
  );
}
