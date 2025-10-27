// server/design/search.ts
import crypto from "crypto";
import { tokenMixer, TokenInput, DesignTokens } from "./tokens.ts";
import { evaluateDesign } from "./score.ts";

function sha1(s:string){ return crypto.createHash("sha1").update(String(s)).digest("hex"); }
function clamp01(x:number){ return Math.max(0, Math.min(1, x)); }

// lighten/darken the primary by nudging HSL L channel
function tweakPrimary(hex:string, delta:number) {
  const h = hex.replace("#",""); const n = parseInt(h.length===3? h.split("").map(x=>x+x).join(""):h,16);
  const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const rr=r/255, gg=g/255, bb=b/255;
  const max=Math.max(rr,gg,bb), min=Math.min(rr,gg,bb);
  let hdeg=0,s=0,l=(max+min)/2;
  if (max!==min){
    const d=max-min; s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){ case rr: hdeg=(gg-bb)/d+(gg<bb?6:0);break; case gg: hdeg=(bb-rr)/d+2;break; default: hdeg=(rr-gg)/d+4; }
    hdeg/=6;
  }
  l = clamp01(l + delta);
  // HSL->RGB
  const hue2rgb=(p:number,q:number,t:number)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
  let r2:number,g2:number,b2:number;
  if (s===0){ r2=g2=b2=l; } else {
    const q=l<0.5? l*(1+s): l+s-l*s; const p=2*l-q;
    r2=hue2rgb(p,q,hdeg+1/3); g2=hue2rgb(p,q,hdeg); b2=hue2rgb(p,q,hdeg-1/3);
  }
  const toHex=(v:number)=>Math.round(v*255).toString(16).padStart(2,"0");
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

export function searchBestTokens(base: TokenInput, k:number = 1): { best: DesignTokens; score: number } {
  const primary = base.primary || "#6d28d9";
  const tones: TokenInput["tone"][] = [base.tone || "serious", "minimal", "playful", "serious"];
  const deltas = [0, -0.06, 0.06, -0.1, 0.1];

  let best: DesignTokens | null = null;
  let bestScore = -1;

  // deterministic iteration
  for (const t of tones) {
    for (const d of deltas) {
      const p2 = d===0 ? primary : tweakPrimary(primary, d);
      const tok = tokenMixer({ primary: p2, dark: base.dark, tone: t });
      const ev = evaluateDesign(tok);
      if (ev.a11yPass && ev.visualScore > bestScore) {
        best = tok; bestScore = ev.visualScore;
      }
    }
  }
  // fallback (should never hit)
  if (!best) best = tokenMixer(base);
  return { best, score: bestScore };
}
