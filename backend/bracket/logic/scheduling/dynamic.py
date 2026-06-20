"""
Dynamic (no-clock) court scheduling.

Instead of laying matches out on a timeline, matches sit in a queue and are pulled onto a court
the moment one becomes free. This matches how an in-person event actually runs: when a game ends,
the next one starts on that court.

Lifecycle (see `MatchStatus`):
    PENDING  -> not ready yet (waiting on a feeder match) or a bye that hasn't been finalized.
    QUEUED   -> both teams known, waiting for a free court.
    PLAYING  -> currently on a court.
    FINISHED -> a result has been recorded (or it was a bye that auto-advanced).
"""

from heliclockter import datetime_utc

from bracket.models.db.match import MatchStatus, MatchWithDetails
from bracket.models.db.util import StageWithStageItems
from bracket.sql.courts import get_all_courts_in_tournament
from bracket.sql.matches import sql_assign_match_to_court, sql_set_match_status
from bracket.sql.stages import get_full_tournament_details
from bracket.utils.id_types import TournamentId


def _input_is_real_team(stage_item_input: object | None) -> bool:
    """True when the slot holds an actual team (not empty, not a bye, not an undecided feeder)."""
    return stage_item_input is not None and getattr(stage_item_input, "team_id", None) is not None


def match_is_playable(match: MatchWithDetails) -> bool:
    """A match is playable once both slots hold real teams and it hasn't finished."""
    return (
        match.status != MatchStatus.FINISHED
        and _input_is_real_team(match.stage_item_input1)
        and _input_is_real_team(match.stage_item_input2)
    )


def match_is_unfinalized_bye(match: MatchWithDetails) -> bool:
    """
    A bye (one real team against an empty slot) has a winner without ever being played. We finalize
    these immediately so they advance the bracket and never occupy a court.
    """
    return (
        match.status != MatchStatus.FINISHED
        and not match_is_playable(match)
        and match.get_winner() is not None
    )


def _ordered_matches(stages: list[StageWithStageItems]) -> list[MatchWithDetails]:
    """All matches, ordered so earlier rounds are pulled onto courts before later ones."""
    ordered: list[MatchWithDetails] = []
    for stage in stages:
        for stage_item in stage.stage_items:
            for round_ in sorted(stage_item.rounds, key=lambda r: r.id):
                for match in sorted(round_.matches, key=lambda m: m.id):
                    ordered.append(match)  # type: ignore[arg-type]
    return ordered


async def reconcile_dynamic_scheduling(tournament_id: TournamentId, fill_courts: bool) -> None:
    """
    Bring the board into a consistent state for dynamic mode:

    1. Finalize any byes.
    2. Promote every now-playable match that isn't on a court into the QUEUED state.
    3. If `fill_courts` is set, deal queued matches onto the free courts (oldest-ready first).

    `fill_courts` is True for the initial "Start" action and for the auto-advance-on-finish flow;
    it is False in suggest-and-confirm mode, where the organizer places the next match by hand.
    """
    stages = await get_full_tournament_details(tournament_id)
    courts = sorted(await get_all_courts_in_tournament(tournament_id), key=lambda c: c.id)
    matches = _ordered_matches(stages)

    # 1. Finalize byes so they advance the bracket without taking a court.
    for match in matches:
        if match_is_unfinalized_bye(match):
            await sql_set_match_status(match.id, MatchStatus.FINISHED)
            match.status = MatchStatus.FINISHED

    # 2. Promote playable-but-unplaced matches into the queue.
    queue: list[MatchWithDetails] = []
    for match in matches:
        if match.status == MatchStatus.PLAYING:
            continue
        if match_is_playable(match):
            if match.status != MatchStatus.QUEUED or match.court_id is not None:
                await sql_assign_match_to_court(match.id, None, MatchStatus.QUEUED, None, None)
                match.status = MatchStatus.QUEUED
                match.court_id = None
            queue.append(match)

    if not fill_courts:
        return

    # 3. Fill free courts from the front of the queue.
    occupied_court_ids = {
        match.court_id
        for match in matches
        if match.status == MatchStatus.PLAYING and match.court_id is not None
    }
    free_courts = [court for court in courts if court.id not in occupied_court_ids]
    next_position = max((m.position_in_schedule or 0) for m in matches) + 1 if matches else 0

    for court, match in zip(free_courts, queue):
        await sql_assign_match_to_court(
            match.id,
            court.id,
            MatchStatus.PLAYING,
            datetime_utc.now(),
            next_position,
        )
        next_position += 1
