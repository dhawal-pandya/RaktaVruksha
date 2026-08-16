/**
 * The shard files are the source of truth, so what has to hold is that they are
 * a FIXED POINT: reading them and writing them back produces exactly the same
 * bytes.
 *
 * That is what lets a hand-edited file and the in-app editor share one format.
 * If `dense(expand(files))` differed from `files` by so much as a key order or a
 * hoisted default, then every autosave would reformat files somebody had been
 * organising by hand — the churn that makes a generated file uneditable, which
 * is the whole thing this format exists to avoid.
 *
 * (The migration off the single flat family-data files was gated on a stricter
 * test than this: every record deep-equal, node order preserved within each
 * layout family, and the 3D layout landing within 2% of the tree's own spread.
 * Those flat files are gone, so that test went with them; git history holds it.)
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MANIFEST, checkShards, dense, expand, shardFileName } from "./shards";
import { buildDataset } from "./dataset";
import { buildGraph } from "./graph";
import { parseFamilyData, validateData } from "./validate";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(here, "../../public/data");
const DATASETS = ["family", "ramayan", "mahabharat", "hiranyagarbha", "chaos"];

const read = (dir: string): Map<string, string> => {
  const files = new Map<string, string>();
  for (const name of readdirSync(resolve(DATA, dir))) {
    if (name.endsWith(".json"))
      files.set(name, readFileSync(resolve(DATA, dir, name), "utf8"));
  }
  return files;
};

describe.each(DATASETS)("%s", (dir) => {
  const files = read(dir);

  it("round-trips to byte-identical files", () => {
    const again = dense(expand(files));
    expect([...again.keys()].sort()).toEqual([...files.keys()].sort());
    for (const [name, text] of again) expect(text).toBe(files.get(name));
  });

  it("every shard on disk is named by the manifest, and vice versa", () => {
    const listed = (JSON.parse(files.get(MANIFEST)!) as { shards: string[] })
      .shards;
    const onDisk = [...files.keys()].filter((f) => f !== MANIFEST);
    expect(listed.slice().sort()).toEqual(onDisk.sort());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("expands into a dataset the app accepts", () => {
    const raw = expand(files);
    expect(checkShards(files)).toEqual([]);
    expect(validateData(raw).errors).toEqual([]);
    expect(buildGraph(buildDataset(raw)).nodes.length).toBeGreaterThan(0);
  });

  // parseFamilyData rebuilds every record field by field, so a field it does not
  // know about is dropped on the way into the app and nowhere else. crossEra was
  // lost exactly this way: the files were right, every Node-side check passed,
  // and the browser levelled forty cross-era bonds into a 4,000-row pancake.
  it("survives the parser the app actually boots through", () => {
    const direct = expand(files);
    const parsed = parseFamilyData(JSON.stringify(direct));
    expect(parsed.errors).toEqual([]);
    expect(parsed.raw).not.toBeNull();
    const byId = <T extends { id: string }>(xs: T[]) =>
      Object.fromEntries(xs.map((x) => [x.id, x]));
    expect(byId(parsed.raw!.unions)).toEqual(byId(direct.unions));
    expect(byId(parsed.raw!.people)).toEqual(byId(direct.people));
  });

  it("files every record where it is drawn", () => {
    const raw = expand(files);
    const ds = buildDataset(raw);
    // A shard's name follows the family a node is RENDERED with, which is not
    // always the family it was born into — Karna is filed with the Sutas who
    // raised him. Whatever the file says, the person's own birthFamilyId is
    // untouched, so both readings stay available.
    for (const n of buildGraph(ds).nodes) {
      if (n.kind !== "person") continue;
      const file = shardFileName(n.familyId);
      expect(files.has(file)).toBe(true);
      expect(JSON.parse(files.get(file)!).people).toHaveProperty(n.personId);
    }
  });
});
