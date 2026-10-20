import { redirect } from "next/navigation";

// /books is the books dashboard, which task 2.2 builds. Until then it is the
// master list; 2.2 removes this redirect and the route table's note.
export default function Books() {
  redirect("/books/list");
}
