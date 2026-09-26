/* @ds-bundle: {"format":4,"namespace":"MdIt","components":[{"name":"Wordmark"},{"name":"Icon"},{"name":"Button"},{"name":"IconButton"},{"name":"SegmentedControl"},{"name":"Menu"},{"name":"Input"},{"name":"RangeField"},{"name":"TreeItem"},{"name":"SaveStatus"},{"name":"VersionItem"},{"name":"EmptyState"},{"name":"Prose"},{"name":"CodeBlock"},{"name":"Callout"},{"name":"Badge"},{"name":"Kbd"},{"name":"Dialog"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  function omit(obj, keys) {
    var o = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) < 0) o[k] = obj[k];
    return o;
  }

  /* Icons: 24px grid, 1.5 stroke, round caps and joins. [path, strokeWidth?] */
  var ICONS = {
    'file': [['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z'], ['M14 3v5h5']],
    'folder': [['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z']],
    'folder-open': [['M3 17V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1'], ['M3 17l2.3-5.8A2 2 0 0 1 7.2 10H21l-2.5 7.6A2 2 0 0 1 16.6 19H5a2 2 0 0 1-2-2z']],
    'chevron-right': [['M9.5 6.5l5.5 5.5-5.5 5.5']],
    'chevron-down': [['M6.5 9.5l5.5 5.5 5.5-5.5']],
    'plus': [['M12 5v14M5 12h14']],
    'search': [['M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z'], ['M20 20l-4.3-4.3']],
    'copy': [['M10 8h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z'], ['M15 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4']],
    'check': [['M5 12.5l4.5 4.5L19 7.5']],
    'x': [['M6.5 6.5l11 11M17.5 6.5l-11 11']],
    'more': [['M6 12h.01M12 12h.01M18 12h.01', 2.6]],
    'columns': [['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'], ['M12 4v16']],
    'pencil': [['M4 20h4L19.3 8.7a2.1 2.1 0 0 0-3-3L5 17v3'], ['M14.5 7.5l2 2']],
    'eye': [['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'], ['M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z']],
    'history': [['M3.5 12A8.5 8.5 0 1 0 6 6'], ['M3.5 3.5V8H8'], ['M12 8v4l3 2']],
    'cloud': [['M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 9.3 4.6 4.6 0 0 0 7 18.5z']],
    'alert': [['M10.3 4.9a2 2 0 0 1 3.4 0l7.1 12.4a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3z'], ['M12 10v4'], ['M12 17h.01', 2.4]],
    'info': [['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'], ['M12 11v5'], ['M12 8h.01', 2.4]],
    'trash': [['M4 7h16'], ['M10 11v6M14 11v6'], ['M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12'], ['M9 7V4h6v3']],
    'download': [['M12 4v11'], ['M7 10l5 5 5-5'], ['M5 20h14']],
    'image': [['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'], ['M4 16l5-5 4 4 2-2 5 5'], ['M16 8.5h.01', 2.6]],
    'sliders': [['M4 7h10M18 7h2M4 17h4M12 17h8'], ['M16 5v4M10 15v4']],
    'sidebar': [['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'], ['M9.5 4v16']],
    'user': [['M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'], ['M4.5 20.5a7.5 7.5 0 0 1 15 0']]
  };

  function Icon(props) {
    var size = props.size || 16;
    var paths = ICONS[props.name] || ICONS['file'];
    return h('svg', {
      className: cx('md-icon', props.className), width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': props.label ? undefined : 'true', role: props.label ? 'img' : undefined, 'aria-label': props.label
    }, paths.map(function (p, i) { return h('path', { key: i, d: p[0], strokeWidth: p[1] }); }));
  }
  Icon.names = Object.keys(ICONS);

  function Wordmark(props) {
    return h('span', { className: cx('md-wordmark', props.size === 'lg' && 'md-wordmark-lg', props.className), 'aria-label': 'md.IT' },
      'md', h('span', { className: 'md-wordmark-dot' }, '.'), 'IT');
  }

  function Button(props) {
    var variant = props.variant || 'secondary';
    var rest = omit(props, ['variant', 'size', 'icon', 'iconRight', 'className', 'children']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('md-btn', 'md-btn-' + variant, props.size === 'sm' && 'md-btn-sm', props.className)
    }),
      props.icon ? h(Icon, { name: props.icon }) : null,
      props.children != null ? h('span', null, props.children) : null,
      props.iconRight ? h(Icon, { name: props.iconRight }) : null);
  }

  function IconButton(props) {
    var rest = omit(props, ['icon', 'label', 'active', 'className', 'size']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('md-iconbtn', props.active && 'is-active', props.size === 'md' && 'md-iconbtn-md', props.className),
      'aria-label': props.label, title: props.label, 'aria-pressed': props.active == null ? undefined : !!props.active
    }), h(Icon, { name: props.icon }));
  }

  function SegmentedControl(props) {
    var init = props.value != null ? props.value : (props.defaultValue != null ? props.defaultValue : (props.options[0] && props.options[0].value));
    var st = useState(init);
    var value = props.value != null ? props.value : st[0];
    return h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': props.label },
      props.options.map(function (o) {
        var on = o.value === value;
        return h('button', {
          key: o.value, type: 'button', role: 'radio', 'aria-checked': on,
          className: cx('md-seg-item', on && 'is-on'),
          onClick: function () { st[1](o.value); if (props.onChange) props.onChange(o.value); }
        }, o.icon ? h(Icon, { name: o.icon }) : null, o.label ? h('span', null, o.label) : null);
      }));
  }

  function Menu(props) {
    return h('div', { className: cx('md-menu', props.className), role: 'menu' },
      props.items.map(function (it, i) {
        if (it === 'separator' || it.separator) return h('div', { key: i, className: 'md-menu-sep', role: 'separator' });
        return h('button', {
          key: i, type: 'button', role: 'menuitem', disabled: it.disabled,
          className: cx('md-menu-item', it.danger && 'is-danger'), onClick: it.onSelect
        },
          h('span', { className: 'md-menu-icon' }, it.icon ? h(Icon, { name: it.icon }) : null),
          h('span', { className: 'md-menu-label' }, it.label),
          it.shortcut ? h('span', { className: 'md-menu-kbd' }, it.shortcut) : null);
      }));
  }

  function Input(props) {
    var rest = omit(props, ['label', 'hint', 'icon', 'className', 'id', 'shortcut']);
    var id = props.id || ('md-in-' + (props.label || props.placeholder || 'x').replace(/\W+/g, '-').toLowerCase());
    return h('label', { className: cx('md-field', props.className), htmlFor: id },
      props.label ? h('span', { className: 'md-field-label' }, props.label) : null,
      h('span', { className: cx('md-input', props.icon && 'has-icon') },
        props.icon ? h(Icon, { name: props.icon }) : null,
        h('input', Object.assign({ id: id }, rest)),
        props.shortcut ? h(Kbd, null, props.shortcut) : null),
      props.hint ? h('span', { className: 'md-field-hint' }, props.hint) : null);
  }

  function RangeField(props) {
    var st = useState(props.value != null ? props.value : (props.defaultValue != null ? props.defaultValue : props.min));
    var v = props.value != null ? props.value : st[0];
    var id = 'md-range-' + props.label.replace(/\W+/g, '-').toLowerCase();
    var pct = ((v - props.min) / (props.max - props.min)) * 100;
    return h('div', { className: 'md-range' },
      h('div', { className: 'md-range-head' },
        h('label', { htmlFor: id, className: 'md-field-label' }, props.label),
        h('output', { htmlFor: id, className: 'md-range-value' }, (props.format ? props.format(v) : v + (props.unit || '')))),
      h('input', {
        id: id, type: 'range', min: props.min, max: props.max, step: props.step || 1, value: v,
        style: { '--pct': pct + '%' },
        onChange: function (e) { var n = parseFloat(e.target.value); st[1](n); if (props.onChange) props.onChange(n); }
      }));
  }

  function TreeItem(props) {
    var isFolder = props.kind === 'folder';
    var depth = props.depth || 0;
    return h('div', {
      className: cx('md-tree-item', props.active && 'is-active', props.dirty && 'is-dirty'),
      role: 'treeitem', 'aria-expanded': isFolder ? !!props.open : undefined, 'aria-selected': !!props.active,
      tabIndex: props.active ? 0 : -1, style: { paddingLeft: 8 + depth * 16 + 'px' }, onClick: props.onClick
    },
      h('span', { className: 'md-tree-chev' }, isFolder ? h(Icon, { name: props.open ? 'chevron-down' : 'chevron-right', size: 14 }) : null),
      h(Icon, { name: isFolder ? (props.open ? 'folder-open' : 'folder') : (props.kind === 'image' ? 'image' : 'file') }),
      h('span', { className: 'md-tree-name' }, props.name),
      props.dirty ? h('span', { className: 'md-tree-dirty', title: 'Changed since last saved version', 'aria-label': 'Changed since last saved version' }) : null);
  }

  var SAVE = {
    saved: { icon: 'check', text: 'Saved locally' },
    saving: { icon: null, text: 'Saving…' },
    failed: { icon: 'alert', text: 'Couldn’t save' },
    cloud: { icon: 'cloud', text: 'Version saved' }
  };
  function SaveStatus(props) {
    var s = SAVE[props.state || 'saved'];
    return h('span', { className: cx('md-save', 'md-save-' + (props.state || 'saved')), role: 'status', 'aria-live': 'polite' },
      s.icon ? h(Icon, { name: s.icon, size: 14 }) : h('span', { className: 'md-save-spin', 'aria-hidden': 'true' }),
      h('span', null, props.children || s.text),
      props.detail ? h('span', { className: 'md-save-detail' }, '· ' + props.detail) : null);
  }

  function VersionItem(props) {
    return h('div', { className: cx('md-version', props.current && 'is-current'), onClick: props.onClick, tabIndex: 0 },
      h('span', { className: 'md-version-num' }, 'v' + props.number),
      h('span', { className: 'md-version-body' },
        h('span', { className: 'md-version-msg' }, props.message || h('em', null, 'No message')),
        h('span', { className: 'md-version-meta' }, props.time)),
      props.current ? h(Badge, { tone: 'accent' }, 'Current') : null);
  }

  function EmptyState(props) {
    return h('div', { className: 'md-empty' },
      props.icon ? h('span', { className: 'md-empty-icon' }, h(Icon, { name: props.icon, size: 20 })) : null,
      h('div', { className: 'md-empty-title' }, props.title),
      props.children ? h('p', { className: 'md-empty-text' }, props.children) : null,
      props.action || null);
  }

  function Prose(props) {
    var rest = omit(props, ['className', 'html', 'children', 'style']);
    var p = Object.assign({}, rest, { className: cx('md-prose', props.className), style: props.style });
    if (props.html != null) p.dangerouslySetInnerHTML = { __html: props.html };
    return h('article', p, props.html != null ? undefined : props.children);
  }

  function CodeBlock(props) {
    var st = useState(false);
    function copy() {
      try { if (navigator.clipboard) navigator.clipboard.writeText(props.code || ''); } catch (e) {}
      st[1](true); setTimeout(function () { st[1](false); }, 1400);
    }
    return h('figure', { className: 'md-code' },
      h('div', { className: 'md-code-bar' },
        props.copyable === false ? h('span') : h('button', { type: 'button', className: 'md-code-copy', onClick: copy, 'aria-label': st[0] ? 'Copied' : 'Copy code' },
          h(Icon, { name: st[0] ? 'check' : 'copy', size: 14 }), h('span', null, st[0] ? 'Copied' : 'Copy')),
        props.language ? h('span', { className: 'md-code-lang' }, props.language) : null),
      h('pre', null, h('code', null, props.children || props.code)));
  }

  var CALLOUT_ICON = { info: 'info', positive: 'check', warning: 'alert', danger: 'alert' };
  function Callout(props) {
    var tone = props.tone || 'info';
    return h('div', { className: cx('md-callout', 'md-callout-' + tone), role: tone === 'danger' ? 'alert' : 'note' },
      h(Icon, { name: CALLOUT_ICON[tone], size: 18 }),
      h('div', { className: 'md-callout-body' },
        props.title ? h('div', { className: 'md-callout-title' }, props.title) : null,
        props.children ? h('div', { className: 'md-callout-text' }, props.children) : null,
        props.actions ? h('div', { className: 'md-callout-actions' }, props.actions) : null));
  }

  function Badge(props) {
    return h('span', { className: cx('md-badge', 'md-badge-' + (props.tone || 'neutral')) }, props.children);
  }

  function Kbd(props) {
    return h('kbd', { className: 'md-kbd' }, props.children);
  }

  function Dialog(props) {
    if (props.open === false) return null;
    var panel = h('div', { className: cx('md-dialog', props.tone === 'danger' && 'is-danger'), role: 'dialog', 'aria-modal': props.inline ? undefined : 'true', 'aria-labelledby': 'md-dialog-title' },
      h('div', { className: 'md-dialog-head' },
        h('h2', { id: 'md-dialog-title', className: 'md-dialog-title' }, props.title),
        props.onClose ? h(IconButton, { icon: 'x', label: 'Close', onClick: props.onClose }) : null),
      h('div', { className: 'md-dialog-body' }, props.children),
      props.actions ? h('div', { className: 'md-dialog-actions' }, props.actions) : null);
    return props.inline ? panel : h('div', { className: 'md-scrim', onClick: function (e) { if (e.target === e.currentTarget && props.onClose) props.onClose(); } }, panel);
  }

  var api = {
    Wordmark: Wordmark, Icon: Icon, Button: Button, IconButton: IconButton, SegmentedControl: SegmentedControl, Menu: Menu,
    Input: Input, RangeField: RangeField, TreeItem: TreeItem, SaveStatus: SaveStatus, VersionItem: VersionItem,
    EmptyState: EmptyState, Prose: Prose, CodeBlock: CodeBlock, Callout: Callout, Badge: Badge, Kbd: Kbd, Dialog: Dialog
  };
  window.MdIt = Object.assign(window.MdIt || {}, api);
})();
