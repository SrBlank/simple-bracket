import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconCalendarPlus,
  IconCheck,
  IconDots,
  IconPencil,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import CourtModal from '@components/modals/create_court_modal';
import MatchModal from '@components/modals/match_modal';
import { NoContent } from '@components/no_content/empty_table_info';
import { Time } from '@components/utils/datetime';
import { formatMatchInput1, formatMatchInput2, isMatchHappening } from '@components/utils/match';
import { getTournamentIdFromRouter, responseIsValid } from '@components/utils/util';
import { Court, CourtsResponse, MatchWithDetails } from '@openapi';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getCourts, getStages, getTournamentById } from '@services/adapter';
import { deleteCourt, updateCourt } from '@services/court';
import {
  getMatchLookup,
  getMatchLookupByCourt,
  getStageItemLookup,
  getTeamsLookup,
} from '@services/lookups';
import { assignMatchToCourt, scheduleMatches } from '@services/match';

// A match is finished once a result is recorded (status) or, in timed mode, once the scores differ.
function matchWinnerSide(match: MatchWithDetails): 1 | 2 | null {
  if (match.stage_item_input1_score > match.stage_item_input2_score) return 1;
  if (match.stage_item_input2_score > match.stage_item_input1_score) return 2;
  return null;
}

// Whether both slots hold a real team (so it's a genuine game, not a bye).
function bothSidesReal(match: MatchWithDetails): boolean {
  return (
    (match.stage_item_input1 as any)?.team_id != null &&
    (match.stage_item_input2 as any)?.team_id != null
  );
}

function teamPlayers(input: any, teamsLookup: any): string {
  if (teamsLookup == null || input?.team_id == null) return '';
  const players = teamsLookup[input.team_id]?.players ?? [];
  return players.map((p: any) => p.name).join(' & ');
}

function MatchCard({
  match,
  stageItemsLookup,
  matchesLookup,
  teamsLookup,
  showPlayerNames,
  onClick,
}: {
  match: MatchWithDetails;
  stageItemsLookup: any;
  matchesLookup: any;
  teamsLookup: any;
  showPlayerNames: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const winner = matchWinnerSide(match);
  const done = match.status === 'FINISHED' || winner != null;
  const playing = !done && (match.status === 'PLAYING' || isMatchHappening(match));
  const color = done ? 'green' : playing ? 'grape' : 'blue';
  // A walkover (no-show) is shown as "W/O" / "No-show" rather than a score.
  const isWalkover = match.walkover && winner != null;

  const teamRow = (side: 1 | 2, name: string, players: string, score: number) => (
    <Group justify="space-between" wrap="nowrap">
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={winner === side ? 700 : 500} lineClamp={1}>
          {name}
        </Text>
        {showPlayerNames && players !== '' && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {players}
          </Text>
        )}
      </div>
      {isWalkover ? (
        <Badge size="sm" variant="light" color={winner === side ? 'orange' : 'gray'}>
          {winner === side ? 'W/O' : 'No-show'}
        </Badge>
      ) : (
        <Text size="sm" fw={700} c={winner === side ? 'green' : undefined}>
          {score}
        </Text>
      )}
    </Group>
  );

  return (
    <Card
      withBorder
      radius="md"
      padding="sm"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderLeft: `4px solid var(--mantine-color-${color}-6)`,
      }}
    >
      <Group justify="space-between" mb={6}>
        <Badge size="sm" color={isWalkover ? 'orange' : color} variant="light">
          {done ? (isWalkover ? 'Walkover' : 'Final') : playing ? 'Playing now' : 'Up next'}
        </Badge>
        <Text size="xs" c="dimmed">
          {match.start_time != null ? <Time datetime={match.start_time} /> : null}
        </Text>
      </Group>
      {teamRow(
        1,
        formatMatchInput1(t, stageItemsLookup, matchesLookup, match),
        teamPlayers(match.stage_item_input1, teamsLookup),
        match.stage_item_input1_score
      )}
      {teamRow(
        2,
        formatMatchInput2(t, stageItemsLookup, matchesLookup, match),
        teamPlayers(match.stage_item_input2, teamsLookup),
        match.stage_item_input2_score
      )}
    </Card>
  );
}

