import { StoryRunner } from "./story/story";

const el = () => document.getElementById("dialogue")!;

/** DOM dialogue box driven by an Ink knot. Resolves when the conversation ends. */
export async function runDialogue(runner: StoryRunner, knot: string, speaker: string): Promise<void> {
  const box = el();
  const rolls: string[] = [];
  runner.onRoll = r => rolls.push(
    `🎲 ${r.stat.toUpperCase()} 판정: d20(${r.roll}) + 보정 = ${r.total} / DC ${r.dc} → ${r.ok ? "성공" : "실패"}`);
  runner.start(knot);
  box.style.display = "block";
  try {
    for (;;) {
      const { lines, choices, done } = runner.advance();
      const picked = await render(box, speaker, [...rolls.splice(0), ...lines], choices);
      if (done) break;
      runner.choose(picked);
    }
  } finally {
    box.style.display = "none";
    runner.save();
  }
}

function render(box: HTMLElement, speaker: string, lines: string[], choices: string[]): Promise<number> {
  return new Promise(resolve => {
    box.innerHTML = "";
    const sp = document.createElement("div");
    sp.className = "speaker";
    sp.textContent = speaker;
    box.append(sp);
    for (const l of lines) {
      const p = document.createElement("div");
      p.className = l.startsWith("🎲") ? "log" : "";
      p.textContent = l;
      box.append(p);
    }
    const finish = (i: number) => { window.removeEventListener("keydown", onKey); resolve(i); };
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (choices.length && n >= 1 && n <= choices.length) finish(n - 1);
      else if (!choices.length && (e.key === " " || e.key === "Enter" || e.key === "e")) finish(0);
    };
    if (choices.length) {
      choices.forEach((c, i) => {
        const b = document.createElement("button");
        b.textContent = `${i + 1}. ${c}`;
        b.onclick = () => finish(i);
        box.append(b);
      });
    } else {
      const b = document.createElement("button");
      b.textContent = "▶ 계속 (Space)";
      b.onclick = () => finish(0);
      box.append(b);
    }
    window.addEventListener("keydown", onKey);
  });
}
