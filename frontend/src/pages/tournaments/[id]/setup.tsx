import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  List,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { getTournamentIdFromRouter } from '@components/utils/util';
import { Court, FullTeamWithPlayers } from '@openapi';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getCourts, getTeams, getTournamentById } from '@services/adapter';
import { createCourt } from '@services/court';
import { autoGenerateBracket } from '@services/stage_item';
import { createTeams } from '@services/team';

function nextPowerOfTwo(teamCount: number): number {
  if (teamCount < 2) return 2;
  return 2 ** Math.ceil(Math.log2(teamCount));
}

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const { tournamentData } = getTournamentIdFromRouter();
  const [active, setActive] = useState(0);
  const [teamNames, setTeamNames] = useState('');
  const [courtName, setCourtName] = useState('');
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState(false);

  const swrTeams = getTeams(tournamentData.id);
  const swrCourts = getCourts(tournamentData.id);
  const swrTournament = getTournamentById(tournamentData.id);
  const teams: FullTeamWithPlayers[] = swrTeams.data != null ? swrTeams.data.data.teams : [];
  const courts: Court[] = swrCourts.data != null ? swrCourts.data.data : [];
  const dashboardEndpoint =
    swrTournament.data != null ? swrTournament.data.data.dashboard_endpoint : null;

  const teamCount = teams.length;
  const bracketSize = nextPowerOfTwo(teamCount);
  const byes = bracketSize - teamCount;

  const addTeams = async () => {
    const trimmed = teamNames.trim();
    if (trimmed.length < 1) return;
    setBusy(true);
    await createTeams(tournamentData.id, trimmed, true);
    setTeamNames('');
    await swrTeams.mutate();
    setBusy(false);
  };

  const addCourt = async () => {
    const trimmed = courtName.trim();
    if (trimmed.length < 1) return;
    setBusy(true);
    await createCourt(tournamentData.id, trimmed);
    setCourtName('');
    await swrCourts.mutate();
    setBusy(false);
  };

  const generate = async () => {
    setBusy(true);
    const response = await autoGenerateBracket(tournamentData.id, { replace_existing: true });
    setBusy(false);
    // handleRequestError surfaces failures as notifications; only advance on success.
    if (response != null && (response as any).name !== 'AxiosError') {
      setGenerated(true);
      setActive(3);
    }
  };

  const publicBracketLink = `/tournaments/${
    dashboardEndpoint || tournamentData.id
  }/dashboard/bracket`;

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <Title mb="lg">Tournament setup</Title>

      <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
        <Stepper.Step label="Add teams" description={`${teamCount} added`}>
          <Stack mt="xl" maw="40rem">
            <Text size="sm" c="dimmed">
              Enter one team per line. You can add more in batches. These are the competitors in
              your bracket.
            </Text>
            <Textarea
              autosize
              minRows={5}
              placeholder={'Team A\nTeam B\nTeam C'}
              value={teamNames}
              onChange={(e) => setTeamNames(e.currentTarget.value)}
            />
            <Group>
              <Button onClick={addTeams} loading={busy} disabled={teamNames.trim().length < 1}>
                Add teams
              </Button>
            </Group>

            {teams.length > 0 && (
              <Card withBorder radius="md">
                <Group justify="space-between" mb="xs">
                  <Text fw={600}>Teams</Text>
                  <Badge>{teamCount}</Badge>
                </Group>
                <Group gap="xs">
                  {teams.map((team) => (
                    <Badge key={team.id} variant="light" color="gray" size="lg">
                      {team.name}
                    </Badge>
                  ))}
                </Group>
              </Card>
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Add courts" description={`${courts.length} added`}>
          <Stack mt="xl" maw="40rem">
            <Text size="sm" c="dimmed">
              Courts are where matches are played. Add at least one. Matches are spread across the
              courts you add.
            </Text>
            <Group align="flex-end">
              <TextInput
                style={{ flex: 1 }}
                label="Court name"
                placeholder="Court 1"
                value={courtName}
                onChange={(e) => setCourtName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCourt();
                }}
              />
              <Button onClick={addCourt} loading={busy} disabled={courtName.trim().length < 1}>
                Add court
              </Button>
            </Group>

            {courts.length > 0 && (
              <Card withBorder radius="md">
                <Group justify="space-between" mb="xs">
                  <Text fw={600}>Courts</Text>
                  <Badge>{courts.length}</Badge>
                </Group>
                <Group gap="xs">
                  {courts.map((court) => (
                    <Badge key={court.id} variant="light" color="gray" size="lg">
                      {court.name}
                    </Badge>
                  ))}
                </Group>
              </Card>
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Generate bracket" description="Single elimination">
          <Stack mt="xl" maw="40rem">
            <Alert icon={<IconInfoCircle />} color="blue" variant="light">
              A single-elimination bracket will be generated. Teams are seeded and, if the count
              is not a power of two, the top seeds receive a first-round bye — no team skips ahead
              for free.
            </Alert>

            <Card withBorder radius="md">
              <List spacing="xs">
                <List.Item>
                  <b>{teamCount}</b> teams
                </List.Item>
                <List.Item>
                  Bracket size: <b>{bracketSize}</b>
                  {byes > 0 ? (
                    <Text span c="dimmed">
                      {' '}
                      ({byes} {byes === 1 ? 'bye' : 'byes'} in round 1)
                    </Text>
                  ) : null}
                </List.Item>
                <List.Item>
                  <b>{courts.length}</b> courts
                </List.Item>
              </List>
            </Card>

            {teamCount < 2 && (
              <Alert color="red" variant="light">
                Add at least 2 teams before generating the bracket.
              </Alert>
            )}

            <Group>
              <Button
                color="green"
                size="md"
                onClick={generate}
                loading={busy}
                disabled={teamCount < 2}
              >
                Generate bracket
              </Button>
              <Button
                variant="default"
                size="md"
                onClick={() => navigate(`/tournaments/${tournamentData.id}/seeding`)}
                disabled={teamCount < 2}
              >
                Reorder seeds first
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack mt="xl" maw="40rem">
            <Alert icon={<IconCheck />} color="green" variant="light" title="Bracket created">
              Your bracket is ready. Enter scores and declare winners on the Results page —
              winners advance automatically. Players can follow along on the public bracket.
            </Alert>
            <Group>
              <Button onClick={() => navigate(`/tournaments/${tournamentData.id}/results`)}>
                Go to Results (enter scores)
              </Button>
              <Button variant="default" onClick={() => navigate(publicBracketLink)}>
                Open public bracket
              </Button>
            </Group>
          </Stack>
        </Stepper.Completed>
      </Stepper>

      {!generated && (
        <Group mt="xl">
          <Button variant="default" onClick={() => setActive((c) => Math.max(0, c - 1))} disabled={active === 0}>
            Back
          </Button>
          {active < 2 && (
            <Button onClick={() => setActive((c) => Math.min(2, c + 1))}>Next</Button>
          )}
        </Group>
      )}
    </TournamentLayout>
  );
}
