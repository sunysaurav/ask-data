import {
    useState,
    useRef,
    useEffect,
    useCallback,
    useMemo,
    type FC,
    type CSSProperties,
    type KeyboardEvent,
    type ChangeEvent
} from "react";
import type { VisualFormattingSettingsModel } from "./settings";
import {
    sendMessage,
    estimateTokens,
    getDefaultModel,
    type ChatMessage,
    type AIConfig,
    type StreamCallbacks
} from "./aiService";
import { tryRenderChart } from "./chartRenderer";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatAppProps {
    settings: VisualFormattingSettingsModel | null;
    dataContext: string[] | null;
    viewport: { width: number; height: number };
}

interface UIMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
    error?: boolean;
    tokenEstimate?: number;
}

interface ThemeColors {
    bg: string;
    surfacePrimary: string;
    surfaceSecondary: string;
    userBubble: string;
    userBubbleText: string;
    aiBubble: string;
    aiBubbleText: string;
    aiBubbleBorder: string;
    text: string;
    textSecondary: string;
    border: string;
    inputBg: string;
    inputBorder: string;
    inputBorderFocus: string;
    inputText: string;
    headerBg: string;
    headerText: string;
    codeBg: string;
    codeText: string;
    errorBg: string;
    errorText: string;
    hoverBg: string;
    accentColor: string;
}

// ─── Theme Definitions ──────────────────────────────────────────────────────

function buildTheme(mode: string, accentColor: string): ThemeColors {
    if (mode === "dark") {
        return {
            bg: "#0f172a",
            surfacePrimary: "#1e293b",
            surfaceSecondary: "#334155",
            userBubble: accentColor,
            userBubbleText: "#ffffff",
            aiBubble: "#1e293b",
            aiBubbleText: "#e2e8f0",
            aiBubbleBorder: "#334155",
            text: "#f1f5f9",
            textSecondary: "#94a3b8",
            border: "#334155",
            inputBg: "#1e293b",
            inputBorder: "#475569",
            inputBorderFocus: accentColor,
            inputText: "#f1f5f9",
            headerBg: "#1e293b",
            headerText: "#f1f5f9",
            codeBg: "#0f172a",
            codeText: "#e2e8f0",
            errorBg: "rgba(127, 29, 29, 0.15)",
            errorText: "#f87171",
            hoverBg: "#334155",
            accentColor
        };
    }
    return {
        bg: "#f8fafc",
        surfacePrimary: "#ffffff",
        surfaceSecondary: "#f1f5f9",
        userBubble: accentColor,
        userBubbleText: "#ffffff",
        aiBubble: "#ffffff",
        aiBubbleText: "#1e293b",
        aiBubbleBorder: "#e2e8f0",
        text: "#0f172a",
        textSecondary: "#64748b",
        border: "#e2e8f0",
        inputBg: "#ffffff",
        inputBorder: "#cbd5e1",
        inputBorderFocus: accentColor,
        inputText: "#0f172a",
        headerBg: "#ffffff",
        headerText: "#0f172a",
        codeBg: "#f1f5f9",
        codeText: "#1e293b",
        errorBg: "#fef2f2",
        errorText: "#dc2626",
        hoverBg: "#f1f5f9",
        accentColor
    };
}

// ─── Markdown Renderer ──────────────────────────────────────────────────────

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, '<code class="ad-inline-code">$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
    html = html.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    html = html.replace(/\n/g, "<br>");
    return html;
}

function renderTable(text: string): string {
    const rows = text.split("\n").filter(r => r.trim());
    if (rows.length < 2) return `<p>${inlineFormat(text)}</p>`;

    const parseRow = (row: string): string[] =>
        row.split("|").filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());

    const headers = parseRow(rows[0]);
    let html = '<table class="ad-table"><thead><tr>';
    for (const h of headers) html += `<th>${inlineFormat(h)}</th>`;
    html += "</tr></thead><tbody>";

    for (let i = 2; i < rows.length; i++) {
        const cells = parseRow(rows[i]);
        html += "<tr>";
        for (const c of cells) html += `<td>${inlineFormat(c)}</td>`;
        html += "</tr>";
    }
    html += "</tbody></table>";
    return html;
}

