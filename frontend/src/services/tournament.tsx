import { Dayjs } from 'dayjs';
import { createAxios, handleRequestError } from './adapter';

export interface TournamentFormValues {
  name: string;
  dashboard_public: boolean;
  dashboard_endpoint: string | null | undefined;
  players_can_be_in_multiple_teams: boolean;
  auto_assign_courts: boolean;
  tournament_type: 'GENERIC' | 'PICKLEBALL';
  scheduling_mode: 'TIMED' | 'DYNAMIC';
  court_auto_advance: boolean;
  show_player_names: boolean;
  duration_minutes: number;
  margin_minutes: number;
}

export async function createTournament(
  club_id: number,
  values: TournamentFormValues & { start_time: Dayjs }
) {
  return createAxios()
    .post('tournaments', { club_id, ...values })
    .catch((response: any) => handleRequestError(response));
}

export async function deleteTournament(tournament_id: number) {
  return createAxios().delete(`tournaments/${tournament_id}`);
}

export async function archiveTournament(tournament_id: number) {
  return createAxios().post(`tournaments/${tournament_id}/change-status`, { status: 'ARCHIVED' });
}

export async function unarchiveTournament(tournament_id: number) {
  return createAxios().post(`tournaments/${tournament_id}/change-status`, { status: 'OPEN' });
}

export async function updateTournament(
  tournament_id: number,
  values: TournamentFormValues & { start_time: string }
) {
  return createAxios()
    .put(`tournaments/${tournament_id}`, values)
    .catch((response: any) => handleRequestError(response));
}
