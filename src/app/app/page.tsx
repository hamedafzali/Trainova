import type { Metadata } from "next";
import { Landing } from "@/components/Landing";

export const metadata: Metadata = {
  title: "Trainova for Android and iPhone",
  description:
    "Follow a plan, log every set in seconds and watch your strength climb. Get Trainova on your phone.",
};

/** The introduction, for everyone (signed-out visitors also get it at "/"). Rendered outside the app shell. */
export default function AppLandingPage() {
  return <Landing />;
}
