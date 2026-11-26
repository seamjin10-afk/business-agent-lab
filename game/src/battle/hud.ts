import { C, D } from "../rules/engine.js";
import { BattleSetup, ControlMode, DEFAULT_SETUP } from "./setup";
import type { RankAction } from "./ranks";

export type Speed = "normal" | "fast" | "instant";

export interface HudHandlers {
  newBattle(setup: BattleSetup): void;
  speed(s: Speed): void;
  choose(c: RankAction): void;
  endTurn(): void;
  toggleFortune(on: boolean): void;
  fortuneCondition(condition: string): void;
  fate(): void;
}

export interface PartyEntry { name: string; options: { key: string; label: string }[] }
export interface Resources { fortune: number; fate: number; conditions: string[]; deathsDoor: boolean; useFortune: boolean }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ENEMY_SETS: Record<string, string[]> = {
  "오크 · 고블린 무리 · 고블린": ["orc", "goblin-swarm", "goblin"],
  "오크 1 · 고블린 2": ["orc", "goblin", "goblin"],
  "고블린 4": ["goblin", "goblin", "goblin", "goblin"],
  "카오스 전사 · 컬티스트 무리": ["chaos-warrior", "cultist-swarm"],
  "마그마 드래곤(2열) · 고블린 2": ["magma-dragon", "goblin", "goblin"],
};
const MODES: [ControlMode, string][] = [
  ["all", "아군 전원 직접 조작"],
  ["single", "1명 직접 조작 · 나머지 자동"],
  ["auto", "전원 자동 (관전)"],
];

/** DOM panels around the board: setup bar, turn order, log, action bar, result. */
export class Hud {
  private setup: BattleSetup = { ...DEFAULT_SETUP };

  constructor(private h: HudHandlers, private party: PartyEntry[]) {
    const partyNames = party.map(p => p.name);
    $("hud-setup").innerHTML = `
      <label>조작 <select id="hud-mode">${MODES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
      <label id="hud-controlled-wrap">직접 조작 <select id="hud-controlled">${partyNames.map((n, i) => `<option value="${i}">${esc(n)}</option>`).join("")}</select></label>
      <label>적 <select id="hud-enemies">${Object.keys(ENEMY_SETS).map(k => `<option>${esc(k)}</option>`).join("")}</select></label>
      <label>연출 <select id="hud-speed"><option value="normal">보통</option><option value="fast">빠름</option><option value="instant">즉시</option></select></label>
      <button id="hud-loadout-btn">스킬 장착</button>
      <button id="hud-start" class="primary">새 전투</button>
      <div id="hud-loadout" hidden></div>`;
    $("hud-loadout-btn").onclick = () => this.toggleLoadout();
    const sync = () => { $("hud-controlled-wrap").hidden = $<HTMLSelectElement>("hud-mode").value !== "single"; };
    $("hud-mode").onchange = sync;
    sync();
    $("hud-speed").onchange = () => h.speed($<HTMLSelectElement>("hud-speed").value as Speed);
    $("hud-start").onclick = () => {
      this.setup = {
        ...this.setup,
        mode: $<HTMLSelectElement>("hud-mode").value as ControlMode,
        controlled: Number($<HTMLSelectElement>("hud-controlled").value),
        enemies: ENEMY_SETS[$<HTMLSelectElement>("hud-enemies").value],
        seed: Math.floor(Math.random() * 1e9),
        loadout: this.readLoadout(),
      };
      h.newBattle(this.setup);
    };
  }

  get current() { return this.setup; }

  /** Darkest Dungeon style: each hero takes at most four special skills into battle. */
  private toggleLoadout() {
    const box = $("hud-loadout");
    if (!box.hidden) { box.hidden = true; return; }
    const saved = this.setup.loadout || {};
    box.innerHTML = `<p class="hint">영웅마다 특수 스킬·주문을 최대 ${4}개까지 고릅니다. 일반 공격·돌격·이탈·보호·자리 바꾸기·방어는 항상 쓸 수 있습니다. "새 전투"를 누르면 적용됩니다.</p>` +
      this.party.map((p, i) => {
        const on = saved[i] ?? p.options.slice(0, 4).map(o => o.key);
        return `<fieldset data-i="${i}"><legend>${esc(p.name)}</legend>${p.options.length ? p.options.map(o =>
          `<label><input type="checkbox" value="${esc(o.key)}" ${on.includes(o.key) ? "checked" : ""}> ${esc(o.label)}</label>`).join("") : '<span class="hint">특수 스킬 없음</span>'}</fieldset>`;
      }).join("");
    box.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach(cb => cb.onchange = () => {
      const set = cb.closest("fieldset")!.querySelectorAll<HTMLInputElement>("input:checked");
      if (set.length > 4) cb.checked = false;
    });
    box.hidden = false;
  }

