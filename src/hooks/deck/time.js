// FILE: src/hooks/deck/time.js
export function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export class Stopwatch {
  constructor(label, enable = true) { this.label = label; this.t0 = Date.now(); this.closed = false; this.enable = enable; this.mark("t0 boot"); }
  mark(name, extra = {}) {
    if (!this.enable) return;
    const t = Date.now() - this.t0;
    console.log(`⏱️ [${this.label}] ${name}: +${t}ms`, Object.keys(extra).length ? extra : "");
  }
  end(name = "done", extra = {}) { if (!this.closed) { this.mark(name, extra); this.closed = true; } }
}
