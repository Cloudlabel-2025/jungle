import "./globals.css";
import "@fontsource/rajdhani/400.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "./jungle.css";
import "./game-map.css";
import "./expedition-pages.css";
import "./projects.css";
import "./forms.css";
import "./level-emblems.css";
import "./player-levels.css";
import "./map-navigation.css";
import "./level-briefing.css";
import "./characters.css";
import "./campfire.css";
import "./mobile-orientation.css";
import "./camp-residents.css";
import "./pilot.css";
import "./workflow.css";
import "./notifications.css";
import "./alumni-map.css";
import "./game-forms.css";
import "./blended-header.css";
import "./mission-map.css";
import "./game-loading.css";
import "./flight.css";
import "./research-choice.css";
import "./sky-journey.css";
import "./player-profile.css";
import "./day-one-setup.css";
import "./attendance.css";
import "./work-history.css";
import "./flight-mission.css";
import "./flight-briefing.css";
import "./pip.css";
import "./level-one-results.css";
import "./star-guide.css";
import "./level-two-missions.css";
import "./week-one-stars.css";
export const metadata = {
  title: "CODEWILD · Escape the Wild",
  description:
    "A jungle expedition powered by learning, teamwork, and code. Explore. Adapt. Survive.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="jungle-world">
        <section
          className="landscape-required"
          aria-label="Landscape orientation required"
        >
          <span className="landscape-phone" aria-hidden="true">
            ↻
          </span>
          <h1>Turn your phone to play</h1>
          <p>
            CODEWILD is played in landscape. Rotate your phone to continue your
            journey.
          </p>
        </section>
        <div className="landscape-app-content">{children}</div>
      </body>
    </html>
  );
}
