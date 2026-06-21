from enum import auto

from heliclockter import datetime_utc
from pydantic import Field

from bracket.models.db.shared import BaseModelORM
from bracket.utils.id_types import ClubId, TournamentId
from bracket.utils.pydantic import EmptyStrToNone
from bracket.utils.types import EnumAutoStr


class TournamentStatus(EnumAutoStr):
    OPEN = auto()
    ARCHIVED = auto()


class TournamentType(EnumAutoStr):
    """
    A preset that bundles sensible defaults at creation time. PICKLEBALL turns on player-name
    display and the dynamic (no-clock) scheduling mode by default; every individual setting
    stays overridable in the tournament settings afterwards.
    """

    GENERIC = auto()
    PICKLEBALL = auto()


class SchedulingMode(EnumAutoStr):
    """
    TIMED   - matches are laid out on a clock with start times (the original behavior).
    DYNAMIC - no clock: matches sit in a queue and are pulled onto a court the moment one frees
              up. Start times are optional metadata only.
    """

    TIMED = auto()
    DYNAMIC = auto()


class TournamentInsertable(BaseModelORM):
    club_id: ClubId
    name: str
    created: datetime_utc
    start_time: datetime_utc
    duration_minutes: int = Field(..., ge=1)
    margin_minutes: int = Field(..., ge=0)
    dashboard_public: bool
    dashboard_endpoint: str | None = None
    logo_path: str | None = None
    players_can_be_in_multiple_teams: bool
    auto_assign_courts: bool
    tournament_type: TournamentType = TournamentType.GENERIC
    scheduling_mode: SchedulingMode = SchedulingMode.TIMED
    court_auto_advance: bool = True
    show_player_names: bool = False
    show_qr_on_tv: bool = True
    status: TournamentStatus = TournamentStatus.OPEN


class Tournament(TournamentInsertable):
    id: TournamentId


class TournamentUpdateBody(BaseModelORM):
    start_time: datetime_utc
    name: str
    dashboard_public: bool
    dashboard_endpoint: EmptyStrToNone | str = None
    players_can_be_in_multiple_teams: bool
    auto_assign_courts: bool
    tournament_type: TournamentType = TournamentType.GENERIC
    scheduling_mode: SchedulingMode = SchedulingMode.TIMED
    court_auto_advance: bool = True
    show_player_names: bool = False
    show_qr_on_tv: bool = True
    duration_minutes: int = Field(..., ge=1)
    margin_minutes: int = Field(..., ge=0)


class TournamentChangeStatusBody(BaseModelORM):
    status: TournamentStatus


class TournamentBody(TournamentUpdateBody):
    club_id: ClubId
