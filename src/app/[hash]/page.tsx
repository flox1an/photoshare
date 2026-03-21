"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const ViewerPanel = dynamic(
  () => import("@/components/viewer/ViewerPanel"),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading album...</p>
        </div>
      </main>
    ),
  },
);

interface Props {
  params: Promise<{ hash: string }>;
}

export default function ViewerPage({ params }: Props) {
  const { hash } = use(params);
  return <ViewerPanel hash={hash} />;
}
