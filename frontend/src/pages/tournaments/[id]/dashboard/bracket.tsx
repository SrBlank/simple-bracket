import { Center, Group, Stack, Title } from '@mantine/core';
import { AiOutlineHourglass } from '@react-icons/all-files/ai/AiOutlineHourglass';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SingleEliminationBracket } from '@components/brackets/bracket_view';
import { DashboardFooter } from '@components/dashboard/footer';
import { DoubleHeader, getTournamentHeadTitle } from '@components/dashboard/layout';
import { NoContent } from '@components/no_content/empty_table_info';
import { responseIsValid, setTitle } from '@components/utils/util';
import { StageItemWithRounds } from '@openapi';
import { getStagesLive } from '@services/adapter';
import { getTournamentResponseByEndpointName } from '@services/dashboard';
import { getMatchLookup, getStageItemLookup } from '@services/lookups';

export default function DashboardBracketPage() {
  const { t } = useTranslation();
  const tournamentDataFull = getTournamentResponseByEndpointName();
  const tournamentValid = !React.isValidElement(tournamentDataFull);

  const swrStagesResponse = getStagesLive(tournamentValid ? tournamentDataFull.id : null);

  if (!tournamentValid) {
    return tournamentDataFull;
  }

  setTitle(getTournamentHeadTitle(tournamentDataFull));

  if (!responseIsValid(swrStagesResponse)) return null;

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const matchesLookup = getMatchLookup(swrStagesResponse);

  const eliminationStageItems: StageItemWithRounds[] = (swrStagesResponse.data?.data ?? [])
    .flatMap((stage: any) => stage.stage_items)
    .filter((stageItem: StageItemWithRounds) => stageItem.type === 'SINGLE_ELIMINATION');

  return (
    <>
      <DoubleHeader tournamentData={tournamentDataFull} />
      <Center>
        <Stack style={{ maxWidth: '80rem', width: '100%' }} px="1rem" gap="xl">
          {eliminationStageItems.length < 1 ? (
            <NoContent
              title={t('no_bracket_title')}
              description=""
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
