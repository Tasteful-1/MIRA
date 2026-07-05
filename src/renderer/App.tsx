import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type WheelEvent,
} from "react";

import packageJson from "../../package.json";
import miraIconUrl from "../../build/icon.svg";
import type { EventSummary, MapSummary, ProjectSnapshot, TransferLink } from "../shared/types";
import {
  groupTransferLinksByDestination,
  splitTransferGroupByConnectedSources,
  type TransferCluster,
  type TransferGroup,
} from "../shared/transferGroups";
import { drawRpgMakerMap, getCharacterFrame } from "./tileRenderer";

type LoadState = "idle" | "loading" | "ready" | "error";
type TransferDirection = "outgoing" | "incoming";
interface FocusedGroup {
  direction: TransferDirection;
  group: TransferGroup;
}

interface MapLocator {
  id: string;
  label: string;
  style: CSSProperties;
}

interface OutgoingMarker {
  groupIndex: number;
  cluster: TransferCluster;
}

interface TilePoint {
  x: number;
  y: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface DragPanState {
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}

interface ArrivalFlash extends TilePoint {
  mapId: number;
  nonce: number;
}

interface ProjectHistoryEntry {
  rootPath: string;
  gameTitle: string;
  openedAt: number;
}

type JumpHandler = (mapId: number, arrivalTile?: TilePoint) => void;

const tilesetImageCache = new Map<string, Promise<HTMLImageElement>>();
const characterImageCache = new Map<string, Promise<HTMLImageElement>>();
const FIT_VIEW_PADDING = 160;
const PAN_SPACE_PADDING = 1400;
const MIN_ZOOM_FACTOR = 0.25;
const MAX_ZOOM_FACTOR = 8;
const ZOOM_STEP = 1.2;
const ARRIVAL_FOCUS_STORAGE_KEY = "mira.arrivalFocusEnabled";
const CONTRAST_DARK_STORAGE_KEY = "mira.contrastDarkEnabled";
const DEFAULT_PROJECT_DIRECTORY_STORAGE_KEY = "mira.defaultProjectDirectory";
const PROJECT_HISTORY_STORAGE_KEY = "mira.projectHistory";
const PROJECT_HISTORY_LIMIT = 8;
const PACKAGE_VERSION = packageJson.version;

export function App(): ReactElement {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [backStack, setBackStack] = useState<number[]>([]);
  const [forwardStack, setForwardStack] = useState<number[]>([]);
  const [arrivalFlash, setArrivalFlash] = useState<ArrivalFlash | null>(null);
  const [query, setQuery] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contrastDarkEnabled, setContrastDarkEnabled] = useState(() =>
    readBooleanSetting(CONTRAST_DARK_STORAGE_KEY, false),
  );
  const [defaultProjectDirectory, setDefaultProjectDirectory] = useState(() =>
    readStringSetting(DEFAULT_PROJECT_DIRECTORY_STORAGE_KEY, ""),
  );
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryEntry[]>(readProjectHistory);
  const [appVersion, setAppVersion] = useState(PACKAGE_VERSION);

  useEffect(() => {
    if (contrastDarkEnabled) {
      document.documentElement.dataset.theme = "contrast-dark";
      return;
    }

    document.documentElement.removeAttribute("data-theme");
  }, [contrastDarkEnabled]);

  useEffect(() => {
    if (defaultProjectDirectory) {
      return;
    }

    let active = true;

    void window.mira.getMiraDirectory().then((directory) => {
      if (active) {
        setDefaultProjectDirectory((current) => current || directory);
      }
    });

    return () => {
      active = false;
    };
  }, [defaultProjectDirectory]);

