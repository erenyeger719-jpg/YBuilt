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

  // Indian languages
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

  // Common global languages
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const prompt = promptText.trim();
    if (!prompt) return;

    try {
      console.log("[hero] starting fetch → /api/generate", { prompt });

      const r = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, promptText: prompt }),
      });

      const ct = r.headers.get("content-type") || "";
      const bodyText = await r.text();
      const data =
        ct.includes("application/json") && bodyText
          ? JSON.parse(bodyText)
          : {};

      console.log("[hero] status:", r.status, "data:", data);

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

      const target = `/workspace/${id}`;
      console.log("[hero] redirect →", target);
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

  // ---- voice result → translate → prompt text ----
  async function handleVoiceResult(rawText: string, langCode: string) {
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          // let backend auto-detect, unless you want to force:
          sourceLang: "auto",
          // everything into English for now
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
        prev ? `${prev} ${translatedText}` : translatedText
      );
    } catch (err) {
      console.error("[translate] error, falling back to raw text:", err);
      setPromptText((prev) => (prev ? `${prev} ${rawText}` : rawText));
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
        description: "Your browser doesn’t support speech recognition yet.",
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

  function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("[upload] design/code file selected:", file);
    toast({
      title: "File selected",
      description: `Ready to process: ${file.name}`,
    });
    // TODO: actually send the file to your backend
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
              {/* BUILD */}
              <span className="block">
                <span className="font-blenny">BUIL</span>
                <span className="font-glodok">D</span>
              </span>

              {/* SMARTER */}
              <span className="block">
                <span className="font-glodok">SMA</span>
                <span className="font-courage">R</span>
                <span className="font-alfarn">TE</span>
                <span className="font-courage">R</span>
              </span>

              {/* LAUNCH */}
              <span className="block">
                <span className="font-courage">L</span>
                <span className="font-blenny">A</span>
                <span className="font-alfarn">UN</span>
                <span className="font-courage">C</span>
                <span className="font-glodok">H</span>
              </span>

              {/* FASTER */}
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
            <form onSubmit={handleCreate}>
              {/* Same height as before */}
              <div className="flex h-[96px] flex-col justify-between rounded-[24px] bg-[#292929] px-8 py-4 sm:px-10 sm:py-4">
                {/* Input row (top) */}
                <div className="flex items-center">
                  <label className="sr-only" htmlFor="hero-idea-input">
                    Describe your website or app idea
                  </label>
                  <input
                    id="hero-idea-input"
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Ask Ybuilt to create a dashboard, app, or site…"
                    className="w-full border-none bg-transparent text-sm sm:text-base text-slate-50 placeholder:text-slate-400 outline-none ring-0 focus:outline-none"
                  />
                </div>

                {/* Icons row (bottom) – all 4 aligned horizontally */}
                <div className="flex items-end justify-between pb-1">
                  {/* Left cluster: + and Attach */}
                  <div className="relative flex items-center gap-1 -ml-5">
                    {/* Plus icon – small circle, centered */}
                    <button
                      type="button"
                      onClick={() => setIsPlusMenuOpen((v) => !v)}
                      className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/22 bg-transparent text-2xl font-light leading-[0] text-white/85"
                    >
                      +
                    </button>

                    {/* Plus dropdown – opens downward */}
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

                    {/* hidden file input for upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {/* Attach pill */}
                    <button
                      type="button"
                      className="hidden mt-0.5 items-center gap-2 rounded-full border border-white/22 bg-transparent px-4 py-1.5 text-xs font-medium text-white/80 sm:inline-flex"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                      >
                        <path
                          d="M16.5 6.75 10 13.25a2.5 2.5 0 1 1-3.54-3.54l6.5-6.5a3.5 3.5 0 0 1 4.95 4.95l-7.07 7.07a4 4 0 1 1-5.66-5.66l5.13-5.13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>Attach</span>
                    </button>
                  </div>

                  {/* Right cluster: Mic + Send */}
                  <div className="flex items-center gap-3 -mr-5">
                    {/* Mic button – hooked to voice input */}
                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className={`hidden h-9 w-9 items-center justify-center rounded-full border ${
                        isListening ? "border-white bg-white/10" : "border-white/22"
                      } bg-transparent text-white/80 sm:flex`}
                    >
                      <span className="sr-only">Record voice prompt</span>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                      >
                        <g
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        >
                          <line x1="6.5" y1="10" x2="6.5" y2="14" />
                          <line x1="10" y1="8" x2="10" y2="16" />
                          <line x1="13.5" y1="9" x2="13.5" y2="15" />
                          <line x1="17" y1="11" x2="17" y2="13" />
                        </g>
                      </svg>
                    </button>

                    {/* Send button */}
                    <button
                      type="submit"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition hover:bg-slate-100"
                    >
                      <span className="sr-only">Send</span>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                      >
                        <path
                          d="M12 4.5a1 1 0 0 1 .7.29l5 5a1 1 0 0 1-1.4 1.42L13 7.9V18a1 1 0 1 1-2 0V7.9l-3.3 3.31a1 1 0 0 1-1.4-1.42l5-5A1 1 0 0 1 12 4.5Z"
                          fill="currentColor"
                        />
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
