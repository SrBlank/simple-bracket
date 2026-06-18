import {
  Button,
  Center,
  Checkbox,
  Divider,
  Grid,
  Modal,
  NumberInput,
  SegmentedControl,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import DeleteButton from '@components/buttons/delete';
import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { TournamentMinimal } from '@components/utils/tournament';
import { MatchWithDetails, RoundWithMatches, StagesWithStageItemsResponse } from '@openapi';
import { getMatchLookup, getStageItemLookup } from '@services/lookups';
import { deleteMatch, updateMatch } from '@services/match';

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
  const form = useForm({
    initialValues: {
      stage_item_input1_score: match.stage_item_input1_score,
      stage_item_input2_score: match.stage_item_input2_score,
      custom_duration_minutes: match.custom_duration_minutes,
      custom_margin_minutes: match.custom_margin_minutes,
    },

    validate: {
      stage_item_input1_score: (value) => (value >= 0 ? null : t('negative_score_validation')),
      stage_item_input2_score: (value) => (value >= 0 ? null : t('negative_score_validation')),
      custom_duration_minutes: (value) =>
        value == null || value >= 0 ? null : t('negative_match_duration_validation'),
      custom_margin_minutes: (value) =>
        value == null || value >= 0 ? null : t('negative_match_margin_validation'),
    },
  });

  const [customDurationEnabled, setCustomDurationEnabled] = useState(
    match.custom_duration_minutes != null
  );
  const [customMarginEnabled, setCustomMarginEnabled] = useState(
    match.custom_margin_minutes != null
  );

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const matchesLookup = getMatchLookup(swrStagesResponse);

  const team1Name = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
  const team2Name = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);

  // The winner is whichever side has the higher score; the bracket advances that team. The
  // selector below lets the organizer declare a winner directly (e.g. for a walkover or to
  // break a tie) by nudging the score so the chosen side leads, without discarding a real
  // score that already reflects the result.
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

  return (
    <>
      <form
        onSubmit={form.onSubmit(async (values) => {
          const updatedMatch = {
            id: match.id,
            round_id: match.round_id,
            stage_item_input1_score: values.stage_item_input1_score,
            stage_item_input2_score: values.stage_item_input2_score,
            court_id: match.court_id || null,
            custom_duration_minutes: customDurationEnabled ? values.custom_duration_minutes : null,
            custom_margin_minutes: customMarginEnabled ? values.custom_margin_minutes : null,
          };
          await updateMatch(tournamentData.id, match.id, updatedMatch);
          await swrStagesResponse.mutate();
          if (swrUpcomingMatchesResponse != null) await swrUpcomingMatchesResponse.mutate();
          setOpened(false);
        })}
      >
        <NumberInput
          withAsterisk
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

        <Divider mt="lg" />

        <Text size="sm" mt="lg">
          {t('custom_match_duration_label')}
        </Text>
        <Grid align="center">
          <Grid.Col span={{ sm: 8 }}>
            <NumberInput
              disabled={!customDurationEnabled}
              rightSection={<Text>{t('minutes')}</Text>}
              placeholder={`${match.duration_minutes}`}
              rightSectionWidth={92}
              {...form.getInputProps('custom_duration_minutes')}
            />
          </Grid.Col>
          <Grid.Col span={{ sm: 4 }}>
            <Center>
              <Checkbox
                checked={customDurationEnabled}
                label={t('customize_checkbox_label')}
                onChange={(event) => {
                  setCustomDurationEnabled(event.currentTarget.checked);
                }}
              />
            </Center>
          </Grid.Col>
        </Grid>

        <Text size="sm" mt="lg">
          {t('custom_match_margin_label')}
        </Text>
        <Grid align="center">
          <Grid.Col span={{ sm: 8 }}>
            <NumberInput
              disabled={!customMarginEnabled}
              placeholder={`${match.margin_minutes}`}
              rightSection={<Text>{t('minutes')}</Text>}
              rightSectionWidth={92}
              {...form.getInputProps('custom_margin_minutes')}
            />
          </Grid.Col>
          <Grid.Col span={{ sm: 4 }}>
            <Center>
              <Checkbox
                checked={customMarginEnabled}
                label={t('customize_checkbox_label')}
                onChange={(event) => {
                  setCustomMarginEnabled(event.currentTarget.checked);
                }}
              />
            </Center>
          </Grid.Col>
        </Grid>

        <Button fullWidth style={{ marginTop: 20 }} color="green" type="submit">
          {t('save_button')}
        </Button>
      </form>
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
