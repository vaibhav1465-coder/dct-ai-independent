import type { Metadata } from "next";
import "./globals.css";
import "./feedback.css";

export const metadata: Metadata = {
  title: "DCT AI Independent — Digital Coaching Tool",
  description: "Editorial coaching for Indian Express Group journalists.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