  private readLoadout(): Record<number, string[]> | undefined {
    const box = $("hud-loadout");
    if (!box.innerHTML) return this.setup.loadout;
    const out: Record<number, string[]> = {};
    box.querySelectorAll<HTMLFieldSetElement>("fieldset").forEach(fs => {
      out[Number(fs.dataset.i)] = [...fs.querySelectorAll<HTMLInputElement>("input:checked")].map(x => x.value);
    });
    return out;
  }

  /** A yes/no decision in the action bar (e.g. Shieldsman push after a won exchange). */
  ask(question: string, yes: string, no: string): Promise<boolean> {
    $("hud-actions").innerHTML = `<div class="who">${esc(question)}</div>
      <div class="btns"><button id="hud-yes" class="primary">${esc(yes)}</button><button id="hud-no">${esc(no)}</button></div>`;
    return new Promise(r => { $("hud-yes").onclick = () => r(true); $("hud-no").onclick = () => r(false); });
  }

  forecast(text: string) {
    const el = document.getElementById("hud-forecast");
    if (el) el.textContent = text;
  }

  reset() {
    $("hud-log").innerHTML = "";
    $("hud-result").hidden = true;
    this.idle("전투 준비");
  }

  order(b: any, view: any, currentId: string | undefined, stress: Record<string, { value: number; resolve: string | null }> = {}) {
    $("hud-order").innerHTML = `<h3>행동 순서 · ${b.round}라운드</h3>` + (b.order as string[]).map(id => {
      const a = b.actors.find((x: any) => x.id === id), v = view.actors[id] || a;
      const dead = v.dead || v.banished;
      return `<div class="ord ${a.team} ${id === currentId ? "now" : ""} ${dead ? "dead" : ""}">
        <span>${esc(a.name)}${stress[id]?.resolve === "afflicted" ? ' <b class="aff">고난</b>' : stress[id]?.resolve === "virtuous" ? ' <b class="vir">각성</b>' : ""}</span><meter min="0" max="${v.maxWounds}" value="${v.wounds}"></meter><small>${v.wounds}/${v.maxWounds}</small>
        ${stress[id] ? `<span class="st">스트레스</span><meter class="stress" min="0" max="200" value="${stress[id].value}"></meter><small>${stress[id].value}</small>` : ""}</div>`;
    }).join("");
  }

  log(text: string, kind = "") {
    const el = document.createElement("div");
    el.className = "entry " + kind;
    el.textContent = text;
    const box = $("hud-log");
    box.append(el);
    box.scrollTop = box.scrollHeight;
  }

  logScene(scene: any) {
    if (scene.phase === "impact") {
      const lost = (scene.losses?.length ? scene.losses : scene.damage ? [{ name: scene.targetName, amount: scene.damage }] : []);
      for (const x of lost) this.log(`  → ${x.name} ${x.amount > 0 ? x.amount + " 피해" : -x.amount + " 회복"}`, x.amount > 0 ? "dmg" : "heal");
      return;
    }
    this.log(scene.text || `${scene.name} · ${scene.label}`, scene.phase === "terminal" ? "death" : scene.team);
    for (const d of scene.dice || []) {
      if (!Number.isInteger(d.roll)) continue;
      this.log(`  🎲 ${d.name} ${d.key}: ${d.roll} / ${d.target} → ${d.success ? "성공" : "실패"} (SL ${d.sl >= 0 ? "+" : ""}${d.sl})`, "dice");
    }
  }

  idle(text: string) {
    $("hud-actions").innerHTML = `<p class="hint">${esc(text)}</p>`;
  }

