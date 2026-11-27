export const supportTicketClosed = ticket => ["RESOLVED", "CLOSED"].includes(ticket.state);
export const supportTicketOverdue = ticket => !supportTicketClosed(ticket) && !ticket.firstResponseAt && Boolean(ticket.breachedAt || ticket.remainingWorkingMinutes < 0);
export function supportQueueCounts(tickets) {
  const open = tickets.filter(ticket => !supportTicketClosed(ticket));
  return { open: open.length, unassigned: open.filter(ticket => !ticket.assignedTo).length,
    overdue: open.filter(supportTicketOverdue).length };
}
export function filterSupportTickets(tickets, { filter = "open", query = "", names = {} } = {}) {
  const needle = query.trim().toLowerCase();
  return tickets.filter(ticket => {
    const closed = supportTicketClosed(ticket);
    const matches = filter === "all" || (filter === "closed" ? closed : !closed &&
      (filter === "unassigned" ? !ticket.assignedTo : filter === "overdue" ? supportTicketOverdue(ticket) : true));
    return matches && (!needle || [ticket.description, ticket.category, ticket.state,
      names[ticket.createdBy], names[ticket.assignedTo], ...(ticket.tags || [])].join(" ").toLowerCase().includes(needle));
  }).sort((a, b) => {
    const priority = ticket => supportTicketClosed(ticket) ? 0 : (supportTicketOverdue(ticket) ? 8 : 0) + (ticket.escalated ? 4 : 0) + (!ticket.assignedTo ? 2 : 0);
    return priority(b) - priority(a) || (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || String(a._id).localeCompare(String(b._id));
  });
}
