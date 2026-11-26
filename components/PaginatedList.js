"use client";
import { useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pagination } from "@/lib/pagination.js";

export default function PaginatedList({ items, children, label, pageSize = 5, className, enabled = true }) {
  const [requestedPage, setPage] = useState(1);
  const root = useRef(null);
  const id = useId();
  const state = pagination(items.length, requestedPage, pageSize);
  function changePage(next) {
    setPage(next);
    const top = root.current?.getBoundingClientRect().top;
    if (top < 0) root.current.scrollIntoView({ block: "start" });
  }
  if (!enabled) return <div className={className}>{children(items)}</div>;
  return <div ref={root} className="paginated-list">
    <div id={id} className={className}>{children(items.slice(state.start, state.end))}</div>
    {items.length > 0 && <nav className="list-pagination" aria-label={`${label} pagination`}>
      <span role="status" aria-live="polite">{state.start + 1}–{state.end} of {items.length} {label}</span>
      <div className="pagination-buttons">
        <button type="button" className="pagination-direction" aria-label={`Previous page of ${label}`} aria-controls={id} disabled={state.page === 1} onClick={() => changePage(state.page - 1)}><ChevronLeft size={16} aria-hidden="true" /><span>Previous</span></button>
        {state.numbers.map(page => <button type="button" key={page} aria-controls={id} aria-label={`Page ${page}`} aria-current={state.page === page ? "page" : undefined} onClick={() => changePage(page)}>{page}</button>)}
        <button type="button" className="pagination-direction" aria-label={`Next page of ${label}`} aria-controls={id} disabled={state.page === state.pages} onClick={() => changePage(state.page + 1)}><span>Next</span><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
    </nav>}
  </div>;
}
