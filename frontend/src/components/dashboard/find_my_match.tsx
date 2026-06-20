import { Badge, Card, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { MatchWithDetails } from '@openapi';

interface TeamEntry {
  id: number;
  name: string;
  players: string[];
}

function teamSide(match: MatchWithDetails, teamId: number): 1 | 2 | null {
  if ((match.stage_item_input1 as any)?.team_id === teamId) return 1;
  if ((match.stage_item_input2 as any)?.team_id === teamId) return 2;
  return null;
}

// The team's earliest match that isn't finished yet (their "next up").
function findNextMatch(matches: MatchWithDetails[], teamId: number): MatchWithDetails | null {
  const upcoming = matches
    .filter((m) => m.status !== 'FINISHED' && teamSide(m, teamId) != null)
    .sort((a, b) => a.id - b.id);
  return upcoming[0] ?? null;
}

export function FindMyMatch({
  matches,
  teamsLookup,
  stageItemsLookup,
  matchesLookup,
  isDynamic,
}: {
  matches: MatchWithDetails[];
  teamsLookup: any;
  stageItemsLookup: any;
  matchesLookup: any;
  isDynamic: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  if (teamsLookup == null) return null;

  const teams: TeamEntry[] = Object.values(teamsLookup).map((team: any) => ({
    id: team.id,
    name: team.name,
    players: (team.players ?? []).map((p: any) => p.name),
  }));

  const trimmed = query.trim().toLowerCase();
  const results =
    trimmed.length < 1
      ? []
      : teams
          .filter(
            (team) =>
              team.name.toLowerCase().includes(trimmed) ||
              team.players.some((p) => p.toLowerCase().includes(trimmed))
          )
          .slice(0, 6);

  // The queue of ready-but-unplaced matches, in play order — used for "how many matches away".
  const queue = matches.filter((m) => m.status === 'QUEUED').sort((a, b) => a.id - b.id);

  const statusForMatch = (match: MatchWithDetails | null) => {
    if (match == null) {
      return { color: 'gray', label: 'No upcoming match — eliminated or finished' };
    }
    if (match.status === 'PLAYING' || match.court != null) {
      return {
        color: 'grape',
        label: match.court != null ? `Playing now — Court ${match.court.name}` : 'Playing now',
      };
    }
    if (isDynamic && match.status === 'QUEUED') {
      const pos = queue.findIndex((m) => m.id === match.id);
      if (pos === 0) return { color: 'blue', label: 'You are next — head to a court' };
      if (pos > 0)
        return {
          color: 'blue',
          label: `Up next — about ${pos} match${pos === 1 ? '' : 'es'} away`,
        };
      return { color: 'blue', label: 'Up next' };
    }
    return { color: 'gray', label: 'Waiting for an earlier match to finish' };
  };

  return (
    <Card withBorder radius="md" p="md">
      <TextInput
        size="md"
        leftSection={<IconSearch size={18} />}
        placeholder="Find your match — type your name or team"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      {trimmed.length > 0 && (
        <Stack gap="xs" mt="md">
          {results.length < 1 ? (
            <Text size="sm" c="dimmed">
              No team or player found for “{query}”.
            </Text>
          ) : (
            results.map((team) => {
              const match = findNextMatch(matches, team.id);
              const status = statusForMatch(match);
              const side = match != null ? teamSide(match, team.id) : null;
              const opponent =
                match == null
                  ? null
                  : side === 1
                    ? formatMatchInput2(t, stageItemsLookup, matchesLookup, match)
                    : formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
              return (
                <Card key={team.id} withBorder radius="md" p="sm">
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ minWidth: 0 }}>
                      <Text fw={700} lineClamp={1}>
                        {team.name}
                      </Text>
                      {team.players.length > 0 && (
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {team.players.join(' & ')}
                        </Text>
                      )}
                      {opponent != null && (
                        <Text size="sm" lineClamp={1}>
                          vs {opponent}
                        </Text>
                      )}
                    </div>
                    <Badge color={status.color} variant="filled" size="lg">
                      {status.label}
                    </Badge>
                  </Group>
                </Card>
              );
            })
          )}
        </Stack>
      )}
    </Card>
  );
}
