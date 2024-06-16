import ImageToZpl from "./_components/convert";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image to ZPL",
  description:
    "Convert images to ZPL. Works offline, images stay on your device.",
};

export default async function App() {
  return (
    <main className="bg-gradient-to-tr from-slate-900 to-slate-950 min-h-screen">
      <ImageToZpl />
    </main>
  );
}