function CourtColumn({
  tournamentId,
  court,
  matches,
  emptyHint,
  openMatchModal,
  onRename,
  stageItemsLookup,
  matchesLookup,
  teamsLookup,
  showPlayerNames,
  swrCourtsResponse,
}: {
  tournamentId: number;
  court: Court;
  matches: MatchWithDetails[];
  emptyHint: ReactNode;
  openMatchModal: (m: MatchWithDetails) => void;
  onRename: (court: Court) => void;
  stageItemsLookup: any;
  matchesLookup: any;
  teamsLookup: any;
  showPlayerNames: boolean;
  swrCourtsResponse: SWRResponse<CourtsResponse>;
}) {
  return (
    <Stack gap="sm" style={{ width: '20rem' }}>
      <Group justify="space-between">
        <Title order={4}>{court.name}</Title>
        <Menu withinPortal position="bottom-end" shadow="sm">
          <Menu.Target>
            <ActionIcon variant="transparent" color="gray">
              <IconDots size="1.25rem" />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconPencil size="1rem" />} onClick={() => onRename(court)}>
              Rename court
            </Menu.Item>
            <Menu.Item
              leftSection={<IconTrash size="1rem" />}
              color="red"
              onClick={async () => {
                await deleteCourt(tournamentId, court.id);
                await swrCourtsResponse.mutate();
              }}
            >
              Delete court
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      {matches.length < 1
        ? emptyHint
        : matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              stageItemsLookup={stageItemsLookup}
              matchesLookup={matchesLookup}
              teamsLookup={teamsLookup}
              showPlayerNames={showPlayerNames}
              onClick={() => openMatchModal(match)}
            />
          ))}
    </Stack>
  );
}

