"use client";

interface Props {
  naddr: string;
}

export default function ViewerPanel({ naddr }: Props) {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">PhotoShare Viewer</h1>
      <p className="mt-2 text-gray-600 font-mono text-sm break-all">{naddr}</p>
    </main>
  );
}
