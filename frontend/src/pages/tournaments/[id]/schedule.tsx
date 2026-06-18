import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Menu,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconCalendarPlus, IconCheck, IconDots, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
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
import { getCourts, getStages } from '@services/adapter';
import { deleteCourt } from '@services/court';
import { getMatchLookup, getMatchLookupByCourt, getStageItemLookup } from '@services/lookups';
import { scheduleMatches } from '@services/match';

// A match is finished once a winner has been decided (the scores differ).
function matchWinnerSide(match: MatchWithDetails): 1 | 2 | null {
  if (match.stage_item_input1_score > match.stage_item_input2_score) return 1;
  if (match.stage_item_input2_score > match.stage_item_input1_score) return 2;
  return null;
}

function MatchCard({
  match,
  stageItemsLookup,
  matchesLookup,
  onClick,
}: {
  match: MatchWithDetails;
  stageItemsLookup: any;
  matchesLookup: any;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const winner = matchWinnerSide(match);
  const done = winner != null;
  const playing = !done && isMatchHappening(match);
  const color = done ? 'green' : playing ? 'grape' : 'blue';

  const teamRow = (side: 1 | 2, name: string, score: number) => (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" fw={winner === side ? 700 : 500} lineClamp={1}>
        {name}
      </Text>
      <Text size="sm" fw={700} c={winner === side ? 'green' : undefined}>
        {score}
      </Text>
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
        <Badge size="sm" color={color} variant="light">
          {done ? 'Final' : playing ? 'Playing now' : 'Up next'}
        </Badge>
        <Text size="xs" c="dimmed">
          {match.start_time != null ? <Time datetime={match.start_time} /> : null}
        </Text>
      </Group>
      {teamRow(
        1,
        formatMatchInput1(t, stageItemsLookup, matchesLookup, match),
        match.stage_item_input1_score
      )}
      {teamRow(
        2,
        formatMatchInput2(t, stageItemsLookup, matchesLookup, match),
        match.stage_item_input2_score
      )}
    </Card>
  );
}

function CourtColumn({
  tournamentId,
  court,
  matches,
  openMatchModal,
  stageItemsLookup,
  matchesLookup,
  swrCourtsResponse,
}: {
  tournamentId: number;
  court: Court;
  matches: MatchWithDetails[];
  openMatchModal: (m: MatchWithDetails) => void;
  stageItemsLookup: any;
  matchesLookup: any;
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
      {matches.length < 1 ? (
        <Text size="sm" c="dimmed">
          No matches waiting.
        </Text>
      ) : (
        matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            stageItemsLookup={stageItemsLookup}
            matchesLookup={matchesLookup}
            onClick={() => openMatchModal(match)}
          />
        ))
      )}
    </Stack>
  );
}

export default function SchedulePage() {
  const [modalOpened, modalSetOpened] = useState(false);
  const [match, setMatch] = useState<MatchWithDetails | null>(null);

  const { tournamentData } = getTournamentIdFromRouter();
  const swrStagesResponse = getStages(tournamentData.id);
  const swrCourtsResponse = getCourts(tournamentData.id);

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

  const courts: Court[] = swrCourtsResponse.data?.data || [];
  const allMatches: MatchWithDetails[] = Object.values(matchesLookup).map((x: any) => x.match);

  // How many matches still need a court/time assigned.
  const unscheduledCount = allMatches.filter((m) => m.start_time == null).length;

  // Completed matches go into a single queue, newest first.
  const completed = allMatches
    .filter((m) => m.start_time != null && matchWinnerSide(m) != null)
    .sort((a, b) => dayjs(b.start_time || '').valueOf() - dayjs(a.start_time || '').valueOf());

  // Active matches stay on their court, sorted by schedule position.
  const activeByCourt = courts.map((court) => ({
    court,
    matches: ((matchesByCourtId[court.id] as MatchWithDetails[]) || [])
      .filter((m) => m.start_time != null && matchWinnerSide(m) == null)
      .sort(
        (a, b) =>
          (a.position_in_schedule ?? 0) - (b.position_in_schedule ?? 0) ||
          dayjs(a.start_time || '').valueOf() - dayjs(b.start_time || '').valueOf()
      ),
  }));

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
              {unscheduledCount > 0
                ? `Schedule ${unscheduledCount} match${unscheduledCount === 1 ? '' : 'es'}`
                : 'Re-schedule matches'}
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
                openMatchModal={openMatchModal}
                stageItemsLookup={stageItemsLookup}
                matchesLookup={matchesLookup}
                swrCourtsResponse={swrCourtsResponse}
              />
            ))}
          </Group>

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
