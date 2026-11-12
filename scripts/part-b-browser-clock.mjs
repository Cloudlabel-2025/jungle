// Preload used ONLY by serve-part-b-browser.mjs, never by normal app commands.
import { readFileSync, watchFile } from "node:fs";
const path = process.env.PART_B_BROWSER_CLOCK_FILE;
if (path) {
  const RealDate = Date;
  let offset = 0;
  const update = () => { offset = Date.parse(readFileSync(path, "utf8").trim()) - RealDate.now(); };
  update();
  watchFile(path, { interval: 250, persistent: false }, update);
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [RealDate.now() + offset])); }
    static now() { return RealDate.now() + offset; }
    static parse(value) { return RealDate.parse(value); }
    static UTC(...args) { return RealDate.UTC(...args); }
  };
  Object.defineProperty(globalThis.Date, "name", { value: "Date" });
}
