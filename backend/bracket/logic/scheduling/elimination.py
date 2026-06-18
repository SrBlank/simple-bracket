import math

from bracket.models.db.match import Match, MatchCreateBody
from bracket.models.db.stage_item_inputs import (
    StageItemInputCreateBody,
    StageItemInputCreateBodyEmpty,
    StageItemInputCreateBodyFinal,
)
from bracket.models.db.tournament import Tournament
from bracket.models.db.util import RoundWithMatches, StageItemWithRounds
from bracket.sql.matches import sql_create_match
from bracket.sql.rounds import get_rounds_for_stage_item
from bracket.sql.tournaments import sql_get_tournament
from bracket.utils.id_types import TeamId, TournamentId


def get_next_power_of_two(team_count: int) -> int:
    """
    Smallest power of two that can hold `team_count` competitors (i.e. the bracket size).
    """
    if team_count < 2:
        return 2
    return 2 ** math.ceil(math.log2(team_count))


def get_bracket_seeding_order(bracket_size: int) -> list[int]:
    """
    Standard single-elimination seeding order.

    Returns a list of 1-indexed seed numbers in slot order, so that pairing adjacent slots
    (0v1, 2v3, ...) yields the canonical matchups: the top seed meets the bottom seed, the
    2nd seed meets the 2nd-to-last, and so on. When the highest seed numbers are byes, this
    distributes byes to the top seeds and ensures two byes never meet, so no competitor gets
    a free ride past the first round.

    e.g. bracket_size=8 -> [1, 8, 4, 5, 2, 7, 3, 6]
    """
    assert bracket_size >= 1 and (bracket_size & (bracket_size - 1)) == 0, (
        "bracket_size must be a power of two"
    )

    order = [1]
    while len(order) < bracket_size:
        size = len(order) * 2
        order = [seed for s in order for seed in (s, size + 1 - s)]

    return order


def build_inputs_from_slots(slots: list[TeamId | None]) -> list[StageItemInputCreateBody]:
    """
    Build bracket inputs from an explicit slot layout (team id, or None for a bye). Used when
    the organizer has manually arranged the bracket, so the exact placement is preserved
    rather than re-derived from seeding.
    """
    inputs: list[StageItemInputCreateBody] = []
    for slot_index, team_id in enumerate(slots):
        slot = slot_index + 1
        if team_id is None:
            inputs.append(StageItemInputCreateBodyEmpty(slot=slot))
        else:
            inputs.append(StageItemInputCreateBodyFinal(slot=slot, team_id=team_id))

    return inputs


def build_seeded_elimination_inputs(team_ids: list[TeamId]) -> list[StageItemInputCreateBody]:
    """
    Map an ordered (by seed) list of teams onto a single-elimination bracket, padding with
    byes (empty inputs) up to the next power of two and placing teams in standard seeding
    order. Slot numbers are 1-indexed and contiguous.
    """
    team_count = len(team_ids)
    bracket_size = get_next_power_of_two(team_count)
    seeding_order = get_bracket_seeding_order(bracket_size)

    inputs: list[StageItemInputCreateBody] = []
    for slot_index, seed in enumerate(seeding_order):
        slot = slot_index + 1
        if seed <= team_count:
            inputs.append(StageItemInputCreateBodyFinal(slot=slot, team_id=team_ids[seed - 1]))
        else:
            inputs.append(StageItemInputCreateBodyEmpty(slot=slot))

    return inputs


def determine_matches_first_round(
    round_: RoundWithMatches, stage_item: StageItemWithRounds, tournament: Tournament
) -> list[MatchCreateBody]:
    suggestions: list[MatchCreateBody] = []

    for i in range(0, len(stage_item.inputs), 2):
        first_input = stage_item.inputs[i + 0]
        second_input = stage_item.inputs[i + 1]
        suggestions.append(
            MatchCreateBody(
                round_id=round_.id,
                court_id=None,
                stage_item_input1_id=first_input.id,
                stage_item_input1_winner_from_match_id=None,
                stage_item_input2_id=second_input.id,
                stage_item_input2_winner_from_match_id=None,
                duration_minutes=tournament.duration_minutes,
                margin_minutes=tournament.margin_minutes,
                custom_duration_minutes=None,
                custom_margin_minutes=None,
            )
        )

    return suggestions


def determine_matches_subsequent_round(
    prev_matches: list[Match],
    round_: RoundWithMatches,
    tournament: Tournament,
) -> list[MatchCreateBody]:
    suggestions: list[MatchCreateBody] = []

    for i in range(0, len(prev_matches), 2):
        first_match = prev_matches[i + 0]
        second_match = prev_matches[i + 1]

        suggestions.append(
            MatchCreateBody(
                round_id=round_.id,
                court_id=None,
                stage_item_input1_id=None,
                stage_item_input2_id=None,
                stage_item_input1_winner_from_match_id=first_match.id,
                stage_item_input2_winner_from_match_id=second_match.id,
                duration_minutes=tournament.duration_minutes,
                margin_minutes=tournament.margin_minutes,
                custom_duration_minutes=None,
                custom_margin_minutes=None,
            )
        )
    return suggestions


async def build_single_elimination_stage_item(
    tournament_id: TournamentId, stage_item: StageItemWithRounds
) -> None:
    rounds = await get_rounds_for_stage_item(tournament_id, stage_item.id)
    tournament = await sql_get_tournament(tournament_id)

    assert len(rounds) > 0
    first_round = rounds[0]

    prev_matches = [
        await sql_create_match(match)
        for match in determine_matches_first_round(first_round, stage_item, tournament)
    ]

    for round_ in rounds[1:]:
        prev_matches = [
            await sql_create_match(match)
            for match in determine_matches_subsequent_round(prev_matches, round_, tournament)
        ]


def get_number_of_rounds_to_create_single_elimination(team_count: int) -> int:
    """
    Number of rounds in a single-elimination bracket holding `team_count` competitors.

    Any count >= 2 is supported: the bracket is padded with byes to the next power of two,
    so e.g. 5 teams -> bracket of 8 -> 3 rounds.
    """
    if team_count < 2:
        return 0

    return int(math.log2(get_next_power_of_two(team_count)))
