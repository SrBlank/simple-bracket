import { Button, Checkbox, Grid, Image, Modal, NumberInput, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { GoPlus } from '@react-icons/all-files/go/GoPlus';
import { IconCalendar, IconCalendarTime } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import SaveButton from '@components/buttons/save';
import { Club, Tournament, TournamentsResponse } from '@openapi';
import { getBaseApiUrl, getClubs } from '@services/adapter';
import { createTournament } from '@services/tournament';
import dayjs from 'dayjs';

export function TournamentLogo({ tournament }: { tournament: Tournament | null }) {
  if (tournament == null || tournament.logo_path == null) return null;
  return (
    <Image
      radius="md"
      alt="Logo of the tournament"
      src={`${getBaseApiUrl()}/static/tournament-logos/${tournament.logo_path}`}
    />
  );
}

function GeneralTournamentForm({
  setOpened,
  swrTournamentsResponse,
  clubs,
}: {
  setOpened: any;
  swrTournamentsResponse: SWRResponse<TournamentsResponse>;
  clubs: Club[];
}) {
  const { t } = useTranslation();
  // Single-organizer mode: tournaments always belong to the one default club, so there is no
  // club picker. We attach to the first (default) club automatically.
  const defaultClubId = clubs.length > 0 ? clubs[0].id : null;
  const form = useForm({
    initialValues: {
      start_time: dayjs(),
      name: '',
      dashboard_public: true,
      dashboard_endpoint: '',
      players_can_be_in_multiple_teams: false,
      auto_assign_courts: true,
      duration_minutes: 10,
      margin_minutes: 5,
    },

    validate: {
      name: (value) => (value.length > 0 ? null : t('too_short_name_validation')),
      start_time: (value) => (value != null ? null : t('start_time_choose_title')),
      duration_minutes: (value) =>
        value != null && value > 0 ? null : t('duration_minutes_choose_title'),
      margin_minutes: (value) =>
        value != null && value > 0 ? null : t('margin_minutes_choose_title'),
    },
  });

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        if (defaultClubId == null) {
          return;
        }
        await createTournament(
          defaultClubId,
          values.name,
          values.dashboard_public,
          values.dashboard_endpoint,
          values.players_can_be_in_multiple_teams,
          values.auto_assign_courts,
          values.start_time,
          values.duration_minutes,
          values.margin_minutes
        );
        await swrTournamentsResponse.mutate();
        setOpened(false);
      })}
    >
      <TextInput
        withAsterisk
        label={t('name_input_label')}
        placeholder={t('tournament_name_input_placeholder')}
        {...form.getInputProps('name')}
      />

      <TextInput
        label={t('dashboard_link_label')}
        placeholder={t('dashboard_link_placeholder')}
        mt="lg"
        {...form.getInputProps('dashboard_endpoint')}
      />
      <Grid mt="1rem">
        <Grid.Col span={{ sm: 9 }}>
          <DateTimePicker
            leftSection={<IconCalendar size="1.1rem" stroke={1.5} />}
            mx="auto"
            {...form.getInputProps('start_time')}
          />
        </Grid.Col>
        <Grid.Col span={{ sm: 3 }}>
          <Button
            fullWidth
            color="indigo"
            leftSection={<IconCalendarTime size="1.1rem" stroke={1.5} />}
            onClick={() => {
              form.setFieldValue('start_time', dayjs());
            }}
          >
            {t('now_button')}
          </Button>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ sm: 6 }}>
          <NumberInput
            label={t('match_duration_label')}
            mt="lg"
            {...form.getInputProps('duration_minutes')}
          />
        </Grid.Col>
        <Grid.Col span={{ sm: 6 }}>
          <NumberInput
            label={t('time_between_matches_label')}
            mt="lg"
            {...form.getInputProps('margin_minutes')}
          />
        </Grid.Col>
      </Grid>

      <Checkbox
        mt="md"
        label={t('dashboard_public_description')}
        {...form.getInputProps('dashboard_public', { type: 'checkbox' })}
      />
      <Checkbox
        mt="md"
        label={t('miscellaneous_label')}
        {...form.getInputProps('players_can_be_in_multiple_teams', { type: 'checkbox' })}
      />
      <Checkbox
        mt="md"
        label={t('auto_assign_courts_label')}
        {...form.getInputProps('auto_assign_courts', { type: 'checkbox' })}
      />

      <Button fullWidth mt={8} color="green" type="submit">
        {t('save_button')}
      </Button>
    </form>
  );
}

export default function TournamentModal({
  swrTournamentsResponse,
}: {
  swrTournamentsResponse: SWRResponse<TournamentsResponse>;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const operation_text = t('create_tournament_button');
  const swrClubsResponse = getClubs();
  const clubs = swrClubsResponse.data?.data || [];

  return (
    <>
      <Modal opened={opened} onClose={() => setOpened(false)} title={operation_text} size="50rem">
        <GeneralTournamentForm
          setOpened={setOpened}
          swrTournamentsResponse={swrTournamentsResponse}
          clubs={clubs}
        />
      </Modal>
      <SaveButton
        mx="0px"
        fullWidth
        onClick={() => setOpened(true)}
        leftSection={<GoPlus size={24} />}
        title={operation_text}
      />
    </>
  );
}
