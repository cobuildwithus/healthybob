import assert from "node:assert/strict";
import { access, mkdtemp, rm, rm as remove } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import {
  appendProfileSnapshot,
  initializeVault,
  readCurrentProfile,
  readJsonlRecords,
  rebuildCurrentProfile,
} from "../src/index.js";

test("rebuildCurrentProfile removes stale current profile markdown when no snapshots remain", async () => {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "healthybob-profile-"));
  const currentProfilePath = path.join(vaultRoot, "bank/profile/current.md");

  try {
    await initializeVault({ vaultRoot });
    const appended = await appendProfileSnapshot({
      vaultRoot,
      recordedAt: "2026-03-12T10:00:00.000Z",
      source: "manual",
      profile: {
        topGoalIds: ["goal_sleep"],
        sleep: {
          averageHours: 7,
        },
      },
    });
    const appendAuditRecords = await readJsonlRecords({
      vaultRoot,
      relativePath: appended.auditPath,
    });

    await access(currentProfilePath);
    await remove(path.join(vaultRoot, "ledger/profile-snapshots"), {
      recursive: true,
      force: true,
    });

    const rebuilt = await rebuildCurrentProfile({ vaultRoot });
    const current = await readCurrentProfile({ vaultRoot });
    const rebuildAuditRecords = await readJsonlRecords({
      vaultRoot,
      relativePath: rebuilt.auditPath,
    });

    assert.equal(rebuilt.exists, false);
    assert.equal(rebuilt.snapshot, null);
    assert.equal(rebuilt.updated, true);
    assert.equal(current.exists, false);
    assert.equal(current.markdown, null);
    assert.equal(
      appendAuditRecords.filter((record) => (record as { action?: string }).action === "profile_snapshot_add").length,
      1,
    );
    assert.equal(
      appendAuditRecords.filter(
        (record) => (record as { action?: string }).action === "profile_current_rebuild",
      ).length,
      1,
    );
    assert.equal(
      rebuildAuditRecords.filter(
        (record) => (record as { action?: string }).action === "profile_current_rebuild",
      ).length,
      2,
    );
    await assert.rejects(access(currentProfilePath));
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});
