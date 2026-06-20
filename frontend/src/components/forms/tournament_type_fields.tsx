import { Checkbox, SegmentedControl, Select, Stack, Text } from '@mantine/core';

// Picking a preset just seeds sensible defaults; every individual setting stays editable.
export function applyTournamentTypePreset(form: any, type: string | null) {
  form.setFieldValue('tournament_type', type);
  if (type === 'PICKLEBALL') {
    form.setFieldValue('scheduling_mode', 'DYNAMIC');
    form.setFieldValue('show_player_names', true);
  } else {
    form.setFieldValue('scheduling_mode', 'TIMED');
    form.setFieldValue('show_player_names', false);
  }
}

export function TournamentTypeFields({ form }: { form: any }) {
  const mode = form.values.scheduling_mode;
  return (
    <Stack gap="md" mt="md">
      <Select
        label="Tournament type"
        description="Sets sensible defaults below — you can still change each one."
        allowDeselect={false}
        data={[
          { value: 'GENERIC', label: 'Generic' },
          { value: 'PICKLEBALL', label: 'Pickleball (doubles)' },
        ]}
        value={form.values.tournament_type}
        onChange={(value) => applyTournamentTypePreset(form, value)}
      />

      <div>
        <Text size="sm" fw={500}>
          Scheduling
        </Text>
        <SegmentedControl
          fullWidth
          mt={4}
          data={[
            { value: 'TIMED', label: 'Timed schedule' },
            { value: 'DYNAMIC', label: 'Dynamic (no clock)' },
          ]}
          value={mode}
          onChange={(value) => form.setFieldValue('scheduling_mode', value)}
        />
        <Text size="xs" c="dimmed" mt={4}>
          Dynamic: matches queue up and a court is filled as soon as one frees — no start times
          needed.
        </Text>
      </div>

      {mode === 'DYNAMIC' && (
        <Checkbox
          label="Automatically start the next match when a court frees up"
          description="Off = the freed court shows the next match as a suggestion for you to confirm."
          {...form.getInputProps('court_auto_advance', { type: 'checkbox' })}
        />
      )}

      <Checkbox
        label="Show player names on the bracket and court board"
        {...form.getInputProps('show_player_names', { type: 'checkbox' })}
      />
    </Stack>
  );
}
