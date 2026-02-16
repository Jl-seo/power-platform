/*
 * This is auto-generated from the ControlManifest.Input.xml file.
 * Regenerate by running 'npm run build'.
 */

// Define IInputs and IOutputs interfaces based on ControlManifest.Input.xml
export interface IInputs {
    environmentData: ComponentFramework.PropertyTypes.StringProperty;
}

export interface IOutputs {
    selectedResourceId?: string;
    selectedResourceType?: string;
}
