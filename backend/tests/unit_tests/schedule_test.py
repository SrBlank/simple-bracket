from bracket.logic.scheduling.elimination import get_number_of_rounds_to_create_single_elimination
from bracket.logic.scheduling.round_robin import get_number_of_rounds_to_create_round_robin


def test_number_of_rounds_round_robin() -> None:
    assert get_number_of_rounds_to_create_round_robin(0) == 0
    assert get_number_of_rounds_to_create_round_robin(2) == 1
    assert get_number_of_rounds_to_create_round_robin(4) == 3
    assert get_number_of_rounds_to_create_round_robin(6) == 5


def test_number_of_rounds_single_elimination() -> None:
    # Powers of two map directly to log2(team_count) rounds.
    assert get_number_of_rounds_to_create_single_elimination(0) == 0
    assert get_number_of_rounds_to_create_single_elimination(1) == 0
    assert get_number_of_rounds_to_create_single_elimination(2) == 1
    assert get_number_of_rounds_to_create_single_elimination(4) == 2
    assert get_number_of_rounds_to_create_single_elimination(8) == 3
    assert get_number_of_rounds_to_create_single_elimination(16) == 4
    assert get_number_of_rounds_to_create_single_elimination(32) == 5
    assert get_number_of_rounds_to_create_single_elimination(64) == 6

    # Non-powers of two are now supported: the bracket is padded with byes to the next
    # power of two, so the round count rounds up.
    assert get_number_of_rounds_to_create_single_elimination(3) == 2
    assert get_number_of_rounds_to_create_single_elimination(5) == 3
    assert get_number_of_rounds_to_create_single_elimination(9) == 4
