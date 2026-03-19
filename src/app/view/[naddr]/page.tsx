"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const ViewerPanel = dynamic(
  () => import("@/components/viewer/ViewerPanel"),
  { ssr: false, loading: () => <p>Loading...</p> },
);

interface Props {
  params: Promise<{ naddr: string }>;
}

export default function ViewerPage({ params }: Props) {
  const { naddr } = use(params);
  return <ViewerPanel naddr={naddr} />;
}
