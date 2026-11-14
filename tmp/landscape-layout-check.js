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
export const metadata = {
  title: "CODEWILD \xB7 Escape the Wild",
  description: "A jungle expedition powered by learning, teamwork, and code. Explore. Adapt. Survive."
};
export default function RootLayout({ children }) {
  return /* @__PURE__ */ React.createElement("html", { lang: "en" }, /* @__PURE__ */ React.createElement("body", { className: "jungle-world" }, /* @__PURE__ */ React.createElement(
    "section",
    {
      className: "landscape-required",
      "aria-label": "Landscape orientation required"
    },
    /* @__PURE__ */ React.createElement("span", { className: "landscape-phone", "aria-hidden": "true" }, "\u21BB"),
    /* @__PURE__ */ React.createElement("h1", null, "Turn your phone to play"),
    /* @__PURE__ */ React.createElement("p", null, "CODEWILD is played in landscape. Rotate your phone to continue your journey.")
  ), /* @__PURE__ */ React.createElement("div", { className: "landscape-app-content" }, children)));
}
