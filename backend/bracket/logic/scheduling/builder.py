from fastapi import HTTPException

from bracket.logic.ranking.calculation import recalculate_ranking_for_stage_item
from bracket.logic.ranking.elimination import update_inputs_in_complete_elimination_stage_item
from bracket.logic.scheduling.elimination import (
    build_seeded_elimination_inputs,
    build_single_elimination_stage_item,
    get_next_power_of_two,
    get_number_of_rounds_to_create_single_elimination,
)
from bracket.logic.scheduling.round_robin import (
    build_round_robin_stage_item,
    get_number_of_rounds_to_create_round_robin,
)
from bracket.models.db.round import RoundInsertable
from bracket.models.db.stage_item import (
    StageItem,
    StageItemWithInputsCreate,
    StageType,
)
from bracket.models.db.stage_item_inputs import (
    StageItemInputFinal,
    StageItemInputOptionFinal,
    StageItemInputOptionTentative,
    StageItemInputTentative,
)
from bracket.models.db.team import FullTeamWithPlayers
from bracket.models.db.util import StageWithStageItems
from bracket.sql.rounds import get_next_round_name, sql_create_round
from bracket.sql.shared import sql_delete_stage_item_with_foreign_keys
from bracket.sql.stage_items import get_stage_item, sql_create_stage_item_with_inputs
from bracket.sql.stages import get_full_tournament_details, sql_create_stage, sql_delete_stage
from bracket.utils.id_types import StageId, StageItemId, TeamId, TournamentId
from tests.integration_tests.mocks import MOCK_NOW


async def delete_single_elimination_stage_items(tournament_id: TournamentId) -> None:
    """
    Remove all existing single-elimination stage items (and any stage left empty as a result).
    Used when regenerating a bracket so re-seeding replaces the previous bracket instead of
    stacking a second one.
    """
    stages = await get_full_tournament_details(tournament_id)
    for stage in stages:
        deleted_any = False
        for stage_item in stage.stage_items:
            if stage_item.type == StageType.SINGLE_ELIMINATION:
                await sql_delete_stage_item_with_foreign_keys(stage_item.id)
                deleted_any = True

        remaining = [
            si for si in stage.stage_items if si.type != StageType.SINGLE_ELIMINATION
        ]
        if deleted_any and len(remaining) == 0:
            await sql_delete_stage(tournament_id, stage.id)


async def create_rounds_for_new_stage_item(
    tournament_id: TournamentId, stage_item: StageItem
) -> None:
    rounds_count: int
    match stage_item.type:
        case StageType.ROUND_ROBIN:
            rounds_count = get_number_of_rounds_to_create_round_robin(stage_item.team_count)
        case StageType.SINGLE_ELIMINATION:
            rounds_count = get_number_of_rounds_to_create_single_elimination(stage_item.team_count)
        case StageType.SWISS:
            return None
        case other:
            raise NotImplementedError(f"No round creation implementation for {other}")

    for _ in range(rounds_count):
        await sql_create_round(
            RoundInsertable(
                created=MOCK_NOW,
                is_draft=False,
                stage_item_id=stage_item.id,
                name=await get_next_round_name(tournament_id, stage_item.id),
            ),
        )


