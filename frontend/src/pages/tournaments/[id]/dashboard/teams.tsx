import { Card, Center, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { AiOutlineHourglass } from '@react-icons/all-files/ai/AiOutlineHourglass';
import React from 'react';

import { DashboardFooter } from '@components/dashboard/footer';
import { DoubleHeader, getTournamentHeadTitle } from '@components/dashboard/layout';
import { NoContent } from '@components/no_content/empty_table_info';
import { TableSkeletonTwoColumns } from '@components/utils/skeletons';
import { setTitle } from '@components/utils/util';
import { FullTeamWithPlayers } from '@openapi';
import { getTeamsLive } from '@services/adapter';
import { getTournamentResponseByEndpointName } from '@services/dashboard';

export default function DashboardTeamsPage() {
  const tournamentDataFull = getTournamentResponseByEndpointName();
  const tournamentValid = !React.isValidElement(tournamentDataFull);

  const swrTeamsResponse = getTeamsLive(tournamentValid ? tournamentDataFull.id : null);

  if (!tournamentValid) {
    return tournamentDataFull;
  }

  setTitle(getTournamentHeadTitle(tournamentDataFull));

  if (swrTeamsResponse.isLoading) {
    return <TableSkeletonTwoColumns />;
  }

  const teams: FullTeamWithPlayers[] = (swrTeamsResponse.data?.data?.teams ?? [])
    .slice()
    .sort((a: FullTeamWithPlayers, b: FullTeamWithPlayers) => (a.name > b.name ? 1 : -1));

  return (
    <>
      <DoubleHeader tournamentData={tournamentDataFull} />
      <Center>
        <Stack style={{ width: '100%', maxWidth: '60rem' }} px="1rem" gap="md">
          <Title order={3}>Teams</Title>
          {teams.length < 1 ? (
            <NoContent
              title="No teams yet"
              description="The organizer hasn't added teams yet. Check back soon."
              icon={<AiOutlineHourglass />}
            />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {teams.map((team) => (
                <Card key={team.id} withBorder radius="md" p="md">
                  <Text fw={700} size="lg" lineClamp={1}>
                    {team.name}
                  </Text>
                  {team.players.length > 0 ? (
                    <Stack gap={2} mt={4}>
                      {team.players.map((player) => (
                        <Text key={player.id} size="sm" c="dimmed" lineClamp={1}>
                          {player.name}
                        </Text>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed" mt={4} fs="italic">
                      No players listed
                    </Text>
                  )}
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Center>
      <DashboardFooter />
    </>
  );
}
