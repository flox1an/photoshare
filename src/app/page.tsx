"use client";

import dynamic from "next/dynamic";

const UploadPanel = dynamic(
  () => import("@/components/upload/UploadPanel"),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </main>
    ),
  },
);

export default function Home() {
  return <UploadPanel />;
}
