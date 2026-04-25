"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { createElement } from "react";
import { createRoot, Root } from "react-dom/client";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";
import ChatApp, { ChatAppProps } from "./ChatApp";

export class Visual implements IVisual {
    private target: HTMLElement;
    private reactRoot: Root;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private dataContext: string[] | null;
    private viewport: { width: number; height: number };

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.dataContext = null;
        this.viewport = { width: 0, height: 0 };

        this.target.style.overflow = "hidden";
        this.target.style.padding = "0";
        this.target.style.margin = "0";

        const container = document.createElement("div");
        container.className = "askdata-visual";
        this.target.appendChild(container);

        this.reactRoot = createRoot(container);

        this.formattingSettings = new VisualFormattingSettingsModel();
        this.renderReact();
    }

    public update(options: VisualUpdateOptions) {
        if (options.dataViews?.[0]) {
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                options.dataViews[0]
            );
        }

        this.dataContext = this.extractDataContext(options.dataViews);
        this.viewport = options.viewport;
        this.renderReact();
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        this.reactRoot?.unmount();
    }

    private renderReact(): void {
        const props: ChatAppProps = {
            settings: this.formattingSettings,
            dataContext: this.dataContext,
            viewport: this.viewport
        };
        this.reactRoot.render(createElement(ChatApp, props));
    }

    private extractDataContext(dataViews: DataView[] | undefined): string[] | null {
        const table = dataViews?.[0]?.table;
        if (!table?.columns?.length || !table?.rows?.length) return null;

        const columns = table.columns.map(c => c.displayName || "Unknown");
        const header = columns.join(" | ");

        const result: string[] = [header];
        for (const row of table.rows) {
            result.push(row.map(v => (v != null ? String(v) : "")).join(" | "));
        }

        return result;
    }
}
