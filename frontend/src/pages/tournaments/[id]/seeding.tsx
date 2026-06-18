import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconArrowsShuffle,
  IconCheck,
  IconGripVertical,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { BracketPreview, nextPowerOfTwo } from '@components/brackets/bracket_preview';
import { NoContent } from '@components/no_content/empty_table_info';
import { getTournamentIdFromRouter } from '@components/utils/util';
import { FullTeamWithPlayers } from '@openapi';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getTeams, getTournamentById } from '@services/adapter';
import { autoGenerateBracket } from '@services/stage_item';

export default function SeedingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tournamentData } = getTournamentIdFromRouter();

  const swrTeams = getTeams(tournamentData.id);
  const swrTournament = getTournamentById(tournamentData.id);
  const teams: FullTeamWithPlayers[] = swrTeams.data != null ? swrTeams.data.data.teams : [];
  const dashboardEndpoint =
    swrTournament.data != null ? swrTournament.data.data.dashboard_endpoint : null;

  const [order, setOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  // Keep the local seed order in sync with the team list: preserve the current order for
  // teams that still exist, append newly added teams, and drop removed ones.
  const teamIdsKey = teams.map((team) => team.id).join(',');
  useEffect(() => {
    const ids = teams.map((team) => team.id);
    setOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamIdsKey]);

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const orderedTeams = order
    .map((id) => teamsById.get(id))
    .filter((team): team is FullTeamWithPlayers => team != null);
  const teamNames = orderedTeams.map((team) => team.name);

  const teamCount = orderedTeams.length;
  const bracketSize = nextPowerOfTwo(teamCount);
  const byes = teamCount >= 2 ? bracketSize - teamCount : 0;

  const shuffle = () => {
    setOrder((prev) => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  const generate = async () => {
    setBusy(true);
    const response = await autoGenerateBracket(tournamentData.id, {
      team_ids: order,
      replace_existing: true,
    });
    setBusy(false);
    if (response != null && (response as any).name !== 'AxiosError') {
      showNotification({
        color: 'green',
        title: t('bracket_generated_title'),
        message: '',
        icon: <IconCheck />,
      });
      const endpoint = dashboardEndpoint || tournamentData.id;
      navigate(`/tournaments/${endpoint}/dashboard/bracket`);
    }
  };

  if (teamCount < 2) {
    return (
      <TournamentLayout tournament_id={tournamentData.id}>
        <Title mb="lg">{t('seeding_title')}</Title>
        <NoContent title={t('seeding_need_teams_title')} description={t('seeding_need_teams_description')} />
      </TournamentLayout>
    );
  }

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <Group justify="space-between" mb="md" align="flex-end">
        <Title>{t('seeding_title')}</Title>
        <Group>
          <Button
            variant="default"
            leftSection={<IconArrowsShuffle size={18} />}
            onClick={shuffle}
            disabled={busy}
          >
            {t('shuffle_button')}
          </Button>
          <Button color="green" leftSection={<IconCheck size={18} />} onClick={generate} loading={busy}>
            {t('generate_update_bracket_button')}
          </Button>
        </Group>
      </Group>

      <Alert icon={<IconInfoCircle />} color="blue" variant="light" mb="md">
        {byes > 0
          ? `${t('seeding_help')} ${t('seeding_help_byes', { count: byes })}`
          : t('seeding_help')}
      </Alert>

      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Text fw={600} mb="xs">
            {t('seeds_label')} ({teamCount})
          </Text>
          <DragDropContext
            onDragEnd={({ destination, source }) => {
              if (destination == null) return;
              setOrder((prev) => {
                const updated = [...prev];
                const [moved] = updated.splice(source.index, 1);
                updated.splice(destination.index, 0, moved);
                return updated;
              });
            }}
          >
            <Droppable droppableId="seeds" direction="vertical">
              {(provided) => (
                <Stack gap="xs" ref={provided.innerRef} {...provided.droppableProps}>
                  {orderedTeams.map((team, index) => (
                    <Draggable key={team.id} draggableId={`${team.id}`} index={index}>
                      {(dragProvided, snapshot) => (
                        <Card
                          withBorder
                          radius="md"
                          p="xs"
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          style={{
                            ...dragProvided.draggableProps.style,
                            opacity: snapshot.isDragging ? 0.85 : 1,
                          }}
                        >
                          <Group gap="sm" wrap="nowrap">
                            <Badge
                              circle
                              variant={index < byes ? 'filled' : 'light'}
                              color={index < byes ? 'green' : 'gray'}
                            >
                              {index + 1}
                            </Badge>
                            <Text fw={500} style={{ flex: 1 }} lineClamp={1}>
                              {team.name}
                            </Text>
                            {index < byes && (
                              <Badge size="sm" variant="outline" color="green">
                                {t('bye_label')}
                              </Badge>
                            )}
                            <IconGripVertical size={18} opacity={0.4} />
                          </Group>
                        </Card>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </Stack>
              )}
            </Droppable>
          </DragDropContext>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Text fw={600} mb="xs">
            {t('bracket_preview_label')}
          </Text>
          <BracketPreview teamNames={teamNames} />
        </Grid.Col>
      </Grid>
    </TournamentLayout>
  );
}
