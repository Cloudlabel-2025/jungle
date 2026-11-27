# Interface typography

CMS, college sign-in, staff dashboards and player screens use self-hosted Geist Variable for interface text, paired with semibold Rajdhani for expedition headings. Both load from the root layout without third-party font requests. Native system fonts provide fallback coverage for other scripts.

- Use `var(--body)` for interface text and `var(--display)` for headings. These resolve to `--font-ui` and `--font-heading` respectively.
- Use `--text-heading` (warm sand), `--text-primary` (sage), `--text-secondary` (moss), and `--text-accent` (lime) for the text hierarchy. Keep semantic success, warning and error colours distinct. Solid action buttons retain dark text for contrast.
- Use `var(--font-code)` or `var(--mono)` for code, terminal output, file paths and technical identifiers.
- Keep body text at regular weight, controls at medium weight, and section headings at semibold weight. Prefer weight and size over decorative typefaces.
- Shared labels, navigation and badges are styled in `app/typography.css`. Keep normal label tracking restrained.
- Do not introduce individual font families in feature stylesheets. Game, calendar and authoring screens use the same tokens as administration screens.

The PDF export uses its own print typography and pagination, independent of browser font loading.