function renderMarkdown(text: string): string {
    if (!text) return "";

    const blocks: string[] = [];
    let current = "";
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeContent = "";

    for (const line of text.split("\n")) {
        if (line.trimStart().startsWith("```")) {
            if (inCodeBlock) {
                const lang = codeLanguage.toLowerCase();
                if (lang === "chart" || lang === "chart-json") {
                    const chartSvg = tryRenderChart(codeContent.trim());
                    blocks.push(
                        chartSvg
                            ? `<div class="ad-chart-container">${chartSvg}</div>`
                            : `<pre class="ad-code-block"><code class="lang-json">${escapeHtml(codeContent.trimEnd())}</code></pre>`
                    );
                } else {
                    blocks.push(
                        `<pre class="ad-code-block"><code class="lang-${escapeHtml(codeLanguage)}">${escapeHtml(codeContent.trimEnd())}</code></pre>`
                    );
                }
                inCodeBlock = false;
                codeContent = "";
                codeLanguage = "";
            } else {
                if (current.trim()) {
                    blocks.push(processBlock(current));
                    current = "";
                }
                inCodeBlock = true;
                codeLanguage = line.trim().slice(3).trim();
            }
        } else if (inCodeBlock) {
            codeContent += line + "\n";
        } else {
            current += line + "\n";
        }
    }

    if (inCodeBlock) {
        blocks.push(
            `<pre class="ad-code-block"><code class="lang-${escapeHtml(codeLanguage)}">${escapeHtml(codeContent.trimEnd())}</code></pre>`
        );
    }
    if (current.trim()) {
        blocks.push(processBlock(current));
    }

    return blocks.join("");
}

function processBlock(text: string): string {
    let html = "";
    const paragraphs = text.split(/\n\n+/);

    for (const paragraph of paragraphs) {
        const trimmed = paragraph.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("#### ")) {
            html += `<h5>${inlineFormat(trimmed.slice(5))}</h5>`;
        } else if (trimmed.startsWith("### ")) {
            html += `<h4>${inlineFormat(trimmed.slice(4))}</h4>`;
        } else if (trimmed.startsWith("## ")) {
            html += `<h3>${inlineFormat(trimmed.slice(3))}</h3>`;
        } else if (trimmed.startsWith("# ")) {
            html += `<h2>${inlineFormat(trimmed.slice(2))}</h2>`;
        } else if (/^[\s]*[-*+] /.test(trimmed) || /^[\s]*\d+\.\s/.test(trimmed)) {
            const lines = trimmed.split("\n");
            const isOrdered = /^\s*\d+\./.test(lines[0]);
            const tag = isOrdered ? "ol" : "ul";
            html += `<${tag}>`;
            for (const line of lines) {
                const content = line.replace(/^[\s]*[-*+]\s+|^[\s]*\d+\.\s+/, "");
                if (content.trim()) html += `<li>${inlineFormat(content)}</li>`;
            }
            html += `</${tag}>`;
        } else if (trimmed.startsWith("> ")) {
            html += `<blockquote>${inlineFormat(trimmed.replace(/^>\s?/gm, ""))}</blockquote>`;
        } else if (trimmed.includes("|") && trimmed.split("\n").length > 1 && trimmed.split("\n").some(r => /^\s*\|?\s*[-:]+/.test(r))) {
            html += renderTable(trimmed);
        } else {
            html += `<p>${inlineFormat(trimmed)}</p>`;
        }
    }

    return html;
}

// ─── SVG Icons ──────────────────────────────────────────────────────────────

