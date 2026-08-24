import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/orgchart/OrgChart.jsx

export type OrgNodeTone = 'brand' | 'light' | 'neutral';

const ORG_TONES: { [tone: string]: [string, string] } = {
  brand: ['var(--brand-600)', 'var(--color-fg-on-brand)'],
  light: ['var(--brand-50)', 'var(--brand-700)'],
  neutral: ['var(--color-bg-elevated)', 'var(--color-fg-primary)']
};

export interface IOrgNode {
  name: string;
  title?: string;
  tone?: OrgNodeTone;
  children?: IOrgNode[];
  onClick?: () => void;
}

interface IOrgNodeProps {
  node: IOrgNode;
  isRoot?: boolean;
}

const OrgNode: React.FC<IOrgNodeProps> = ({ node, isRoot }) => {
  const kids: IOrgNode[] = node.children || [];
  const [bg, fg] = ORG_TONES[node.tone || (isRoot ? 'brand' : 'neutral')] || ORG_TONES.neutral;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        onClick={node.onClick}
        style={{
          background: bg, color: fg,
          border: '1px solid ' + (bg === 'var(--color-bg-elevated)' ? 'var(--color-border-default)' : 'transparent'),
          borderRadius: 12, padding: '10px 16px', textAlign: 'center', minWidth: 96,
          boxShadow: 'var(--shadow-sm)', cursor: node.onClick ? 'pointer' : undefined
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{node.name}</div>
        {node.title ? <div style={{ fontSize: 11, opacity: bg === 'var(--color-bg-elevated)' ? 0.6 : 0.85, marginTop: 2, whiteSpace: 'nowrap' }}>{node.title}</div> : undefined}
      </div>
      {kids.length > 0 ? (
        <React.Fragment>
          <div style={{ width: 1, height: 14, background: 'var(--neutral-300)' }} />
          <div style={{ display: 'flex' }}>
            {kids.map((c: IOrgNode, i: number) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', position: 'relative' }}>
                <div style={{
                  position: 'absolute', top: 0, height: 1, background: 'var(--neutral-300)',
                  left: i === 0 ? '50%' : 0, right: i === kids.length - 1 ? '50%' : 0,
                  display: kids.length === 1 ? 'none' : 'block'
                }} />
                <div style={{ width: 1, height: 14, background: 'var(--neutral-300)' }} />
                <OrgNode node={c} />
              </div>
            ))}
          </div>
        </React.Fragment>
      ) : undefined}
    </div>
  );
};

export interface IOrgChartProps {
  root?: IOrgNode;
  style?: React.CSSProperties;
}

export const OrgChart: React.FC<IOrgChartProps> = ({ root, style }) => {
  if (!root) {
    return null;
  }
  return (
    <div style={{ display: 'inline-flex', fontFamily: 'var(--font-sans)', overflowX: 'auto', maxWidth: '100%', ...style }}>
      <OrgNode node={root} isRoot />
    </div>
  );
};
