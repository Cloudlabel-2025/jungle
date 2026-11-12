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
export const metadata = {
  title: "CODEWILD · Escape the Wild",
  description:
    "A jungle expedition powered by learning, teamwork, and code. Explore. Adapt. Survive.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="jungle-world">
        <div className="landscape-app-content">{children}</div>
      </body>
    </html>
  );
}
