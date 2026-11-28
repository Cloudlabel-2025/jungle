export const RESPONSE_MS = 2 * 60000;
// A completed clock-in is remembered by the server across dates and devices.
export function needsClockInTutorial(session) {
  return (
    session?.state === "NOT_IN" &&
    session.attendanceRequired !== false &&
    !session.hasClockedIn &&
    !session.clockAt &&
    !session.clockOutAt
  );
}
