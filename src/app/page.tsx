"use client";

import dynamic from "next/dynamic";

const UploadPanel = dynamic(
  () => import("@/components/upload/UploadPanel"),
  { ssr: false, loading: () => <p>Loading...</p> },
);

export default function Home() {
  return <UploadPanel />;
}
