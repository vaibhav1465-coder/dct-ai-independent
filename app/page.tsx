import { Header } from "./ui/header";
import { CheckForm } from "./ui/check-form";
import { prisma } from "../lib/prisma";
import { getCurrentUser } from "../lib/auth";

type SavedAnalysis = {
  id: string;
  publication: string;
  articleLabel: string;
  headline: string;
  subhead: string;
  article: string;
  content: string;
  verdict: string;
  category: string;
  reliability: string;
  createdAt: string;
  journalistName: string;
  journalistEmail: string;
};

export default async function Home() {
  const user = await getCurrentUser();
  const savedAnalyses: SavedAnalysis[] = user ? (await prisma.checkMetadata.findMany({
    where: { status: "SUCCEEDED", outputContent: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 16,
    select: {
      id: true,
      publication: true,
      articleLabel: true,
      headline: true,
      subhead: true,
      articleContent: true,
      outputContent: true,
      verdict: true,
      primaryCategory: true,
      reliability: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  })).map((item) => ({
    id: item.id,
    publication: item.publication,
    articleLabel: item.articleLabel ?? item.headline ?? "Draft copy",
    headline: item.headline ?? "",
    subhead: item.subhead ?? "",
    article: item.articleContent ?? "",
    content: item.outputContent ?? "",
    verdict: item.verdict ?? "Editorial review complete",
    category: item.primaryCategory ?? "Editorial coaching",
    reliability: item.reliability === "REPAIRED" ? "Repaired" : "Passed",
    createdAt: item.createdAt.toISOString(),
    journalistName: item.user.name?.trim() || item.user.email.split("@")[0],
    journalistEmail: item.user.email,
  })) : [];

  return (
    <>
      <Header active="check" />
      <main>
        <section className="hero grid">
          <div>
            <p className="eyebrow">DCT AI INDEPENDENT — DIGITAL COACHING TOOL · V2.2_F · INDIAN EXPRESS GROUP</p>
            <h1>Focus on what matters<br />most in the story.</h1>
            <p className="lede">DCT AI Independent checks the story against the editorial framework and newsroom copy rules — without rewriting the copy, and it highlights what is working well alongside what needs stronger coaching.</p>
            <div className="status"><i /> DCT AI Independent · Editorial Framework · Ready</div>
          </div>
        </section>
        <CheckForm savedAnalyses={savedAnalyses} />
      </main>
      <footer>DCT AI Independent — Digital Coaching Tool · Indian Express Group <span>Human editorial review remains mandatory.</span></footer>
    </>
  );
}
