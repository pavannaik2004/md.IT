import { Button, RangeField, SegmentedControl, type SegmentedOption } from '../ui';
import { DEFAULT_RENDERING, formatSetting, RENDERING_LIMITS, sameRendering, type DocFont, type NumericSetting, type RenderingSettings } from './rendering';
import './settings.css';

const FONT_OPTIONS: ReadonlyArray<SegmentedOption<DocFont>> = [
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans' },
  { value: 'mono', label: 'Mono' },
];

const FIELDS: ReadonlyArray<[NumericSetting, string]> = [
  ['letterSpacing', 'Letter spacing'],
  ['lineHeight', 'Line height'],
  ['margin', 'Margin'],
  ['padding', 'Padding'],
];

export interface SettingsPanelProps {
  value: RenderingSettings;
  onChange: (patch: Partial<RenderingSettings>) => void;
  onReset: () => void;
}

export function SettingsPanel({ value, onChange, onReset }: SettingsPanelProps) {
  return (
    <div className="settings-panel">
      <h3 className="panel-heading">Rendering</h3>
      <div className="settings-font">
        <span className="md-field-label" aria-hidden="true">
          Font
        </span>
        <SegmentedControl label="Font" value={value.font} options={FONT_OPTIONS} onChange={(font) => onChange({ font })} />
      </div>
      {FIELDS.map(([key, label]) => (
        <RangeField
          key={key}
          label={label}
          {...RENDERING_LIMITS[key]}
          value={value[key]}
          format={(v) => formatSetting(key, v)}
          onChange={(v) => onChange({ [key]: v } as Partial<RenderingSettings>)}
        />
      ))}
      <p className="panel-caption">Applies to every document in this browser and to exports.</p>
      <div>
        <Button size="sm" disabled={sameRendering(value, DEFAULT_RENDERING)} onClick={onReset}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
