/**
 * Parked mid-read (task 5.15, D-105): a Parked book with a start held on
 * `book_status`, a read begun (1.17) and not finished since, since finishing
 * moves the start onto the read it appends (data model 2.18). Derived, never
 * stored: D-105 chose this over a *was reading* flag. TASK-111's review offers
 * such a book *Pick it back up*, which keeps the start. `listBooks` rows carry
 * both fields.
 */
export function isParkedMidRead(row: { status: string; started_on_precision: string }): boolean {
  return row.status === "parked" && row.started_on_precision !== "none";
}
