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
import "./avatar-studio.css";
import "./avatar-sticker-studio.css";
import "./campfire.css";
import "./mobile-orientation.css";
import "./camp-residents.css";
import "./pilot.css";
import "./workflow.css";
import "./notifications.css";
import "./alumni-map.css";
import "./game-forms.css";
import "./mission-adventure.css";
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
import "./level-two-comics.css";
import "./level-two-story-board.css";
import "./cohort-calendar.css";
import "./attendance-register.css";
import "./experience-celebration.css";
import "./level-three-missions.css";
import "./signal-lab.css";
import "./simple-level-three.css";
import "./objectives.css";
import "./flight-finale.css";
import "./first-discovery.css";
import "./vow-brand.css";
import "./expedition-login.css";
import "./college-portal.css";
import "./game-stations.css";
import "./league-medals.css";
import "./team-lab.css";
import { brand } from "@/lib/brand.js";
export const metadata = {
  title: brand.title,
  applicationName: brand.name,
  description: brand.description,
  icons: {icon:[16,32,64,192].map(size=>({url:`${brand.iconPrefix}-${size}.png`,sizes:`${size}x${size}`,type:"image/png"})),apple:[{url:`${brand.iconPrefix}-180.png`,sizes:"180x180",type:"image/png"}]},
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
          <h2>Turn your phone to play</h2>
          <p>
            VOW is played in landscape. Rotate your phone to continue your
            journey.
          </p>
        </section>
        <div className="landscape-app-content">{children}</div>
      </body>
    </html>
  );
}
