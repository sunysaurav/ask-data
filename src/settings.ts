"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import powerbi from "powerbi-visuals-api";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

const aiProviderOptions: powerbi.IEnumMember[] = [
    { value: "openai", displayName: "OpenAI" },
    { value: "gemini", displayName: "Google Gemini" },
    { value: "claude", displayName: "Anthropic Claude" },
    { value: "openrouter", displayName: "OpenRouter (Free Models)" }
];

const themeOptions: powerbi.IEnumMember[] = [
    { value: "light", displayName: "Light" },
    { value: "dark", displayName: "Dark" },
    { value: "auto", displayName: "Auto" }
];

class AIConfigCardSettings extends FormattingSettingsCard {
    provider = new formattingSettings.ItemDropdown({
        name: "provider",
        displayName: "AI Provider",
        description: "Select the AI service provider",
        items: aiProviderOptions,
        value: aiProviderOptions[0]
    });

    apiKey = new formattingSettings.TextInput({
        name: "apiKey",
        displayName: "API Key",
        description: "Your API key for the selected provider (stored in report metadata)",
        value: "",
        placeholder: "Enter API key..."
    });

    modelName = new formattingSettings.TextInput({
        name: "modelName",
        displayName: "Model",
        description: "Model name (e.g. gpt-4o, gemini-2.0-flash, claude-sonnet-4-20250514, openrouter/free)",
        value: "",
        placeholder: "Leave empty for default"
    });

    apiEndpoint = new formattingSettings.TextInput({
        name: "apiEndpoint",
        displayName: "Custom Endpoint",
        description: "Override the default API endpoint URL (optional)",
        value: "",
        placeholder: "https://..."
    });

    name: string = "aiConfig";
    displayName: string = "AI Configuration";
    description: string = "Configure your AI provider and credentials";
    slices: FormattingSettingsSlice[] = [this.provider, this.apiKey, this.modelName, this.apiEndpoint];
}

class ChatBehaviorCardSettings extends FormattingSettingsCard {
    systemPrompt = new formattingSettings.TextInput({
        name: "systemPrompt",
        displayName: "System Prompt",
        description: "Initial instructions for the AI assistant",
        value: "You are AskData, an expert data analyst AI assistant embedded in a Power BI dashboard. Analyze the provided data context and answer questions clearly and concisely. Use markdown formatting for better readability. When data is provided, reference specific values and suggest actionable insights.\n\nYou can render charts inline by outputting a JSON code block with language `chart`. Supported types: bar, horizontalBar, line, area, pie, doughnut. Example:\n```chart\n{\"type\":\"bar\",\"title\":\"Revenue by Region\",\"labels\":[\"East\",\"West\",\"North\"],\"datasets\":[{\"label\":\"Revenue\",\"data\":[45000,38000,52000]}]}\n```\nUse charts proactively when visualizing data would help the user understand trends, comparisons, or distributions. Always include a brief text explanation alongside the chart.",
        placeholder: "Enter system instructions..."
    });

    temperature = new formattingSettings.NumUpDown({
        name: "temperature",
        displayName: "Temperature",
        description: "Controls randomness: 0 = focused and deterministic, 2 = creative and varied",
        value: 0.7
    });

    maxTokens = new formattingSettings.NumUpDown({
        name: "maxTokens",
        displayName: "Max Response Tokens",
        description: "Maximum length of AI response in tokens",
        value: 2048
    });

    includeDataContext = new formattingSettings.ToggleSwitch({
        name: "includeDataContext",
        displayName: "Include Data Context",
        description: "Automatically send the dragged data field values as context to the AI",
        value: true
    });

    streamResponse = new formattingSettings.ToggleSwitch({
        name: "streamResponse",
        displayName: "Stream Responses",
        description: "Display AI response progressively as it is generated",
        value: true
    });

    name: string = "chatBehavior";
    displayName: string = "Chat Behavior";
    description: string = "Control how the AI responds";
    slices: FormattingSettingsSlice[] = [
        this.systemPrompt,
        this.temperature,
        this.maxTokens,
        this.includeDataContext,
        this.streamResponse
    ];
}

class AppearanceCardSettings extends FormattingSettingsCard {
    theme = new formattingSettings.ItemDropdown({
        name: "theme",
        displayName: "Theme",
        description: "Color theme for the chat interface",
        items: themeOptions,
        value: themeOptions[0]
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font Size",
        description: "Base font size in pixels",
        value: 13
    });

    accentColor = new formattingSettings.ColorPicker({
        name: "accentColor",
        displayName: "Accent Color",
        description: "Primary accent color for user messages and interactive elements",
        value: { value: "#2563eb" }
    });

    showTimestamps = new formattingSettings.ToggleSwitch({
        name: "showTimestamps",
        displayName: "Show Timestamps",
        description: "Display timestamps on each message",
        value: false
    });

    showTokenCount = new formattingSettings.ToggleSwitch({
        name: "showTokenCount",
        displayName: "Show Token Estimate",
        description: "Display approximate token count for AI responses",
        value: false
    });

    name: string = "appearance";
    displayName: string = "Appearance";
    description: string = "Customize the visual appearance of the chat";
    slices: FormattingSettingsSlice[] = [
        this.theme,
        this.fontSize,
        this.accentColor,
        this.showTimestamps,
        this.showTokenCount
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    aiConfigCard = new AIConfigCardSettings();
    chatBehaviorCard = new ChatBehaviorCardSettings();
    appearanceCard = new AppearanceCardSettings();

    cards = [this.aiConfigCard, this.chatBehaviorCard, this.appearanceCard];
}
