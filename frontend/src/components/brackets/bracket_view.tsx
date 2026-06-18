import { Badge, Box, Card, Center, Group, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { MatchWithDetails, StageItemWithRounds } from '@openapi';

import classes from './bracket_view.module.css';

type Side = 1 | 2;

// A side is a "bye" when its slot is an empty input that is not fed by a previous match.
function sideIsBye(match: MatchWithDetails, side: Side): boolean {
  const input: any = side === 1 ? match.stage_item_input1 : match.stage_item_input2;
  const winnerFrom =
    side === 1
      ? match.stage_item_input1_winner_from_match_id
      : match.stage_item_input2_winner_from_match_id;

  return (
    winnerFrom == null &&
    (input == null || (input.team_id == null && input.winner_from_stage_item_id == null))
  );
}

// Returns the winning side (1 or 2), or null if undecided. A team facing a bye wins
// automatically; otherwise the higher score wins.
function getWinnerSide(match: MatchWithDetails): Side | null {
  const bye1 = sideIsBye(match, 1);
  const bye2 = sideIsBye(match, 2);
  if (bye1 && !bye2) return 2;
  if (bye2 && !bye1) return 1;
  if (match.stage_item_input1_score > match.stage_item_input2_score) return 1;
  if (match.stage_item_input2_score > match.stage_item_input1_score) return 2;
  return null;
}

function BracketMatch({
  match,
  stageItemsLookup,
  matchesLookup,
}: {
  match: MatchWithDetails;
  stageItemsLookup: any;
  matchesLookup: any;
}) {
  const { t } = useTranslation();
  const winnerSide = getWinnerSide(match);

  const name1 = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
  const name2 = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);

  const row = (side: Side, name: string, score: number) => {
    const isBye = sideIsBye(match, side);
    return (
      <Group
        justify="space-between"
        wrap="nowrap"
        className={`${classes.teamRow} ${winnerSide === side ? classes.winner : ''}`}
      >
        <Text size="sm" fw={winnerSide === side ? 700 : 400} lineClamp={1} className={classes.name}>
          {isBye ? t('bye_label') : name}
        </Text>
        {!isBye && (
          <Text size="sm" fw={700} className={classes.score}>
            {score}
          </Text>
        )}
      </Group>
    );
  };

  return (
    <Card withBorder radius="md" p={0} className={classes.match}>
      {row(1, name1, match.stage_item_input1_score)}
      <Box className={classes.divider} />
      {row(2, name2, match.stage_item_input2_score)}
    </Card>
  );
}

export function SingleEliminationBracket({
  stageItem,
  stageItemsLookup,
  matchesLookup,
}: {
  stageItem: StageItemWithRounds;
  stageItemsLookup: any;
  matchesLookup: any;
}) {
  const { t } = useTranslation();
  const rounds = [...stageItem.rounds].sort((a, b) => a.id - b.id);

  return (
    <Box className={classes.bracketScroll}>
      <Group align="stretch" gap="xl" wrap="nowrap" className={classes.bracket}>
        {rounds.map((round, index) => {
          const isFinal = index === rounds.length - 1;
          const label = isFinal ? t('final_label') : `${t('round_label')} ${index + 1}`;
          return (
            <Stack key={round.id} justify="space-around" gap="lg" className={classes.round}>
              <Center>
                <Badge variant="light" color="gray">
                  {label}
                </Badge>
              </Center>
              <Stack justify="space-around" gap="lg" style={{ flex: 1 }}>
                {round.matches.map((match) => (
                  <BracketMatch
                    key={match.id}
                    match={match as MatchWithDetails}
                    stageItemsLookup={stageItemsLookup}
                    matchesLookup={matchesLookup}
                  />
                ))}
              </Stack>
            </Stack>
          );
        })}
      </Group>
    </Box>
  );
}
