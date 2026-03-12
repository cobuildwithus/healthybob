import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createSamplePresetRegistry,
  importCsvSamples,
  importDocument,
  importMeal,
  parseDelimitedRows,
} from "../src/index.js";

async function createTempFile(name, contents) {
  const directory = await mkdtemp(join(tmpdir(), "healthybob-importers-"));
  const filePath = join(directory, name);
  await writeFile(filePath, contents);
  return filePath;
}

function createCorePortSpy() {
  const calls = {
    documents: [],
    meals: [],
    samples: [],
  };

  return {
    calls,
    corePort: {
      async importDocument(payload) {
        calls.documents.push(payload);
        return { ok: true, kind: "document" };
      },
      async addMeal(payload) {
        calls.meals.push(payload);
        return { ok: true, kind: "meal" };
      },
      async importSamples(payload) {
        calls.samples.push(payload);
        return { ok: true, kind: "samples" };
      },
    },
  };
}

test("importDocument delegates a core-shaped document payload", async () => {
  const filePath = await createTempFile("labs.pdf", "pdf-placeholder");
  const { calls, corePort } = createCorePortSpy();

  const result = await importDocument(
    {
      filePath,
      note: "  annual lab packet  ",
      occurredAt: "2026-03-11T14:00:00-05:00",
    },
    { corePort },
  );

  assert.deepEqual(result, { ok: true, kind: "document" });
  assert.equal(calls.documents.length, 1);
  assert.equal(calls.documents[0].sourcePath, filePath);
  assert.equal(calls.documents[0].title, "labs.pdf");
  assert.equal(calls.documents[0].note, "annual lab packet");
});

test("importMeal validates attachments and maps to addMeal-compatible input", async () => {
  const photoPath = await createTempFile("dinner.jpg", "image-placeholder");
  const audioPath = await createTempFile("dinner-note.m4a", "audio-placeholder");
  const { calls, corePort } = createCorePortSpy();

  await importMeal(
    {
      photoPath,
      audioPath,
      note: "  salmon and rice  ",
      occurredAt: new Date("2026-03-11T18:30:00Z"),
    },
    { corePort },
  );

  assert.equal(calls.meals.length, 1);
  assert.equal(calls.meals[0].photoPath, photoPath);
  assert.equal(calls.meals[0].audioPath, audioPath);
  assert.equal(calls.meals[0].note, "salmon and rice");
});

test("importMeal rejects requests without a baseline photo attachment", async () => {
  const { corePort } = createCorePortSpy();

  await assert.rejects(
    () =>
      importMeal(
        {
          note: "soup",
        },
        { corePort },
      ),
    /photoPath/,
  );
});

test("importCsvSamples parses rows and emits recordedAt values for core", async () => {
  const filePath = await createTempFile(
    "heart-rate.csv",
    [
      "timestamp,bpm,device,context",
      "2026-03-11T08:00:00Z,72,watch,resting",
      "2026-03-11T08:05:00Z,75,watch,\"post, walk\"",
    ].join("\n"),
  );
  const { calls, corePort } = createCorePortSpy();
  const presetRegistry = createSamplePresetRegistry([
    {
      id: "vendor-watch-heart-rate",
      stream: "heart_rate",
      tsColumn: "timestamp",
      valueColumn: "bpm",
      unit: "bpm",
      metadataColumns: ["device", "context"],
      source: "device",
    },
  ]);

  await importCsvSamples(
    {
      filePath,
      presetId: "vendor-watch-heart-rate",
    },
    { corePort, presetRegistry },
  );

  assert.equal(calls.samples.length, 1);
  assert.equal(calls.samples[0].stream, "heart_rate");
  assert.equal(calls.samples[0].unit, "bpm");
  assert.equal(calls.samples[0].source, "device");
  assert.equal(calls.samples[0].sourcePath, filePath);
  assert.equal(calls.samples[0].samples.length, 2);
  assert.equal(calls.samples[0].samples[1].recordedAt, "2026-03-11T08:05:00.000Z");
});

test("createSamplePresetRegistry rejects duplicate preset ids", () => {
  const registry = createSamplePresetRegistry();

  registry.register({
    id: "duplicate",
    stream: "steps",
    tsColumn: "ts",
    valueColumn: "value",
    unit: "count",
  });

  assert.throws(
    () =>
      registry.register({
        id: "duplicate",
        stream: "steps",
        tsColumn: "ts",
        valueColumn: "value",
        unit: "count",
      }),
    /already registered/,
  );
});

test("parseDelimitedRows handles quoted commas", () => {
  const rows = parseDelimitedRows('a,b\n1,"two,three"\n', ",");
  assert.deepEqual(rows, [
    ["a", "b"],
    ["1", "two,three"],
  ]);
});

test("importDocument accepts a narrow core port with only the called export", async () => {
  const filePath = await createTempFile("visit-note.txt", "note");

  const result = await importDocument(
    { filePath },
    {
      corePort: {
        async importDocument(payload) {
          return payload.title;
        },
      },
    },
  );

  assert.equal(result, "visit-note.txt");
});
