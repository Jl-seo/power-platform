import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { ResourceTreeView } from "./components/ResourceTreeView";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

export class ResourceTreeViewControl implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container!: HTMLDivElement;
    private root!: Root;
    private notifyOutputChanged!: () => void;
    private selectedResourceId: string = "";
    private selectedResourceType: string = "";

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.container = container;
        this.notifyOutputChanged = notifyOutputChanged;
        this.root = createRoot(container);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        const rawData = context.parameters.environmentData.raw || "[]";

        let environments: Environment[] = [];
        try {
            environments = JSON.parse(rawData);
        } catch (e) {
            console.error("Failed to parse environment data:", e);
        }

        this.root.render(
            <FluentProvider theme={ webLightTheme } >
        <ResourceTreeView
                    environments={ environments }
                    onResourceSelect = { this.handleResourceSelect.bind(this) }
            />
            </FluentProvider>
        );
    }

    private handleResourceSelect(resourceId: string, resourceType: string): void {
        this.selectedResourceId = resourceId;
        this.selectedResourceType = resourceType;
        this.notifyOutputChanged();
    }

    public getOutputs(): IOutputs {
        return {
            selectedResourceId: this.selectedResourceId,
            selectedResourceType: this.selectedResourceType
        };
    }

    public destroy(): void {
        this.root.unmount();
    }
}

// Type definitions
interface Environment {
    id: string;
    name: string;
    type: string;
    apps: Resource[];
    flows: Resource[];
    bots: Resource[];
}

interface Resource {
    id: string;
    name: string;
    status: "active" | "inactive" | "quarantined";
    owner: string;
}
