// Vercel hosts the college platform. Legacy single-database installations can
// still opt out explicitly; an omitted deployment flag must not change which
// database college credentials are checked against.
export function tenancyEnabled(environment = process.env) {
  const configured = environment.TENANCY_ENABLED;
  return configured ? configured === "true" : environment.VERCEL === "1";
}
