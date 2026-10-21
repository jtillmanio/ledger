import { Suspense } from "react";
import InboxCount from "./InboxCount";
import ShellFrame from "./ShellFrame";

/** The app shell: the phone's media bar, the tablet's rail, the desktop sidebar, and the content box. */
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ShellFrame inbox={<Suspense fallback={null}><InboxCount /></Suspense>}>
      {children}
    </ShellFrame>
  );
}
