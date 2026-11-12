"""Rewrite the weak poses in every rig JSON (run export_all.py afterwards for .skel/bundle).

What it changes, for all 14 rigs (rider bones r_*, mount bones m_*):
  afflicted  hunched, cowering, trembling loop (was: left arm raised, otherwise idle)
  skill      both arms lift for a channel, then thrust (was: left arm only)
  walk       adds arm swing and a forward lean to the existing leg cycle
  down       the weapon arm is flung clear so the weapon lies beside the body
             mounted rigs: the horse/dragon folds its legs and sinks (was: standing)

Angles are added on top of each bone's setup pose (Spine 2.1 JSON, degrees, CCW).
Re-running is safe: each listed track is replaced, others are left as they were.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent


def rot(*keys):
    return [{"time": t, "angle": a} for t, a in keys]


def move(*keys):
    return [{"time": t, "x": x, "y": y} for t, x, y in keys]


def tremble(base, amp, dur, step=0.1):
    """Small alternating shake around `base`, closed so the loop is seamless."""
    keys, t, s = [], 0.0, 1
    while t < dur - 1e-6:
        keys.append((round(t, 3), base + amp * s))
        s, t = -s, t + step
    keys.append((dur, base + amp))
    return rot(*keys)


def afflicted(d):
    D = d["durations"]["afflicted"]
    return {
        "r_base": {"translate": move((0, 0, -10), (D / 2, 0, -13), (D, 0, -10))},
        "r_torso": {"rotate": tremble(-14, 1.6, D)},
        "r_head": {"rotate": rot((0, -20), (D / 2, -26), (D, -20))},
        "r_upper_arm_l": {"rotate": rot((0, 70), (D / 2, 76), (D, 70))},
        "r_forearm_l": {"rotate": rot((0, 85), (D, 85))},
        "r_upper_arm_r": {"rotate": rot((0, -18), (D, -18))},
        "r_forearm_r": {"rotate": rot((0, 40), (D / 2, 46), (D, 40))},
        "r_sword": {"rotate": rot((0, 25), (D, 25))},
        "r_thigh_l": {"rotate": rot((0, 14), (D, 14))},
        "r_shin_boot_l": {"rotate": rot((0, -22), (D, -22))},
        "r_thigh_r": {"rotate": rot((0, 10), (D, 10))},
        "r_shin_boot_r": {"rotate": rot((0, -18), (D, -18))},
    }


def skill(d):
    D = d["durations"]["skill"]
    return {
        "r_base": {"translate": move((0, 0, 0), (0.35 * D, 0, 4), (0.55 * D, 0, -3), (D, 0, 0))},
        "r_torso": {"rotate": rot((0, 0), (0.35 * D, 9), (0.55 * D, -10), (0.8 * D, -6), (D, 0))},
        "r_head": {"rotate": rot((0, 0), (0.35 * D, 10), (0.55 * D, -6), (D, 0))},
        "r_upper_arm_l": {"rotate": rot((0, 0), (0.35 * D, 140), (0.55 * D, 105), (0.8 * D, 100), (D, 0))},
        "r_forearm_l": {"rotate": rot((0, 0), (0.35 * D, 20), (0.55 * D, -10), (D, 0))},
        "r_upper_arm_r": {"rotate": rot((0, 0), (0.35 * D, 95), (0.55 * D, 70), (0.8 * D, 65), (D, 0))},
        "r_forearm_r": {"rotate": rot((0, 0), (0.35 * D, 25), (0.55 * D, 10), (D, 0))},
        "r_sword": {"rotate": rot((0, 0), (0.35 * D, 30), (0.55 * D, 15), (D, 0))},
    }


def walk_extra(d):
    D = d["durations"]["walk"]
    return {
        "r_torso": {"rotate": rot((0, -5), (D / 2, -3), (D, -5))},
        "r_upper_arm_l": {"rotate": rot((0, 24), (D / 2, -20), (D, 24))},
        "r_upper_arm_r": {"rotate": rot((0, -16), (D / 2, 18), (D, -16))},
        "r_forearm_l": {"rotate": rot((0, 12), (D / 2, 4), (D, 12))},
    }


def down_extra(d, mounted):
    D = d["durations"]["down"]
    tracks = {
        # Throw the weapon arm out past the head so the weapon lands beside the body.
        "r_upper_arm_r": {"rotate": rot((0, 0), (0.4 * D, 120), (D, 150))},
        "r_forearm_r": {"rotate": rot((0, 0), (0.4 * D, 10), (D, 5))},
        "r_sword": {"rotate": rot((0, 0), (0.4 * D, -40), (D, -70))},
    }
    if not mounted:
        return tracks
    bones = {b["name"] for b in d["bones"]}
    # Lying down: forelegs tucked back under the chest, hind legs folded forward.
    fold = {
        "m_upper_fore_near": -38, "m_upper_fore_far": -32, "m_lower_fore_near": 128, "m_lower_fore_far": 120,
        "m_foot_fore_near": -30, "m_foot_fore_far": -26,
        "m_upper_hind_near": 48, "m_upper_hind_far": 42, "m_lower_hind_near": -122, "m_lower_hind_far": -115,
        "m_foot_hind_near": 30, "m_foot_hind_far": 26,
        "m_neck": -24, "m_head": -16, "m_tail": -20,
    }
    for name, angle in fold.items():
        if name in bones:
            tracks[name] = {"rotate": rot((0, 0), (0.5 * D, angle * 0.8), (D, angle))}
    if "m_body" in bones:
        # Sink the body as the legs fold (keeps the existing tilt timing).
        old = d["animations"]["down"]["bones"].get("m_body", {})
        tracks["m_body"] = {**old, "translate": move((0, 0, 0), (0.5 * D, 0, -110), (D, 0, -165))}
    return tracks


def apply(anim, tracks, bones):
    for name, tr in tracks.items():
        if name in bones:
            anim["bones"].setdefault(name, {}).update(tr)


def main():
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    for rid in manifest["rigs"]:
        path = ROOT / rid / f"{rid}.json"
        d = json.loads(path.read_text(encoding="utf-8"))
        bones = {b["name"] for b in d["bones"]}
        A = d["animations"]
        A["afflicted"]["bones"] = {k: v for k, v in A["afflicted"]["bones"].items() if k.startswith("m_")}
        apply(A["afflicted"], afflicted(d), bones)
        A["skill"]["bones"] = {k: v for k, v in A["skill"]["bones"].items() if k.startswith("m_")}
        apply(A["skill"], skill(d), bones)
        apply(A["walk"], walk_extra(d), bones)
        apply(A["down"], down_extra(d, d.get("mounted", False)), bones)
        path.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
        print(rid, "tuned")


if __name__ == "__main__":
    main()
