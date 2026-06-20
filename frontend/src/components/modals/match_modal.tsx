import {
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import DeleteButton from '@components/buttons/delete';
import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { TournamentMinimal } from '@components/utils/tournament';
import { Court, MatchWithDetails, RoundWithMatches, StagesWithStageItemsResponse } from '@openapi';
import { getCourts, getTournamentById } from '@services/adapter';
import { getMatchLookup, getStageItemLookup } from '@services/lookups';
import { assignMatchToCourt, deleteMatch, updateMatch } from '@services/match';

function MatchDeleteButton({
  tournamentData,
  match,
  swrStagesResponse,
  swrUpcomingMatchesResponse,
}: {
  tournamentData: TournamentMinimal;
  match: MatchWithDetails;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrUpcomingMatchesResponse: SWRResponse | null;
}) {
  const { t } = useTranslation();
  return (
    <DeleteButton
      fullWidth
      onClick={async () => {
        await deleteMatch(tournamentData.id, match.id);
        await swrStagesResponse.mutate();
        if (swrUpcomingMatchesResponse != null) await swrUpcomingMatchesResponse.mutate();
      }}
      style={{ marginTop: '1rem' }}
      size="sm"
      title={t('remove_match_button')}
    />
  );
}

function MatchModalForm({
  tournamentData,
  match,
  swrStagesResponse,
  swrUpcomingMatchesResponse,
  setOpened,
  round,
}: {
  tournamentData: TournamentMinimal;
  match: MatchWithDetails | null;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrUpcomingMatchesResponse: SWRResponse | null;
  setOpened: any;
  round: RoundWithMatches | null;
}) {
  if (match == null) {
    return null;
  }

  const { t } = useTranslation();
  const swrCourtsResponse = getCourts(tournamentData.id);
  const swrTournamentResponse = getTournamentById(tournamentData.id);
  const courts: Court[] = swrCourtsResponse.data?.data ?? [];
  const isDynamic = swrTournamentResponse.data?.data?.scheduling_mode === 'DYNAMIC';

  const form = useForm({
    initialValues: {
      stage_item_input1_score: match.stage_item_input1_score,
      stage_item_input2_score: match.stage_item_input2_score,
      court_id: match.court_id != null ? `${match.court_id}` : null,
    },

    validate: {
      stage_item_input1_score: (value) => (value >= 0 ? null : t('negative_score_validation')),
      stage_item_input2_score: (value) => (value >= 0 ? null : t('negative_score_validation')),
    },
  });

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const matchesLookup = getMatchLookup(swrStagesResponse);

  const team1Name = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
  const team2Name = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);

  // The winner is whichever side has the higher score; the bracket advances that team. The
  // selector below lets the organizer declare a winner directly (e.g. for a walkover or to
  // break a tie) by nudging the score so the chosen side leads.
  const score1 = form.values.stage_item_input1_score;
  const score2 = form.values.stage_item_input2_score;
  const currentWinner = score1 > score2 ? 'team1' : score2 > score1 ? 'team2' : '';

  const declareWinner = (winner: string) => {
    if (winner === 'team1' && score1 <= score2) {
      form.setFieldValue('stage_item_input1_score', score2 + 1);
    } else if (winner === 'team2' && score2 <= score1) {
      form.setFieldValue('stage_item_input2_score', score1 + 1);
    }
  };

  const bothTeamsPresent = match.stage_item_input1 != null && match.stage_item_input2 != null;

  // Persist the entered result (and court). Editing a finished match re-runs here, which
  // re-propagates the winner into later rounds — so a wrong winner can always be corrected.
  const saveResult = async (
    score1Override?: number,
    score2Override?: number,
    walkover: boolean = false
  ) => {
    const finalScore1 = score1Override ?? form.values.stage_item_input1_score;
    const finalScore2 = score2Override ?? form.values.stage_item_input2_score;
    const courtId = form.values.court_id != null ? parseInt(form.values.court_id, 10) : null;

    await updateMatch(tournamentData.id, match.id, {
      round_id: match.round_id,
      stage_item_input1_score: finalScore1,
      stage_item_input2_score: finalScore2,
      court_id: courtId,
      custom_duration_minutes: match.custom_duration_minutes ?? null,
      custom_margin_minutes: match.custom_margin_minutes ?? null,
      walkover,
    });

    // In dynamic mode, putting a match on a court should also mark it as playing (unless it just
    // got a result, in which case the backend already finished it).
    if (isDynamic && courtId != null && finalScore1 === finalScore2) {
      await assignMatchToCourt(tournamentData.id, match.id, courtId);
    }

    await swrStagesResponse.mutate();
    if (swrUpcomingMatchesResponse != null) await swrUpcomingMatchesResponse.mutate();
    setOpened(false);
  };

  return (
    <>
      <form onSubmit={form.onSubmit(async () => saveResult(undefined, undefined, match.walkover))}>
        {courts.length > 0 && (
          <Select
            label="Court"
            placeholder="Not on a court yet"
            clearable
            data={courts.map((court) => ({ value: `${court.id}`, label: court.name }))}
            {...form.getInputProps('court_id')}
          />
        )}

        <NumberInput
          withAsterisk
          mt="lg"
          label={`${t('score_of_label')} ${team1Name}`}
          placeholder={`${t('score_of_label')} ${team1Name}`}
          {...form.getInputProps('stage_item_input1_score')}
        />
        <NumberInput
          withAsterisk
          mt="lg"
          label={`${t('score_of_label')} ${team2Name}`}
          placeholder={`${t('score_of_label')} ${team2Name}`}
          {...form.getInputProps('stage_item_input2_score')}
        />

        {bothTeamsPresent && (
          <>
            <Text size="sm" mt="lg" fw={500}>
              Winner
            </Text>
            <SegmentedControl
              fullWidth
              mt={4}
              color="green"
              data={[
                { label: team1Name, value: 'team1' },
                { label: team2Name, value: 'team2' },
              ]}
              value={currentWinner}
              onChange={declareWinner}
            />
          </>
        )}

        <Button fullWidth style={{ marginTop: 20 }} color="green" type="submit">
          {t('save_button')}
        </Button>
      </form>

      {bothTeamsPresent && (
        <>
          <Divider my="lg" label="No-show / walkover" labelPosition="center" />
          <Text size="xs" c="dimmed" mb="xs">
            Advance a team without playing (e.g. the other team didn't show up). This is recorded as
            a walkover, not a score.
          </Text>
          <Group grow>
            <Button variant="light" color="orange" onClick={() => saveResult(1, 0, true)}>
              {team1Name} wins by walkover
            </Button>
            <Button variant="light" color="orange" onClick={() => saveResult(0, 1, true)}>
              {team2Name} wins by walkover
            </Button>
          </Group>
        </>
      )}

      {round && round.is_draft && (
        <MatchDeleteButton
          swrStagesResponse={swrStagesResponse}
          swrUpcomingMatchesResponse={swrUpcomingMatchesResponse}
          tournamentData={tournamentData}
          match={match}
        />
      )}
    </>
  );
}

export default function MatchModal({
  tournamentData,
  match,
  swrStagesResponse,
  swrUpcomingMatchesResponse,
  opened,
  setOpened,
  round,
}: {
  tournamentData: TournamentMinimal;
  match: MatchWithDetails | null;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrUpcomingMatchesResponse: SWRResponse | null;
  opened: boolean;
  setOpened: any;
  round: RoundWithMatches | null;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Modal opened={opened} onClose={() => setOpened(false)} title={t('edit_match_modal_title')}>
        <MatchModalForm
          swrStagesResponse={swrStagesResponse}
          swrUpcomingMatchesResponse={swrUpcomingMatchesResponse}
          tournamentData={tournamentData}
          match={match}
          setOpened={setOpened}
          round={round}
        />
      </Modal>
    </>
  );
}
