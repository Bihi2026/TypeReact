import type { Metadata } from "next";
import { AcceptedIdeasBrowse } from "@/components/stories/accepted-ideas-browse";

export const metadata: Metadata = {
  title: "Accepted Story Ideas",
};

export default function AcceptedStoryIdeasPage() {
  return <AcceptedIdeasBrowse />;
}
