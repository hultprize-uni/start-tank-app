import type { Metadata } from "next";
import { JuryPortal } from "@/components/jurado/JuryPortal";

export const metadata: Metadata = {
  title: "Portal del jurado | Start Tank",
};

/** Portal del jurado para laptop: acceso con código y votación. */
export default function Page() {
  return <JuryPortal />;
}