async def generate_single_elimination_bracket_from_teams(
    tournament_id: TournamentId,
    team_ids: list[TeamId],
    name: str | None = None,
    replace_existing: bool = False,
) -> StageItem:
    """
    One-shot helper for the simplified workflow: create a new stage containing a single
    single-elimination stage item seeded with the given teams (in seed order). Teams are
    padded with byes to the next power of two using standard seeding, so any number of teams
    (>= 2) produces a correct bracket. Byes are then resolved so the first real matches are
    ready to play.

    When `replace_existing` is set, any pre-existing single-elimination bracket is removed
    first, so re-seeding regenerates the bracket in place rather than adding another one.
    """
    if len(team_ids) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 teams are required to generate a bracket",
        )

    if replace_existing:
        await delete_single_elimination_stage_items(tournament_id)

    bracket_size = get_next_power_of_two(len(team_ids))
    inputs = build_seeded_elimination_inputs(team_ids)

    stage = await sql_create_stage(tournament_id)
    stage_item = await sql_create_stage_item_with_inputs(
        tournament_id,
        StageItemWithInputsCreate(
            stage_id=stage.id,
            name=name,
            team_count=bracket_size,
            type=StageType.SINGLE_ELIMINATION,
            inputs=inputs,
        ),
    )

    await build_matches_for_stage_item(stage_item, tournament_id)

    # Propagate byes: teams paired with an empty slot advance immediately, so the next round
    # already shows them as confirmed participants.
    stage_item_with_rounds = await get_stage_item(tournament_id, stage_item.id)
    await update_inputs_in_complete_elimination_stage_item(stage_item_with_rounds)

    return stage_item


async def build_matches_for_stage_item(stage_item: StageItem, tournament_id: TournamentId) -> None:
    await create_rounds_for_new_stage_item(tournament_id, stage_item)
    stage_item_with_rounds = await get_stage_item(tournament_id, stage_item.id)

    match stage_item.type:
        case StageType.ROUND_ROBIN:
            await build_round_robin_stage_item(tournament_id, stage_item_with_rounds)
        case StageType.SINGLE_ELIMINATION:
            await build_single_elimination_stage_item(tournament_id, stage_item_with_rounds)
        case StageType.SWISS:
            return None

        case _:
            raise HTTPException(
                400, f"Cannot automatically create matches for stage type {stage_item.type}"
            )

    await recalculate_ranking_for_stage_item(tournament_id, stage_item_with_rounds)


def determine_available_inputs(
    teams: list[FullTeamWithPlayers],
    stages: list[StageWithStageItems],
) -> dict[StageId, list[StageItemInputOptionTentative | StageItemInputOptionFinal]]:
    """
    Returns available inputs for the given stage.

    Inputs are either from:
    - Teams directly
    - Previous ROUND_ROBIN or SWISS stage items (tentative options)
    """
    all_team_options = {
        team.id: StageItemInputOptionFinal(team_id=team.id, already_taken=False) for team in teams
    }
    # Add inputs from non-elimination stage items that can be used in the next stage.
    # Elimination stage items have no "outputs" but are final.
    all_tentative_options = {
        (stage_item.id, winner_position): StageItemInputOptionTentative(
            winner_from_stage_item_id=stage_item.id,
            winner_position=winner_position,
            already_taken=False,
        )
        for stage in stages
        for stage_item in stage.stage_items
        if stage_item.type in {StageType.ROUND_ROBIN, StageType.SWISS}
        for winner_position in range(1, stage_item.team_count + 1)
    }

    # Determine which inputs have been used (set `already_taken` to True)
    for stage in stages:
        for stage_item in stage.stage_items:
            for input_ in stage_item.inputs:
                match input_:
                    case StageItemInputFinal() as final if input_.team_id in all_team_options:
                        all_team_options[final.team_id].already_taken = True

                    case StageItemInputTentative() as tentative:
                        if (key := tentative.get_lookup_key()) in all_tentative_options:
                            all_tentative_options[key].already_taken = True

    # Loop through stage items once more to assemble the final results and make sure
    # tentative inputs are only available after the stage item that they originate from.
    # We start with all teams but not tentative inputs.
    results_teams = all_team_options.copy()
    results_tentative: dict[tuple[StageItemId, int], StageItemInputOptionTentative] = {}
    results = {}

    for stage in stages:
        results[stage.id] = list(results_teams.values()) + list(results_tentative.values())

        # Add options for subsequent stage items for the tentative "outputs" from this round
        for stage_item in stage.stage_items:
            for (option_stage_item_id, option_win_pos), option in all_tentative_options.items():
                if option_stage_item_id == stage_item.id:
                    results_tentative[(option_stage_item_id, option_win_pos)] = option

    return results
