export const skyStations = [
  [220, 280],
  [800, 270],
  [1380, 290],
  [1960, 230],
  [2540, 310],
];

export function skyStationArrival(level) {
  const [x, y] = skyStations[level.day - 1];
  // Leave a cleared checkpoint behind the aircraft, before the next station.
  return { x: Math.min(2570, x + (level.completed ? 185 : -65)), y: y - 150 };
}

export function skyAircraftRest(levels) {
  const active =
    levels.find((level) => level.open) ||
    levels.findLast((level) => level.completed && level.available) ||
    levels[0];
  const [x, y] = skyStations[active.day - 1];
  return active.completed
    ? skyStationArrival(active)
    : { x: Math.max(35, x - 300), y: y - 150 };
}

// One visual flight at a time. Eligibility is checked again at arrival.
export function createSkyFlight({ requestFrame, cancelFrame }) {
  let flight = null;
  function cancel(reason = "cancelled") {
    if (!flight) return;
    const previous = flight;
    flight = null;
    cancelFrame(previous.frame);
    previous.onCancel?.(reason);
  }
  function start(options) {
    if (flight || !options.isAvailable()) return false;
    const state = { ...options, frame: null, started: null };
    flight = state;
    function tick(time) {
      if (flight !== state) return;
      if (!state.isAvailable()) {
        cancel("locked");
        return;
      }
      state.started ??= time;
      const progress = Math.min(1, (time - state.started) / state.duration);
      const eased = progress * progress * (3 - 2 * progress);
      const t = state.reducedMotion && progress < 1 ? 0 : eased;
      state.onFrame(
        {
          x: state.from.x + (state.to.x - state.from.x) * t,
          y:
            state.from.y +
            (state.to.y - state.from.y) * t -
            (state.reducedMotion ? 0 : Math.sin(Math.PI * progress) * 38),
        },
        t,
      );
      if (progress === 1) {
        // onFrame can synchronously revoke/cancel the flight.
        if (flight !== state) return;
        if (!state.isAvailable()) {
          cancel("locked");
          return;
        }
        flight = null;
        state.onArrive();
      } else state.frame = requestFrame(tick);
    }
    state.frame = requestFrame(tick);
    return true;
  }
  return { start, cancel };
}
