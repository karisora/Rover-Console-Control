import { FormEvent, useMemo, useRef, useState } from "react";
import { Bot, KeyRound, Loader2, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoverParams } from "./RoverParamsContext";
import type { MissionConfig } from "./missionTypes";
import {
  getStoredDesignAiApiKey,
  requestDesignChat,
  setStoredDesignAiApiKey,
  type DesignChatMessage,
} from "./designAiClient";

export function DesignChatPanel({ config }: { config: MissionConfig }) {
  const { params } = useRoverParams();
  const [messages, setMessages] = useState<DesignChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [apiKey, setApiKey] = useState(() => getStoredDesignAiApiKey());
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending, [draft, sending]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const nextMessages: DesignChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    try {
      const result = await requestDesignChat({
        config,
        params,
        messages: nextMessages,
      });
      setMessages([...nextMessages, { role: "assistant", content: result.message }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed";
      setMessages([...nextMessages, { role: "assistant", content: `AI connection error: ${message}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary">Rover Design Chat</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">AI design consultation</p>
        </div>
        <Bot className="w-4 h-4 text-primary" />
      </div>

      <div className="px-4 py-3 border-b border-border grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 items-center">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          <KeyRound className="w-3.5 h-3.5 text-primary" />
          Azure Key
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            setStoredDesignAiApiKey(event.target.value);
          }}
          placeholder="sk-..."
          spellCheck={false}
          className="h-9 min-w-0 rounded border border-border bg-muted/20 px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <span className={`font-mono text-[9px] tracking-[0.2em] uppercase ${apiKey ? "text-primary" : "text-muted-foreground"}`}>
          {apiKey ? "KEY SET" : "NO KEY"}
        </span>
      </div>

      <div className="min-h-[220px] max-h-[360px] overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="h-[168px] border border-dashed border-border rounded flex items-center justify-center">
            <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">SESSION READY</span>
          </div>
        ) : (
          messages.map((message, index) => {
            const isUser = message.role === "user";
            const Icon = isUser ? User : Bot;
            return (
              <div
                key={`${message.role}-${index}`}
                className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <span className="w-7 h-7 rounded border border-primary/40 bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                )}
                <div
                  className={[
                    "max-w-[86%] rounded border px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                    isUser
                      ? "bg-primary/15 border-primary/40 text-foreground"
                      : "bg-muted/30 border-border text-muted-foreground",
                  ].join(" ")}
                >
                  {message.content}
                </div>
                {isUser && (
                  <span className="w-7 h-7 rounded border border-border bg-muted/30 text-muted-foreground flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            );
          })
        )}
        {sending && (
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            THINKING
          </div>
        )}
      </div>

      <form ref={formRef} onSubmit={submit} className="border-t border-border p-3 grid grid-cols-[1fr_auto] gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              void submit();
            }
          }}
          rows={2}
          placeholder="Example: I want a configuration that is less likely to get stuck in loose regolith"
          className="min-h-11 max-h-28 resize-y rounded border border-border bg-muted/20 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <Button type="submit" disabled={!canSend} className="h-11 w-11 p-0" aria-label="Send design chat">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
