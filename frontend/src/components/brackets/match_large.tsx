import { Card, Center, Grid, Text } from '@mantine/core';

import { Time } from '@components/utils/datetime';
import { formatStageItemInput } from '@components/utils/stage_item_input';
import { MatchWithDetails } from '@openapi';

function teamPlayers(input: any, teamsLookup: any, showPlayerNames: boolean): string {
  if (!showPlayerNames || teamsLookup == null || input?.team_id == null) return '';
  const players = teamsLookup[input.team_id]?.players ?? [];
  return players.map((p: any) => p.name).join(' & ');
}

export default function MatchLarge({
  match,
  stageItemsLookup,
  teamsLookup = null,
  showPlayerNames = false,
  showTime = true,
}: {
  match: MatchWithDetails;
  stageItemsLookup: any;
  teamsLookup?: any;
  showPlayerNames?: boolean;
  showTime?: boolean;
}) {
  const players1 = teamPlayers(match.stage_item_input1, teamsLookup, showPlayerNames);
  const players2 = teamPlayers(match.stage_item_input2, teamsLookup, showPlayerNames);

  const bracket = (
    <div>
      <Card padding="md" shadow="sm" radius="lg" withBorder>
        <Grid align="center">
          <Grid.Col span={{ sm: showTime ? 9 : 12 }}>
            <Text lineClamp={1} inherit>
              {formatStageItemInput(match.stage_item_input1, stageItemsLookup) || <i>N/A</i>}
            </Text>
            {players1 !== '' && (
              <Text lineClamp={1} c="dimmed" style={{ fontSize: '0.6em' }}>
                {players1}
              </Text>
            )}
            <Text lineClamp={1} inherit>
              {formatStageItemInput(match.stage_item_input2, stageItemsLookup) || <i>N/A</i>}
            </Text>
            {players2 !== '' && (
              <Text lineClamp={1} c="dimmed" style={{ fontSize: '0.6em' }}>
                {players2}
              </Text>
            )}
          </Grid.Col>
          {showTime && (
            <Grid.Col span={{ sm: 3 }}>
              <Center>
                <Time datetime={match.start_time || ''} />
              </Center>
            </Grid.Col>
          )}
        </Grid>
      </Card>
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        padding: '0px',
        fontSize: '1.8rem',
      }}
    >
      {bracket}
    </div>
  );
}
