import { describe, expect, it } from "vitest";
import { buildDataset, displayFamilyOf } from "../dataset";
import { validateData } from "../validate";
import { fixture } from "./fixture";

describe("validateData", () => {
  it("accepts the fixture", () => {
    const { errors } = validateData(fixture());
    expect(errors).toEqual([]);
  });

  it("rejects a person as biological child of two unions", () => {
    const raw = fixture();
    raw.unions[0].children.push("Son"); // Son already bio child of u_dad_mom
    const { errors } = validateData(raw);
    expect(
      errors.some((e) => e.includes("biological child of two unions")),
    ).toBe(true);
  });

  it("rejects a child who is also a partner in the same union", () => {
    const raw = fixture();
    raw.unions[0].children.push("GpaA");
    const { errors } = validateData(raw);
    expect(errors.some((e) => e.includes("both partner and child"))).toBe(true);
  });
});

describe("buildDataset derived relations", () => {
  const ds = buildDataset(fixture());

  it("derives parents with biological/adoptive tags", () => {
    expect(ds.parentsOf.get("Son")).toEqual([
      { id: "Dad", tag: "biological" },
      { id: "Mom", tag: "biological" },
    ]);
    const adoptedParents = ds.parentsOf.get("AdoptedKid")!;
    expect(adoptedParents).toContainEqual({ id: "SoloMum", tag: "biological" });
    expect(adoptedParents).toContainEqual({ id: "Dad", tag: "adoptive" });
    expect(adoptedParents).toContainEqual({ id: "Mom", tag: "adoptive" });
  });

  it("derives spouses with union status", () => {
    const dadSpouses = ds.spousesOf.get("Dad")!;
    expect(dadSpouses).toContainEqual({
      id: "Ex",
      unionId: "u_dad_ex",
      status: "divorced",
    });
    expect(dadSpouses).toContainEqual({
      id: "Mom",
      unionId: "u_dad_mom",
      status: "married",
    });
  });

  it("keeps out-of-wedlock parentage complete (partners status, both parents)", () => {
    expect(ds.parentsOf.get("LoveChild")).toEqual([
      { id: "Son", tag: "biological" },
      { id: "Girlfriend", tag: "biological" },
    ]);
    expect(ds.spousesOf.get("Son")![0].status).toBe("partners");
  });

  it("handles the unknown-partner case as a 1-partner union", () => {
    expect(ds.parentsOf.get("OutKid")).toEqual([
      { id: "SoloMum", tag: "biological" },
    ]);
  });

  it("derives family history: birth, then married-into, in union order", () => {
    // Ex: born famC, divorced out of famA
    expect(ds.familiesOf.get("Ex")).toEqual([
      { familyId: "famC", kind: "birth" },
      {
        familyId: "famA",
        kind: "married-into",
        status: "divorced",
        unionId: "u_dad_ex",
      },
    ]);
    // Mom: born famB, married into famA
    expect(ds.familiesOf.get("Mom")).toEqual([
      { familyId: "famB", kind: "birth" },
      {
        familyId: "famA",
        kind: "married-into",
        status: "married",
        unionId: "u_dad_mom",
      },
    ]);
    // AdoptedKid: born famC, adopted into famA
    expect(ds.familiesOf.get("AdoptedKid")).toEqual([
      { familyId: "famC", kind: "birth" },
      { familyId: "famA", kind: "adopted-into", unionId: "u_dad_mom" },
    ]);
  });

  it("family members include born, married-in and adopted-in people", () => {
    const famA = ds.membersOfFamily.get("famA")!;
    expect(famA.has("Dad")).toBe(true); // born
    expect(famA.has("Mom")).toBe(true); // married in
    expect(famA.has("Ex")).toBe(true); // married in (divorced: history stays)
    expect(famA.has("AdoptedKid")).toBe(true); // adopted in
    expect(famA.has("UncleB")).toBe(false);
  });

  it("displayFamily falls back to adoptive family only when lineage is unknown", () => {
    expect(displayFamilyOf(ds, "AdoptedKid")).toBe("famC"); // lineage known → lineage
    expect(displayFamilyOf(ds, "Hermit")).toBe(null);
  });
});

describe("family labels (same-name lineages)", () => {
  it("leaves uniquely-named families without a distinguisher", () => {
    const labels = buildDataset(fixture()).familyLabels;
    expect(labels.get("famA")).toEqual({ name: "A" });
  });

  it("distinguishes two families sharing a name: by note, else by eldest ancestor", () => {
    const raw = fixture();
    raw.families.famA.name = "Pandya";
    raw.families.famB.name = "Pandya"; // now two "Pandya" lineages
    raw.families.famB.note = "Surat branch";
    const labels = buildDataset(raw).familyLabels;
    // famB has an explicit note
    expect(labels.get("famB")).toEqual({
      name: "Pandya",
      distinguisher: "Surat branch",
    });
    // famA has none → eldest ancestor born into it (GpaA is gen 0 in famA)
    expect(labels.get("famA")).toEqual({
      name: "Pandya",
      distinguisher: "GpaA",
    });
    // famC still unique
    expect(labels.get("famC")).toEqual({ name: "C" });
  });
});
