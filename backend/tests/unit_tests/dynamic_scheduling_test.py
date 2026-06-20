from bracket.logic.scheduling.dynamic import (
    _ordered_matches,
    match_is_playable,
    match_is_unfinalized_bye,
)
from bracket.models.db.match import MatchStatus, MatchWithDetails
from bracket.models.db.stage_item_inputs import StageItemInputEmpty, StageItemInputFinal
from bracket.models.db.team import Team
from bracket.models.db.util import RoundWithMatches, StageWithStageItems
from bracket.utils.dummy_records import DUMMY_MOCK_TIME, DUMMY_TEAM1, DUMMY_TEAM2
from bracket.utils.id_types import (
    MatchId,
    RoundId,
    StageId,
    StageItemId,
    StageItemInputId,
    TeamId,
    TournamentId,
)
from tests.unit_tests.mocks import get_stage_item_mock

TID = TournamentId(-1)


def _final(slot: int, team_no: int) -> StageItemInputFinal:
    dummy = DUMMY_TEAM1 if team_no == 1 else DUMMY_TEAM2
    return StageItemInputFinal(
        id=StageItemInputId(-slot),
        team_id=TeamId(-team_no),
        slot=slot,
        tournament_id=TID,
        team=Team(**dummy.model_dump(), id=TeamId(-team_no)),
    )


def _empty(slot: int) -> StageItemInputEmpty:
    return StageItemInputEmpty(id=StageItemInputId(-slot), slot=slot, tournament_id=TID)


def _match(
    match_id: int,
    *,
    input1: object | None,
    input2: object | None,
    round_id: int = -3,
    score1: int = 0,
    score2: int = 0,
    status: MatchStatus = MatchStatus.PENDING,
) -> MatchWithDetails:
    return MatchWithDetails(
        id=MatchId(match_id),
        created=DUMMY_MOCK_TIME,
        duration_minutes=10,
        margin_minutes=0,
        round_id=RoundId(round_id),
        stage_item_input1=input1,  # type: ignore[arg-type]
        stage_item_input2=input2,  # type: ignore[arg-type]
        stage_item_input1_id=getattr(input1, "id", None),
        stage_item_input2_id=getattr(input2, "id", None),
        stage_item_input1_score=score1,
        stage_item_input2_score=score2,
        stage_item_input1_conflict=False,
        stage_item_input2_conflict=False,
        status=status,
    )


def test_match_is_playable() -> None:
    # Two real teams, not finished -> playable.
    assert match_is_playable(_match(-1, input1=_final(1, 1), input2=_final(2, 2)))
    # One side is a bye -> not playable.
    assert not match_is_playable(_match(-2, input1=_final(1, 1), input2=_empty(2)))
    # Waiting on feeder matches (no inputs yet) -> not playable.
    assert not match_is_playable(_match(-3, input1=None, input2=None))
    # Already finished -> not playable.
    assert not match_is_playable(
        _match(-4, input1=_final(1, 1), input2=_final(2, 2), status=MatchStatus.FINISHED)
    )


def test_match_is_unfinalized_bye() -> None:
    # Real team vs empty slot -> a bye that should be finalized.
    assert match_is_unfinalized_bye(_match(-1, input1=_final(1, 1), input2=_empty(2)))
    # Two real teams, no result yet -> not a bye.
    assert not match_is_unfinalized_bye(_match(-2, input1=_final(1, 1), input2=_final(2, 2)))
    # Undecided feeder -> not a bye.
    assert not match_is_unfinalized_bye(_match(-3, input1=None, input2=None))
    # Already finished bye -> nothing to do.
    assert not match_is_unfinalized_bye(
        _match(-4, input1=_final(1, 1), input2=_empty(2), status=MatchStatus.FINISHED)
    )


def test_ordered_matches_sorts_by_round_then_id() -> None:
    m_r1_a = _match(-10, input1=_final(1, 1), input2=_final(2, 2), round_id=-3)
    m_r1_b = _match(-5, input1=_final(1, 1), input2=_final(2, 2), round_id=-3)
    m_r2 = _match(-20, input1=None, input2=None, round_id=-2)

    rounds = [
        RoundWithMatches(
            id=RoundId(-2),
            matches=[m_r2],
            stage_item_id=StageItemId(-1),
            created=DUMMY_MOCK_TIME,
            is_draft=False,
            name="",
        ),
        RoundWithMatches(
            id=RoundId(-3),
            matches=[m_r1_a, m_r1_b],
            stage_item_id=StageItemId(-1),
            created=DUMMY_MOCK_TIME,
            is_draft=False,
            name="",
        ),
    ]
    stage = StageWithStageItems(
        id=StageId(-1),
        tournament_id=TID,
        name="",
        created=DUMMY_MOCK_TIME,
        is_active=False,
        stage_items=[get_stage_item_mock([_final(1, 1), _final(2, 2)], rounds)],
    )

    ordered_ids = [m.id for m in _ordered_matches([stage])]
    # Round -3 comes before round -2; within a round, ascending match id.
    assert ordered_ids == [MatchId(-10), MatchId(-5), MatchId(-20)]
