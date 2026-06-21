import {
  ActionIcon,
  Center,
  Grid,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { SingleEliminationBracket } from '@components/brackets/bracket_view';
import CourtsLarge, { CourtBadge } from '@components/brackets/courts_large';
import { getTournamentHeadTitle } from '@components/dashboard/layout';
import { isMatchHappening, isMatchInTheFuture } from '@components/utils/match';
import { getBaseURL, responseIsValid, setTitle } from '@components/utils/util';
import { Court, MatchWithDetails, StageItemWithRounds } from '@openapi';
import { StandingsContent } from '@pages/tournaments/[id]/dashboard/standings';
import { getCourtsLive, getStagesLive } from '@services/adapter';
import { getTournamentResponseByEndpointName } from '@services/dashboard';
import {
  getMatchLookup,
  getMatchLookupByCourt,
  getStageItemLookup,
  getTeamsLookup,
} from '@services/lookups';

import classes from '@components/dashboard/tv_display.module.css';

type View = 'bracket' | 'courts' | 'standings';
const ROTATE_INTERVAL_MS = 20_000;
const IDLE_AFTER_MS = 3_000;

// Scale `contentRef` to fit `viewportRef`, recomputing on resize and as live data changes.
//
// Normal mode fits both dimensions (the content keeps its natural size). In `fill` mode the
// content is scaled to the viewport WIDTH and given an explicit height so that, after scaling, it
// fills the viewport height too — used for wide brackets (e.g. a split bracket) whose natural
// aspect ratio is much wider than a TV, which would otherwise sit letterboxed with big top/bottom
// gaps. The bracket's flex layout then spreads the matches to fill that height.
function useFitScale(
  viewportRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  fill: boolean,
  deps: unknown[]
) {
  const [state, setState] = useState<{ scale: number; contentHeight: number | undefined }>({
    scale: 1,
    contentHeight: undefined,
  });

  const recompute = useCallback(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (vp == null || content == null) return;
    const cw = content.offsetWidth;
    if (cw <= 0) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;

    let scale: number;
    let contentHeight: number | undefined;
    if (fill) {
      // Width-priority: the bracket is wider than it is tall, so width is the binding dimension.
      scale = Math.max(0.15, Math.min(3, vw / cw));
      contentHeight = vh / scale; // after scaling this becomes exactly the viewport height
    } else {
      const ch = content.offsetHeight;
      if (ch <= 0) return;
      scale = Math.max(0.15, Math.min(3, Math.min(vw / cw, vh / ch)));
      contentHeight = undefined;
    }

    setState((prev) =>
      prev.scale === scale && prev.contentHeight === contentHeight ? prev : { scale, contentHeight }
    );
  }, [viewportRef, contentRef, fill]);

  useLayoutEffect(() => {
    recompute();
    const observer = new ResizeObserver(recompute);
    if (viewportRef.current != null) observer.observe(viewportRef.current);
    if (contentRef.current != null) observer.observe(contentRef.current);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recompute, ...deps]);

  return state;
}

