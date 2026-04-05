import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { EventStoreProvider } from "applesauce-react";
import { NostrAccountRestorer } from "@/components/auth/NostrAccountRestorer";
import SystemThemeSync from "@/components/theme/SystemThemeSync";
import { eventStore } from "@/lib/nostr/eventStore";
import { useSettings } from "@/hooks/useSettings";
import { useImageProcessor } from "@/hooks/useImageProcessor";
import { SettingsPage } from "@/components/settings/SettingsPage";

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

export default function App() {
  const settings = useSettings();
  const imageProcessor = useImageProcessor();

  return (
    <BrowserRouter>
      <EventStoreProvider eventStore={eventStore}>
      <SystemThemeSync />
      <NostrAccountRestorer />
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <UploadPanel settings={settings} imageProcessor={imageProcessor} />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<LoadingSpinner message="Loading settings..." />}>
              <SettingsPage settings={settings} />
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
      </EventStoreProvider>
    </BrowserRouter>
  );
}
