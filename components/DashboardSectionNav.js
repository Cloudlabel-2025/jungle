"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Users, Flag, Compass, CalendarDays, Radio } from "lucide-react";

export default function DashboardSectionNav({ hasProgramme, hasSupport, sectionPrefix = "cc" }) {
  const [active, setActive] = useState("overview");
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef(null);
  const sections = useMemo(() => [
    ["overview", "Overview", Activity],
    ["squads", "Squads", Users],
    ["attention", "Needs attention", Flag],
    ...(hasProgramme ? [["actions", "Quick actions", Compass]] : []),
    ["programme", "Programme", CalendarDays],
    ...(hasSupport ? [["support", "Support", Radio]] : []),
  ], [hasProgramme, hasSupport]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) setActive(visible[0].target.id.slice(sectionPrefix.length + 1));
    }, { rootMargin: "-15% 0px -55% 0px" });
    for (const [id] of sections) {
      const section = document.getElementById(`${sectionPrefix}-${id}`);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [sections, sectionPrefix]);

  function navigate(event, id) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const section = document.getElementById(`${sectionPrefix}-${id}`);
    if (!section) return;
    event.preventDefault();
    setActive(id);
    window.history.replaceState(window.history.state, "", `#${sectionPrefix}-${id}`);
    // Move keyboard focus without interrupting the scroll animation.
    section.setAttribute("tabindex", "-1");
    section.focus({ preventScroll: true });
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }

  return <>
    <span ref={sentinel} className="cc-header-sentinel" aria-hidden="true" />
    <header className="cc-dashboard-header" data-stuck={stuck ? "true" : "false"}>
    <nav className="cc-section-nav" aria-label="Dashboard sections">
    {sections.map(([id, label, Icon]) => <a key={id} href={`#${sectionPrefix}-${id}`}
      aria-current={active === id ? "location" : undefined}
      onClick={event => navigate(event, id)}>
      <Icon size={16} aria-hidden="true" /><span>{label}</span>
    </a>)}
    </nav>
    </header>
  </>;
}