export default function TvDisplayPage() {
  const tournamentDataFull = getTournamentResponseByEndpointName();
  const tournamentValid = !React.isValidElement(tournamentDataFull);
  const tournamentId = tournamentValid ? tournamentDataFull.id : null;

  const swrStagesResponse = getStagesLive(tournamentId);
  const swrCourtsResponse = getCourtsLive(tournamentId);
  const teamsLookup = getTeamsLookup(tournamentId);

  const [view, setView] = useState<View>('bracket');
  const [autoRotate, setAutoRotate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Force a dark scheme while on the TV page (high contrast across the room), restoring the
  // previous choice on the way out.
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const previousSchemeRef = useRef(colorScheme);
  useEffect(() => {
    setColorScheme('dark');
    return () => setColorScheme(previousSchemeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courts: Court[] = swrCourtsResponse.data?.data ?? [];
  const stagesData = responseIsValid(swrStagesResponse) ? (swrStagesResponse.data?.data ?? []) : [];
  const eliminationStageItems: StageItemWithRounds[] = stagesData
    .flatMap((stage: any) => stage.stage_items)
    .filter((si: StageItemWithRounds) => si.type === 'SINGLE_ELIMINATION');

  // Fold large brackets into a two-sided layout (better aspect ratio for a TV). A first round with
  // 8+ matches means a bracket of 16+ slots. With a single such bracket we also let it fill the
  // screen height (spread matches vertically) rather than sit letterboxed.
  const singleElim = eliminationStageItems.length === 1 ? eliminationStageItems[0] : null;
  const firstRoundCount =
    singleElim != null
      ? ([...singleElim.rounds].sort((a, b) => a.id - b.id)[0]?.matches?.length ?? 0)
      : 0;
  const splitBracket = firstRoundCount >= 8;

  const availableViews: View[] = useMemo(
    () => ['bracket', ...(courts.length > 0 ? (['courts'] as View[]) : []), 'standings'],
    [courts.length]
  );

  // Signature that changes whenever the rendered content changes size, so the fit recomputes.
  const contentSignature = `${view}:${eliminationStageItems.length}:${courts.length}:${stagesData.length}:${splitBracket}`;
  const fillBracket = view === 'bracket' && splitBracket;
  const { scale, contentHeight } = useFitScale(viewportRef, contentRef, fillBracket, [
    contentSignature,
  ]);

  // Auto-rotate between the available views for an unattended lobby screen.
  useEffect(() => {
    if (!autoRotate) return undefined;
    const id = setInterval(() => {
      setView((current) => {
        const idx = availableViews.indexOf(current);
        return availableViews[(idx + 1) % availableViews.length];
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRotate, availableViews]);

  // Track fullscreen state (also updates if the user presses Esc).
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Hide the controls and cursor after a few idle seconds; reveal them on mouse movement.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onMove = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_AFTER_MS);
    };
    window.addEventListener('mousemove', onMove);
    timer = setTimeout(() => setIdle(true), IDLE_AFTER_MS);
    return () => {
      window.removeEventListener('mousemove', onMove);
      clearTimeout(timer);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement != null) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  }, []);

  if (!tournamentValid) {
    return tournamentDataFull;
  }

  setTitle(getTournamentHeadTitle(tournamentDataFull));

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const matchesLookup = responseIsValid(swrStagesResponse) ? getMatchLookup(swrStagesResponse) : {};
  const isDynamic = tournamentDataFull.scheduling_mode === 'DYNAMIC';
  const showPlayerNames = tournamentDataFull.show_player_names;
  const showQr = tournamentDataFull.show_qr_on_tv;
  const matchesByCourtId = responseIsValid(swrStagesResponse)
    ? getMatchLookupByCourt(swrStagesResponse)
    : {};

  const publicUrl = `${getBaseURL()}/tournaments/${tournamentDataFull.dashboard_endpoint}/dashboard`;

  const bracketView =
    eliminationStageItems.length < 1 ? (
      <Center style={{ height: '100%' }}>
        <Text size="xl" c="dimmed">
          The bracket hasn&apos;t been generated yet.
        </Text>
      </Center>
    ) : (
      <div
        ref={contentRef}
        className={classes.fitContent}
        style={{ transform: `scale(${scale})`, height: contentHeight }}
      >
        <Stack gap="xl" style={fillBracket ? { height: '100%' } : undefined}>
          {eliminationStageItems.map((stageItem) => (
            <SingleEliminationBracket
              key={stageItem.id}
              stageItem={stageItem}
              stageItemsLookup={stageItemsLookup}
              matchesLookup={matchesLookup}
              teamsLookup={teamsLookup}
              showPlayerNames={showPlayerNames}
              split={splitBracket}
              fillHeight={fillBracket}
            />
          ))}
        </Stack>
      </div>
    );

  const courtsView = (
    <div className={classes.fill} style={{ fontSize: 22 }}>
      <Grid align="center" gutter="2rem">
        <Grid.Col span={{ sm: 2 }} />
        <Grid.Col span={{ sm: 5 }}>
          <CourtBadge name="On court now" color="teal" />
        </Grid.Col>
        <Grid.Col span={{ sm: 5 }}>
          <CourtBadge name="Up next" color="gray" />
        </Grid.Col>
      </Grid>
      {courts.map((court) => {
        const matchesForCourt = matchesByCourtId[court.id] || [];
        const activeMatch = isDynamic
          ? matchesForCourt.filter((m: MatchWithDetails) => m.status === 'PLAYING')[0]
          : matchesForCourt.filter((m: MatchWithDetails) => isMatchHappening(m))[0];
        const nextMatch = isDynamic
          ? null
          : matchesForCourt
              .filter((m: MatchWithDetails) => isMatchInTheFuture(m))
              .sort((m1: MatchWithDetails, m2: MatchWithDetails) =>
                (m1.start_time || '') > (m2.start_time || '') ? 1 : -1
              )[0];
        return (
          <CourtsLarge
            key={court.id}
            court={court}
            activeMatch={activeMatch}
            nextMatch={nextMatch}
            stageItemsLookup={stageItemsLookup}
            teamsLookup={teamsLookup}
            showPlayerNames={showPlayerNames}
            showTime={!isDynamic}
          />
        );
      })}
    </div>
  );

  const standingsView = (
    <div className={classes.fill} style={{ fontSize: 30 }}>
      <StandingsContent
        swrStagesResponse={swrStagesResponse}
        fontSizeInPixels={30}
        maxTeamsToDisplay={16}
      />
    </div>
  );

  return (
    <div className={classes.root} data-idle={idle ? 'true' : undefined}>
      <div className={classes.header}>
        <div className={classes.titleBlock}>
          <div className={classes.title}>{tournamentDataFull.name}</div>
          {showQr && (
            <div className={classes.followLink}>
              Follow at <strong>{publicUrl}</strong>
            </div>
          )}
        </div>
        <div className={classes.controls} data-hidden={idle ? 'true' : undefined}>
          <SegmentedControl
            size="sm"
            value={view}
            onChange={(value) => setView(value as View)}
            data={availableViews.map((v) => ({
              value: v,
              label: v === 'bracket' ? 'Bracket' : v === 'courts' ? 'Courts' : 'Standings',
            }))}
          />
          <Switch
            size="sm"
            label="Auto-rotate"
            checked={autoRotate}
            onChange={(e) => setAutoRotate(e.currentTarget.checked)}
          />
          <Tooltip label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <ActionIcon variant="light" size="lg" onClick={toggleFullscreen}>
              {isFullscreen ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      <div className={classes.viewport} ref={viewportRef}>
        {view === 'bracket' && bracketView}
        {view === 'courts' && courtsView}
        {view === 'standings' && standingsView}
      </div>
    </div>
  );
}
