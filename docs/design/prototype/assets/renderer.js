/* Minimal standalone renderer for the canvas's .dc.html artboards.
   Reads <template id="tpl"> (markup with {{holes}}, sc-for / sc-if converted to <template data-sc>)
   and the page's `Component` class, and renders them with React + the YogaCRM design-system bundle. */
(function () {
  var h = React.createElement;

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  function interp(str, scope) {
    return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, p) {
      var v = lookup(p, scope);
      return v == null ? '' : String(v);
    });
  }
  function attrValue(str, scope) {
    var m = str.match(WHOLE);
    if (m) return lookup(m[1], scope);
    return interp(str, scope);
  }
  function camel(s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }
  function parseStyle(str) {
    var out = {};
    str.split(';').forEach(function (decl) {
      var i = decl.indexOf(':');
      if (i < 0) return;
      var k = decl.slice(0, i).trim();
      var v = decl.slice(i + 1).trim();
      if (!k) return;
      out[k.indexOf('--') === 0 ? k : camel(k)] = v;
    });
    return out;
  }
  var EVENTS = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onsubmit: 'onSubmit' };
  var HTML_ATTRS = { 'class': 'className', 'for': 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', colspan: 'colSpan', rowspan: 'rowSpan', maxlength: 'maxLength', autocomplete: 'autoComplete' };

  function fixHref(v) {
    if (typeof v !== 'string') return v;
    return v.replace(/\.dc\.html$/, '.html');
  }
  function fixSrc(v) {
    if (typeof v !== 'string') return v;
    return v.indexOf('/_blob/') === 0 ? 'assets/prana-mark.png' : v;
  }

  function convertChildren(nodes, scope, keyBase) {
    var out = [];
    Array.prototype.forEach.call(nodes, function (n, i) {
      var r = convert(n, scope, keyBase + '.' + i);
      if (r == null) return;
      if (Array.isArray(r)) out.push.apply(out, r); else out.push(r);
    });
    return out;
  }

  function convert(node, scope, key) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      if (!/\S/.test(t)) return t.indexOf('\n') >= 0 ? null : t;
      var m = t.match(WHOLE);
      if (m) { var v = lookup(m[1], scope); return v == null ? null : (typeof v === 'object' ? v : String(v)); }
      return interp(t, scope);
    }
    if (node.nodeType !== 1) return null;
    var tag = node.tagName.toLowerCase();

    if (tag === 'template' && node.getAttribute('data-sc') === 'for') {
      var list = attrValue(node.getAttribute('list') || '', scope) || [];
      var as = node.getAttribute('as') || 'item';
      var res = [];
      list.forEach(function (item, idx) {
        var s = Object.create(scope);
        s[as] = item; s.$index = idx;
        res.push(h(React.Fragment, { key: key + ':' + idx }, convertChildren(node.content.childNodes, s, key + ':' + idx)));
      });
      return res;
    }
    if (tag === 'template' && node.getAttribute('data-sc') === 'if') {
      var cond = attrValue(node.getAttribute('value') || '', scope);
      if (!cond) return null;
      return h(React.Fragment, { key: key }, convertChildren(node.content.childNodes, scope, key));
    }

    var props = { key: key };
    var isSvg = node.namespaceURI === 'http://www.w3.org/2000/svg';
    var type = tag;
    if (tag === 'x-import') {
      var path = node.getAttribute('component-from-global-scope');
      type = path.split('.').reduce(function (o, k) { return o && o[k]; }, window);
      if (!type) return h('span', { key: key, style: { color: 'red' } }, '[missing ' + path + ']');
    }
    Array.prototype.forEach.call(node.attributes, function (a) {
      var name = a.name;
      if (tag === 'x-import' && name === 'component-from-global-scope') return;
      var raw = a.value;
      if (name === 'style') {
        var st = parseStyle(interp(raw, scope));
        if (tag === 'x-import') { props.style = Object.assign({}, props.style || {}, st); }
        else props.style = st;
        return;
      }
      var val = attrValue(raw, scope);
      if (tag === 'x-import') {
        props[camel(name)] = fixSrc(val);
        return;
      }
      if (EVENTS[name]) { props[EVENTS[name]] = val; return; }
      if (name === 'href') val = fixHref(val);
      if (name === 'src') val = fixSrc(val);
      if (name.indexOf('aria-') === 0 || name.indexOf('data-') === 0) { props[name] = val; return; }
      if (HTML_ATTRS[name]) { props[HTML_ATTRS[name]] = val; return; }
      props[isSvg ? camel(name) : name] = val;
    });
    if (tag === 'x-import' && props.style && type !== 'x') {
      // style on x-import only places the slot: wrap the component.
      var slotStyle = props.style; delete props.style;
      var kids0 = convertChildren(node.childNodes, scope, key);
      var inner = h(type, Object.assign({}, props, { key: undefined }), kids0.length ? kids0 : undefined);
      if (type === window.YogaCRM.Button) {
        return h(type, Object.assign({}, props, { style: slotStyle }), kids0.length ? kids0 : undefined);
      }
      return h('div', { key: key, style: slotStyle }, inner);
    }
    var kids = convertChildren(node.childNodes, scope, key);
    if (tag === 'input' || tag === 'img' || tag === 'br' || tag === 'hr') return h(type, props);
    return h(type, props, kids.length ? kids : undefined);
  }

  window.DCLogic = window.DCLogic || function () {};

  function Host(props) {
    React.Component.call(this, props);
    var self = this;
    var logic = new Component({});
    logic.props = logic.props || {};
    logic.state = logic.state || {};
    logic.setState = function (p) {
      logic.state = Object.assign({}, logic.state, typeof p === 'function' ? p(logic.state) : p);
      self.forceUpdate();
    };
    logic.forceUpdate = function () { self.forceUpdate(); };
    this.logic = logic;
  }
  Host.prototype = Object.create(React.Component.prototype);
  Host.prototype.constructor = Host;
  Host.prototype.render = function () {
    var vals = this.logic.renderVals ? this.logic.renderVals() : {};
    var tpl = document.getElementById('tpl');
    var kids = convertChildren(tpl.content.childNodes, vals, 'r');
    return h(React.Fragment, null, kids);
  };

  ReactDOM.createRoot(document.getElementById('root')).render(h(Host));
})();
