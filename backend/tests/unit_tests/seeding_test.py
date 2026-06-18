import pytest

from bracket.logic.scheduling.elimination import (
    build_inputs_from_slots,
    build_seeded_elimination_inputs,
    get_bracket_seeding_order,
    get_next_power_of_two,
    get_number_of_rounds_to_create_single_elimination,
)
from bracket.models.db.stage_item_inputs import (
    StageItemInputCreateBodyEmpty,
    StageItemInputCreateBodyFinal,
)
from bracket.utils.id_types import TeamId


@pytest.mark.parametrize(
    ("team_count", "expected"),
    [(2, 2), (3, 4), (4, 4), (5, 8), (7, 8), (8, 8), (9, 16), (16, 16), (17, 32)],
)
def test_get_next_power_of_two(team_count: int, expected: int) -> None:
    assert get_next_power_of_two(team_count) == expected


@pytest.mark.parametrize(
    ("bracket_size", "expected"),
    [
        (1, [1]),
        (2, [1, 2]),
        (4, [1, 4, 2, 3]),
        (8, [1, 8, 4, 5, 2, 7, 3, 6]),
    ],
)
def test_get_bracket_seeding_order(bracket_size: int, expected: list[int]) -> None:
    assert get_bracket_seeding_order(bracket_size) == expected


@pytest.mark.parametrize("bracket_size", [2, 4, 8, 16, 32, 64])
def test_seeding_order_is_a_valid_permutation(bracket_size: int) -> None:
    order = get_bracket_seeding_order(bracket_size)
    # Every seed appears exactly once.
    assert sorted(order) == list(range(1, bracket_size + 1))
    # Each first-round pairing (adjacent slots) sums to bracket_size + 1, i.e. the strongest
    # seed always faces the weakest remaining seed.
    for i in range(0, bracket_size, 2):
        assert order[i] + order[i + 1] == bracket_size + 1


@pytest.mark.parametrize(
    ("team_count", "expected_rounds"),
    [(2, 1), (3, 2), (4, 2), (5, 3), (8, 3), (9, 4), (16, 4), (32, 5)],
)
def test_number_of_rounds(team_count: int, expected_rounds: int) -> None:
    assert get_number_of_rounds_to_create_single_elimination(team_count) == expected_rounds


def test_seeded_inputs_pad_to_power_of_two_with_byes() -> None:
    team_ids = [TeamId(i) for i in range(1, 6)]  # 5 teams
    inputs = build_seeded_elimination_inputs(team_ids)

    assert len(inputs) == 8  # padded to next power of two
    finals = [i for i in inputs if isinstance(i, StageItemInputCreateBodyFinal)]
    byes = [i for i in inputs if isinstance(i, StageItemInputCreateBodyEmpty)]
    assert len(finals) == 5
    assert len(byes) == 3

    # Slots are contiguous and 1-indexed.
    assert sorted(i.slot for i in inputs) == list(range(1, 9))
    # All teams are present exactly once.
    assert sorted(i.team_id for i in finals) == team_ids


def test_build_inputs_from_slots_preserves_layout() -> None:
    # Explicit slot layout: team, bye, team, team (a manually arranged bracket of 4 slots).
    slots = [TeamId(10), None, TeamId(20), TeamId(30)]
    inputs = build_inputs_from_slots(slots)

    assert [i.slot for i in inputs] == [1, 2, 3, 4]
    assert isinstance(inputs[0], StageItemInputCreateBodyFinal) and inputs[0].team_id == TeamId(10)
    assert isinstance(inputs[1], StageItemInputCreateBodyEmpty)
    assert isinstance(inputs[2], StageItemInputCreateBodyFinal) and inputs[2].team_id == TeamId(20)
    assert isinstance(inputs[3], StageItemInputCreateBodyFinal) and inputs[3].team_id == TeamId(30)


@pytest.mark.parametrize("team_count", [3, 5, 6, 7, 9, 11, 13])
def test_no_competitor_gets_a_free_ride_past_round_one(team_count: int) -> None:
    """
    The bug we are fixing: with a non-power-of-2 field, byes used to cluster together so a
    team could advance multiple rounds without playing. With standard seeding, every
    first-round match has at most one bye, so two byes never meet and no team skips past the
    first round for free.
    """
    team_ids = [TeamId(i) for i in range(1, team_count + 1)]
    inputs = build_seeded_elimination_inputs(team_ids)
    inputs_by_slot = sorted(inputs, key=lambda i: i.slot)

    for i in range(0, len(inputs_by_slot), 2):
        pair = (inputs_by_slot[i], inputs_by_slot[i + 1])
        byes_in_pair = sum(1 for inp in pair if isinstance(inp, StageItemInputCreateBodyEmpty))
        assert byes_in_pair <= 1, f"Two byes meet in a first-round match for {team_count} teams"
