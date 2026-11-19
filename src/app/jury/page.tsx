import type { Metadata } from "next";
import { JuryPortal } from "@/features/jury";

export const metadata: Metadata = {
  title: "Portal del jurado | Start Tank",
};

/** Portal del jurado para laptop: acceso con código y votación. */
export default function Page() {
  return <JuryPortal />;
}
