// client/src/components/Hero.tsx
import { useState, FormEvent, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { FiCamera, FiUploadCloud } from "react-icons/fi";
import { SiGithub } from "react-icons/si";

const VOICE_LANG_OPTIONS = [
  { code: "auto", label: "Auto (browser default)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-IN", label: "Bengali" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "mr-IN", label: "Marathi" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "or-IN", label: "Odia" },
  { code: "ur-IN", label: "Urdu (India)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "ru-RU", label: "Russian" },
  { code: "zh-CN", label: "Chinese (Mandarin)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "ar-SA", label: "Arabic" },
];

export default function Hero() {
  const { toast } = useToast();
  const [promptText, setPromptText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState<string>("auto");

  const recognitionRef = useRef<any>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // --- autoresize textarea ---
  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 192); // 12rem max
    el.style.height = next + "px";
  };

  useEffect(() => {
    autoGrow();
  }, [promptText]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const prompt = promptText.trim();
    if (!prompt) return;

    try {
      // Remember last prompt for Studio finalize view
      try {
        localStorage.setItem("lastPrompt", prompt);
      } catch {
        // ignore storage issues
      }

      const r = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, promptText: prompt }),
      });

      const ct = r.headers.get("content-type") || "";
      const bodyText = await r.text();
      const data =
        ct.includes("application/json") && bodyText ? JSON.parse(bodyText) : {};

      if (!r.ok) {
        const msg =
          (data as any)?.message ||
          (data as any)?.error ||
          r.statusText ||
          "Request failed";
        const err: any = new Error(msg);
        err.status = r.status;
        err.body = data;
        throw err;
      }

      const id =
        (data as any).jobId ||
        (data as any).id ||
        (data as any)?.job?.id ||
        (data as any)?.data?.jobId ||
        (data as any)?.data?.id;

      if (!id) throw new Error("No jobId in response");

      // ✅ Go to Studio middle step instead of Workspace
      const target = `/studio/${id}`;
      window.location.assign(target);
      setTimeout(() => {
        window.location.href = target;
      }, 50);
    } catch (err: any) {
      if (err?.status === 401) {
        toast({
          title: "Sign in required",
          description: "Please sign in to create a project.",
          variant: "destructive",
        });
        return;
      }
      console.error("[hero] error:", err);
      toast({
        title: "Create failed",
        description: err?.message || "Request failed",
      });
    }
  }

  // ---- upload helper (used by + menu and Attach) ----
  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files as any);
    if (!list.length) return;

    const form = new FormData();
    for (const f of list) form.append("files", f);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("[upload] failed", data);
      toast({
        title: "Upload failed",
        description: data?.message || "Server error",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Uploaded",
      description: `Received ${data?.files?.length || list.length} file(s).`,
    });
  }

  function handleFileChange(e: any) {
    const files = e.target.files as FileList;
    void uploadFiles(files);
    e.target.value = "";
  }

  // ---- voice result → translate → prompt text ----
  async function handleVoiceResult(rawText: string, langCode: string) {
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          sourceLang: "auto",
          targetLang: "en",
        }),
      });

      if (!res.ok) {
        console.error("[translate] HTTP error", res.status);
        throw new Error("Translate API failed");
      }

      const data = await res.json();
      const translatedText: string = data?.translatedText || rawText;

      setPromptText((prev) =>
        prev ? `${prev}\n${translatedText}` : translatedText
      );
    } catch (err) {
      console.error("[translate] error, falling back to raw text:", err);
      setPromptText((prev) => (prev ? `${prev}\n${rawText}` : rawText));
      toast({
        title: "Translate issue",
        description:
          "Translate API failed – using the raw speech text instead.",
      });
    }
  }

  // ----- Voice input -----
  function initRecognition() {
    if (typeof window === "undefined") return null;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      toast({
        title: "Voice input not available",
        description: "Your browser doesn't support speech recognition yet.",
      });
      return null;
    }

    const recognition = new SpeechRecognitionClass();

    let langCode: string;
    if (voiceLang === "auto") {
      if (typeof navigator !== "undefined" && navigator.language) {
        langCode = navigator.language;
      } else {
        langCode = "en-US";
      }
    } else {
      langCode = voiceLang;
    }

    recognition.lang = langCode;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      void handleVoiceResult(text, langCode);
    };

    recognition.onerror = (event: any) => {
      console.error("[voice] error", event);
      toast({
        title: "Voice input error",
        description:
          event?.error ||
          "Something went wrong with voice capture or this language.",
        variant: "destructive",
      });
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return recognition;
  }

  function handleToggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    const recognition = initRecognition();
    if (!recognition) return;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("[voice] start error", err);
      setIsListening(false);
    }
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop?.();
      }
    };
  }, []);

  // ----- Plus menu -----
  function handleMenuAction(
    action: "screenshot" | "figma" | "github" | "upload"
  ) {
    setIsPlusMenuOpen(false);

    switch (action) {
      case "screenshot":
        toast({
          title: "Screenshot capture",
          description: "Wire this into your getDisplayMedia or capture flow.",
        });
        break;
      case "figma":
        toast({
          title: "Import from Figma",
          description: "Open your Figma OAuth or file picker here.",
        });
        break;
      case "github":
        toast({
          title: "Import from GitHub",
          description: "Connect to GitHub and pull a repo or file.",
        });
        break;
      case "upload":
        fileInputRef.current?.click();
        break;
    }
  }

  useEffect(() => {
    if (!isPlusMenuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (!plusMenuRef.current) return;
      if (!plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPlusMenuOpen]);

  return (
    // pull hero further up behind the header
    <section
      className="relative overflow-hidden text-white -mt-20 pt-20"
      style={{
        background: `
          linear-gradient(
            180deg,
            #171717 0%,
            #171717 33%,
            #191919 38%,
            #1A1D22 43%,
            #242F40 48%,
            #283854 53%,
            #4262A3 58%,
            #587CC9 63%,
            #698AD5 68%,
            #8B97DE 73%,
            #C89EE1 78%,
            #D499D9 83%,
            #F27166 88%,
            #F27361 92%,
            #F16E3C 96%,
            #F16D0B 100%
          )
        `,
      }}
    >
      {/* MAIN HERO CONTAINER */}
      <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16 lg:pb-20">
        {/* TOP ROW: billboard text + trust copy */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-end">
          {/* Left: BUILD / SMARTER / LAUNCH / FASTER with mixed fonts */}
          <div>
            <p className="leading-[0.9] tracking-[0.03em] uppercase text-[clamp(3.4rem,7vw,5.8rem)] font-extrabold text-white">
              <span className="block">
                <span className="font-blenny">BUIL</span>
                <span className="font-glodok">D</span>
              </span>
              <span className="block">
                <span className="font-glodok">SMA</span>
                <span className="font-courage">R</span>
                <span className="font-alfarn">TE</span>
                <span className="font-courage">R</span>
              </span>
              <span className="block">
                <span className="font-courage">L</span>
                <span className="font-blenny">A</span>
                <span className="font-alfarn">UN</span>
                <span className="font-courage">C</span>
                <span className="font-glodok">H</span>
              </span>
              <span className="block">
                <span className="font-courage">F</span>
                <span className="font-glodok">A</span>
                <span className="font-alfarn">S</span>
                <span className="font-courage">TER</span>
              </span>
            </p>
          </div>

          {/* Right: trust / marketing copy */}
          <div className="flex items-end lg:items-start">
            <div className="max-w-xs text-right text-[13px] leading-relaxed tracking-tight text-white/85 lg:ml-auto lg:pt-4 lg:text-left">
              <p className="mb-3 font-medium">
                A focused product studio for people who want{" "}
                <span className="font-semibold">real, working apps and sites</span>,
                not just nice-looking mockups.
              </p>
              <p className="text-white/70">
                Ybuilt gives you a single AI-assisted space to go from idea to
                live product — UI, logic, and deployment in one flow — so you
                can launch functional platforms, websites, and tools without
                needing a full engineering team.
              </p>
            </div>
          </div>
        </div>

        {/* PROMPT BAR */}
        <div className="mt-12 flex justify-center">
          <div className="w-full max-w-3xl rounded-[32px] bg-gradient-to-r from-[#6c7dff] via-[#c26bff] to-[#f28ac1] p-[2px] shadow-[0_22px_60px_rgba(15,23,42,0.5)]">
            <form ref={formRef} onSubmit={handleCreate}>
              {/* Shell grows with textarea */}
              <div className="flex flex-col rounded-[24px] bg-[#292929] px-8 py-4 sm:px-10 sm:py-4">
                {/* Textarea row */}
                <div className="flex">
                  <label className="sr-only" htmlFor="hero-idea-input">
                    Describe your website or app idea
                  </label>
                  <textarea
                    id="hero-idea-input"
                    ref={textareaRef}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    onInput={autoGrow}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (promptText.trim()) formRef.current?.requestSubmit();
                      }
                    }}
                    rows={1}
                    placeholder="Ask Ybuilt to create a dashboard, app, or site…"
                    className="hero-textarea w-full resize-none border-none bg-transparent text-sm sm:text-base text-slate-50 placeholder:text-slate-400 outline-none ring-0 focus:outline-none leading-relaxed max-h-48 overflow-y-auto"
                    style={{ lineHeight: "1.6" }}
                  />
                </div>

                {/* Icons row – directly under textarea, no grey line */}
                <div className="mt-3 flex items-center justify-between">
                  {/* Left cluster: + and Attach */}
                  <div className="relative flex items-center gap-2 -ml-3">
                    {/* Plus icon */}
                    <button
                      type="button"
                      onClick={() => setIsPlusMenuOpen((v) => !v)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-transparent text-white/60 hover:bg-white/5 transition-colors"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-5 w-5"
                        fill="none"
                      >
                        <path
                          d="M10 5v10M5 10h10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    {/* Plus dropdown */}
                    {isPlusMenuOpen && (
                      <div
                        ref={plusMenuRef}
                        className="absolute left-0 top-[135%] z-20 w-72 overflow-hidden rounded-2xl border border-white/12 bg-[#101010] py-1 shadow-xl shadow-black/70 backdrop-blur"
                      >
                        {/* Take a screenshot */}
                        <button
                          type="button"
                          onClick={() => handleMenuAction("screenshot")}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5">
                            <FiCamera className="h-4 w-4" />
                          </span>
                          <span>Take a screenshot</span>
                        </button>

                        {/* Import from Figma – colorful inline SVG */}
                        <button
                          type="button"
                          onClick={() => handleMenuAction("figma")}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#111]">
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className="h-4 w-4"
                            >
                              <circle cx="10" cy="6" r="2.2" fill="#F24E1E" />
                              <circle cx="10" cy="12" r="2.2" fill="#A259FF" />
                              <circle cx="10" cy="18" r="2.2" fill="#0ACF83" />
                              <circle cx="16" cy="6" r="2.2" fill="#FF7262" />
                              <circle cx="16" cy="12" r="2.2" fill="#1ABCFE" />
                            </svg>
                          </span>
                          <span>Import from Figma</span>
                        </button>

                        {/* Import from GitHub */}
                        <button
                          type="button"
                          onClick={() => handleMenuAction("github")}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5">
                            <SiGithub className="h-4 w-4" />
                          </span>
                          <span>Import from GitHub</span>
                        </button>

                        {/* Upload design / code file */}
                        <button
                          type="button"
                          onClick={() => handleMenuAction("upload")}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/5"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5">
                            <FiUploadCloud className="h-4 w-4" />
                          </span>
                          <span>Upload design / code file</span>
                        </button>

                        {/* Voice language selector */}
                        <div className="mt-1 border-t border-white/10 px-4 pt-2.5 pb-3 text-[11px] text-white/60">
                          <div className="mb-1.5">
                            <span className="uppercase tracking-[0.12em] text-[10px] text-white/40">
                              Voice input language (speech engine)
                            </span>
                          </div>
                          <select
                            value={voiceLang}
                            onChange={(e) => setVoiceLang(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-white/40"
                          >
                            {VOICE_LANG_OPTIONS.map((lang) => (
                              <option
                                key={lang.code}
                                value={lang.code}
                                className="bg-[#101010] text-white"
                              >
                                {lang.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* hidden file input for upload (used by + menu + Attach) */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.zip,.json,.txt,.md,.html,.css,.js,.ts,.tsx,.fig,.sketch,.psd,.ai,.mp4,.mov,.webm"
                      onChange={handleFileChange}
                    />

                    {/* Attach pill */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-transparent px-4 py-1.5 text-sm font-medium text-white/60 hover:bg-white/5 transition-colors"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                      >
                        <path
                          d="M13.5 5.5 8 11a2 2 0 1 1-2.83-2.83l5.5-5.5a2.83 2.83 0 0 1 4 4l-6 6a3.33 3.33 0 1 1-4.71-4.71l4.33-4.34"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>Attach</span>
                    </button>
                  </div>

                  {/* Right cluster: Mic + Send */}
                  <div className="flex items-center gap-2.5 -mr-3">
                    {/* Mic button */}
                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                        isListening
                          ? "border-red-400 bg-red-400/20 text-red-400"
                          : "border-white/20 bg-transparent text-white/60 hover:bg-white/5"
                      }`}
                    >
                      <span className="sr-only">Record voice prompt</span>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-[18px] w-[18px]"
                        fill="none"
                      >
                        <g
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        >
                          <path d="M6 10v4M10 8v8M14 9v6M18 11v2" />
                        </g>
                      </svg>
                    </button>

                    {/* Send button */}
                    <button
                      type="submit"
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        promptText.trim()
                          ? "bg-white text-slate-900 shadow-sm hover:bg-slate-100"
                          : "bg-white/40 text-slate-600 cursor-not-allowed"
                      }`}
                      disabled={!promptText.trim()}
                    >
                      <span className="sr-only">Send</span>
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="currentColor"
                      >
                        <path d="M10 3.5a.75.75 0 0 1 .53.22l4.5 4.5a.75.75 0 0 1-1.06 1.06L10.75 6.06V15.5a.75.75 0 0 1-1.5 0V6.06L6.03 9.28a.75.75 0 1 1-1.06-1.06l4.5-4.5A.75.75 0 0 1 10 3.5Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* STRIPES */}
        <div className="mt-12 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="relative left-1/2 w-screen -translate-x-1/2 border-t border-white/60 pt-6">
            <div className="space-y-3">
              <div className="h-[2px] bg-white" />
              <div className="h-[4px] bg-white" />
              <div className="h-[6px] bg-white" />
              <div className="h-[18px] bg-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
