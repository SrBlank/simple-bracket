import { ActionIcon, Badge, Box, Card, Center, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconMaximize, IconMinus, IconPlus, IconTrophy } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { MatchWithDetails, StageItemWithRounds } from '@openapi';

import { roundLabel } from './bracket_preview';
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

// Player names for the team in a given slot, when available and enabled.
function sidePlayers(
  match: MatchWithDetails,
  side: Side,
  teamsLookup: any,
  showPlayerNames: boolean
): string[] {
  if (!showPlayerNames || teamsLookup == null) return [];
  const input: any = side === 1 ? match.stage_item_input1 : match.stage_item_input2;
  const teamId = input?.team_id;
  if (teamId == null) return [];
  const players = teamsLookup[teamId]?.players ?? [];
  return players.map((p: any) => p.name);
}

function BracketMatch({
  match,
  stageItemsLookup,
  matchesLookup,
  teamsLookup,
  showPlayerNames,
}: {
  match: MatchWithDetails;
  stageItemsLookup: any;
  matchesLookup: any;
  teamsLookup: any;
  showPlayerNames: boolean;
}) {
  const { t } = useTranslation();
  const winnerSide = getWinnerSide(match);

  const name1 = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
  const name2 = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);

  // Show the court for matches that are assigned but not finished, so players know where to go.
  const showCourt = match.court != null && winnerSide == null;
  const isPlaying = match.status === 'PLAYING';

  // A walkover (no-show): the match was decided without playing, so show "W/O" for the winner
  // and "No-show" for the loser instead of a meaningless score.
  const isWalkover = match.walkover && winnerSide != null;

  const row = (side: Side, name: string, score: number) => {
    const isBye = sideIsBye(match, side);
    const players = sidePlayers(match, side, teamsLookup, showPlayerNames);
    return (
      <Group
        justify="space-between"
        wrap="nowrap"
        className={`${classes.teamRow} ${winnerSide === side ? classes.winner : ''}`}
      >
        <Box className={classes.name}>
          <Text size="sm" fw={winnerSide === side ? 700 : 400} lineClamp={1}>
            {isBye ? 'Bye' : name}
          </Text>
          {!isBye && players.length > 0 && (
            <Text size="xs" c="dimmed" lineClamp={1} className={classes.players}>
              {players.join(' & ')}
            </Text>
          )}
        </Box>
        {!isBye &&
          (isWalkover ? (
            <Badge size="sm" variant="light" color={winnerSide === side ? 'orange' : 'gray'}>
              {winnerSide === side ? 'W/O' : 'No-show'}
            </Badge>
          ) : (
            <Text size="sm" fw={700} className={classes.score}>
              {score}
            </Text>
          ))}
      </Group>
    );
  };

  return (
    <Card withBorder radius="md" p={0} className={classes.match}>
      {showCourt && (
        <Box className={classes.courtBar} data-playing={isPlaying ? 'true' : undefined}>
          <Text size="xs" fw={700}>
            {isPlaying ? '● ' : ''}
            {match.court?.name}
          </Text>
        </Box>
      )}
      {row(1, name1, match.stage_item_input1_score)}
      <Box className={classes.divider} />
      {row(2, name2, match.stage_item_input2_score)}
    </Card>
  );
}

