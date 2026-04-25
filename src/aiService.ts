"use strict";

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface AIConfig {
    provider: string;
    apiKey: string;
    model: string;
    endpoint?: string;
    temperature: number;
    maxTokens: number;
    stream: boolean;
}

export interface StreamCallbacks {
    onToken: (token: string) => void;
    onComplete: (fullText: string) => void;
    onError: (error: Error) => void;
}

const DEFAULT_MODELS: Record<string, string> = {
    openai: "gpt-4o",
    gemini: "gemini-2.0-flash",
    claude: "claude-sonnet-4-20250514",
    openrouter: "openrouter/free"
};

const DEFAULT_ENDPOINTS: Record<string, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    claude: "https://api.anthropic.com/v1/messages",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    openrouter: "https://openrouter.ai/api/v1/chat/completions"
};

export function getDefaultModel(provider: string): string {
    return DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;
}

export async function sendMessage(
    messages: ChatMessage[],
    config: AIConfig,
    callbacks?: StreamCallbacks
): Promise<string> {
    const model = config.model || DEFAULT_MODELS[config.provider] || DEFAULT_MODELS.openai;

    switch (config.provider) {
        case "openai":
            return sendOpenAI(messages, model, config, callbacks);
        case "claude":
            return sendClaude(messages, model, config, callbacks);
        case "gemini":
            return sendGemini(messages, model, config, callbacks);
        case "openrouter":
            return sendOpenRouter(messages, model, config, callbacks);
        default:
            throw new Error(`Unsupported provider: ${config.provider}. Use openai, gemini, claude, or openrouter.`);
    }
}

async function sendOpenAI(
    messages: ChatMessage[],
    model: string,
    config: AIConfig,
    callbacks?: StreamCallbacks
): Promise<string> {
    const endpoint = config.endpoint || DEFAULT_ENDPOINTS.openai;
    const shouldStream = config.stream && !!callbacks;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            stream: shouldStream
        })
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error?.message || `OpenAI API error ${response.status}: ${response.statusText}`);
    }

    if (shouldStream && response.body) {
        return streamSSE(response, extractOpenAIToken, callbacks!);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

async function sendClaude(
    messages: ChatMessage[],
    model: string,
    config: AIConfig,
    callbacks?: StreamCallbacks
): Promise<string> {
    const endpoint = config.endpoint || DEFAULT_ENDPOINTS.claude;
    const shouldStream = config.stream && !!callbacks;

    const systemContent = messages.find(m => m.role === "system")?.content || "";
    const chatMessages = messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
        model,
        messages: chatMessages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: shouldStream
    };

    if (systemContent) {
        body.system = systemContent;
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error?.message || `Claude API error ${response.status}: ${response.statusText}`);
    }

    if (shouldStream && response.body) {
        return streamSSE(response, extractClaudeToken, callbacks!);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
}

async function sendGemini(
    messages: ChatMessage[],
    model: string,
    config: AIConfig,
    callbacks?: StreamCallbacks
): Promise<string> {
    const baseEndpoint = config.endpoint || DEFAULT_ENDPOINTS.gemini;
    const shouldStream = config.stream && !!callbacks;
    const action = shouldStream ? "streamGenerateContent" : "generateContent";
    const endpoint = `${baseEndpoint}/models/${model}:${action}?key=${config.apiKey}${shouldStream ? "&alt=sse" : ""}`;

    const systemInstruction = messages.find(m => m.role === "system")?.content;
    const contents = messages
        .filter(m => m.role !== "system")
        .map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
        }));

    const body: Record<string, unknown> = {
        contents,
        generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens
        }
    };

    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const msg = errBody?.error?.message || `Gemini API error ${response.status}: ${response.statusText}`;
        throw new Error(msg);
    }

    if (shouldStream && response.body) {
        return streamSSE(response, extractGeminiToken, callbacks!);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function sendOpenRouter(
    messages: ChatMessage[],
    model: string,
    config: AIConfig,
    callbacks?: StreamCallbacks
): Promise<string> {
    const endpoint = config.endpoint || DEFAULT_ENDPOINTS.openrouter;
    const shouldStream = config.stream && !!callbacks;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`,
            "HTTP-Referer": "https://askdata.powerbi.visual",
            "X-Title": "AskData Power BI"
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            stream: shouldStream
        })
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error?.message || `OpenRouter API error ${response.status}: ${response.statusText}`);
    }

    if (shouldStream && response.body) {
        return streamSSE(response, extractOpenAIToken, callbacks!);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

// --- SSE stream parser ---

type TokenExtractor = (jsonStr: string) => string | null;

function extractOpenAIToken(data: string): string | null {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content || null;
}

function extractClaudeToken(data: string): string | null {
    const parsed = JSON.parse(data);
    if (parsed.type === "content_block_delta") {
        return parsed.delta?.text || null;
    }
    return null;
}

function extractGeminiToken(data: string): string | null {
    const parsed = JSON.parse(data);
    return parsed.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function streamSSE(
    response: Response,
    extractToken: TokenExtractor,
    callbacks: StreamCallbacks
): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;

                const data = trimmed.slice(5).trim();
                if (!data || data === "[DONE]") continue;

                try {
                    const token = extractToken(data);
                    if (token) {
                        fullText += token;
                        callbacks.onToken(token);
                    }
                } catch {
                    // Skip malformed chunks
                }
            }
        }

        callbacks.onComplete(fullText);
        return fullText;
    } catch (error) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        return fullText;
    }
}

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}
