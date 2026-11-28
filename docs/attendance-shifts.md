# Attendance shifts and clock corrections

MC and CC with `game:write` access can change the cohort's daily attendance shift in Attendance or Calendar. Choose today or a future effective date, opening and closing times, and a reason. This schedule applies to the whole cohort. Later planned shifts remain scheduled. Earlier dates retain their previous schedule, and closed sessions retain their recorded official window. Today's active sessions follow a shift changed for today.

Attendance shows shift history with the previous and new hours, effective date, reason, editor and change time. Older cohorts receive a baseline history entry automatically on their first shift edit; no backfill command is required.

To correct a player's recorded times, choose **Correct**, enable **Correct recorded clock times**, enter both times for the selected date and provide a reason. MC can correct assigned players; CC can correct the cohort. The player must end an active session first. Times cannot be future times or overlap retained break events. Existing break intervals remain excluded from attendance duration.

The automatic attendance result uses the corrected duration and the applicable full/half-day minimums. A separately selected manual attendance result takes precedence. Time corrections retain the previous times and session events in correction history, along with the updated values, editor and reason. Saved work and previously awarded XP and trophies are preserved.

Stale clock or result versions are rejected. Refresh Attendance before retrying. Deploy the application changes to enable the controls in production; no database migration or seed command is needed.
