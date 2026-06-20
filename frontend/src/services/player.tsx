import { Player } from '@openapi';
import { createAxios, handleRequestError } from './adapter';

export async function createPlayer(tournament_id: number, name: string, active: boolean) {
  return createAxios()
    .post(`tournaments/${tournament_id}/players`, { name, active })
    .catch((response: any) => handleRequestError(response));
}

// Map a list of player names to player ids, creating any that don't exist yet. Lets the Teams
// page manage players inline (type a name and it's created), so a separate Players tab isn't
// needed. Matching is case-insensitive on the trimmed name.
export async function resolvePlayerIdsByName(
  tournament_id: number,
  names: string[],
  existingPlayers: Player[]
): Promise<string[]> {
  const idByName = new Map(existingPlayers.map((p) => [p.name.trim().toLowerCase(), `${p.id}`]));
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name.length < 1) continue;
    const existing = idByName.get(name.toLowerCase());
    if (existing != null) {
      ids.push(existing);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const response: any = await createPlayer(tournament_id, name, true);
    const newId = response?.data?.data?.id;
    if (newId != null) {
      const idStr = `${newId}`;
      idByName.set(name.toLowerCase(), idStr);
      ids.push(idStr);
    }
  }
  return ids;
}

export async function createMultiplePlayers(tournament_id: number, names: string, active: boolean) {
  return createAxios()
    .post(`tournaments/${tournament_id}/players_multi`, { names, active })
    .catch((response: any) => handleRequestError(response));
}

export async function deletePlayer(tournament_id: number, player_id: number) {
  return createAxios()
    .delete(`tournaments/${tournament_id}/players/${player_id}`)
    .catch((response: any) => handleRequestError(response));
}

export async function updatePlayer(
  tournament_id: number,
  player_id: number,
  name: string,
  active: boolean,
  team_id: string | null
) {
  return createAxios()
    .put(`tournaments/${tournament_id}/players/${player_id}`, {
      name,
      active,
      team_id,
    })
    .catch((response: any) => handleRequestError(response));
}
