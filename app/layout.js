import "./globals.css";
import "@fontsource/rajdhani/400.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "./jungle.css";
import "./game-map.css";
import "./expedition-pages.css";
export const metadata = {
  title: "CODEWILD · Escape the Wild",
  description:
    "A jungle expedition powered by learning, teamwork, and code. Explore. Adapt. Survive.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="jungle-world">{children}</body>
    </html>
  );
}
