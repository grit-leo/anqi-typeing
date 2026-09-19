import { fingerFor, keyLabel } from "./island-engine";
const rows = ["1234567890", "qwertyuiop", "asdfghjkl;'", "zxcvbnm,./"];
export function IslandKeyboard({ target, guide = true }: { target: string; guide?: boolean }) {
  const finger = fingerFor(target);
  const shift = /[A-Z!?]/.test(target);
  const physical = target === "!" ? "1" : target === "?" ? "/" : target.toLowerCase();
  return <section className="island-keyboard" aria-label={`指法提示：${finger.name}按${keyLabel(target)}${shift ? `，${finger.hand === "left" ? "右" : "左"}手小指按住 Shift` : ""}`}>
    <div className="finger-instruction"><span className="finger-dot" style={{ background: finger.color }}/><strong>{finger.name}</strong><span>{shift ? `另一只手按住 Shift，再按 ${keyLabel(physical)}` : target === " " ? "轻按空格，其他手指留在原位" : `按 ${keyLabel(target)}，然后回到 ${finger.home}`}</span></div>
    {guide && <div className="key-layout" aria-hidden="true">{rows.map((row, r) => <div className={`key-row key-row-${r}`} key={row}>{[...row].map(key => <span key={key} className={`keycap ${key === physical ? "key-active" : ""} ${"fj".includes(key) ? "home-key" : ""}`} style={{ "--key-color": fingerFor(key).color } as React.CSSProperties}>{key.toUpperCase()}</span>)}</div>)}<div className="key-row"><span className={`keycap shift-cap ${shift && finger.hand === "right" ? "key-active" : ""}`} style={{ "--key-color": "#b899ad" } as React.CSSProperties}>Shift</span><span className={`keycap space-cap ${target === " " ? "key-active" : ""}`} style={{ "--key-color": "#b8aa8a" } as React.CSSProperties}>空格</span><span className={`keycap shift-cap ${shift && finger.hand === "left" ? "key-active" : ""}`} style={{ "--key-color": "#b899ad" } as React.CSSProperties}>Shift</span></div></div>}
    <div className="keyboard-note">食指轻触 F / J 的小凸点 · 手腕放松 · 先打准，再打快</div>
  </section>;
}
