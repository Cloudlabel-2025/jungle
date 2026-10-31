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
import { Smartphone, RotateCw } from "lucide-react";
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
        <section
          className="mobile-orientation-guard"
          aria-label="Landscape orientation required"
        >
          <div className="orientation-device" aria-hidden="true">
            <Smartphone size={56} strokeWidth={1.4} />
            <RotateCw size={28} strokeWidth={1.6} />
          </div>
          <span className="orientation-brand">
            CODEWILD / EXPEDITION ACCESS
          </span>
          <h1>Rotate your phone</h1>
          <p>
            Your expedition runs in landscape. Turn your phone sideways to enter
            the jungle.
          </p>
          <small>The game opens automatically when you rotate.</small>
        </section>
      </body>
    </html>
  );
}
