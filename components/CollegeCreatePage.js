"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  GraduationCap,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Field } from "./PlatformFields";
import { platformApi } from "@/lib/platform-client.js";
import { brand } from "@/lib/brand.js";
import { collegeTypes } from "@/lib/college-options.js";
import { buildCollegeUrl, validCollegeAddress } from "@/lib/college-routing.js";

const profileKeys = [
  "institutionType",
  "affiliation",
  "website",
  "contactEmail",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "country",
  "postalCode",
];
export default function CollegeCreatePage({
  initial,
  mode = "create",
  routing,
}) {
  const editing = mode === "edit";
  const backHref = editing
    ? `/platform?college=${encodeURIComponent(initial.id)}`
    : "/platform";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(initial?.name || ""),
    [slug, setSlug] = useState(initial?.slug || "");
  const [status, setStatus] = useState(initial?.status || "ACTIVE");
  const loginUrl =
    routing && validCollegeAddress(slug)
      ? buildCollegeUrl(slug, routing.origin, routing)
      : "";
  const customSlug = useRef(Boolean(initial)),
    pending = useRef(false),
    errorRef = useRef(null);
  const profile = initial?.profile || {};
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const section = (number, title, copy, Icon) => (
    <header className="pa-create-section-heading">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <Icon size={23} aria-hidden="true" />
    </header>
  );
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    if (!editing && data.password !== data.confirmPassword) {
      setError("The Centre Command passwords do not match.");
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const profile = Object.fromEntries(
        profileKeys.map((key) => [key, data[key] || ""]),
      );
      const result = await platformApi(
        editing ? `colleges/${encodeURIComponent(initial.id)}` : "colleges",
        {
          method: editing ? "PATCH" : "POST",
          body: editing
            ? {
                name: data.name,
                slug: data.slug,
                status: data.status,
                profile,
                version: initial.version,
                accessRevision: initial.accessRevision,
              }
            : {
                name: data.name,
                slug: data.slug,
                cohortName: data.cohortName,
                startDate: data.startDate,
                adminName: data.adminName,
                email: data.email,
                ...(data.username ? { username: data.username } : {}),
                password: data.password,
                profile,
              },
        },
      );
      location.assign(`/platform?college=${encodeURIComponent(result.id)}`);
    } catch (failure) {
      setError(failure.message);
      if (failure.status === 401 || failure.status === 403)
        setError(`${failure.message} Open the CMS sign-in page to continue.`);
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="platform-admin pa-create-page">
      <header className="pa-create-topbar">
        <a className="pa-brand" href="/platform">
          <img
            className="pa-brand-emblem"
            src={brand.logo}
            alt=""
            width={52}
            height={52}
          />
          <span className="pa-brand-copy">
            <strong>VOW</strong>
            <small>{brand.name}</small>
          </span>
          <span className="pa-brand-label">CMS</span>
        </a>
        <span className="pa-platform-label">
          <ShieldCheck size={16} />
          Super admin
        </span>
      </header>
      <div className="pa-create-container">
        <a
          className="pa-back"
          href={backHref}
          onClick={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <ArrowLeft size={16} />
          {editing ? "Back to college" : "Back to colleges"}
        </a>
        <div className="pa-create-breadcrumb">
          <span>Colleges</span>
          <ChevronRight size={14} />
          <strong>
            {editing
              ? "Edit college"
              : initial
                ? "Retry college setup"
                : "Add college"}
          </strong>
        </div>
        <div className="pa-page-heading">
          <div>
            <span className="pa-kicker">
              {editing
                ? "MANAGE YOUR COLLEGE PROFILE"
                : "GROW YOUR EXPEDITION NETWORK"}
            </span>
            <h1>
              {editing
                ? "Edit college"
                : initial
                  ? "Complete college setup"
                  : "Add a college"}
            </h1>
            <p>
              {editing
                ? "Update college information, contact details, location and access."
                : "Set up the college, its first cohort and the Centre Command account that will lead it."}
            </p>
          </div>
        </div>
        <form method="post" onSubmit={submit} aria-busy={busy} className="pa-create-layout">
          <div className="pa-create-sections">
            <fieldset disabled={busy} className="pa-create-fields">
              <section className="pa-create-section">
                {section(
                  "01",
                  "College details",
                  "The college identity used throughout VOW.",
                  Building2,
                )}
                <div className="pa-form-two">
                  <Field
                    label="College name"
                    hint="Use the full official name."
                  >
                    <input
                      name="name"
                      required
                      maxLength={120}
                      value={name}
                      onChange={(e) => {
                        const next = e.target.value;
                        setName(next);
                        if (!customSlug.current)
                          setSlug(
                            next
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-|-$/g, "")
                              .slice(0, 63),
                          );
                      }}
                    />
                  </Field>
                  <Field
                    label="College URL name"
                    hint="Creates the college's own login address. Changing it changes the address, while existing accounts and history stay linked."
                  >
                    <input
                      name="slug"
                      required
                      maxLength={63}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      value={slug}
                      onChange={(e) => {
                        customSlug.current = true;
                        setSlug(e.target.value);
                      }}
                      readOnly={Boolean(initial) && !editing}
                      spellCheck={false}
                      autoCapitalize="none"
                    />
                  </Field>
                  <Field label="College type">
                    <select
                      name="institutionType"
                      required={!editing}
                      defaultValue={profile.institutionType || ""}
                    >
                      <option value="">Select college type</option>
                      {collegeTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Affiliated university / board (optional)">
                    <input
                      name="affiliation"
                      maxLength={160}
                      defaultValue={profile.affiliation || ""}
                    />
                  </Field>
                  <Field
                    label="Website (optional)"
                    hint="Include https:// in the address."
                  >
                    <input
                      name="website"
                      type="url"
                      maxLength={300}
                      placeholder="https://college.edu"
                      defaultValue={profile.website || ""}
                    />
                  </Field>
                </div>
              </section>
              <section className="pa-create-section">
                {section(
                  "02",
                  "Contact & location",
                  editing
                    ? "Update the saved contact details. Leave a field blank to clear it."
                    : "Keep the college's official contact details in one place.",
                  MapPin,
                )}
                <div className="pa-form-two">
                  <Field label="College contact email">
                    <input
                      name="contactEmail"
                      type="email"
                      required={!editing}
                      maxLength={120}
                      defaultValue={profile.contactEmail || ""}
                    />
                  </Field>
                  <Field
                    label="Contact phone (optional)"
                    hint="Include the country code, for example +91."
                  >
                    <input
                      name="phone"
                      type="tel"
                      maxLength={30}
                      defaultValue={profile.phone || ""}
                    />
                  </Field>
                  <Field label="Address line 1 (optional)">
                    <input
                      name="addressLine1"
                      maxLength={160}
                      defaultValue={profile.addressLine1 || ""}
                    />
                  </Field>
                  <Field label="Address line 2 (optional)">
                    <input
                      name="addressLine2"
                      maxLength={160}
                      defaultValue={profile.addressLine2 || ""}
                    />
                  </Field>
                  <Field label="City">
                    <input
                      name="city"
                      required={!editing}
                      maxLength={80}
                      defaultValue={profile.city || ""}
                    />
                  </Field>
                  <Field label="State / region">
                    <input
                      name="state"
                      required={!editing}
                      maxLength={80}
                      defaultValue={profile.state || ""}
                    />
                  </Field>
                  <Field label="Country">
                    <input
                      name="country"
                      required={!editing}
                      maxLength={80}
                      defaultValue={profile.country || (editing ? "" : "India")}
                    />
                  </Field>
                  <Field label="Postal code (optional)">
                    <input
                      name="postalCode"
                      maxLength={20}
                      defaultValue={profile.postalCode || ""}
                    />
                  </Field>
                </div>
              </section>
              {editing ? (
                <section className="pa-create-section">
                  {section(
                    "03",
                    "College access",
                    "Control sign-in access for this college.",
                    ShieldCheck,
                  )}
                  <Field
                    label="Access status"
                    hint="Changing status signs out current college sessions. Archiving preserves all records."
                  >
                    <select
                      name="status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      {["ACTIVE", "MAINTENANCE", "SUSPENDED", "ARCHIVED"].map(
                        (value) => (
                          <option key={value} value={value}>
                            {value[0] + value.slice(1).toLowerCase()}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <p className="pa-note">
                    Manage cohorts and Centre Command accounts from the college
                    workspace.
                  </p>
                </section>
              ) : (
                <>
                  <section className="pa-create-section">
                    {section(
                      "03",
                      "First cohort",
                      "Give the college its first intake. More cohorts can be added later.",
                      GraduationCap,
                    )}
                    <div className="pa-form-two">
                      <Field label="First cohort name">
                        <input
                          name="cohortName"
                          required
                          maxLength={120}
                          defaultValue="Initial cohort"
                        />
                      </Field>
                      <Field label="First cohort start date">
                        <input name="startDate" type="date" required />
                      </Field>
                    </div>
                  </section>
                  <section className="pa-create-section">
                    {section(
                      "04",
                      "First Centre Command account",
                      "This CC can manage all the college's cohorts, teams, MCs and players.",
                      ShieldCheck,
                    )}
                    <div className="pa-form-two">
                      <Field label="CC full name">
                        <input
                          name="adminName"
                          required
                          maxLength={120}
                          autoComplete="off"
                        />
                      </Field>
                      <Field
                        label="CC email address"
                        hint="Used to sign in and recover this account."
                      >
                        <input
                          name="email"
                          type="email"
                          required
                          maxLength={120}
                          autoComplete="off"
                        />
                      </Field>
                      <Field label="CC username (optional)">
                        <input
                          name="username"
                          maxLength={32}
                          pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}"
                          autoComplete="off"
                        />
                      </Field>
                      <div className="pa-create-field-spacer" />
                      <Field
                        label="Initial password"
                        hint="Use at least 8 characters and share it privately."
                      >
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={8}
                          maxLength={256}
                          autoComplete="new-password"
                        />
                      </Field>
                      <Field label="Confirm initial password">
                        <input
                          name="confirmPassword"
                          type="password"
                          required
                          minLength={8}
                          maxLength={256}
                          autoComplete="new-password"
                        />
                      </Field>
                    </div>
                  </section>
                </>
              )}
            </fieldset>
            {error && (
              <div
                className="pa-error"
                role="alert"
                tabIndex={-1}
                ref={errorRef}
              >
                {error}
                <a className="pa-text-link" href="/platform">
                  Open CMS
                </a>
              </div>
            )}
            <footer className="pa-create-actions">
              <p role="status">
                {busy
                  ? editing
                    ? "Saving college details…"
                    : "Creating the college and preparing its first cohort and CC account…"
                  : editing
                    ? "Review the details before saving your changes."
                    : "Review the details before creating the college."}
              </p>
              <div>
                <button
                  type="button"
                  className="pa-secondary"
                  disabled={busy}
                  onClick={() => location.assign(backHref)}
                >
                  Cancel
                </button>
                <button className="pa-primary" disabled={busy}>
                  {busy
                    ? editing
                      ? "Saving changes…"
                      : "Creating college…"
                    : editing
                      ? "Save changes"
                      : initial
                        ? "Retry setup"
                        : "Create college"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </footer>
          </div>
          <aside className="pa-create-summary">
            <span className="pa-kicker">
              {editing ? "COLLEGE PROFILE" : "READY FOR THE JOURNEY"}
            </span>
            <h2>{name || "Your new college"}</h2>
            <p className="pa-note">Dedicated college login URL</p>
            {loginUrl ? (
              <a
                className="pa-url-preview"
                href={loginUrl}
                target="_blank"
                rel="noreferrer"
              >
                {loginUrl}
              </a>
            ) : (
              <p className="pa-note">
                Choose a valid college URL name to see its address.
              </p>
            )}
            <ul>
              <li>
                <Check size={17} />
                {editing ? "College identity" : "One college workspace"}
              </li>
              <li>
                <Check size={17} />
                {editing ? "Contact & location" : "The first learning cohort"}
              </li>
              <li>
                <Check size={17} />
                {editing
                  ? `Access: ${status[0] + status.slice(1).toLowerCase()}`
                  : "A college-wide CC account"}
              </li>
            </ul>
            <p>
              {editing
                ? "Your cohorts, teams, staff accounts and learning history stay linked to this college."
                : "The CC can then create MCs, assign teams and add players. MCs can create players only in their assigned teams."}
            </p>
            {!editing && (
              <button
                className="pa-text-link"
                type="button"
                disabled={busy}
                onClick={() =>
                  document.querySelector('[name="adminName"]')?.focus()
                }
              >
                Go to CC details
                <ChevronRight size={15} />
              </button>
            )}
          </aside>
        </form>
      </div>
    </main>
  );
}
