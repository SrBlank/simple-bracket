import { Badge, Box, Card, Center, Group, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import classes from './bracket_view.module.css';

// --- Seeding math (mirrors the backend in bracket/logic/scheduling/elimination.py) ---

export function nextPowerOfTwo(teamCount: number): number {
  if (teamCount < 2) return 2;
  return 2 ** Math.ceil(Math.log2(teamCount));
}

export function bracketSeedingOrder(bracketSize: number): number[] {
  let order = [1];
  while (order.length < bracketSize) {
    const size = order.length * 2;
    order = order.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return order;
}

export type PreviewSlot =
  | { kind: 'team'; id: number; name: string }
  | { kind: 'bye' }
  | { kind: 'tbd' };

export type PreviewMatch = { slot1: PreviewSlot; slot2: PreviewSlot };

function resolveWinner(match: PreviewMatch): PreviewSlot {
  // A team facing a bye advances automatically, so we can show it in the next round already.
  if (match.slot1.kind === 'bye' && match.slot2.kind === 'team') return match.slot2;
  if (match.slot2.kind === 'bye' && match.slot1.kind === 'team') return match.slot1;
  if (match.slot1.kind === 'bye' && match.slot2.kind === 'bye') return { kind: 'bye' };
  return { kind: 'tbd' };
}

// Build the full bracket tree (rounds of matches) from the first-round slot layout.
export function buildRoundsFromFirstRound(firstRoundSlots: PreviewSlot[]): PreviewMatch[][] {
  if (firstRoundSlots.length < 2) return [];

  const rounds: PreviewMatch[][] = [];
  let current: PreviewMatch[] = [];
  for (let i = 0; i < firstRoundSlots.length; i += 2) {
    current.push({ slot1: firstRoundSlots[i], slot2: firstRoundSlots[i + 1] });
  }
  rounds.push(current);

  while (current.length > 1) {
    const next: PreviewMatch[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push({ slot1: resolveWinner(current[i]), slot2: resolveWinner(current[i + 1]) });
    }
    rounds.push(next);
    current = next;
  }

  return rounds;
}

// Build a bracket preview from an ordered list of team names using standard seeding.
export function buildBracketPreview(teamNames: string[]): PreviewMatch[][] {
  const teamCount = teamNames.length;
  if (teamCount < 2) return [];

  const size = nextPowerOfTwo(teamCount);
  const order = bracketSeedingOrder(size);
  const firstRound: PreviewSlot[] = order.map((seed) =>
    seed <= teamCount ? { kind: 'team', id: seed, name: teamNames[seed - 1] } : { kind: 'bye' }
  );

  return buildRoundsFromFirstRound(firstRound);
}

// --- Rendering ---

export function SlotLabel({ slot }: { slot: PreviewSlot }) {
  const { t } = useTranslation();
  if (slot.kind === 'team') {
    return (
      <Text size="sm" fw={500} lineClamp={1} className={classes.name}>
        {slot.name}
      </Text>
    );
  }
  return (
    <Text size="sm" c="dimmed" lineClamp={1} className={classes.name}>
      {slot.kind === 'bye' ? t('bye_label') : t('tbd_label')}
    </Text>
  );
}

// A single round rendered as a bracket column. Used both standalone and composed alongside an
// editable round (see the seeding page).
export function BracketRoundColumn({ matches, label }: { matches: PreviewMatch[]; label: string }) {
  return (
    <Stack justify="space-around" gap="lg" className={classes.round}>
      <Center>
        <Badge variant="light" color="gray">
          {label}
        </Badge>
      </Center>
      <Stack justify="space-around" gap="lg" style={{ flex: 1 }}>
        {matches.map((match, matchIndex) => (
          <Card key={matchIndex} withBorder radius="md" p={0} className={classes.match}>
            <Group justify="space-between" wrap="nowrap" className={classes.teamRow}>
              <SlotLabel slot={match.slot1} />
            </Group>
            <Box className={classes.divider} />
            <Group justify="space-between" wrap="nowrap" className={classes.teamRow}>
              <SlotLabel slot={match.slot2} />
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

// Label for a round given its index within the rounds array (final is always the last round).
export function roundLabel(
  t: (key: string) => string,
  roundIndex: number,
  totalRounds: number,
  labelOffset = 0
): string {
  return roundIndex === totalRounds - 1
    ? t('final_label')
    : `${t('round_label')} ${roundIndex + 1 + labelOffset}`;
}

export function BracketRoundsView({
  rounds,
  labelOffset = 0,
}: {
  rounds: PreviewMatch[][];
  labelOffset?: number;
}) {
  const { t } = useTranslation();

  return (
    <Box className={classes.bracketScroll}>
      <Group align="stretch" gap="xl" wrap="nowrap" className={classes.bracket}>
        {rounds.map((matches, roundIndex) => (
          <BracketRoundColumn
            key={roundIndex}
            matches={matches}
            label={roundLabel(t, roundIndex, rounds.length, labelOffset)}
          />
        ))}
      </Group>
    </Box>
  );
}

export function BracketPreview({ teamNames }: { teamNames: string[] }) {
  const { t } = useTranslation();
  const rounds = buildBracketPreview(teamNames);

  if (rounds.length < 1) {
    return (
      <Text c="dimmed" size="sm">
        {t('seeding_preview_empty')}
      </Text>
    );
  }

  return <BracketRoundsView rounds={rounds} />;
}
