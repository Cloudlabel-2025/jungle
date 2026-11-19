export default function CollegeProfile({ profile = {} }) {
  const address = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.state,
    profile.postalCode,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");
  const rows = [
    ["College type", profile.institutionType],
    ["Affiliation", profile.affiliation],
    ["Contact email", profile.contactEmail],
    ["Contact phone", profile.phone],
    ["Website", profile.website],
    ["Address", address],
  ];
  if (!rows.some(([, value]) => value)) return null;
  return (
    <section className="pa-college-profile" aria-label="College information">
      <h2>College information</h2>
      <dl>
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {label === "Website" && /^https?:\/\//i.test(value) ? (
                  <a href={value} target="_blank" rel="noreferrer">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
