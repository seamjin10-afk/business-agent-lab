import { C, D } from "../rules/engine.js";
import { BattleSetup, ControlMode, DEFAULT_SETUP } from "./setup";

export type Speed = "normal" | "fast" | "instant";
export interface ActionChoice { action: string; label: string; weaponId?: string; spellId?: string }

export interface HudHandlers {
  newBattle(setup: BattleSetup): void;
  speed(s: Speed): void;
  choose(c: ActionChoice): void;
  endTurn(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ENEMY_SETS: Record<string, string[]> = {
  "오크 1 · 고블린 2": ["orc", "goblin", "goblin"],
  "고블린 4": ["goblin", "goblin", "goblin", "goblin"],
  "오크 2": ["orc", "orc"],
  "컬티스트 2 · 카오스 전사": ["cultist", "cultist", "chaos-warrior"],
};
const MODES: [ControlMode, string][] = [
  ["all", "아군 전원 직접 조작"],
  ["single", "1명 직접 조작 · 나머지 자동"],
  ["auto", "전원 자동 (관전)"],
];

/** DOM panels around the board: setup bar, turn order, log, action bar, result. */
export class Hud {
  private setup: BattleSetup = { ...DEFAULT_SETUP };

  constructor(private h: HudHandlers, partyNames: string[]) {
    $("hud-setup").innerHTML = `
      <label>조작 <select id="hud-mode">${MODES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
      <label id="hud-controlled-wrap">직접 조작 <select id="hud-controlled">${partyNames.map((n, i) => `<option value="${i}">${esc(n)}</option>`).join("")}</select></label>
      <label>적 <select id="hud-enemies">${Object.keys(ENEMY_SETS).map(k => `<option>${esc(k)}</option>`).join("")}</select></label>
      <label>연출 <select id="hud-speed"><option value="normal">보통</option><option value="fast">빠름</option><option value="instant">즉시</option></select></label>
      <button id="hud-start" class="primary">새 전투</button>`;
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
      };
      h.newBattle(this.setup);
    };
  }

  get current() { return this.setup; }

  reset() {
    $("hud-log").innerHTML = "";
    $("hud-result").hidden = true;
    this.idle("전투 준비");
  }

  order(b: any, view: any, currentId: string | undefined) {
    $("hud-order").innerHTML = `<h3>행동 순서 · ${b.round}라운드</h3>` + (b.order as string[]).map(id => {
      const a = b.actors.find((x: any) => x.id === id), v = view.actors[id] || a;
      const dead = v.dead || v.banished;
      return `<div class="ord ${a.team} ${id === currentId ? "now" : ""} ${dead ? "dead" : ""}">
        <span>${esc(a.name)}</span><meter min="0" max="${v.maxWounds}" value="${v.wounds}"></meter><small>${v.wounds}/${v.maxWounds}</small></div>`;
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

  /** Shows the controlled actor's options. `selected` is highlighted; board clicks use it. */
  controls(actor: any, choices: ActionChoice[], selected: ActionChoice | null, moveLeft: number, error = "") {
    $("hud-actions").innerHTML = `
      <div class="who"><strong>${esc(actor.name)}</strong>의 차례 · 남은 이동 ${moveLeft}칸${actor.actionUsed ? " · 행동 사용함" : ""}</div>
      <div class="btns">${choices.map((c, i) => `<button data-i="${i}" class="${selected && sameChoice(c, selected) ? "sel" : ""}" ${actor.actionUsed && c.action !== "defend" ? "disabled" : ""}>${esc(c.label)}</button>`).join("")}
        <button id="hud-end" class="quiet">턴 종료</button></div>
      <p class="hint">파란 칸을 누르면 이동하고, 빨간 테두리의 적을 누르면 선택한 행동을 실행합니다. 남은 이동력으로 닿는 적이면 다가가서 실행합니다.</p>
      ${error ? `<p class="err">${esc(error)}</p>` : ""}`;
    $("hud-actions").querySelectorAll<HTMLButtonElement>("button[data-i]").forEach(b => {
      b.onclick = () => this.h.choose(choices[Number(b.dataset.i)]);
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

export const sameChoice = (a: ActionChoice, b: ActionChoice) =>
  a.action === b.action && a.weaponId === b.weaponId && a.spellId === b.spellId;

export const actionName = (k: string) => D.ACTION_NAMES[k] || k;