function ChampionBanner({
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
  const finalMatch = rounds[rounds.length - 1]?.matches?.[0] as MatchWithDetails | undefined;
  if (finalMatch == null) return null;

  const winnerSide = getWinnerSide(finalMatch);
  if (winnerSide == null) return null;

  const championName =
    winnerSide === 1
      ? formatMatchInput1(t, stageItemsLookup, matchesLookup, finalMatch)
      : formatMatchInput2(t, stageItemsLookup, matchesLookup, finalMatch);

  return (
    <Card withBorder radius="md" mb="md" className={classes.champion}>
      <Group justify="center" gap="sm">
        <IconTrophy size={22} color="var(--mantine-color-yellow-6)" />
        <Text fw={700} size="lg">
          Champion: {championName}
        </Text>
      </Group>
    </Card>
  );
}

// A small zoom toolbar so a large bracket (many teams) can be made to fit a big screen.
function ZoomControls({
  zoom,
  setZoom,
  onFit,
}: {
  zoom: number;
  setZoom: (z: number) => void;
  onFit: () => void;
}) {
  return (
    <Group gap="xs" justify="flex-end" mb="xs">
      <Tooltip label="Zoom out">
        <ActionIcon variant="default" onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}>
          <IconMinus size={16} />
        </ActionIcon>
      </Tooltip>
      <Text size="sm" w={48} ta="center">
        {Math.round(zoom * 100)}%
      </Text>
      <Tooltip label="Zoom in">
        <ActionIcon variant="default" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
          <IconPlus size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Fit to screen">
        <ActionIcon variant="default" onClick={onFit}>
          <IconMaximize size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

// A single rendered column of the bracket: a header label and the matches stacked in it.
type BracketColumn = { key: string; label: string; matches: MatchWithDetails[] };

// Lay the rounds out as left-to-right columns. In `split` mode the bracket is folded into two
// mirrored halves that meet at the final in the middle (much better aspect ratio for a TV): each
// round (except the final) is cut in half — the top half feeds the left side, the bottom half the
// right side — and the right side is rendered in reverse round order so it advances inward.
function buildColumns(rounds: { id: number; matches: any[] }[], split: boolean): BracketColumn[] {
  const labelFor = (index: number) => roundLabel(index, rounds.length);

  if (!split || rounds.length < 2) {
    return rounds.map((round, index) => ({
      key: `${round.id}`,
      label: labelFor(index),
      matches: round.matches as MatchWithDetails[],
    }));
  }

  const finalIndex = rounds.length - 1;
  const leftColumns: BracketColumn[] = [];
  const rightColumns: BracketColumn[] = [];

  for (let i = 0; i < finalIndex; i += 1) {
    const matches = rounds[i].matches as MatchWithDetails[];
    const half = Math.ceil(matches.length / 2);
    leftColumns.push({
      key: `L${rounds[i].id}`,
      label: labelFor(i),
      matches: matches.slice(0, half),
    });
    rightColumns.push({
      key: `R${rounds[i].id}`,
      label: labelFor(i),
      matches: matches.slice(half),
    });
  }

  const finalColumn: BracketColumn = {
    key: `${rounds[finalIndex].id}`,
    label: labelFor(finalIndex),
    matches: rounds[finalIndex].matches as MatchWithDetails[],
  };

  return [...leftColumns, finalColumn, ...rightColumns.reverse()];
}

export function SingleEliminationBracket({
  stageItem,
  stageItemsLookup,
  matchesLookup,
  teamsLookup = null,
  showPlayerNames = false,
  zoomable = false,
  split = false,
  fillHeight = false,
}: {
  stageItem: StageItemWithRounds;
  stageItemsLookup: any;
  matchesLookup: any;
  teamsLookup?: any;
  showPlayerNames?: boolean;
  zoomable?: boolean;
  split?: boolean;
  fillHeight?: boolean;
}) {
  const rounds = [...stageItem.rounds].sort((a, b) => a.id - b.id);
  const columns = buildColumns(rounds, split);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (container == null || content == null) return;
    // Measure the content at its natural size by dividing out the current zoom.
    const naturalWidth = content.scrollWidth / zoom;
    if (naturalWidth > 0) {
      setZoom(Math.min(1, Math.max(0.3, container.clientWidth / naturalWidth)));
    }
  }, [zoom]);

  // Auto-fit once on mount and whenever the number of rounds changes.
  useEffect(() => {
    if (zoomable) fitToScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomable, rounds.length]);

  return (
    <>
      {zoomable && <ZoomControls zoom={zoom} setZoom={setZoom} onFit={fitToScreen} />}
      <Box
        className={classes.bracketScroll}
        ref={containerRef}
        style={
          fillHeight
            ? { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
            : undefined
        }
      >
        <ChampionBanner
          stageItem={stageItem}
          stageItemsLookup={stageItemsLookup}
          matchesLookup={matchesLookup}
        />
        <div
          ref={contentRef}
          style={
            zoomable
              ? { zoom, width: 'min-content' }
              : fillHeight
                ? { flex: 1, minHeight: 0 }
                : undefined
          }
        >
          <Group
            align="stretch"
            gap="xl"
            wrap="nowrap"
            className={classes.bracket}
            style={fillHeight ? { height: '100%' } : undefined}
          >
            {columns.map((column) => (
              <Stack key={column.key} justify="space-around" gap="lg" className={classes.round}>
                <Center>
                  <Badge variant="light" color="gray">
                    {column.label}
                  </Badge>
                </Center>
                <Stack justify="space-around" gap="lg" style={{ flex: 1 }}>
                  {column.matches.map((match) => (
                    <BracketMatch
                      key={match.id}
                      match={match}
                      stageItemsLookup={stageItemsLookup}
                      matchesLookup={matchesLookup}
                      teamsLookup={teamsLookup}
                      showPlayerNames={showPlayerNames}
                    />
                  ))}
                </Stack>
              </Stack>
            ))}
          </Group>
        </div>
      </Box>
    </>
  );
}