  /** Shows the controlled actor's options; greyed out when the current rank doesn't allow them. */
  controls(actor: any, rank: number, acts: (RankAction & { ok: boolean })[], selected: RankAction | null, error = "", res?: Resources) {
    const ranks = (r: number[]) => r.length ? r.join("·") : "-";
    $("hud-actions").innerHTML = `
      <div class="who"><strong>${esc(actor.name)}</strong>의 차례 · 현재 <b>${rank}열</b></div>
      <div class="btns">${acts.map((c, i) => `<button data-i="${i}" class="${selected && sameAction(c, selected) ? "sel" : ""}" ${c.ok ? "" : "disabled"}
        title="사용 위치 ${ranks(c.from)}열 → 대상 ${ranks(c.to)}열">${esc(c.label)}<small> ${ranks(c.from)}→${ranks(c.to)}</small></button>`).join("")}
        <button id="hud-end" class="quiet">턴 넘기기</button></div>
      ${res ? `<div class="res">행운점 ${res.fortune} · 운명점 ${res.fate}${res.deathsDoor ? ' · <b class="door">죽음의 문턱</b>' : ""}
        ${res.fortune > 0 ? `<label><input type="checkbox" id="hud-fortune" ${res.useFortune ? "checked" : ""}> 행운점으로 이번 판정 유리하게</label>` : ""}
        ${res.fortune > 0 && res.conditions.length ? `<select id="hud-cond">${res.conditions.map(c => `<option value="${esc(c)}">${esc(D.CONDITION_NAMES[c] || c)}</option>`).join("")}</select><button id="hud-cond-btn" class="quiet">행운점: 상태 제거</button>` : ""}
        ${res.fate > 0 && res.deathsDoor ? `<button id="hud-fate" class="quiet">운명점: 살아서 전장 이탈</button>` : ""}</div>` : ""}
      <p id="hud-forecast" class="forecast"></p>
      <p class="hint">행동을 고르고 빨간 테두리의 적(자리 바꾸기·보호는 파란 테두리의 아군)을 누르세요. 적 위에 마우스를 올리면 명중·피해 예측이 나옵니다. 숫자는 "사용 가능한 내 열 → 맞힐 수 있는 적 열"입니다.</p>
      ${error ? `<p class="err">${esc(error)}</p>` : ""}`;
    const fo = document.getElementById("hud-fortune") as HTMLInputElement | null;
    if (fo) fo.onchange = () => this.h.toggleFortune(fo.checked);
    const cb = document.getElementById("hud-cond-btn");
    if (cb) cb.onclick = () => this.h.fortuneCondition((document.getElementById("hud-cond") as HTMLSelectElement).value);
    const fa = document.getElementById("hud-fate");
    if (fa) fa.onclick = () => this.h.fate();
    $("hud-actions").querySelectorAll<HTMLButtonElement>("button[data-i]").forEach(b => {
      b.onclick = () => this.h.choose(acts[Number(b.dataset.i)]);
    });
    $("hud-end").onclick = () => this.h.endTurn();
  }

  result(b: any, view: any, stats: Record<string, { dealt: number; taken: number; actions: number }>) {
    const win = b.winner === "allies";
    const rows = b.actors.map((a: any) => {
      const v = view.actors[a.id] || a, s = stats[a.id] || { dealt: 0, taken: 0, actions: 0 };
      const state = v.dead ? "사망" : v.banished ? "소멸" : v.escaped ? "이탈" : !C.conscious(a) ? `쓰러짐 ${v.wounds}/${v.maxWounds}` : `생존 ${v.wounds}/${v.maxWounds}`;
      return `<tr class="${a.team}"><td>${esc(a.name)}</td><td>${state}</td><td>${s.dealt}</td><td>${s.taken}</td><td>${s.actions}</td></tr>`;
    }).join("");
    $("hud-result").innerHTML = `
      <div class="card"><h2 class="${win ? "win" : "lose"}">${win ? "승리" : b.winner === "enemies" ? "패배" : "전투 종료"}</h2>
      <p>${b.round}라운드</p>
      <table><thead><tr><th>이름</th><th>상태</th><th>준 피해</th><th>받은 피해</th><th>행동</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hint">전체 행동 기록은 오른쪽 로그에 남아 있습니다.</p>
      <button id="hud-again" class="primary">다시 하기</button></div>`;
    $("hud-result").hidden = false;
    $("hud-again").onclick = () => this.h.newBattle({ ...this.setup, seed: Math.floor(Math.random() * 1e9) });
  }
}

export const sameAction = (a: RankAction, b: RankAction) =>
  a.kind === b.kind && a.weaponId === b.weaponId && a.spellId === b.spellId;

export const actionName = (k: string) => D.ACTION_NAMES[k] || k;
