import { AsyncLocalStorage } from "node:async_hooks";

// Shared across development reloads, isolated across concurrent async requests.
const key = Symbol.for("jungle.college-context");
const storage = globalThis[key] ||= new AsyncLocalStorage();
export { tenancyEnabled } from "./tenancy-mode.js";
export const collegeContext = () => storage.getStore();
export function runWithCollege(context, work) {
  if (!context?.college?._id || !context.connection || !context.models)
    throw new Error("A complete college context is required.");
  return storage.run(context, work);
}
export function requireCollegeContext() {
  const context = collegeContext();
  if (!context) throw new Error("College context required; select a college explicitly.");
  return context;
}