  useEffect(() => {
    let active = true;

    void window.mira
      .getAppVersion()
      .then((version) => {
        if (active) {
          setAppVersion(version);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const selectedMap = snapshot?.maps.find((map) => map.id === selectedMapId) ?? snapshot?.maps[0] ?? null;
  const visibleMaps = useMemo(() => filterMaps(snapshot?.maps ?? [], query), [snapshot, query]);
  const outgoingLinks = useMemo(() => getOutgoing(snapshot, selectedMap?.id), [snapshot, selectedMap?.id]);
  const incomingLinks = useMemo(() => getIncoming(snapshot, selectedMap?.id), [snapshot, selectedMap?.id]);
  const appVersionLabel = formatAppVersion(appVersion);

  async function loadProject(loader: () => Promise<ProjectSnapshot | null>): Promise<void> {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const nextSnapshot = await loader();

      if (!nextSnapshot) {
        setLoadState(snapshot ? "ready" : "idle");
        return;
      }

      setSnapshot(nextSnapshot);
      setSelectedMapId(nextSnapshot.maps[0]?.id ?? null);
      setBackStack([]);
      setForwardStack([]);
      setArrivalFlash(null);
      rememberProject(nextSnapshot);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function openProjectFromDialog(): void {
    void loadProject(() => window.mira.openProjectFolder(defaultProjectDirectory || undefined));
  }

  function openProjectFromHistory(rootPath: string): void {
    void loadProject(() => window.mira.loadProjectFolder(rootPath));
  }

  async function chooseDefaultProjectDirectory(): Promise<void> {
    const directory = await window.mira.chooseDirectory(defaultProjectDirectory || undefined);

    if (directory) {
      updateDefaultProjectDirectory(directory);
    }
  }

  async function resetDefaultProjectDirectory(): Promise<void> {
    updateDefaultProjectDirectory(await window.mira.getMiraDirectory());
  }

  function updateDefaultProjectDirectory(directory: string): void {
    setDefaultProjectDirectory(directory);
    writeStringSetting(DEFAULT_PROJECT_DIRECTORY_STORAGE_KEY, directory);
  }

  function rememberProject(nextSnapshot: ProjectSnapshot): void {
    setProjectHistory((current) => {
      const nextHistory = mergeProjectHistory(current, nextSnapshot);
      writeProjectHistory(nextHistory);

      return nextHistory;
    });
  }

  function clearProjectHistory(): void {
    setProjectHistory([]);
    writeProjectHistory([]);
  }

  function removeProjectHistoryEntry(rootPath: string): void {
    setProjectHistory((current) => {
      const nextHistory = current.filter((entry) => entry.rootPath !== rootPath);
      writeProjectHistory(nextHistory);

      return nextHistory;
    });
  }

  function selectMap(mapId: number, arrivalTile?: TilePoint): void {
    setArrivalFlash(arrivalTile ? { mapId, ...arrivalTile, nonce: Date.now() } : null);

    if (selectedMapId === mapId) {
      return;
    }

    if (selectedMapId !== null) {
      setBackStack((stack) => [...stack, selectedMapId]);
    }

    setForwardStack([]);
    setSelectedMapId(mapId);
  }

  function goBack(): void {
    if (selectedMapId === null || backStack.length === 0) {
      return;
    }

    setArrivalFlash(null);
    setForwardStack((stack) => [...stack, selectedMapId]);
    setSelectedMapId(backStack[backStack.length - 1]);
    setBackStack((stack) => stack.slice(0, -1));
  }

  function goForward(): void {
    if (selectedMapId === null || forwardStack.length === 0) {
      return;
    }

    setArrivalFlash(null);
    setBackStack((stack) => [...stack, selectedMapId]);
    setSelectedMapId(forwardStack[forwardStack.length - 1]);
    setForwardStack((stack) => stack.slice(0, -1));
  }

  function handleHistoryMouseDown(event: ReactMouseEvent<HTMLElement>): void {
    if (event.button === 3) {
      event.preventDefault();
      goBack();
    } else if (event.button === 4) {
      event.preventDefault();
      goForward();
    }
  }

  function preventHistoryAuxClick(event: ReactMouseEvent<HTMLElement>): void {
    if (event.button === 3 || event.button === 4) {
      event.preventDefault();
    }
  }

  function updateContrastDarkEnabled(enabled: boolean): void {
    setContrastDarkEnabled(enabled);
    writeBooleanSetting(CONTRAST_DARK_STORAGE_KEY, enabled);
  }

  if (!snapshot) {
    return (
      <LaunchCover
        loadState={loadState}
        errorMessage={errorMessage}
        projectHistory={projectHistory}
        defaultProjectDirectory={defaultProjectDirectory}
        contrastDarkEnabled={contrastDarkEnabled}
        appVersionLabel={appVersionLabel}
        onOpenProject={openProjectFromDialog}
        onOpenHistory={openProjectFromHistory}
        onChooseDefaultDirectory={() => void chooseDefaultProjectDirectory()}
        onResetDefaultDirectory={() => void resetDefaultProjectDirectory()}
        onClearHistory={clearProjectHistory}
        onRemoveHistory={removeProjectHistoryEntry}
        onToggleContrastDark={() => updateContrastDarkEnabled(!contrastDarkEnabled)}
      />
    );
  }

  return (
    <main className="app-shell" onMouseDown={handleHistoryMouseDown} onAuxClick={preventHistoryAuxClick}>
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-lockup">
            <img className="brand-icon" src={miraIconUrl} alt="" aria-hidden="true" />
            <div>
              <h1>MIRA</h1>
              <p>{snapshot?.gameTitle ?? "RPG Maker MV/MZ"}</p>
            </div>
          </div>
          <div className="brand-actions">
            <button
              className="theme-toggle-button"
              aria-label="고대비 다크모드"
              aria-pressed={contrastDarkEnabled}
              onClick={() => updateContrastDarkEnabled(!contrastDarkEnabled)}
              title="고대비 다크모드"
            >
              <span aria-hidden="true">{contrastDarkEnabled ? "☾" : "☀"}</span>
            </button>
            <button className="primary-button" onClick={openProjectFromDialog}>
              열기
            </button>
          </div>
        </header>

        <input
          className="search-input"
          placeholder="맵 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <nav className="map-list">
          {visibleMaps.map((map) => (
            <button
              className={map.id === selectedMap?.id ? "map-row selected" : "map-row"}
              key={map.id}
              onClick={() => selectMap(map.id)}
            >
              <span className="map-title">{formatMapName(map)}</span>
              <span className="map-counts">
                {map.outgoingCount} / {map.incomingCount}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <TopBar loadState={loadState} snapshot={snapshot} errorMessage={errorMessage} />

        {selectedMap ? (
          <div className="viewer-layout">
            <MapGrid
              rootPath={snapshot?.rootPath ?? ""}
              tileSize={snapshot?.tileSize ?? 48}
              map={selectedMap}
              outgoingLinks={outgoingLinks}
              incomingLinks={incomingLinks}
              canGoBack={backStack.length > 0}
              canGoForward={forwardStack.length > 0}
              arrivalFlash={arrivalFlash?.mapId === selectedMap.id ? arrivalFlash : null}
              appVersionLabel={appVersionLabel}
              onBack={goBack}
              onForward={goForward}
              onJump={selectMap}
            />
          </div>
        ) : (
          <div className="empty-state">프로젝트를 여는 중입니다.</div>
        )}
      </section>
    </main>
  );
}

function LaunchCover(props: {
  loadState: LoadState;
  errorMessage: string | null;
  projectHistory: ProjectHistoryEntry[];
  defaultProjectDirectory: string;
  contrastDarkEnabled: boolean;
  appVersionLabel: string;
  onOpenProject: () => void;
  onOpenHistory: (rootPath: string) => void;
  onChooseDefaultDirectory: () => void;
  onResetDefaultDirectory: () => void;
  onClearHistory: () => void;
  onRemoveHistory: (rootPath: string) => void;
  onToggleContrastDark: () => void;
}): ReactElement {
  const isLoading = props.loadState === "loading";
  const [showSettings, setShowSettings] = useState(false);

  return (
    <main className="launch-shell">
      <header className="launch-top">
        <div className="launch-brand">
          <img className="brand-icon launch-brand-icon" src={miraIconUrl} alt="" aria-hidden="true" />
          <div>
            <h1>MIRA</h1>
            <p>RPG Maker MV/MZ map viewer</p>
          </div>
        </div>
        <div className="launch-actions">
          <div className="launch-settings-menu">
            <button
              className="launch-settings-button"
              aria-expanded={showSettings}
              aria-label="설정"
              onClick={() => setShowSettings((current) => !current)}
              title="설정"
            >
              <span aria-hidden="true">⚙</span>
            </button>
            {showSettings ? (
              <div className="launch-settings-popover">
                <div className="launch-settings-heading">기본 디렉토리</div>
                <strong>{props.defaultProjectDirectory || "MIRA 디렉토리"}</strong>
                <div className="launch-settings-actions">
                  <button className="secondary-button" onClick={props.onChooseDefaultDirectory}>
                    변경
                  </button>
                  <button className="secondary-button" onClick={props.onResetDefaultDirectory}>
                    MIRA
                  </button>
                </div>
                <div className="app-version-label">{props.appVersionLabel}</div>
              </div>
            ) : null}
          </div>
          <button
            className="theme-toggle-button"
            aria-label="고대비 다크모드"
            aria-pressed={props.contrastDarkEnabled}
            onClick={props.onToggleContrastDark}
            title="고대비 다크모드"
          >
            <span aria-hidden="true">{props.contrastDarkEnabled ? "☾" : "☀"}</span>
          </button>
        </div>
      </header>

      <section className="launch-content">
        <div className="launch-primary">
          <span className="launch-kicker">Project</span>
          <h2>프로젝트 선택</h2>
          <button className="launch-open-button" disabled={isLoading} onClick={props.onOpenProject}>
            {isLoading ? "읽는 중" : "프로젝트 열기"}
          </button>
          {props.errorMessage ? <p className="launch-error">{props.errorMessage}</p> : null}
        </div>

        <div className="launch-side">
          <section className="launch-panel">
            <header>
              <h3>경로 히스토리</h3>
              {props.projectHistory.length > 0 ? (
                <button className="text-button" onClick={props.onClearHistory}>
                  지우기
                </button>
              ) : null}
            </header>
            <div className="project-history-list">
              {props.projectHistory.length > 0 ? (
                props.projectHistory.map((entry) => (
                  <div
                    className="project-history-row"
                    key={entry.rootPath}
                  >
                    <button
                      className="project-history-open"
                      disabled={isLoading}
                      onClick={() => props.onOpenHistory(entry.rootPath)}
                    >
                      <strong>{entry.gameTitle || getPathBasename(entry.rootPath)}</strong>
                      <span>{entry.rootPath}</span>
                    </button>
                    <small>{formatHistoryDate(entry.openedAt)}</small>
                    <button
                      className="project-history-remove"
                      aria-label={`${entry.gameTitle || getPathBasename(entry.rootPath)} 히스토리 삭제`}
                      onClick={() => props.onRemoveHistory(entry.rootPath)}
                      title="히스토리에서 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <p className="launch-muted">아직 열린 경로가 없습니다.</p>
              )}
            </div>
          </section>

        </div>
      </section>
    </main>
  );
}

function TopBar(props: { loadState: LoadState; snapshot: ProjectSnapshot | null; errorMessage: string | null }): ReactElement {
  return (
    <header className="top-bar">
      <div>
        <strong>{props.snapshot?.rootPath ?? "샘플 프로젝트"}</strong>
        <span>{props.loadState === "loading" ? "읽는 중" : `${props.snapshot?.maps.length ?? 0} maps`}</span>
      </div>
      {props.errorMessage ? <p className="error-text">{props.errorMessage}</p> : null}
    </header>
  );
}

function MapGrid(props: {
  rootPath: string;
  tileSize: number;
  map: MapSummary;
  outgoingLinks: TransferLink[];
  incomingLinks: TransferLink[];
  canGoBack: boolean;
  canGoForward: boolean;
  arrivalFlash: ArrivalFlash | null;
  appVersionLabel: string;
  onBack: () => void;
  onForward: () => void;
  onJump: JumpHandler;
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragPanRef = useRef<DragPanState | null>(null);
  const centeredArrivalNonceRef = useRef<number | null>(null);
  const [tilesetImages, setTilesetImages] = useState<Array<HTMLImageElement | null> | null>(null);
  const [characterImages, setCharacterImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [renderError, setRenderError] = useState<string | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showMapMarkers, setShowMapMarkers] = useState(true);
  const [showLinkOverlay, setShowLinkOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [arrivalFocusEnabled, setArrivalFocusEnabled] = useState(() =>
    readBooleanSetting(ARRIVAL_FOCUS_STORAGE_KEY, true),
  );
  const [hoverTile, setHoverTile] = useState<TilePoint | null>(null);
  const [focusedGroup, setFocusedGroup] = useState<FocusedGroup | null>(null);
  const [visibleArrival, setVisibleArrival] = useState<ArrivalFlash | null>(null);
  const pixelWidth = props.map.width * props.tileSize;
  const pixelHeight = props.map.height * props.tileSize;
  const zoom = fitScale * zoomFactor;
  const frameWidth = pixelWidth * zoom;
  const frameHeight = pixelHeight * zoom;
  const panSpaceWidth = Math.max(frameWidth + PAN_SPACE_PADDING * 2, viewportSize.width + PAN_SPACE_PADDING * 2);
  const panSpaceHeight = Math.max(frameHeight + PAN_SPACE_PADDING * 2, viewportSize.height + PAN_SPACE_PADDING * 2);
  const outgoingGroups = useMemo(() => groupTransferLinksByDestination(props.outgoingLinks), [props.outgoingLinks]);
  const outgoingMarkers = useMemo(() => buildOutgoingMarkers(outgoingGroups), [outgoingGroups]);
  const incomingGroups = useMemo(() => groupTransferLinksByDestination(props.incomingLinks), [props.incomingLinks]);
  const eventCharacterNames = useMemo(() => getEventCharacterNames(props.map.events), [props.map.events]);
  const focusedLocators = useMemo(() => buildFocusedLocators(focusedGroup, props.tileSize), [focusedGroup, props.tileSize]);

  useEffect(() => {
    if (!props.arrivalFlash) {
      setVisibleArrival(null);
      return;
    }

    setVisibleArrival(props.arrivalFlash);
    const timeoutId = window.setTimeout(() => setVisibleArrival(null), 1800);

    return () => window.clearTimeout(timeoutId);
  }, [props.arrivalFlash]);

  useEffect(() => {
    if (!arrivalFocusEnabled || !visibleArrival || centeredArrivalNonceRef.current === visibleArrival.nonce) {
      return;
    }

    centeredArrivalNonceRef.current = visibleArrival.nonce;
    const frameId = window.requestAnimationFrame(() => {
      centerTileInView(scrollRef.current, frameRef.current, visibleArrival, props.tileSize, zoom);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [arrivalFocusEnabled, props.tileSize, visibleArrival]);

  useEffect(() => {
    let active = true;
    setTilesetImages(null);
    setRenderError(null);

    void loadTilesetImages(props.rootPath, props.map.tilesetNames)
      .then((images) => {
        if (active) {
          setTilesetImages(images);
        }
      })
      .catch((error) => {
        if (active) {
          setRenderError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      active = false;
    };
  }, [props.rootPath, props.map.id, props.map.tilesetNames]);

  useEffect(() => {
    let active = true;
    setCharacterImages(new Map());

    void loadCharacterImages(props.rootPath, eventCharacterNames)
      .then((images) => {
        if (active) {
          setCharacterImages(images);
        }
      })
      .catch((error) => {
        if (active) {
          setRenderError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      active = false;
    };
  }, [props.rootPath, props.map.id, eventCharacterNames]);

  useEffect(() => {
    setZoomFactor(1);
  }, [props.map.id]);

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    const updateFitScale = (): void => {
      const availableWidth = Math.max(1, scrollElement.clientWidth - FIT_VIEW_PADDING);
      const availableHeight = Math.max(1, scrollElement.clientHeight - FIT_VIEW_PADDING);
      const nextFitScale = Math.min(1, availableWidth / pixelWidth, availableHeight / pixelHeight);

      setViewportSize((current) =>
        current.width === scrollElement.clientWidth && current.height === scrollElement.clientHeight
          ? current
          : { width: scrollElement.clientWidth, height: scrollElement.clientHeight },
      );
      setFitScale(Number.isFinite(nextFitScale) ? nextFitScale : 1);
    };

    updateFitScale();

    const resizeObserver = new ResizeObserver(updateFitScale);
    resizeObserver.observe(scrollElement);

    return () => resizeObserver.disconnect();
  }, [pixelWidth, pixelHeight]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomIn();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fitScale, zoomFactor]);

  useEffect(() => {
    if (canvasRef.current && tilesetImages) {
      drawRpgMakerMap(canvasRef.current, props.map, props.tileSize, tilesetImages, characterImages);
    }
  }, [props.map, props.tileSize, tilesetImages, characterImages]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      centerFrameInView(scrollRef.current, frameRef.current);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [props.map.id, fitScale, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    if (!isPanning) {
      return;
    }

    const handleMouseMove = (event: MouseEvent): void => {
      const dragPan = dragPanRef.current;
      const scrollElement = scrollRef.current;

      if (!dragPan || !scrollElement) {
        return;
      }

      scrollElement.scrollLeft = dragPan.scrollLeft - (event.clientX - dragPan.startX);
      scrollElement.scrollTop = dragPan.scrollTop - (event.clientY - dragPan.startY);
    };

    const stopPanning = (): void => {
      dragPanRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopPanning);
    window.addEventListener("blur", stopPanning);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopPanning);
      window.removeEventListener("blur", stopPanning);
      dragPanRef.current = null;
    };
  }, [isPanning]);

  function zoomIn(anchor?: TilePoint): void {
    zoomBy(ZOOM_STEP, anchor);
  }

  function zoomOut(anchor?: TilePoint): void {
    zoomBy(1 / ZOOM_STEP, anchor);
  }

  function zoomBy(multiplier: number, anchor?: TilePoint): void {
    const nextZoomFactor = clampZoomFactor(zoomFactor * multiplier);

    if (nextZoomFactor === zoomFactor) {
      return;
    }

    const scrollElement = scrollRef.current;
    const frameElement = frameRef.current;
    const scrollRect = scrollElement?.getBoundingClientRect();
    const frameRect = frameElement?.getBoundingClientRect();
    const anchorX = anchor?.x ?? (scrollRect ? scrollRect.left + scrollRect.width / 2 : 0);
    const anchorY = anchor?.y ?? (scrollRect ? scrollRect.top + scrollRect.height / 2 : 0);
    const mapX = frameRect ? Math.min(pixelWidth, Math.max(0, (anchorX - frameRect.left) / zoom)) : pixelWidth / 2;
    const mapY = frameRect ? Math.min(pixelHeight, Math.max(0, (anchorY - frameRect.top) / zoom)) : pixelHeight / 2;
    const nextZoom = fitScale * nextZoomFactor;

    setZoomFactor(nextZoomFactor);

    if (!scrollElement || !frameElement) {
      return;
    }

    requestAnimationFrame(() => {
      const nextFrameRect = frameElement.getBoundingClientRect();
      scrollElement.scrollLeft += nextFrameRect.left + mapX * nextZoom - anchorX;
      scrollElement.scrollTop += nextFrameRect.top + mapY * nextZoom - anchorY;
    });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>): void {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();

    if (event.deltaY < 0) {
      zoomIn({ x: event.clientX, y: event.clientY });
    } else {
      zoomOut({ x: event.clientX, y: event.clientY });
    }
  }

  function handleMapMouseMove(event: ReactMouseEvent<HTMLDivElement>): void {
    const nextTile = getTilePointFromMouse(event, props.map);
    setHoverTile((current) => (current?.x === nextTile?.x && current?.y === nextTile?.y ? current : nextTile));
  }

  function handlePanMouseDown(event: ReactMouseEvent<HTMLDivElement>): void {
    if (event.button !== 0 || isInteractivePanTarget(event.target)) {
      return;
    }

    dragPanRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };

    setIsPanning(true);
    event.preventDefault();
  }

  function updateArrivalFocusEnabled(enabled: boolean): void {
    setArrivalFocusEnabled(enabled);
    writeBooleanSetting(ARRIVAL_FOCUS_STORAGE_KEY, enabled);
  }

  return (
    <section className="map-stage">
      <header>
        <div className="map-title-group">
          <button className="history-button" disabled={!props.canGoBack} onClick={props.onBack} title="뒤로">
            &lt;
          </button>
          <button className="history-button" disabled={!props.canGoForward} onClick={props.onForward} title="앞으로">
            &gt;
          </button>
          <h2>{formatMapName(props.map)}</h2>
        </div>
        <div className="map-header-actions">
          <span>
            {props.map.width} x {props.map.height} / {Math.round(zoom * 100)}%
            {hoverTile ? ` / ${hoverTile.x}, ${hoverTile.y}` : ""}
          </span>
          <div className="settings-menu">
            <button
              className="settings-button"
              aria-expanded={showSettings}
              aria-label="설정"
              onClick={() => setShowSettings((current) => !current)}
              title="설정"
            >
              <span aria-hidden="true">⚙</span>
            </button>
            {showSettings ? (
              <div className="settings-popover">
                <label className="setting-row">
                  <input
                    type="checkbox"
                    checked={arrivalFocusEnabled}
                    onChange={(event) => updateArrivalFocusEnabled(event.target.checked)}
                  />
                  <span className="setting-label">이동 후 도착 위치 강조</span>
                </label>
                <div className="app-version-label">{props.appVersionLabel}</div>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div className="map-body">
        <button
          className={showMapMarkers ? "marker-toggle-button map-marker-toggle-button active" : "marker-toggle-button map-marker-toggle-button"}
          aria-pressed={showMapMarkers}
          onClick={() => setShowMapMarkers((current) => !current)}
          title="맵 마커 표시"
        >
          <span className="marker-toggle-icon" aria-hidden="true">
            <span />
          </span>
        </button>
        <div
          className={isPanning ? "map-scroll panning" : "map-scroll"}
          ref={scrollRef}
          onMouseDown={handlePanMouseDown}
          onWheel={handleWheel}
        >
          <div className="map-pan-space" style={{ width: panSpaceWidth, height: panSpaceHeight }}>
            <div className="map-frame" ref={frameRef} style={{ width: frameWidth, height: frameHeight }}>
              <div
                className="map-surface"
                style={{ width: pixelWidth, height: pixelHeight, transform: `scale(${zoom})` }}
                onMouseMove={handleMapMouseMove}
                onMouseLeave={() => setHoverTile(null)}
              >
                <canvas className="map-canvas" ref={canvasRef} />
                {tilesetImages ? null : <div className="map-loading">그래픽 로딩</div>}
                {renderError ? <div className="map-loading error">{renderError}</div> : null}
                {showMapMarkers
                  ? props.map.events.map((event) => (
                      <div
                        className="event-marker"
                        key={event.id}
                        style={eventOverlayStyle(event, props.tileSize, characterImages.get(event.characterName))}
                        title={`EV${event.id} ${event.name}`}
                      >
                        <span>EV</span>
                      </div>
                    ))
                  : null}
                {showMapMarkers
                  ? outgoingMarkers.map((marker) => (
                      <button
                        className="transfer-marker-group"
                        key={marker.cluster.id}
                        onDoubleClick={() => jumpGroup(marker.cluster.group, "outgoing", props.onJump)}
                        style={transferClusterStyle(marker.cluster, props.tileSize)}
                        title={groupTitle(marker.cluster.group, "outgoing")}
                      >
                        <span className="transfer-marker">{marker.groupIndex + 1}</span>
                      </button>
                    ))
                  : null}
                {showMapMarkers
                  ? focusedLocators.map((locator) => (
                      <div className="coordinate-locator" key={locator.id} style={locator.style}>
                        <span>{locator.label}</span>
                      </div>
                    ))
                  : null}
                {showMapMarkers && visibleArrival ? (
                  <div
                    className="coordinate-locator arrival-locator"
                    key={visibleArrival.nonce}
                    aria-label="도착 위치"
                    style={tileStyle(visibleArrival.x, visibleArrival.y, props.tileSize)}
                  >
                    <span aria-hidden="true" />
                  </div>
                ) : null}
              </div>
              {showMapMarkers && visibleArrival && arrivalFocusEnabled ? (
                <div
                  className="arrival-beacon"
                  key={`beacon-${visibleArrival.nonce}`}
                  aria-hidden="true"
                  style={arrivalBeaconStyle(visibleArrival, props.tileSize, zoom)}
                >
                  <span />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <aside className={showLinkOverlay ? "map-overlay-shell expanded" : "map-overlay-shell"}>
          <button
            className="overlay-shell-toggle"
            aria-expanded={showLinkOverlay}
            onClick={() => setShowLinkOverlay((current) => !current)}
            title="IN/OUT 패널"
          >
            {showLinkOverlay ? "-" : "+"}
          </button>
          {showLinkOverlay ? (
            <div className="overlay-shell-body">
              <div className="link-overlay">
                <OverlayLinks
                  title="OUT"
                  direction="outgoing"
                  groups={outgoingGroups}
                  onFocusGroup={setFocusedGroup}
                  onJump={props.onJump}
                />
                <OverlayLinks
                  title="IN"
                  direction="incoming"
                  groups={incomingGroups}
                  onFocusGroup={setFocusedGroup}
                  onJump={props.onJump}
                />
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function OverlayLinks(props: {
  title: string;
  direction: TransferDirection;
  groups: TransferGroup[];
  onFocusGroup: (group: FocusedGroup | null) => void;
  onJump: JumpHandler;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={expanded ? "overlay-panel" : "overlay-panel collapsed"}>
      <header>
        <button
          type="button"
          className="overlay-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="collapse-glyph" aria-hidden="true">
            {expanded ? "-" : "+"}
          </span>
          <h2>{props.title}</h2>
          <span className="overlay-count">{props.groups.length}</span>
        </button>
      </header>
      {expanded ? (
        <div className="link-list">
          {props.groups.map((group) => (
            <button
              className="link-card"
              key={group.id}
              onBlur={() => props.onFocusGroup(null)}
              onDoubleClick={() => jumpGroup(group, props.direction, props.onJump)}
              onFocus={() => props.onFocusGroup({ direction: props.direction, group })}
              onMouseEnter={() => props.onFocusGroup({ direction: props.direction, group })}
              onMouseLeave={() => props.onFocusGroup(null)}
            >
              <strong>{groupTitle(group, props.direction)}</strong>
              <span>{groupRouteText(group, props.direction)}</span>
              <small>{groupMetaText(group)}</small>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

async function loadTilesetImages(rootPath: string, names: string[]): Promise<Array<HTMLImageElement | null>> {
  return Promise.all(names.map((name) => (name ? loadTilesetImage(rootPath, name) : Promise.resolve(null))));
}

async function loadCharacterImages(rootPath: string, names: string[]): Promise<Map<string, HTMLImageElement>> {
  const images = await Promise.all(names.map((name) => loadCharacterImage(rootPath, name)));
  return new Map(names.map((name, index) => [name, images[index]]));
}

function loadTilesetImage(rootPath: string, name: string): Promise<HTMLImageElement> {
  const key = `${rootPath}\0${name}`;
  const cachedImage = tilesetImageCache.get(key);

  if (cachedImage) {
    return cachedImage;
  }

  const imagePromise = window.mira.loadTilesetImage(rootPath, name).then((dataUrl) => loadImageElement(dataUrl, "Tileset"));
  tilesetImageCache.set(key, imagePromise);

  return imagePromise;
}

function loadCharacterImage(rootPath: string, name: string): Promise<HTMLImageElement> {
  const key = `${rootPath}\0${name}`;
  const cachedImage = characterImageCache.get(key);

  if (cachedImage) {
    return cachedImage;
  }

  const imagePromise = window.mira
    .loadCharacterImage(rootPath, name)
    .then((dataUrl) => loadImageElement(dataUrl, "Character"));
  characterImageCache.set(key, imagePromise);

  return imagePromise;
}

function loadImageElement(dataUrl: string, label: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${label} image load failed`));
    image.src = dataUrl;
  });
}

function getEventCharacterNames(events: EventSummary[]): string[] {
  return [...new Set(events.map((event) => event.characterName).filter(Boolean))];
}

function filterMaps(maps: MapSummary[], query: string): MapSummary[] {
  const needle = query.trim().toLowerCase();

  return needle ? maps.filter((map) => formatMapName(map).toLowerCase().includes(needle)) : maps;
}

function getTilePointFromMouse(event: ReactMouseEvent<HTMLDivElement>, map: MapSummary): TilePoint | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * map.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * map.height);

  return x >= 0 && x < map.width && y >= 0 && y < map.height ? { x, y } : null;
}

function isInteractivePanTarget(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest("button, input, label, a, .event-marker"));
}

function getOutgoing(snapshot: ProjectSnapshot | null, mapId?: number): TransferLink[] {
  return snapshot && mapId ? snapshot.links.filter((link) => link.sourceMapId === mapId) : [];
}

function getIncoming(snapshot: ProjectSnapshot | null, mapId?: number): TransferLink[] {
  return snapshot && mapId ? snapshot.links.filter((link) => link.targetMapId === mapId) : [];
}

function buildOutgoingMarkers(groups: TransferGroup[]): OutgoingMarker[] {
  return groups.flatMap((group, groupIndex) =>
    splitTransferGroupByConnectedSources(group).map((cluster) => ({ groupIndex, cluster })),
  );
}

function buildFocusedLocators(focusedGroup: FocusedGroup | null, tileSize: number): MapLocator[] {
  if (!focusedGroup) {
    return [];
  }

  if (focusedGroup.direction === "incoming") {
    const link = focusedGroup.group.representative;

    return link.targetX === null || link.targetY === null
      ? []
      : [{ id: focusedGroup.group.id, label: "IN", style: tileStyle(link.targetX, link.targetY, tileSize) }];
  }

  return splitTransferGroupByConnectedSources(focusedGroup.group).map((cluster) => ({
    id: cluster.id,
    label: "OUT",
    style: transferClusterStyle(cluster, tileSize),
  }));
}

function transferClusterStyle(cluster: TransferCluster, tileSize: number): CSSProperties {
  const minX = Math.min(...cluster.links.map((link) => link.eventX));
  const maxX = Math.max(...cluster.links.map((link) => link.eventX));
  const minY = Math.min(...cluster.links.map((link) => link.eventY));
  const maxY = Math.max(...cluster.links.map((link) => link.eventY));

  return {
    left: minX * tileSize,
    top: minY * tileSize,
    width: (maxX - minX + 1) * tileSize,
    height: (maxY - minY + 1) * tileSize,
  };
}

function tileStyle(x: number, y: number, tileSize: number): CSSProperties {
  return {
    left: x * tileSize,
    top: y * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

function arrivalBeaconStyle(point: TilePoint, tileSize: number, zoom: number): CSSProperties {
  return {
    left: (point.x + 0.5) * tileSize * zoom,
    top: (point.y + 0.5) * tileSize * zoom,
  };
}

function eventOverlayStyle(event: EventSummary, tileSize: number, image?: HTMLImageElement): CSSProperties {
  const frame = image ? getCharacterFrame(image, event) : { width: tileSize, height: tileSize };

  return {
    left: event.x * tileSize + (tileSize - frame.width) / 2,
    top: (event.y + 1) * tileSize - frame.height,
    width: frame.width,
    height: frame.height,
  };
}

function jumpGroup(group: TransferGroup, direction: TransferDirection, onJump: JumpHandler): void {
  const link = group.representative;
  const nextMapId = direction === "incoming" ? link.sourceMapId : link.targetMapId;
  const arrivalTile =
    direction === "incoming" ? { x: link.eventX, y: link.eventY } : buildTargetTile(link.targetX, link.targetY);

  if (nextMapId !== null) {
    onJump(nextMapId, arrivalTile);
  }
}

function buildTargetTile(targetX: number | null, targetY: number | null): TilePoint | undefined {
  return targetX === null || targetY === null ? undefined : { x: targetX, y: targetY };
}

function centerTileInView(
  scrollElement: HTMLDivElement | null,
  frameElement: HTMLDivElement | null,
  point: TilePoint,
  tileSize: number,
  zoom: number,
): void {
  if (!scrollElement || !frameElement) {
    return;
  }

  const centerX = frameElement.offsetLeft + (point.x + 0.5) * tileSize * zoom;
  const centerY = frameElement.offsetTop + (point.y + 0.5) * tileSize * zoom;

  scrollElement.scrollTo({
    left: Math.max(0, centerX - scrollElement.clientWidth / 2),
    top: Math.max(0, centerY - scrollElement.clientHeight / 2),
    behavior: "smooth",
  });
}

function centerFrameInView(scrollElement: HTMLDivElement | null, frameElement: HTMLDivElement | null): void {
  if (!scrollElement || !frameElement) {
    return;
  }

  scrollElement.scrollTo({
    left: Math.max(0, frameElement.offsetLeft + frameElement.offsetWidth / 2 - scrollElement.clientWidth / 2),
    top: Math.max(0, frameElement.offsetTop + frameElement.offsetHeight / 2 - scrollElement.clientHeight / 2),
  });
}

function groupTitle(group: TransferGroup, direction: TransferDirection): string {
  return direction === "incoming" ? `도착 ${targetCoordinateText(group.representative)}` : targetPlaceText(group.representative);
}

function groupRouteText(group: TransferGroup, direction: TransferDirection): string {
  const link = group.representative;
  const sourceText = group.links.length > 1 ? `${sourcePlaceText(link)} 외 ${group.links.length - 1}곳` : sourcePlaceText(link);
  const targetText = direction === "incoming" ? targetCoordinateText(link) : targetPlaceText(link);

  return `${sourceText} -> ${targetText}`;
}

function groupMetaText(group: TransferGroup): string {
  const link = group.representative;
  const eventText = `EV${link.eventId} ${link.eventName} / page ${link.pageIndex + 1}`;

  return group.links.length > 1 ? `${group.links.length}개 이동 / 첫 항목 ${eventText}` : eventText;
}

function sourcePlaceText(link: TransferLink): string {
  return `${link.sourceMapName} (${link.eventX}, ${link.eventY})`;
}

function targetPlaceText(link: TransferLink): string {
  return link.kind === "direct" ? `${link.targetMapName ?? "Unknown"} ${targetCoordinateText(link)}` : "변수 지정 이동";
}

function targetCoordinateText(link: TransferLink): string {
  return link.targetX === null ? "좌표 미정" : `(${link.targetX}, ${link.targetY})`;
}

function formatMapName(map: MapSummary): string {
  return `${String(map.id).padStart(3, "0")} ${map.name}`;
}

function clampZoomFactor(zoomFactor: number): number {
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, zoomFactor));
}

function formatAppVersion(version: string): string {
  return version ? `MIRA ${version}` : "MIRA";
}

function mergeProjectHistory(history: ProjectHistoryEntry[], snapshot: ProjectSnapshot): ProjectHistoryEntry[] {
  const nextEntry: ProjectHistoryEntry = {
    rootPath: snapshot.rootPath,
    gameTitle: snapshot.gameTitle,
    openedAt: Date.now(),
  };

  return [nextEntry, ...history.filter((entry) => entry.rootPath !== snapshot.rootPath)].slice(0, PROJECT_HISTORY_LIMIT);
}

function readProjectHistory(): ProjectHistoryEntry[] {
  try {
    const rawValue = window.localStorage.getItem(PROJECT_HISTORY_STORAGE_KEY);

    return rawValue ? parseProjectHistory(JSON.parse(rawValue)) : [];
  } catch {
    return [];
  }
}

function parseProjectHistory(value: unknown): ProjectHistoryEntry[] {
  return Array.isArray(value) ? value.filter(isProjectHistoryEntry).slice(0, PROJECT_HISTORY_LIMIT) : [];
}

function isProjectHistoryEntry(value: unknown): value is ProjectHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<ProjectHistoryEntry>;

  return (
    typeof entry.rootPath === "string" &&
    typeof entry.gameTitle === "string" &&
    typeof entry.openedAt === "number"
  );
}

function writeProjectHistory(history: ProjectHistoryEntry[]): void {
  try {
    window.localStorage.setItem(PROJECT_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage failures; the current session still has the in-memory history.
  }
}

function readStringSetting(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStringSetting(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; the in-memory setting still works for this session.
  }
}

function getPathBasename(rootPath: string): string {
  const parts = rootPath.split(/[\\/]/).filter(Boolean);

  return parts[parts.length - 1] ?? rootPath;
}

function formatHistoryDate(openedAt: number): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(openedAt));
  } catch {
    return "";
  }
}

function readBooleanSetting(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);

    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function writeBooleanSetting(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures; the in-memory setting still works for this session.
  }
}
