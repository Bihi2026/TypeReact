import type { Metadata } from "next";
import { SubmitStoryIdea } from "@/components/stories/submit-story-idea";

export const metadata: Metadata = {
  title: "Submit a Story Idea",
};

export default function SubmitStoryIdeaPage() {
  return <SubmitStoryIdea />;
}