const SendIcon: FC<{ color: string }> = ({ color }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const ClearIcon: FC<{ color: string }> = ({ color }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const CopyIcon: FC<{ color: string; size?: number }> = ({ color, size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const BotIcon: FC<{ color: string }> = ({ color }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
);

const DataIcon: FC<{ color: string }> = ({ color }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
);

// ─── Sub-components ─────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
    openai: "OpenAI",
    gemini: "Gemini",
    claude: "Claude",
    openrouter: "OpenRouter"
};

interface WelcomeScreenProps {
    theme: ThemeColors;
    fontSize: number;
}

const WelcomeScreen: FC<WelcomeScreenProps> = ({ theme, fontSize }) => {
    const containerStyle: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "32px 24px",
        textAlign: "center",
        color: theme.text
    };

    const iconContainerStyle: CSSProperties = {
        width: 64,
        height: 64,
        borderRadius: 16,
        background: `${theme.accentColor}15`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20
    };

    return (
        <div style={containerStyle}>
            <div style={iconContainerStyle}>
                <BotIcon color={theme.accentColor} />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: fontSize + 6, fontWeight: 600, color: theme.text }}>
                Welcome to AskData
            </h2>
            <p style={{ margin: "0 0 24px", fontSize, color: theme.textSecondary, lineHeight: 1.5, maxWidth: 360 }}>
                Chat with AI about your Power BI data. Configure your API key in the visual&apos;s format pane to get started.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
                {["openai", "gemini", "claude", "openrouter"].map(p => (
                    <div
                        key={p}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 16px",
                            borderRadius: 10,
                            background: theme.surfacePrimary,
                            border: `1px solid ${theme.border}`,
                            fontSize: fontSize - 1,
                            color: theme.textSecondary
                        }}
                    >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.border }} />
                        {PROVIDER_LABELS[p]}
                    </div>
                ))}
            </div>
            <p style={{ margin: "24px 0 0", fontSize: fontSize - 2, color: theme.textSecondary, opacity: 0.7 }}>
                Format pane &rarr; AI Configuration &rarr; Enter API Key
            </p>
        </div>
    );
};

interface MessageBubbleProps {
    message: UIMessage;
    theme: ThemeColors;
    fontSize: number;
    showTimestamp: boolean;
    showTokens: boolean;
    onCopy: (text: string) => void;
}

const MessageBubble: FC<MessageBubbleProps> = ({ message, theme, fontSize, showTimestamp, showTokens, onCopy }) => {
    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        onCopy(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [message.content, onCopy]);

    const wrapperStyle: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
        animation: "ad-fadeIn 0.3s ease-out"
    };

    const bubbleStyle: CSSProperties = {
        maxWidth: "85%",
        padding: isUser ? "10px 16px" : "14px 18px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? theme.userBubble : theme.aiBubble,
        color: isUser ? theme.userBubbleText : theme.aiBubbleText,
        border: isUser ? "none" : `1px solid ${theme.aiBubbleBorder}`,
        fontSize,
        lineHeight: 1.6,
        wordBreak: "break-word" as const,
        position: "relative" as const,
        boxShadow: isUser ? "none" : "0 1px 2px rgba(0,0,0,0.04)"
    };

    const metaStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 4,
        fontSize: fontSize - 3,
        color: theme.textSecondary,
        opacity: 0.7
    };

    const copyBtnStyle: CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "none",
        border: "none",
        padding: "2px 6px",
        borderRadius: 4,
        cursor: "pointer",
        color: theme.textSecondary,
        fontSize: fontSize - 3,
        opacity: 0.6,
        transition: "opacity 0.15s"
    };

    const formatTime = (d: Date) =>
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <div style={wrapperStyle}>
            {!isUser && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, marginLeft: 2 }}>
                    <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: `${theme.accentColor}20`,
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <BotIcon color={theme.accentColor} />
                    </div>
                    <span style={{ fontSize: fontSize - 2, fontWeight: 600, color: theme.textSecondary }}>AskData</span>
                </div>
            )}
            <div style={bubbleStyle}>
                {isUser ? (
                    <span>{message.content}</span>
                ) : message.error ? (
                    <span style={{ color: theme.errorText }}>{message.content}</span>
                ) : (
                    <div
                        className="ad-markdown-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                        style={{
                            ["--ad-code-bg" as string]: theme.codeBg,
                            ["--ad-code-text" as string]: theme.codeText,
                            ["--ad-border" as string]: theme.border,
                            ["--ad-accent" as string]: theme.accentColor,
                            ["--ad-text-secondary" as string]: theme.textSecondary
                        }}
                    />
                )}
                {message.isStreaming && (
                    <span className="ad-cursor-blink" style={{ display: "inline-block", width: 2, height: "1em", background: theme.accentColor, marginLeft: 2, verticalAlign: "text-bottom" }} />
                )}
            </div>
            <div style={metaStyle}>
                {showTimestamp && <span>{formatTime(message.timestamp)}</span>}
                {showTokens && !isUser && message.content && !message.isStreaming && (
                    <span>~{estimateTokens(message.content)} tokens</span>
                )}
                {!isUser && message.content && !message.isStreaming && (
                    <button
                        style={copyBtnStyle}
                        onClick={handleCopy}
                        onMouseEnter={e => { (e.target as HTMLElement).style.opacity = "1"; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.opacity = "0.6"; }}
                        title="Copy response"
                    >
                        <CopyIcon color={theme.textSecondary} />
                        {copied ? "Copied!" : "Copy"}
                    </button>
                )}
            </div>
        </div>
    );
};

