import { vi } from "vitest";

vi.mock("../server/llm/registry.ts", () => ({
  chatJSON: vi.fn(async ({ user }) => {
    const issues = user.includes("alt") ? [] : [{
      type: "seo",
      msg: "Add meta description",
      fix: "Insert proper meta tag",
      ops: [{ file: "index.html", find: "$$EOF$$", replace: "\n<meta name=\"description\" content=\"...\">", isRegex: false }]
    }];
    return { json: { issues } };
  })
}));

vi.mock("../server/middleware/contracts.ts", async () => {
  const real = await vi.importActual<any>("../server/middleware/contracts.ts").catch(()=>({}));
  const contractsHardStop = () => (req: any,_res:any,next:any)=>{
    req.__prepared = {
      before: { sections:["hero-basic"], copy:{HEADLINE:"A"}, brand:{} },
      patch:  { copy:{ HEADLINE:"B" } },
      copy:   { HEADLINE:"B" },
    };
    next();
  };
  return { ...real, contractsHardStop };
});
