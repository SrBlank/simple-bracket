import { createAxios, handleRequestError } from './adapter';

export async function createStageItem(
  tournament_id: number,
  stage_id: number,
  type: string,
  team_count: number
) {
  return createAxios()
    .post(`tournaments/${tournament_id}/stage_items`, { stage_id, type, team_count })
    .catch((response: any) => handleRequestError(response));
}

export async function autoGenerateBracket(
  tournament_id: number,
  options: {
    name?: string | null;
    team_ids?: number[] | null;
    replace_existing?: boolean;
  } = {}
) {
  const { name = null, team_ids = null, replace_existing = false } = options;
  return createAxios()
    .post(`tournaments/${tournament_id}/auto_generate_bracket`, {
      name,
      team_ids,
      replace_existing,
    })
    .catch((response: any) => handleRequestError(response));
}

export async function updateStageItem(
  tournament_id: number,
  stage_item_id: number,
  name: string,
  ranking_id: string
) {
  return createAxios()
    .put(`tournaments/${tournament_id}/stage_items/${stage_item_id}`, { name, ranking_id })
    .catch((response: any) => handleRequestError(response));
}

export async function deleteStageItem(tournament_id: number, stage_item_id: number) {
  return createAxios()
    .delete(`tournaments/${tournament_id}/stage_items/${stage_item_id}`)
    .catch((response: any) => handleRequestError(response));
}
