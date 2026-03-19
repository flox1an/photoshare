// @vitest-environment jsdom
/**
 * RED test scaffolds for src/store/uploadStore.ts
 * Covers: UPLD-07
 *
 * All tests in this file fail because src/store/uploadStore.ts does not exist yet.
 * This is the intentional RED state — implementation is in Plan 03-03.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useUploadStore } from "@/store/uploadStore";

describe("useUploadStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    useUploadStore.getState().reset();
  });

  it("initial state has empty photos Record (UPLD-07)", () => {
    const state = useUploadStore.getState();
    expect(state.photos).toEqual({});
  });

  it("setEncrypting(id) transitions photo from pending to 'encrypting' (UPLD-07)", () => {
    const store = useUploadStore.getState();
    // Add a pending photo first
    store.addPhoto("photo-id-1", "test.jpg");
    expect(useUploadStore.getState().photos["photo-id-1"].status).toBe("pending");

    store.setEncrypting("photo-id-1");
    expect(useUploadStore.getState().photos["photo-id-1"].status).toBe("encrypting");
  });

  it("setUploading(id) transitions photo from encrypting to 'uploading' (UPLD-07)", () => {
    const store = useUploadStore.getState();
    store.addPhoto("photo-id-2", "test2.jpg");
    store.setEncrypting("photo-id-2");
    store.setUploading("photo-id-2");
    expect(useUploadStore.getState().photos["photo-id-2"].status).toBe("uploading");
  });

  it("setUploadDone(id, descriptor) transitions to 'done' with BlobDescriptor result (UPLD-07)", () => {
    const store = useUploadStore.getState();
    const descriptor = {
      url: "https://24242.io/blob/abc",
      sha256: "a".repeat(64),
      size: 100,
      type: "application/octet-stream",
      uploaded: 1700000000,
    };
    store.addPhoto("photo-id-3", "test3.jpg");
    store.setEncrypting("photo-id-3");
    store.setUploading("photo-id-3");
    store.setUploadDone("photo-id-3", descriptor);
    const photo = useUploadStore.getState().photos["photo-id-3"];
    expect(photo.status).toBe("done");
    expect(photo.result).toEqual(descriptor);
  });

  it("setUploadError(id, message) transitions to 'error' with message (UPLD-07)", () => {
    const store = useUploadStore.getState();
    store.addPhoto("photo-id-4", "test4.jpg");
    store.setEncrypting("photo-id-4");
    store.setUploadError("photo-id-4", "Upload failed after 3 retries");
    const photo = useUploadStore.getState().photos["photo-id-4"];
    expect(photo.status).toBe("error");
    expect(photo.error).toBe("Upload failed after 3 retries");
  });

  it("status union includes 'encrypting' and 'uploading' in addition to existing values (UPLD-07)", () => {
    const store = useUploadStore.getState();
    store.addPhoto("photo-id-5", "test5.jpg");
    // Verify encrypting state
    store.setEncrypting("photo-id-5");
    expect(useUploadStore.getState().photos["photo-id-5"].status).toBe("encrypting");
    // Verify uploading state
    store.setUploading("photo-id-5");
    expect(useUploadStore.getState().photos["photo-id-5"].status).toBe("uploading");
  });
});
