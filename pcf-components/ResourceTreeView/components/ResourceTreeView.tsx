import * as React from "react";
import {
    Tree,
    TreeItem,
    TreeItemLayout,
    TreeItemValue,
    TreeOpenChangeData,
    TreeOpenChangeEvent,
    Badge,
    tokens,
    makeStyles,
} from "@fluentui/react-components";
import {
    BuildingRegular,
    AppFolderRegular,
    FlowRegular,
    BotRegular,
    CircleFilled,
} from "@fluentui/react-icons";

// ============================================================
// Types
// ============================================================

export interface Environment {
    id: string;
    name: string;
    type: string; // Production | Sandbox | Developer | Teams
    apps: Resource[];
    flows: Resource[];
    bots: Resource[];
}

export interface Resource {
    id: string;
    name: string;
    displayName?: string;
    status: "active" | "inactive" | "quarantined";
    owner?: string;
    createdAt?: string;
}

interface ResourceTreeViewProps {
    environments: Environment[];
    onResourceSelect: (resourceId: string, resourceType: string) => void;
}

// ============================================================
// Styles
// ============================================================

const useStyles = makeStyles({
    container: {
        padding: "8px",
        minHeight: "300px",
        backgroundColor: tokens.colorNeutralBackground1,
    },
    environmentHeader: {
        fontWeight: tokens.fontWeightSemibold,
    },
    resourceCount: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        marginLeft: "8px",
    },
    statusIndicator: {
        display: "inline-flex",
        alignItems: "center",
        marginLeft: "8px",
    },
    emptyState: {
        padding: "24px",
        textAlign: "center" as const,
        color: tokens.colorNeutralForeground3,
    },
});

// ============================================================
// Helper Components
// ============================================================

const ResourceIcon: React.FC<{ type: string }> = ({ type }) => {
    switch (type) {
        case "app":
            return <AppFolderRegular />;
        case "flow":
            return <FlowRegular />;
        case "bot":
            return <BotRegular />;
        default:
            return <BuildingRegular />;
    }
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colorMap: Record<string, string> = {
        active: tokens.colorPaletteGreenForeground1,
        inactive: tokens.colorNeutralForeground3,
        quarantined: tokens.colorPaletteRedForeground1,
    };

    const labelMap: Record<string, string> = {
        active: "Active",
        inactive: "Inactive",
        quarantined: "Quarantined",
    };

    return (
        <Badge
            size="small"
            appearance="ghost"
            color={status === "quarantined" ? "danger" : status === "active" ? "success" : "informative"}
            icon={<CircleFilled style={{ color: colorMap[status], fontSize: 8 }} />}
        >
            {labelMap[status] || status}
        </Badge>
    );
};

const EnvironmentTypeBadge: React.FC<{ type: string }> = ({ type }) => {
    const colorMap: Record<string, "brand" | "informative" | "success" | "warning"> = {
        Production: "brand",
        Sandbox: "informative",
        Developer: "success",
        Teams: "warning",
        Default: "informative",
    };

    return (
        <Badge
            size="small"
            appearance="tint"
            color={colorMap[type] || "informative"}
        >
            {type}
        </Badge>
    );
};

// ============================================================
// Main Component
// ============================================================

export const ResourceTreeView: React.FC<ResourceTreeViewProps> = ({
    environments,
    onResourceSelect,
}) => {
    const styles = useStyles();
    const [openItems, setOpenItems] = React.useState<Set<TreeItemValue>>(new Set());

    const handleOpenChange = (
        _event: TreeOpenChangeEvent,
        data: TreeOpenChangeData
    ) => {
        setOpenItems(data.openItems);
    };

    const handleResourceClick = (resourceId: string, resourceType: string) => {
        onResourceSelect(resourceId, resourceType);
    };

    const renderResources = (
        resources: Resource[],
        type: string,
        envId: string
    ) => {
        if (resources.length === 0) {
            return (
                <TreeItem key={`${envId}-${type}-empty`} itemType="leaf" value={`${envId}-${type}-empty`}>
                    <TreeItemLayout>
                        <span style={{ color: tokens.colorNeutralForeground3, fontStyle: "italic" }}>
                            No {type}s
                        </span>
                    </TreeItemLayout>
                </TreeItem>
            );
        }

        return resources.map((resource) => (
            <TreeItem
                key={resource.id}
                itemType="leaf"
                value={`${envId}-${type}-${resource.id}`}
                onClick={() => handleResourceClick(resource.id, type)}
            >
                <TreeItemLayout
                    iconBefore={<ResourceIcon type={type} />}
                    aside={<StatusBadge status={resource.status} />}
                >
                    {resource.displayName || resource.name}
                </TreeItemLayout>
            </TreeItem>
        ));
    };

    if (!environments || environments.length === 0) {
        return (
            <div className={styles.emptyState}>
                <BuildingRegular style={{ fontSize: 48, marginBottom: 16 }} />
                <p>No environments found</p>
                <p style={{ fontSize: 12 }}>Connect to Power Platform Inventory API to load data</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Tree
                aria-label="Power Platform Resources"
                openItems={openItems}
                onOpenChange={handleOpenChange}
            >
                {environments.map((env) => {
                    const totalResources = env.apps.length + env.flows.length + env.bots.length;

                    return (
                        <TreeItem key={env.id} itemType="branch" value={env.id}>
                            <TreeItemLayout
                                iconBefore={<BuildingRegular />}
                                aside={<EnvironmentTypeBadge type={env.type} />}
                            >
                                <span className={styles.environmentHeader}>{env.name}</span>
                                <span className={styles.resourceCount}>({totalResources})</span>
                            </TreeItemLayout>

                            {/* Apps */}
                            <TreeItem itemType="branch" value={`${env.id}-apps`}>
                                <TreeItemLayout iconBefore={<AppFolderRegular />}>
                                    📱 Apps
                                    <span className={styles.resourceCount}>({env.apps.length})</span>
                                </TreeItemLayout>
                                {renderResources(env.apps, "app", env.id)}
                            </TreeItem>

                            {/* Flows */}
                            <TreeItem itemType="branch" value={`${env.id}-flows`}>
                                <TreeItemLayout iconBefore={<FlowRegular />}>
                                    ⚡ Flows
                                    <span className={styles.resourceCount}>({env.flows.length})</span>
                                </TreeItemLayout>
                                {renderResources(env.flows, "flow", env.id)}
                            </TreeItem>

                            {/* Bots */}
                            <TreeItem itemType="branch" value={`${env.id}-bots`}>
                                <TreeItemLayout iconBefore={<BotRegular />}>
                                    🤖 Copilots
                                    <span className={styles.resourceCount}>({env.bots.length})</span>
                                </TreeItemLayout>
                                {renderResources(env.bots, "bot", env.id)}
                            </TreeItem>
                        </TreeItem>
                    );
                })}
            </Tree>
        </div>
    );
};

export default ResourceTreeView;
