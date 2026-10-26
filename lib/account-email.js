export function accountEmail(name) {
  const local = name
    .trim()
    .replace(/^Commander\s+/i, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
  if (!local) throw new Error("Account name needs a valid email identifier.");
  return `${local}@gmail.com`;
}
