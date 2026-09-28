import type { Metadata } from "next";
import { AskQuestionsFeed } from "@/components/ask/ask-questions-feed";

export const metadata: Metadata = {
  title: "Ask a Question",
};

export default function AskQuestionsPage() {
  return <AskQuestionsFeed />;
}
