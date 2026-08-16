/**
 * What each union status MEANS, in one table.
 *
 * A status used to be spread across seven files — the type, the parser's
 * whitelist, the link colours, the 3D dash, the 2D dash, the guide's legend, and
 * the layout's welding rules — and adding `abduction` meant finding all seven.
 * Miss the parser and the field is silently dropped on the way into the browser;
 * miss the guide and the tree draws a colour nothing explains.
 *
 * So a status is declared once, here, and everything else reads from it. To add
 * one: add an entry, add the name to UnionStatus in types.ts, and it appears in
 * the legend, gets its colour and dash, and knows whether it welds — in every
 * tree, with no other edit.
 */
import type { UnionStatus } from "./types";

export interface StatusStyle {
  /** Legend label. */
  label: string;
  /** One line on what it means, shown in the guide beside the swatch. */
  hint: string;
  color: string;
  /** SVG/three dash pattern, or null for a solid line. */
  dash: [number, number] | null;
  /**
   * Whether the two orbs snap into one rigid body.
   *
   * Only a marriage does. A welded pair sits at a fixed offset inside a collide
   * radius that covers them both, so nothing can ever come between them — which
   * is what makes a couple read as a couple, and is exactly the wrong thing to
   * say about a love affair, an abduction, or a marriage that ended.
   */
  welds: boolean;
  /** Which union wins the weld when someone has several: lowest rank first. */
  rank: number;
}

export const UNION_STATUS: Record<UnionStatus, StatusStyle> = {
  married: {
    label: "Married",
    hint: "and only a marriage snaps the two orbs together",
    color: "#ffffff",
    dash: null,
    welds: true,
    rank: 0,
  },
  unknown: {
    label: "Together, status unrecorded",
    hint: "a couple whose ceremony nobody wrote down",
    color: "#93855f",
    dash: null,
    welds: true,
    rank: 1,
  },
  partners: {
    label: "Partners, unmarried",
    hint: "a thread, not a weld: they are joined but not a pair",
    color: "#b58fc4",
    dash: null,
    welds: false,
    rank: 2,
  },
  abduction: {
    label: "Taken by force",
    hint: "seizure or deception — consent is absent, whatever the method",
    color: "#c0455a",
    dash: null,
    welds: false,
    rank: 3,
  },
  divorced: {
    label: "Divorced",
    hint: "a marriage that ended; the current one keeps the weld",
    color: "#7a6a4d",
    dash: [4, 3],
    welds: false,
    rank: 4,
  },
};

export const STATUS_KEYS = Object.keys(UNION_STATUS) as UnionStatus[];

/** True for a string the schema knows; used by the parser so a new status is
 *  never silently dropped on the way into the app. */
export const isUnionStatus = (v: unknown): v is UnionStatus =>
  typeof v === "string" && Object.hasOwn(UNION_STATUS, v);