const TypingIndicator: FC<{ theme: ThemeColors; fontSize: number }> = ({ theme, fontSize }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 16 }}>
        <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: `${theme.accentColor}20`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
            <BotIcon color={theme.accentColor} />
        </div>
        <div style={{
            padding: "12px 18px",
            borderRadius: "18px 18px 18px 4px",
            background: theme.aiBubble,
            border: `1px solid ${theme.aiBubbleBorder}`,
            display: "flex",
            alignItems: "center",
            gap: 4
        }}>
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className="ad-typing-dot"
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: theme.textSecondary,
                        animationDelay: `${i * 0.2}s`
                    }}
                />
            ))}
        </div>
    </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

const ChatApp: FC<ChatAppProps> = ({ settings, dataContext, viewport }) => {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // ─── Extract settings ────────────────────────────────────────
    const provider = (settings?.aiConfigCard?.provider?.value?.value as string) || "openai";
    const apiKey = settings?.aiConfigCard?.apiKey?.value || "";
    const model = settings?.aiConfigCard?.modelName?.value || "";
    const endpoint = settings?.aiConfigCard?.apiEndpoint?.value || "";
    const systemPrompt = settings?.chatBehaviorCard?.systemPrompt?.value || "";
    const temperature = settings?.chatBehaviorCard?.temperature?.value ?? 0.7;
    const maxTokens = settings?.chatBehaviorCard?.maxTokens?.value ?? 2048;
    const includeData = settings?.chatBehaviorCard?.includeDataContext?.value !== false;
    const stream = settings?.chatBehaviorCard?.streamResponse?.value !== false;
    const themeMode = (settings?.appearanceCard?.theme?.value?.value as string) || "light";
    const fontSize = settings?.appearanceCard?.fontSize?.value || 13;
    const accentColor = settings?.appearanceCard?.accentColor?.value?.value || "#2563eb";
    const showTimestamps = settings?.appearanceCard?.showTimestamps?.value || false;
    const showTokens = settings?.appearanceCard?.showTokenCount?.value || false;

    const isConfigured = !!apiKey;
    const theme = useMemo(() => buildTheme(themeMode, accentColor), [themeMode, accentColor]);

    const dataContextStr = useMemo(() => {
        if (!dataContext?.length || !includeData) return "";
        const header = dataContext[0];
        const rows = dataContext.slice(1);
        const columns = header.split(" | ");
        const separator = columns.map(() => "---").join(" | ");
        const tableRows = rows.map(r => `| ${r} |`).join("\n");
        return `[Data Context - ${columns.length} columns, ${rows.length} rows]\n| ${header} |\n| ${separator} |\n${tableRows}`;
    }, [dataContext, includeData]);

    // ─── Scroll management ───────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (!isLoading) inputRef.current?.focus();
    }, [isLoading]);

    // ─── Copy handler ────────────────────────────────────────────
    const handleCopy = useCallback((text: string) => {
        navigator.clipboard?.writeText(text).catch(() => {});
    }, []);

    // ─── Clear chat ──────────────────────────────────────────────
    const handleClear = useCallback(() => {
        if (isLoading && abortRef.current) {
            abortRef.current.abort();
        }
        setMessages([]);
        setIsLoading(false);
        setInput("");
    }, [isLoading]);

    // ─── Send message ────────────────────────────────────────────
    const handleSend = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading || !isConfigured) return;

        const userMsg: UIMessage = {
            id: `u-${Date.now()}`,
            role: "user",
            content: trimmed,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        // Reset textarea height
        if (inputRef.current) inputRef.current.style.height = "auto";

        // Build API messages
        const apiMessages: ChatMessage[] = [];
        let system = systemPrompt;
        if (dataContextStr) system += `\n\n${dataContextStr}`;
        if (system) apiMessages.push({ role: "system", content: system });

        for (const m of messages) {
            apiMessages.push({ role: m.role, content: m.content });
        }
        apiMessages.push({ role: "user", content: trimmed });

        const aiConfig: AIConfig = {
            provider,
            apiKey,
            model: model || getDefaultModel(provider),
            endpoint: endpoint || undefined,
            temperature,
            maxTokens,
            stream
        };

        const assistantId = `a-${Date.now()}`;

        if (stream) {
            const assistantMsg: UIMessage = {
                id: assistantId,
                role: "assistant",
                content: "",
                timestamp: new Date(),
                isStreaming: true
            };
            setMessages(prev => [...prev, assistantMsg]);

            const callbacks: StreamCallbacks = {
                onToken: (token) => {
                    setMessages(prev =>
                        prev.map(m => m.id === assistantId ? { ...m, content: m.content + token } : m)
                    );
                },
                onComplete: (fullText) => {
                    setMessages(prev =>
                        prev.map(m =>
                            m.id === assistantId
                                ? { ...m, content: fullText, isStreaming: false, tokenEstimate: estimateTokens(fullText) }
                                : m
                        )
                    );
                    setIsLoading(false);
                },
                onError: (err) => {
                    setMessages(prev =>
                        prev.map(m =>
                            m.id === assistantId
                                ? { ...m, content: `Error: ${err.message}`, isStreaming: false, error: true }
                                : m
                        )
                    );
                    setIsLoading(false);
                }
            };

            try {
                await sendMessage(apiMessages, aiConfig, callbacks);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantId
                            ? { ...m, content: `Error: ${errMsg}`, isStreaming: false, error: true }
                            : m
                    )
                );
                setIsLoading(false);
            }
        } else {
            setMessages(prev => [...prev, {
                id: assistantId,
                role: "assistant",
                content: "",
                timestamp: new Date(),
                isStreaming: true
            }]);

            try {
                const response = await sendMessage(apiMessages, aiConfig);
                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantId
                            ? { ...m, content: response, isStreaming: false, tokenEstimate: estimateTokens(response) }
                            : m
                    )
                );
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantId
                            ? { ...m, content: `Error: ${errMsg}`, isStreaming: false, error: true }
                            : m
                    )
                );
            } finally {
                setIsLoading(false);
            }
        }
    }, [input, isLoading, isConfigured, messages, systemPrompt, dataContextStr, provider, apiKey, model, endpoint, temperature, maxTokens, stream]);

    // ─── Input handlers ──────────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }, []);

    // ─── Styles ──────────────────────────────────────────────────
    const containerStyle: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        height: viewport.height,
        width: viewport.width,
        background: theme.bg,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
        color: theme.text,
        fontSize
    };

    const headerStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: theme.headerBg,
        borderBottom: `1px solid ${theme.border}`,
        flexShrink: 0,
        minHeight: 48
    };

    const messagesAreaStyle: CSSProperties = {
        flex: 1,
        overflowY: "auto",
        padding: "16px 16px 8px",
        background: theme.bg
    };

    const dataBarStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 16px",
        background: theme.surfaceSecondary,
        borderTop: `1px solid ${theme.border}`,
        fontSize: fontSize - 2,
        color: theme.textSecondary,
        flexShrink: 0
    };

    const inputAreaStyle: CSSProperties = {
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        padding: "12px 16px",
        background: theme.surfacePrimary,
        borderTop: `1px solid ${theme.border}`,
        flexShrink: 0
    };

    const textareaStyle: CSSProperties = {
        flex: 1,
        resize: "none",
        border: `1.5px solid ${theme.inputBorder}`,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize,
        fontFamily: "inherit",
        background: theme.inputBg,
        color: theme.inputText,
        outline: "none",
        lineHeight: 1.5,
        maxHeight: 120,
        minHeight: 40,
        transition: "border-color 0.15s"
    };

    const sendBtnStyle: CSSProperties = {
        width: 40,
        height: 40,
        borderRadius: 12,
        border: "none",
        background: isLoading || !input.trim() ? theme.surfaceSecondary : theme.accentColor,
        cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "background 0.15s, transform 0.1s",
        opacity: isLoading || !input.trim() ? 0.5 : 1
    };

    const clearBtnStyle: CSSProperties = {
        background: "none",
        border: "none",
        padding: "6px",
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.6,
        transition: "opacity 0.15s"
    };

    // ─── Render ──────────────────────────────────────────────────

    if (!isConfigured) {
        return (
            <div style={containerStyle}>
                <WelcomeScreen theme={theme} fontSize={fontSize} />
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: `${theme.accentColor}15`,
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <BotIcon color={theme.accentColor} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: fontSize + 1, lineHeight: 1.2 }}>AskData</div>
                        <div style={{ fontSize: fontSize - 3, color: theme.textSecondary }}>
                            {PROVIDER_LABELS[provider] || provider} &middot; {model || getDefaultModel(provider)}
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {messages.length > 0 && (
                        <button
                            style={clearBtnStyle}
                            onClick={handleClear}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
                            title="Clear conversation"
                        >
                            <ClearIcon color={theme.textSecondary} />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div style={messagesAreaStyle} className="ad-messages-scroll">
                {messages.length === 0 && (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        textAlign: "center",
                        padding: "20px"
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12,
                            background: `${theme.accentColor}10`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            marginBottom: 16
                        }}>
                            <BotIcon color={theme.accentColor} />
                        </div>
                        <p style={{ color: theme.textSecondary, fontSize, margin: "0 0 4px" }}>
                            How can I help you today?
                        </p>
                        <p style={{ color: theme.textSecondary, fontSize: fontSize - 2, margin: 0, opacity: 0.6 }}>
                            {dataContext?.length
                                ? `${dataContext[0].split(" | ").length} fields, ${dataContext.length - 1} rows loaded as context`
                                : "Drag dimensions or measures onto the visual to add data context"}
                        </p>
                    </div>
                )}

                {messages.map(msg => (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        theme={theme}
                        fontSize={fontSize}
                        showTimestamp={showTimestamps}
                        showTokens={showTokens}
                        onCopy={handleCopy}
                    />
                ))}

                {isLoading && !messages.some(m => m.isStreaming) && (
                    <TypingIndicator theme={theme} fontSize={fontSize} />
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Data context bar */}
            {dataContext && dataContext.length > 1 && includeData && (
                <div style={dataBarStyle}>
                    <DataIcon color={theme.textSecondary} />
                    <span>{dataContext[0].split(" | ").length} fields &middot; {dataContext.length - 1} rows</span>
                </div>
            )}

            {/* Input area */}
            <div style={inputAreaStyle}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={e => { e.target.style.borderColor = theme.inputBorderFocus; }}
                    onBlur={e => { e.target.style.borderColor = theme.inputBorder; }}
                    placeholder={isLoading ? "Waiting for response..." : "Ask about your data..."}
                    disabled={isLoading}
                    style={{
                        ...textareaStyle,
                        opacity: isLoading ? 0.6 : 1
                    }}
                    rows={1}
                />
                <button
                    style={sendBtnStyle}
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    title="Send message (Enter)"
                >
                    <SendIcon color={isLoading || !input.trim() ? theme.textSecondary : "#ffffff"} />
                </button>
            </div>
        </div>
    );
};

export default ChatApp;