export default function SchedulePage() {
  const [modalOpened, modalSetOpened] = useState(false);
  const [match, setMatch] = useState<MatchWithDetails | null>(null);
  const [renamingCourt, setRenamingCourt] = useState<Court | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const { tournamentData } = getTournamentIdFromRouter();
  const swrStagesResponse = getStages(tournamentData.id);
  const swrCourtsResponse = getCourts(tournamentData.id);
  const swrTournamentResponse = getTournamentById(tournamentData.id);
  const teamsLookup = getTeamsLookup(tournamentData.id);

  const tournamentFull = swrTournamentResponse.data?.data ?? null;
  const isDynamic = tournamentFull?.scheduling_mode === 'DYNAMIC';
  const autoAdvance = tournamentFull?.court_auto_advance ?? true;
  const showPlayerNames = tournamentFull?.show_player_names ?? false;

  const stageItemsLookup = responseIsValid(swrStagesResponse)
    ? getStageItemLookup(swrStagesResponse)
    : [];
  const matchesLookup = responseIsValid(swrStagesResponse) ? getMatchLookup(swrStagesResponse) : [];
  const matchesByCourtId = responseIsValid(swrStagesResponse)
    ? getMatchLookupByCourt(swrStagesResponse)
    : {};

  if (!responseIsValid(swrStagesResponse)) return null;
  if (!responseIsValid(swrCourtsResponse)) return null;

  function openMatchModal(matchToOpen: MatchWithDetails) {
    setMatch(matchToOpen);
    modalSetOpened(true);
  }

  function openRenameCourt(court: Court) {
    setRenamingCourt(court);
    setRenameValue(court.name);
  }

  const courts: Court[] = swrCourtsResponse.data?.data || [];
  const allMatches: MatchWithDetails[] = Object.values(matchesLookup).map((x: any) => x.match);

  // How many matches still need to be placed. In dynamic mode that's the queue + still-pending
  // playable matches; in timed mode it's matches without a start time.
  const unscheduledCount = isDynamic
    ? allMatches.filter(
        (m) => m.status !== 'FINISHED' && m.status !== 'PLAYING' && bothSidesReal(m)
      ).length
    : allMatches.filter((m) => m.start_time == null).length;

  // Completed matches go into a single queue (exclude byes), newest first.
  const completed = allMatches
    .filter((m) =>
      isDynamic
        ? m.status === 'FINISHED' && bothSidesReal(m)
        : m.start_time != null && matchWinnerSide(m) != null
    )
    .sort((a, b) => dayjs(b.start_time || '').valueOf() - dayjs(a.start_time || '').valueOf());

  // The queue of ready matches waiting for a court (dynamic mode only), in play order.
  const queue = isDynamic
    ? allMatches.filter((m) => m.status === 'QUEUED').sort((a, b) => a.id - b.id)
    : [];

  // Matches currently on each court.
  const activeByCourt = courts.map((court) => ({
    court,
    matches: ((matchesByCourtId[court.id] as MatchWithDetails[]) || [])
      .filter((m) =>
        isDynamic ? m.status === 'PLAYING' : m.start_time != null && matchWinnerSide(m) == null
      )
      .sort(
        (a, b) =>
          (a.position_in_schedule ?? 0) - (b.position_in_schedule ?? 0) ||
          dayjs(a.start_time || '').valueOf() - dayjs(b.start_time || '').valueOf()
      ),
  }));

  const scheduleButtonLabel = isDynamic
    ? unscheduledCount > 0
      ? 'Start / fill courts'
      : 'Refresh courts'
    : unscheduledCount > 0
      ? `Schedule ${unscheduledCount} match${unscheduledCount === 1 ? '' : 'es'}`
      : 'Re-schedule matches';

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      {match != null ? (
        <MatchModal
          swrStagesResponse={swrStagesResponse}
          swrUpcomingMatchesResponse={null}
          tournamentData={tournamentData}
          match={match}
          opened={modalOpened}
          setOpened={modalSetOpened}
          round={null}
        />
      ) : null}

      <Modal
        opened={renamingCourt != null}
        onClose={() => setRenamingCourt(null)}
        title="Rename court"
      >
        <TextInput
          data-autofocus
          label="Court name"
          value={renameValue}
          onChange={(event) => setRenameValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <Button
          fullWidth
          mt="md"
          color="green"
          disabled={renameValue.trim().length < 1}
          onClick={async () => {
            if (renamingCourt != null) {
              await updateCourt(tournamentData.id, renamingCourt.id, renameValue.trim());
              await swrCourtsResponse.mutate();
              await swrStagesResponse.mutate();
            }
            setRenamingCourt(null);
          }}
        >
          Save
        </Button>
      </Modal>

      <Grid align="center" mb="md">
        <Grid.Col span="auto">
          <Title>Planning</Title>
        </Grid.Col>
        <Grid.Col span="content">
          <Group>
            <CourtModal
              swrCourtsResponse={swrCourtsResponse}
              tournamentId={tournamentData.id}
              buttonSize="xs"
            />
            <Button
              color="indigo"
              leftSection={<IconCalendarPlus size={20} />}
              onClick={async () => {
                await scheduleMatches(tournamentData.id);
                await swrStagesResponse.mutate();
              }}
            >
              {scheduleButtonLabel}
            </Button>
          </Group>
        </Grid.Col>
      </Grid>

      {courts.length < 1 ? (
        <Stack align="center" mt="xl">
          <NoContent
            title="No courts yet"
            description="Add a court, then schedule matches to lay out the games."
          />
          <CourtModal
            swrCourtsResponse={swrCourtsResponse}
            tournamentId={tournamentData.id}
            buttonSize="lg"
          />
        </Stack>
      ) : (
        <>
          <Text fw={600} mb="xs">
            On the courts
          </Text>
          <Group align="flex-start" wrap="wrap" gap="xl">
            {activeByCourt.map(({ court, matches: courtMatches }) => (
              <CourtColumn
                key={court.id}
                tournamentId={tournamentData.id}
                court={court}
                matches={courtMatches}
                emptyHint={
                  isDynamic && !autoAdvance && queue.length > 0 ? (
                    <Button
                      variant="light"
                      color="grape"
                      leftSection={<IconPlayerPlay size={16} />}
                      onClick={async () => {
                        await assignMatchToCourt(tournamentData.id, queue[0].id, court.id);
                        await swrStagesResponse.mutate();
                      }}
                    >
                      Start next match here
                    </Button>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No match on this court.
                    </Text>
                  )
                }
                openMatchModal={openMatchModal}
                onRename={openRenameCourt}
                stageItemsLookup={stageItemsLookup}
                matchesLookup={matchesLookup}
                teamsLookup={teamsLookup}
                showPlayerNames={showPlayerNames}
                swrCourtsResponse={swrCourtsResponse}
              />
            ))}
          </Group>

          {isDynamic && (
            <>
              <Divider my="xl" />
              <Group justify="space-between" mb="xs">
                <Text fw={600}>Up next (queue)</Text>
                <Badge color="blue" variant="light">
                  {queue.length}
                </Badge>
              </Group>
              {queue.length < 1 ? (
                <Text size="sm" c="dimmed">
                  Ready matches will line up here and drop onto a court as one frees up.
                </Text>
              ) : (
                <Group align="flex-start" wrap="wrap" gap="sm">
                  {queue.map((m, index) => (
                    <div key={m.id} style={{ width: '20rem', position: 'relative' }}>
                      {index === 0 && (
                        <Badge
                          size="xs"
                          color="blue"
                          style={{ position: 'absolute', top: -8, left: 8, zIndex: 1 }}
                        >
                          Next
                        </Badge>
                      )}
                      <MatchCard
                        match={m}
                        stageItemsLookup={stageItemsLookup}
                        matchesLookup={matchesLookup}
                        teamsLookup={teamsLookup}
                        showPlayerNames={showPlayerNames}
                        onClick={() => openMatchModal(m)}
                      />
                    </div>
                  ))}
                </Group>
              )}
            </>
          )}

          <Divider my="xl" />

          <Group justify="space-between" mb="xs">
            <Text fw={600}>Completed</Text>
            <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
              {completed.length}
            </Badge>
          </Group>
          {completed.length < 1 ? (
            <Text size="sm" c="dimmed">
              Finished matches will stack up here as you enter results.
            </Text>
          ) : (
            <Group align="flex-start" wrap="wrap" gap="sm">
              {completed.map((m) => (
                <div key={m.id} style={{ width: '20rem' }}>
                  <MatchCard
                    match={m}
                    stageItemsLookup={stageItemsLookup}
                    matchesLookup={matchesLookup}
                    teamsLookup={teamsLookup}
                    showPlayerNames={showPlayerNames}
                    onClick={() => openMatchModal(m)}
                  />
                </div>
              ))}
            </Group>
          )}
        </>
      )}
    </TournamentLayout>
  );
}
