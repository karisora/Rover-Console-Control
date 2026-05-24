import { useEffect, useRef, useState, useCallback } from "react";
import { useSendRoverMove } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Zap, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTelemetry } from "./TelemetryContext";

type SR = any;

const LUMOS_GRAMMAR =
  "#JSGF V1.0; grammar spell; public <spell> = lumos | lumo's ;";
const LUMOS_ROMANIZED_FORMS = [
  "lumos",
  "lumo",
  "lumis",
  "lumi",
  "lumas",
  "luma",
  "lomos",
  "lomo",
  "loomos",
  "loomo",
  "loomoss",
  "lumous",
  "luminous",
  "rumos",
  "rumo",
  "rumis",
  "rumi",
  "rumas",
  "ruma",
];
const FATAL_SPEECH_ERRORS = new Set([
  "audio-capture",
  "language-not-supported",
  "not-allowed",
  "service-not-allowed",
]);
const FIRE_COOLDOWN_MS = 900;
const TRANSCRIPT_MEMORY_MS = 2200;

function getPreferredSpeechLanguage() {
  const language =
    navigator.languages?.find((value) => /^ja\b/i.test(value)) ??
    navigator.language ??
    document.documentElement.lang;
  return /^ja\b/i.test(language) ? "ja-JP" : "en-US";
}

function normalizeSpeechText(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s'"`’.,!?;:()[\]{}<>_-]+/g, "");
}

function isLumosTranscript(text: string) {
  const normalized = normalizeSpeechText(text);
  return LUMOS_ROMANIZED_FORMS.some((form) => normalized.includes(form));
}

function collectTranscripts(event: any) {
  const transcripts: string[] = [];
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    for (let j = 0; j < result.length; j++) {
      const transcript = result[j]?.transcript?.trim();
      if (transcript) {
        transcripts.push(transcript);
      }
    }
  }
  return transcripts;
}

export function VoiceTrigger() {
  const sendMove = useSendRoverMove();
  const { addLog } = useTelemetry();

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [flash, setFlash] = useState(0);
  const recRef = useRef<SR | null>(null);
  const transcriptMemoryRef = useRef<Array<{ text: string; at: number }>>([]);
  const lastFireRef = useRef<number>(0);
  const sendRef = useRef(sendMove.mutate);
  sendRef.current = sendMove.mutate;
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;

  useEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
  }, []);

  const fireSpell = useCallback(() => {
    const now = Date.now();
    if (now - lastFireRef.current < FIRE_COOLDOWN_MS) return;
    lastFireRef.current = now;
    setFlash((n) => n + 1);
    sendRef.current(
      { data: { action: "spell" } },
      {
        onSuccess: () =>
          addLogRef.current(`LUMOS → 0x450,0`, "info"),
        onError: () =>
          addLogRef.current(`LUMOS FAILED → 0x450,0`, "failed"),
      },
    );
  }, []);

  const start = useCallback(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR || recRef.current) return;
    const rec: SR = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 10;
    rec.lang = getPreferredSpeechLanguage();

    const GrammarList = w.SpeechGrammarList || w.webkitSpeechGrammarList;
    if (GrammarList) {
      const grammarList = new GrammarList();
      grammarList.addFromString(LUMOS_GRAMMAR, 1);
      rec.grammars = grammarList;
    }

    rec.onresult = (event: any) => {
      const transcripts = collectTranscripts(event);
      const now = Date.now();
      transcriptMemoryRef.current = [
        ...transcriptMemoryRef.current.filter(
          (entry) => now - entry.at < TRANSCRIPT_MEMORY_MS,
        ),
        ...transcripts.map((text) => ({ text, at: now })),
      ].slice(-24);

      const bufferedTranscript = transcriptMemoryRef.current
        .map((entry) => entry.text)
        .join(" ");
      setTranscript(transcripts[0] ?? bufferedTranscript);
      if ([...transcripts, bufferedTranscript].some(isLumosTranscript)) {
        fireSpell();
      }
    };
    rec.onerror = (event: any) => {
      const error = event?.error;
      if (FATAL_SPEECH_ERRORS.has(error)) {
        recRef.current = null;
        setListening(false);
        setTranscript("");
        addLogRef.current(`VOICE ERROR: ${error}`, "failed");
      }
    };
    rec.onend = () => {
      // Auto-restart while still in listening mode
      if (recRef.current === rec) {
        window.setTimeout(() => {
          if (recRef.current !== rec) return;
          try {
            rec.start();
          } catch {}
        }, 80);
      }
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      // ignore
    }
  }, [fireSpell]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    transcriptMemoryRef.current = [];
    setListening(false);
    setTranscript("");
    if (rec) {
      try {
        rec.onend = null;
        rec.stop();
      } catch {}
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return (
    <div className="bg-card border border-border p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" />
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Voice Spell · "Lumos"
          </span>
        </div>
        {!supported && (
          <span className="flex items-center gap-1 text-[10px] text-destructive font-mono">
            <AlertTriangle className="w-3 h-3" />
            UNSUPPORTED BROWSER
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          disabled={!supported}
          onClick={listening ? stop : start}
          variant={listening ? "default" : "secondary"}
          className={`font-mono text-xs uppercase tracking-widest h-12 px-5 ${
            listening
              ? "bg-accent text-accent-foreground hover:bg-accent/90"
              : ""
          }`}
        >
          {listening ? (
            <>
              <Mic className="w-4 h-4 mr-2" /> LISTENING
            </>
          ) : (
            <>
              <MicOff className="w-4 h-4 mr-2" /> ACTIVATE MIC
            </>
          )}
        </Button>

        <div className="flex-1 min-w-0 border border-border bg-background/60 px-3 py-2 font-mono text-xs h-12 flex items-center">
          {listening ? (
            <span className="truncate text-foreground/80">
              {transcript || (
                <span className="text-muted-foreground italic">
                  say "lumos" to fire 0x450,0...
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground italic">mic disengaged</span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            initial={{ opacity: 0.9, scale: 0.6 }}
            animate={{ opacity: 0, scale: 2.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            onAnimationComplete={() =>
              setFlash((n) => (n === flash ? 0 : n))
            }
            className="pointer-events-none absolute inset-0 bg-accent/40"
            style={{ borderRadius: "inherit" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
