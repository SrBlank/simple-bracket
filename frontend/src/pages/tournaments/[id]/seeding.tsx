import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Alert, Badge, Box, Button, Card, Center, Group, Stack, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconArrowsShuffle,
  IconCheck,
  IconGripVertical,
  IconInfoCircle,
  IconSortAscendingNumbers,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import bracketClasses from '@components/brackets/bracket_view.module.css';
import {
  BracketRoundColumn,
  PreviewSlot,
  bracketSeedingOrder,
  buildRoundsFromFirstRound,
  nextPowerOfTwo,
  roundLabel,
} from '@components/brackets/bracket_preview';
import { NoContent } from '@components/no_content/empty_table_info';
import { getTournamentIdFromRouter } from '@components/utils/util';
import { FullTeamWithPlayers } from '@openapi';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getTeams, getTournamentById } from '@services/adapter';
import { autoGenerateBracket } from '@services/stage_item';

// One bracket slot: a stable uid (so drag-and-drop keys survive reordering) and the team that
// occupies it, or null for a bye.
type Slot = { uid: string; teamId: number | null };

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Lay out teams onto a power-of-two bracket using standard seeding (byes go to the top seeds).
function standardSlots(teamIds: number[]): Slot[] {
  const size = nextPowerOfTwo(teamIds.length);
  const order = bracketSeedingOrder(size);
  return order.map((seed, index) => ({
    uid: `slot-${index}`,
    teamId: seed <= teamIds.length ? teamIds[seed - 1] : null,
  }));
}

export default function SeedingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tournamentData } = getTournamentIdFromRouter();

  const swrTeams = getTeams(tournamentData.id);
  const swrTournament = getTournamentById(tournamentData.id);
  const teams: FullTeamWithPlayers[] = swrTeams.data != null ? swrTeams.data.data.teams : [];
  const dashboardEndpoint =
    swrTournament.data != null ? swrTournament.data.data.dashboard_endpoint : null;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);

  // Rebuild the bracket with standard seeding whenever the set of teams changes (so adding or
  // removing teams keeps the bracket valid). Manual arrangements before that are intentionally
  // reset, since the bracket size itself may change.
  const teamIdsKey = teams.map((team) => team.id).join(',');
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current !== teamIdsKey) {
      lastKey.current = teamIdsKey;
      setSlots(standardSlots(teams.map((team) => team.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamIdsKey]);

  const nameById = new Map(teams.map((team) => [team.id, team.name]));
  const teamCount = teams.length;

  const firstRoundSlots: PreviewSlot[] = slots.map((slot) =>
    slot.teamId == null
      ? { kind: 'bye' }
      : { kind: 'team', id: slot.teamId, name: nameById.get(slot.teamId) ?? '?' }
  );
  const allRounds = buildRoundsFromFirstRound(firstRoundSlots);
  const laterRounds = allRounds.slice(1);

  // Warn if a match has two byes — that wastes a slot and lets a team skip the next round.
  const hasDoubleBye = slots.some(
    (_, i) => i % 2 === 0 && slots[i]?.teamId == null && slots[i + 1]?.teamId == null
  );

  const reseedStandard = () => setSlots(standardSlots(teams.map((team) => team.id)));
  const randomize = () => setSlots(standardSlots(shuffled(teams.map((team) => team.id))));

  const generateFromSlots = async (slotsToUse: Slot[]) => {
    setBusy(true);
    const response = await autoGenerateBracket(tournamentData.id, {
      slots: slotsToUse.map((slot) => slot.teamId),
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

  const generateRandom = async () => {
    const randomSlots = standardSlots(shuffled(teams.map((team) => team.id)));
    setSlots(randomSlots);
    await generateFromSlots(randomSlots);
  };

  if (teamCount < 2) {
    return (
      <TournamentLayout tournament_id={tournamentData.id}>
        <Title mb="lg">{t('seeding_title')}</Title>
        <NoContent
          title={t('seeding_need_teams_title')}
          description={t('seeding_need_teams_description')}
        />
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
            leftSection={<IconSortAscendingNumbers size={18} />}
            onClick={reseedStandard}
            disabled={busy}
          >
            {t('standard_seeding_button')}
          </Button>
          <Button
            variant="default"
            leftSection={<IconArrowsShuffle size={18} />}
            onClick={randomize}
            disabled={busy}
          >
            {t('shuffle_button')}
          </Button>
          <Button
            variant="light"
            leftSection={<IconArrowsShuffle size={18} />}
            onClick={generateRandom}
            loading={busy}
          >
            {t('random_bracket_button')}
          </Button>
          <Button color="green" leftSection={<IconCheck size={18} />} onClick={() => generateFromSlots(slots)} loading={busy}>
            {t('generate_update_bracket_button')}
          </Button>
        </Group>
      </Group>

      <Alert icon={<IconInfoCircle />} color="blue" variant="light" mb="md">
        {t('bracket_drag_help')}
      </Alert>

      {hasDoubleBye && (
        <Alert color="yellow" variant="light" mb="md">
          {t('double_bye_warning')}
        </Alert>
      )}

      <Box className={bracketClasses.bracketScroll}>
        <Group align="stretch" gap="xl" wrap="nowrap" className={bracketClasses.bracket}>
          {/* Round 1 — draggable */}
          <Stack justify="space-around" gap="lg" className={bracketClasses.round}>
            <Center>
              <Badge variant="light" color="gray">
                {laterRounds.length === 0 ? t('final_label') : `${t('round_label')} 1`}
              </Badge>
            </Center>
            <DragDropContext
              onDragEnd={({ destination, source }) => {
                if (destination == null) return;
                setSlots((prev) => {
                  const updated = [...prev];
                  const [moved] = updated.splice(source.index, 1);
                  updated.splice(destination.index, 0, moved);
                  return updated;
                });
              }}
            >
              <Droppable droppableId="bracket-slots" direction="vertical">
                {(provided) => (
                  <Stack
                    gap="xs"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{ flex: 1 }}
                  >
                    {slots.map((slot, index) => (
                      <Draggable key={slot.uid} draggableId={slot.uid} index={index}>
                        {(dragProvided, snapshot) => (
                          <Card
                            withBorder
                            radius="md"
                            p="xs"
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            // Extra space before each new match (even index) groups the pairs.
                            mt={index > 0 && index % 2 === 0 ? 'md' : undefined}
                            style={{
                              ...dragProvided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.85 : 1,
                            }}
                          >
                            <Group gap="sm" wrap="nowrap">
                              {slot.teamId == null ? (
                                <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                                  {t('bye_label')}
                                </Text>
                              ) : (
                                <Text size="sm" fw={500} style={{ flex: 1 }} lineClamp={1}>
                                  {nameById.get(slot.teamId) ?? '?'}
                                </Text>
                              )}
                              <IconGripVertical size={16} opacity={0.4} />
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
          </Stack>

          {/* Rounds 2+ — derived preview, updates live as you drag */}
          {laterRounds.map((matches, index) => (
            <BracketRoundColumn
              key={index}
              matches={matches}
              label={roundLabel(t, index, laterRounds.length, 1)}
            />
          ))}
        </Group>
      </Box>
    </TournamentLayout>
  );
}
