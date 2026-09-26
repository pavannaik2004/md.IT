import type * as React from 'react';

export type IconName = 'file' | 'folder' | 'folder-open' | 'chevron-right' | 'chevron-down' | 'plus' | 'search' | 'copy' | 'check' | 'x' | 'more' | 'columns' | 'pencil' | 'eye' | 'history' | 'cloud' | 'alert' | 'info' | 'trash' | 'download' | 'image' | 'sliders' | 'sidebar' | 'user';
type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'danger';

export interface WordmarkProps { size?: 'md' | 'lg'; className?: string }
export declare function Wordmark(props: WordmarkProps): React.ReactElement;

export interface IconProps { name: IconName; size?: number; label?: string; className?: string }
export declare function Icon(props: IconProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: IconName; iconRight?: IconName }
export declare function Button(props: ButtonProps): React.ReactElement;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; active?: boolean; size?: 'sm' | 'md' }
export declare function IconButton(props: IconButtonProps): React.ReactElement;

export interface SegmentedOption { value: string; label?: string; icon?: IconName }
export interface SegmentedControlProps { options: SegmentedOption[]; value?: string; defaultValue?: string; onChange?: (value: string) => void; label?: string }
export declare function SegmentedControl(props: SegmentedControlProps): React.ReactElement;

export type MenuItem = 'separator' | { label: string; icon?: IconName; shortcut?: string; danger?: boolean; disabled?: boolean; onSelect?: () => void };
export interface MenuProps { items: MenuItem[]; className?: string }
export declare function Menu(props: MenuProps): React.ReactElement;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; icon?: IconName; shortcut?: string }
export declare function Input(props: InputProps): React.ReactElement;

export interface RangeFieldProps { label: string; min: number; max: number; step?: number; value?: number; defaultValue?: number; unit?: string; format?: (v: number) => string; onChange?: (v: number) => void }
export declare function RangeField(props: RangeFieldProps): React.ReactElement;

export interface TreeItemProps { kind: 'folder' | 'file' | 'image'; name: string; depth?: number; open?: boolean; active?: boolean; dirty?: boolean; onClick?: () => void }
export declare function TreeItem(props: TreeItemProps): React.ReactElement;

export interface SaveStatusProps { state?: 'saved' | 'saving' | 'failed' | 'cloud'; detail?: string; children?: React.ReactNode }
export declare function SaveStatus(props: SaveStatusProps): React.ReactElement;

export interface VersionItemProps { number: number; message?: string; time: string; current?: boolean; onClick?: () => void }
export declare function VersionItem(props: VersionItemProps): React.ReactElement;

export interface EmptyStateProps { icon?: IconName; title: string; children?: React.ReactNode; action?: React.ReactNode }
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;

export interface ProseProps extends React.HTMLAttributes<HTMLElement> { html?: string; children?: React.ReactNode }
export declare function Prose(props: ProseProps): React.ReactElement;

export interface CodeBlockProps { language?: string; code?: string; children?: React.ReactNode; copyable?: boolean }
export declare function CodeBlock(props: CodeBlockProps): React.ReactElement;

export interface CalloutProps { tone?: 'info' | 'positive' | 'warning' | 'danger'; title?: string; children?: React.ReactNode; actions?: React.ReactNode }
export declare function Callout(props: CalloutProps): React.ReactElement;

export interface BadgeProps { tone?: Tone; children?: React.ReactNode }
export declare function Badge(props: BadgeProps): React.ReactElement;

export interface KbdProps { children?: React.ReactNode }
export declare function Kbd(props: KbdProps): React.ReactElement;

export interface DialogProps { title: string; children?: React.ReactNode; actions?: React.ReactNode; onClose?: () => void; tone?: 'danger'; inline?: boolean; open?: boolean }
export declare function Dialog(props: DialogProps): React.ReactElement | null;

declare global { interface Window { MdIt: { Wordmark: typeof Wordmark; Icon: typeof Icon & { names: IconName[] }; Button: typeof Button; IconButton: typeof IconButton; SegmentedControl: typeof SegmentedControl; Menu: typeof Menu; Input: typeof Input; RangeField: typeof RangeField; TreeItem: typeof TreeItem; SaveStatus: typeof SaveStatus; VersionItem: typeof VersionItem; EmptyState: typeof EmptyState; Prose: typeof Prose; CodeBlock: typeof CodeBlock; Callout: typeof Callout; Badge: typeof Badge; Kbd: typeof Kbd; Dialog: typeof Dialog } } }
