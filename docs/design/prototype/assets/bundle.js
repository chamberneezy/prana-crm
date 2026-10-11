/* @ds-bundle: {"format":4,"namespace":"YogaCRM","components":[{"name":"Button"},{"name":"Input"},{"name":"Checkbox"},{"name":"Choice"},{"name":"LangSwitch"},{"name":"Avatar"},{"name":"StatusChip"},{"name":"Tag"},{"name":"Card"},{"name":"Stat"},{"name":"MembershipCard"},{"name":"MemberRow"},{"name":"ClassTable"},{"name":"Toast"},{"name":"Notice"},{"name":"EmptyState"},{"name":"Sidebar"},{"name":"PageHeader"},{"name":"UpisnicaForm"},{"name":"MemberProfile"}]} */
(function(){
"use strict";
var React = window.React;
var NS = {};
// forms/Button
(function(){
const V = {
    primary: { background: 'var(--primary)', color: '#fff', border: '0', hover: 'var(--primary-hover)', weight: 600 },
    secondary: { background: 'var(--surface-card)', color: 'var(--text-1)', border: '1px solid var(--border-field)', hoverBorder: 'var(--sage)', weight: 500 },
    ghost: { background: 'transparent', color: 'var(--text-2)', border: '0', hover: 'var(--mist)', weight: 500 },
    attention: { background: 'var(--surface-card)', color: 'var(--clay-text)', border: '1px solid var(--terracotta)', hover: 'var(--blush)', weight: 600 },
};
function Button({ variant = 'primary', size = 'md', disabled = false, children, onClick, type = 'button', style }) {
    const [h, setH] = React.useState(false);
    const v = V[variant] || V.primary;
    const pad = size === 'sm' ? '7px 14px' : variant === 'ghost' ? '10px 12px' : '10px 18px';
    return (React.createElement("button", { type: type, disabled: disabled, onClick: onClick, onMouseEnter: () => setH(true), onMouseLeave: () => setH(false), style: {
            fontFamily: 'var(--font-ui)', fontSize: size === 'sm' ? 13 : 14, fontWeight: v.weight,
            minHeight: size === 'sm' ? 32 : 'var(--control-height)', padding: pad, borderRadius: 'var(--radius-md)',
            background: h && !disabled && v.hover ? v.hover : v.background, color: h && variant === 'ghost' ? 'var(--text-1)' : v.color,
            border: v.border, borderColor: h && !disabled && v.hoverBorder ? v.hoverBorder : undefined,
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', ...style,
        } }, children));
}

NS.Button = Button;
})();
// forms/Input
(function(){
function Input({ label, value, defaultValue, onChange, placeholder, error, hint, readOnly = false, multiline = false, rows = 2, type = 'text', style }) {
    const [f, setF] = React.useState(false);
    const Tag = multiline ? 'textarea' : 'input';
    const border = error ? 'var(--terracotta)' : f && !readOnly ? 'var(--border-focus)' : readOnly ? 'var(--border-divider)' : 'var(--border-field)';
    const ring = error ? '0 0 0 3px var(--blush)' : f && !readOnly ? '0 0 0 3px var(--focus-ring)' : 'none';
    return (React.createElement("label", { style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style } },
        label && React.createElement("span", { style: { font: 'var(--text-label)', color: 'var(--text-2)' } }, label),
        React.createElement(Tag, { type: multiline ? undefined : type, rows: multiline ? rows : undefined, value: value, defaultValue: defaultValue, onChange: onChange, placeholder: placeholder, readOnly: readOnly, onFocus: () => setF(true), onBlur: () => setF(false), style: { fontFamily: 'var(--font-ui)', fontSize: 14, color: readOnly ? 'var(--text-2)' : 'var(--text-1)',
                background: readOnly ? 'var(--surface-readonly)' : 'var(--surface-card)', border: '1px solid ' + border, boxShadow: ring,
                borderRadius: 'var(--radius-md)', padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: multiline ? 'vertical' : undefined } }),
        error && React.createElement("span", { style: { fontSize: 12, color: 'var(--text-attention)' } }, error),
        !error && hint && React.createElement("span", { style: { fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)' } }, hint)));
}

NS.Input = Input;
})();
// forms/Checkbox
(function(){
function Checkbox({ checked = false, onChange, children, required = false, invalid = false }) {
    const bd = checked ? 'var(--sage-deep)' : invalid ? 'var(--terracotta)' : 'var(--border-field)';
    return (React.createElement("div", { role: "checkbox", "aria-checked": checked, tabIndex: 0, onClick: () => onChange && onChange(!checked), onKeyDown: e => { if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange && onChange(!checked);
        } }, style: { display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', outline: 'none' } },
        React.createElement("span", { style: { flex: 'none', width: 20, height: 20, boxSizing: 'border-box', borderRadius: 'var(--radius-xs)', border: '1px solid ' + bd,
                background: checked ? 'var(--sage-deep)' : 'var(--surface-card)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, boxShadow: invalid && !checked ? '0 0 0 3px var(--blush)' : 'none' } }, checked ? '✓' : ''),
        React.createElement("span", { style: { font: 'var(--text-small)', color: 'var(--text-2)' } },
            children,
            required && React.createElement("strong", { style: { color: 'var(--text-1)' } }, " Obavezno."))));
}

NS.Checkbox = Checkbox;
})();
// forms/Choice
(function(){
function Choice({ options = [], value, onChange, layout = 'inline', columns = 2 }) {
    const grid = layout === 'grid';
    return (React.createElement("div", { role: "radiogroup", style: grid ? { display: 'grid', gridTemplateColumns: 'repeat(' + columns + ', minmax(0,1fr))', gap: 8 } : { display: 'flex', flexWrap: 'wrap', gap: 6 } }, options.map(o => {
        const sel = o.value === value;
        return (React.createElement("button", { key: String(o.value), type: "button", role: "radio", "aria-checked": sel, onClick: () => onChange && onChange(o.value), style: { fontFamily: 'var(--font-ui)', color: 'var(--text-1)', cursor: 'pointer', borderRadius: 'var(--radius-md)',
                background: sel ? 'var(--surface-selected)' : 'var(--surface-card)', border: '1px solid ' + (sel ? 'var(--border-focus)' : 'var(--border-field)'),
                padding: grid ? '12px 14px' : '9px 16px', textAlign: grid ? 'left' : 'center', display: 'flex', flexDirection: 'column', gap: 4 } },
            React.createElement("span", { style: { fontWeight: 600, fontSize: grid ? 14 : 13 } }, o.label),
            o.sub && React.createElement("span", { style: { fontSize: 12, color: 'var(--text-2)' } }, o.sub)));
    })));
}

NS.Choice = Choice;
})();
// forms/LangSwitch
(function(){
function LangSwitch({ value = 'HR', onChange, dark = false, options = ['HR', 'EN'] }) {
    return (React.createElement("div", { style: { display: 'inline-flex', border: '1px solid ' + (dark ? 'var(--ink-muted)' : 'var(--border-field)'), borderRadius: 'var(--radius-md)', overflow: 'hidden' } }, options.map(l => {
        const sel = l === value;
        return (React.createElement("button", { key: l, type: "button", onClick: () => onChange && onChange(l), style: { border: 0, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, padding: '7px 12px',
                background: sel ? (dark ? 'var(--sage-deep)' : 'var(--mist)') : 'transparent',
                color: sel ? (dark ? '#fff' : 'var(--text-1)') : (dark ? 'var(--field)' : 'var(--text-3)') } }, l));
    })));
}

NS.LangSwitch = LangSwitch;
})();
// data/Avatar
(function(){
function Avatar({ name = '', size = 36 }) {
    const ini = name.trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    return React.createElement("div", { style: { width: size, height: size, borderRadius: '50%', background: 'var(--mist-strong)', color: 'var(--text-1)', flex: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: Math.round(size * 0.34) } }, ini);
}

NS.Avatar = Avatar;
})();
// data/StatusChip
(function(){
const LABEL = { active: 'Aktivna', expiring: 'Ističe uskoro', unpaid: 'Neplaćeno', frozen: 'Zamrznuta', trial: 'Proba' };
function StatusChip({ status = 'active', children }) {
    const trial = status === 'trial';
    return (React.createElement("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: trial ? '4px 9px' : '5px 10px', borderRadius: 'var(--radius-sm)',
            background: 'var(--status-' + status + '-bg)', color: 'var(--status-' + status + '-fg)', border: trial ? '1px dashed var(--sage)' : 0,
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' } },
        !trial && React.createElement("span", { style: { width: 7, height: 7, borderRadius: '50%', background: 'var(--status-' + status + '-dot)' } }),
        children || LABEL[status]));
}

NS.StatusChip = StatusChip;
})();
// data/Tag
(function(){
const K = {
    plan: { background: 'var(--ink)', color: '#fff', border: 0 },
    flag: { background: 'transparent', color: 'var(--sage-ink)', border: '1px dashed var(--sage)' },
    health: { background: 'var(--blush)', color: 'var(--clay-text)', border: 0 },
    neutral: { background: 'var(--mist)', color: 'var(--sage-ink)', border: 0 },
};
function Tag({ kind = 'neutral', children }) {
    const k = K[kind] || K.neutral;
    return React.createElement("span", { style: { display: 'inline-flex', alignItems: 'center', padding: k.border ? '4px 9px' : '5px 10px', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...k } }, children);
}

NS.Tag = Tag;
})();
// data/Card
(function(){
function Card({ padding = 24, title, overline, children, style }) {
    return (React.createElement("div", { style: { background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, boxSizing: 'border-box', ...style } },
        overline && React.createElement("span", { style: { font: 'var(--text-overline)', letterSpacing: 'var(--tracking-overline)', textTransform: 'uppercase', color: 'var(--text-3)' } }, overline),
        title && React.createElement("span", { style: { font: 'var(--text-card-title)', color: 'var(--text-1)' } }, title),
        children));
}

NS.Card = Card;
})();
// data/Stat
(function(){
function Stat({ label, value, attention = false }) {
    const c = attention ? 'var(--text-attention)' : undefined;
    return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } },
        React.createElement("span", { style: { fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, color: c || 'var(--text-3)' } }, label),
        React.createElement("span", { style: { fontFamily: 'var(--font-ui)', fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: c || 'var(--text-1)' } }, value)));
}

NS.Stat = Stat;
})();
// data/MembershipCard
(function(){
function MembershipCard({ plan = '2× tjedno', used = 0, total = 8, renewal, period }) {
    const unlimited = !total;
    const segs = unlimited ? [] : Array.from({ length: total }, (_, i) => i < used);
    return (React.createElement("div", { style: { background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-ui)' } },
        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 } },
            React.createElement("span", { style: { fontWeight: 600, fontSize: 15, color: 'var(--text-1)' } }, plan),
            renewal && React.createElement("span", { style: { padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--amber-bg)', color: 'var(--amber-fg)', fontSize: 11, fontWeight: 600 } },
                "Obnova ",
                renewal)),
        unlimited
            ? React.createElement("div", { style: { height: 8, borderRadius: 9, background: 'var(--sage)' } })
            : React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(' + total + ',1fr)', gap: 3 } }, segs.map((u, i) => React.createElement("span", { key: i, style: { height: 8, borderRadius: 2, background: u ? 'var(--sage)' : 'var(--mist)' } }))),
        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', gap: 8 } },
            React.createElement("span", null, unlimited ? used + ' dolazaka' : used + ' od ' + total + ' iskorišteno'),
            React.createElement("span", null, unlimited ? (period || 'neograničeno') : React.createElement(React.Fragment, null,
                React.createElement("strong", { style: { color: 'var(--text-1)' } }, total - used),
                " preostalo")))));
}

NS.MembershipCard = MembershipCard;
})();
// data/MemberRow
(function(){
var Avatar = NS.Avatar, StatusChip = NS.StatusChip, Tag = NS.Tag;
function MemberRow({ name, sub, note, status = 'active', statusLabel, onClick, compact = false }) {
    const [h, setH] = React.useState(false);
    return (React.createElement("div", { onClick: onClick, onMouseEnter: () => setH(true), onMouseLeave: () => setH(false), style: { display: 'flex', alignItems: 'center', gap: 14, padding: (compact ? 8 : 12) + 'px 16px', borderTop: '1px solid var(--border-divider)',
            background: h ? 'var(--surface-hover)' : 'var(--surface-card)', cursor: onClick ? 'pointer' : 'default', fontFamily: 'var(--font-ui)' } },
        React.createElement(Avatar, { name: name }),
        React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 1, flex: '1 1 140px', minWidth: 120 } },
            React.createElement("strong", { style: { fontWeight: 600, fontSize: 14, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, name),
            sub && React.createElement("span", { style: { fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, sub)),
        React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', flex: '0 1 auto', minWidth: 0 } },
            note && React.createElement(Tag, { kind: "health" }, note),
            React.createElement(StatusChip, { status: status }, statusLabel))));
}

NS.MemberRow = MemberRow;
})();
// data/ClassTable
(function(){
function Row({ c, pad }) {
    const [h, setH] = React.useState(false);
    const full = c.booked >= c.capacity;
    const pct = Math.min(100, Math.round(c.booked / c.capacity * 100));
    return (React.createElement("div", { onMouseEnter: () => setH(true), onMouseLeave: () => setH(false), style: { display: 'flex', alignItems: 'center', gap: 16, padding: pad + 'px 16px', borderTop: '1px solid var(--border-divider)', fontSize: 14, background: h ? 'var(--surface-hover)' : 'transparent' } },
        React.createElement("span", { style: { width: 100, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)', flex: 'none' } }, c.time),
        React.createElement("span", { style: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 } },
            React.createElement("span", { style: { width: 10, height: 22, borderRadius: 999, background: c.color, flex: 'none' } }),
            c.title),
        React.createElement("span", { style: { width: 80, color: 'var(--text-2)', flex: 'none' } }, c.teacher),
        React.createElement("span", { style: { width: 130, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flex: 'none' } },
            React.createElement("span", { style: { width: 56, height: 5, borderRadius: 9, background: 'var(--mist)', overflow: 'hidden', display: 'flex' } },
                React.createElement("span", { style: { width: pct + '%', background: full ? 'var(--terracotta)' : 'var(--sage-deep)' } })),
            React.createElement("span", { style: { fontVariantNumeric: 'tabular-nums', fontWeight: 600 } },
                c.booked,
                "/",
                c.capacity,
                c.waitlist ? ' · +' + c.waitlist : ''))));
}
function ClassTable({ date, classes = [], compact = false }) {
    const head = { font: 'var(--text-overline)', letterSpacing: 'var(--tracking-table-head)', textTransform: 'uppercase', color: 'var(--text-3)' };
    return (React.createElement("div", { style: { background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', fontFamily: 'var(--font-ui)', color: 'var(--text-1)' } },
        date && React.createElement("div", { style: { padding: '14px 16px', fontWeight: 600, fontSize: 15 } }, date),
        React.createElement("div", { style: { display: 'flex', gap: 16, padding: '10px 16px', background: 'var(--header-row)', ...head } },
            React.createElement("span", { style: { width: 100, flex: 'none' } }, "Vrijeme"),
            React.createElement("span", { style: { flex: 1 } }, "Sat"),
            React.createElement("span", { style: { width: 80, flex: 'none' } }, "U\u010Ditelj"),
            React.createElement("span", { style: { width: 130, textAlign: 'right', flex: 'none' } }, "Popunjenost")),
        classes.map((c, i) => React.createElement(Row, { key: i, c: c, pad: compact ? 8 : 12 }))));
}

NS.ClassTable = ClassTable;
})();
// feedback/Toast
(function(){
function Toast({ children, action, onAction }) {
    return (React.createElement("div", { role: "status", style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ink)', color: '#fff', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontFamily: 'var(--font-ui)', fontSize: 13, boxShadow: 'var(--shadow-float)', maxWidth: 440 } },
        React.createElement("span", { style: { width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)', flex: 'none' } }),
        React.createElement("span", { style: { flex: 1 } }, children),
        action && React.createElement("button", { type: "button", onClick: onAction, style: { background: 'none', border: 0, color: 'var(--mist-strong)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 } }, action)));
}

NS.Toast = Toast;
})();
// feedback/Notice
(function(){
function Notice({ title, children }) {
    return (React.createElement("div", { style: { background: 'var(--bg-attention)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-ui)' } },
        title && React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: 'var(--text-attention)' } }, title),
        React.createElement("span", { style: { fontSize: 13, lineHeight: 1.5, color: 'var(--text-1)' } }, children)));
}

NS.Notice = Notice;
})();
// feedback/EmptyState
(function(){
function EmptyState({ title, children, action }) {
    return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start', fontFamily: 'var(--font-ui)' } },
        React.createElement("span", { style: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--text-1)' } }, title),
        children && React.createElement("span", { style: { fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' } }, children),
        action));
}

NS.EmptyState = EmptyState;
})();
// navigation/Sidebar
(function(){
var LangSwitch = NS.LangSwitch;
function Sidebar({ items = [], active, onSelect, logoSrc, lang = 'HR', onLang }) {
    return (React.createElement("nav", { style: { width: 'var(--sidebar-width)', flex: 'none', background: 'var(--bg-sidebar)', color: 'var(--text-on-dark)', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-ui)', boxSizing: 'border-box', alignSelf: 'stretch' } },
        logoSrc && React.createElement("img", { src: logoSrc, alt: "Prana", style: { width: 36, filter: 'brightness(0) invert(0.9)', margin: '0 0 16px 8px' } }),
        items.map(it => {
            const sel = it.id === active;
            return React.createElement("button", { key: it.id, type: "button", onClick: () => onSelect && onSelect(it.id), style: { textAlign: 'left', border: 0, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                    background: sel ? 'var(--sage-deep)' : 'transparent', color: sel ? '#fff' : 'var(--text-on-dark)', fontWeight: sel ? 600 : 400 } }, it.label);
        }),
        React.createElement("div", { style: { marginTop: 'auto', paddingTop: 16 } },
            React.createElement(LangSwitch, { dark: true, value: lang, onChange: onLang }))));
}

NS.Sidebar = Sidebar;
})();
// navigation/PageHeader
(function(){
function PageHeader({ title, children }) {
    return (React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
        React.createElement("h1", { style: { margin: 0, font: 'var(--text-page-title)', color: 'var(--text-1)', flex: 1, minWidth: 160 } }, title),
        children));
}

NS.PageHeader = PageHeader;
})();
// members/UpisnicaForm
(function(){
var Input = NS.Input, Choice = NS.Choice, Checkbox = NS.Checkbox, Button = NS.Button;
const PLANS = [
    { value: '1x', label: '1× tjedno', sub: '≈ 4 dolaska mjesečno', visits: 4 },
    { value: '2x', label: '2× tjedno', sub: '≈ 8 dolazaka mjesečno', visits: 8 },
    { value: '3x', label: '3× tjedno', sub: '≈ 12 dolazaka mjesečno', visits: 12 },
    { value: 'unl', label: 'Neograničeno', sub: 'Svi satovi u rasporedu', visits: 0 },
];
const EMPTY = { name: '', email: '', phone: '', dob: '', student: false, plan: '2x', health: false, healthText: '', consent: false, news: false };
function Section({ n, title, children }) {
    return React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement("div", { style: { fontSize: 13, fontWeight: 600, paddingBottom: 8, borderBottom: '1px solid var(--border-divider)' } },
            n,
            " \u00B7 ",
            title),
        children);
}
function UpisnicaForm({ initial, place = 'Varaždin', date = '10.10.2026.', onChange, onSave, onCancel }) {
    const [v, setV] = React.useState({ ...EMPTY, ...initial });
    const [tried, setTried] = React.useState(false);
    const set = p => { const n = { ...v, ...p }; setV(n); onChange && onChange(n); };
    const t = k => e => set({ [k]: e.target.value });
    const save = () => { setTried(true); if (v.consent && v.name.trim())
        onSave && onSave(v); };
    return (React.createElement("div", { style: { background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 26, fontFamily: 'var(--font-ui)', color: 'var(--text-1)', boxSizing: 'border-box' } },
        React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            React.createElement("div", { style: { font: 'var(--text-card-title)' } }, "Prijava za \u010Dlanstvo"),
            React.createElement("p", { style: { margin: 0, font: 'var(--text-small)', color: 'var(--text-2)' } }, "Drago nam je \u0161to nam se pridru\u017Eujete. Nekoliko kratkih podataka kako bismo vas bolje upoznali i osigurali ugodno i sigurno vje\u017Ebanje.")),
        React.createElement(Section, { n: "01", title: "Va\u0161i podaci" },
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 } },
                React.createElement(Input, { label: "Ime i prezime", value: v.name, onChange: t('name'), error: tried && !v.name.trim() ? 'Upišite ime i prezime.' : undefined, style: { gridColumn: '1 / -1' } }),
                React.createElement(Input, { label: "E-mail", type: "email", value: v.email, onChange: t('email') }),
                React.createElement(Input, { label: "Broj mobitela", value: v.phone, onChange: t('phone') }),
                React.createElement(Input, { label: "Datum ro\u0111enja", placeholder: "dd.mm.gggg.", value: v.dob, onChange: t('dob') }),
                React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                    React.createElement("span", { style: { font: 'var(--text-label)', color: 'var(--text-2)' } }, "Student / umirovljenik?"),
                    React.createElement(Choice, { value: v.student, onChange: x => set({ student: x }), options: [{ value: false, label: 'NE' }, { value: true, label: 'DA' }] })))),
        React.createElement(Section, { n: "02", title: "Odaberite \u010Dlanstvo" },
            React.createElement(Choice, { layout: "grid", columns: 2, value: v.plan, onChange: x => set({ plan: x }), options: PLANS })),
        React.createElement(Section, { n: "03", title: "Va\u017Eno za va\u0161u praksu" },
            React.createElement("p", { style: { margin: 0, font: 'var(--text-small)', color: 'var(--text-2)' } }, "Postoji li ne\u0161to \u0161to bi u\u010Ditelj trebao znati (npr. zdravstveni problemi vezani uz odre\u0111ene vje\u017Ebe i polo\u017Eaje)?"),
            React.createElement(Choice, { value: v.health, onChange: x => set({ health: x }), options: [{ value: false, label: 'Ne' }, { value: true, label: 'Da, molimo navedite' }] }),
            v.health && React.createElement(Input, { label: "Molimo navedite", multiline: true, value: v.healthText, onChange: t('healthText') }),
            React.createElement("span", { style: { fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)' } }, "Odnosi se samo na okolnosti va\u017Ene za sigurno vje\u017Ebanje. Vidi ga samo u\u010Ditelj na popisu sata.")),
        React.createElement(Section, { n: "04", title: "Suglasnosti" },
            React.createElement(Checkbox, { checked: v.consent, onChange: x => set({ consent: x }), required: true, invalid: tried && !v.consent }, "Potvr\u0111ujem da su navedeni podaci to\u010Dni i da \u0107u u\u010Ditelja obavijestiti o okolnostima koje mogu utjecati na moje sigurno vje\u017Ebanje."),
            React.createElement(Checkbox, { checked: v.news, onChange: x => set({ news: x }) }, "\u017Delim primati obavijesti o rasporedu, radionicama i novostima studija putem e-maila.")),
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, alignItems: 'end' } },
            React.createElement(Input, { label: "Mjesto i datum", readOnly: true, value: place + ', ' + date }),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                React.createElement("span", { style: { font: 'var(--text-label)', color: 'var(--text-2)' } }, "Potpis"),
                React.createElement("div", { style: { height: 64, border: '1px solid var(--border-field)', borderRadius: 'var(--radius-md)', background: 'var(--surface-readonly)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '8px 14px', boxSizing: 'border-box', gap: 8 } },
                    React.createElement("span", { style: { font: 'var(--text-signature)', whiteSpace: 'nowrap', overflow: 'hidden' } }, v.name),
                    React.createElement("span", { style: { fontSize: 11, color: 'var(--text-3)', flex: 'none' } }, "potpis na tabletu")))),
        React.createElement("div", { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
            React.createElement(Button, { onClick: save, disabled: !v.consent }, "Spremi \u010Dlana"),
            React.createElement(Button, { variant: "ghost", onClick: onCancel }, "Odustani"),
            !v.consent && React.createElement("span", { style: { marginLeft: 'auto', fontSize: 12, color: 'var(--text-attention)' } }, "Potrebna je potvrda to\u010Dnosti podataka"))));
}

NS.PLANS = PLANS;
NS.UpisnicaForm = UpisnicaForm;
})();
// members/MemberProfile
(function(){
var Avatar = NS.Avatar, StatusChip = NS.StatusChip, Tag = NS.Tag, Button = NS.Button;
const PLAN = { '1x': '1× tjedno', '2x': '2× tjedno', '3x': '3× tjedno', unl: 'Neograničeno' };
function age(dob) {
    const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(dob || '');
    if (!m)
        return '';
    const n = new Date(), b = new Date(+m[3], +m[2] - 1, +m[1]);
    let a = n.getFullYear() - b.getFullYear();
    if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()))
        a--;
    return isNaN(a) ? '' : ' (' + a + ')';
}
function Field({ label, children }) {
    return React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } },
        React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: 'var(--text-3)' } }, label),
        React.createElement("span", { style: { fontSize: 14, color: 'var(--text-1)', overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' } }, children || '—'));
}
function MemberProfile({ member = {}, status = 'active', since = '10.10.2026.', onEdit }) {
    const m = member;
    return (React.createElement("div", { style: { background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--font-ui)', color: 'var(--text-1)', boxSizing: 'border-box' } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' } },
            React.createElement(Avatar, { name: m.name || '?', size: 52 }),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 160 } },
                React.createElement("span", { style: { font: 'var(--text-card-title)' } }, m.name || 'Novi član'),
                React.createElement("span", { style: { fontSize: 13, color: 'var(--text-2)' } },
                    "\u010Clan od ",
                    since,
                    m.consent ? ' · upisnica potpisana' : '')),
            onEdit && React.createElement(Button, { variant: "secondary", size: "sm", onClick: onEdit }, "Uredi")),
        React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
            React.createElement(StatusChip, { status: status }),
            m.plan && React.createElement(Tag, { kind: "plan" }, PLAN[m.plan] || m.plan),
            m.student && React.createElement(Tag, { kind: "flag" }, "Student / umirovljenik"),
            m.news && React.createElement(Tag, { kind: "neutral" }, "Newsletter")),
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, paddingTop: 16, borderTop: '1px solid var(--border-divider)' } },
            React.createElement(Field, { label: "E-mail" }, m.email),
            React.createElement(Field, { label: "Mobitel" }, m.phone),
            React.createElement(Field, { label: "Datum ro\u0111enja" }, m.dob ? m.dob + age(m.dob) : '')),
        m.health
            ? React.createElement("div", { style: { background: 'var(--bg-attention)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 } },
                React.createElement("span", { style: { fontSize: 12, fontWeight: 600, color: 'var(--text-attention)' } }, "Va\u017Eno za praksu \u00B7 vidi u\u010Ditelj"),
                React.createElement("span", { style: { fontSize: 14, lineHeight: 1.5 } }, m.healthText || '—'))
            : React.createElement("span", { style: { fontSize: 13, color: 'var(--text-2)' } }, "Nema napomena za praksu."),
        React.createElement("div", { style: { display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-2)', borderTop: '1px solid var(--border-divider)', paddingTop: 14 } },
            React.createElement("span", null, m.consent ? '✓ Podaci potvrđeni · potpisano ' + since : '○ Čeka potvrdu podataka'),
            React.createElement("span", null, m.news ? '✓ Prima e-mail obavijesti' : '○ Ne prima e-mail obavijesti'))));
}

NS.MemberProfile = MemberProfile;
})();

window.YogaCRM = NS;
})();
