import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NostrAccountRestorer } from "@/components/auth/NostrAccountRestorer";

const UploadPanel = lazy(() => import("@/components/upload/UploadPanel"));
const ViewerPanel = lazy(() => import("@/components/viewer/ViewerPanel"));

function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">{message}</p>
      </div>
    </main>
  );
}

function ViewerRoute() {
  const { hash } = useParams();
  return <ViewerPanel hash={hash!} />;
}

import { useParams } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <NostrAccountRestorer />
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <UploadPanel />
            </Suspense>
          }
        />
        <Route
          path="/:hash"
          element={
            <Suspense fallback={<LoadingSpinner message="Loading album..." />}>
              <ViewerRoute />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
