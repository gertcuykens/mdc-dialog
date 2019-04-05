var candidateSelectors = [
  'input',
  'select',
  'textarea',
  'a[href]',
  'button',
  '[tabindex]',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
];
var candidateSelector = candidateSelectors.join(',');

var matches = typeof Element === 'undefined'
  ? function (select:string) { select; return false}
  : Element.prototype.matches || Element.prototype.webkitMatchesSelector; // || Element.prototype.msMatchesSelector

interface Unshift extends NodeListOf<Element>{
  unshift(el: Element):any;
}
function tabbable(el:Element, options:any) {
  options = options || {};

  var elementDocument = el.ownerDocument; // || el;
  if (!elementDocument) return []

  var regularTabbables = [];
  var orderedTabbables = [];

  var untouchabilityChecker = new UntouchabilityChecker (elementDocument);
  var candidates = (el.querySelectorAll(candidateSelector)) as Unshift;

  if (options.includeContainer) {
    if (matches.call(el, candidateSelector)) {
      candidates = (Array.prototype.slice.apply(candidates)) as any as Unshift;
      candidates.unshift(el);
    }
  }

  var i, candidate, candidateTabindex;
  for (i = 0; i < candidates.length; i++) {
    candidate = candidates[i];

    if (!isNodeMatchingSelectorTabbable(candidate, untouchabilityChecker)) continue;

    candidateTabindex = getTabindex(candidate);
    if (candidateTabindex === 0) {
      regularTabbables.push(candidate);
    } else {
      orderedTabbables.push({
        documentOrder: i,
        tabIndex: candidateTabindex,
        node: candidate,
      });
    }
  }

  var tabbableNodes = orderedTabbables
    .sort(sortOrderedTabbables)
    .map(function(a) { return a.node })
    .concat(regularTabbables);

  return tabbableNodes;
}

tabbable.isTabbable = isTabbable;
tabbable.isFocusable = isFocusable;

function isNodeMatchingSelectorTabbable(node:any, untouchabilityChecker:UntouchabilityChecker) {
  if (
    !isNodeMatchingSelectorFocusable(node, untouchabilityChecker)
    || isNonTabbableRadio(node)
    || getTabindex(node) < 0
  ) {
    return false;
  }
  return true;
}

function isTabbable(node:Element, untouchabilityChecker:any) {
  if (!node) throw new Error('No node provided');
  if (matches.call(node, candidateSelector) === false) return false;
  return isNodeMatchingSelectorTabbable(node, untouchabilityChecker);
}

interface ElementDisabled extends Element{
  disabled:Boolean
}
function isNodeMatchingSelectorFocusable(node:ElementDisabled, untouchabilityChecker:UntouchabilityChecker) {
  var doc = node.ownerDocument
  if (!doc) return false
  untouchabilityChecker = untouchabilityChecker || new UntouchabilityChecker(doc); // || node
  if (
    node.disabled
    || isHiddenInput(node)
    || untouchabilityChecker.isUntouchable(node)
  ) {
    return false;
  }
  return true;
}

var focusableCandidateSelector = candidateSelectors.concat('iframe').join(',');
export function isFocusable(node:any, untouchabilityChecker:any) {
  if (!node) throw new Error('No node provided');
  if (matches.call(node, focusableCandidateSelector) === false) return false;
  return isNodeMatchingSelectorFocusable(node, untouchabilityChecker);
}

function getTabindex(node:any) {
  var tabindexAttr = parseInt(node.getAttribute('tabindex'), 10);
  if (!isNaN(tabindexAttr)) return tabindexAttr;
  // Browsers do not return `tabIndex` correctly for contentEditable nodes;
  // so if they don't have a tabindex attribute specifically set, assume it's 0.
  if (isContentEditable(node)) return 0;
  return node.tabIndex;
}

function sortOrderedTabbables(a:any, b:any) {
  return a.tabIndex === b.tabIndex ? a.documentOrder - b.documentOrder : a.tabIndex - b.tabIndex;
}

// Array.prototype.find not available in IE.
function find(list:any, predicate:any) {
  for (var i = 0, length = list.length; i < length; i++) {
    if (predicate(list[i])) return list[i];
  }
}

function isContentEditable(node:any) {
  return node.contentEditable === 'true';
}

function isInput(node:any) {
  return node.tagName === 'INPUT';
}

function isHiddenInput(node:any) {
  return isInput(node) && node.type === 'hidden';
}

function isRadio(node:any) {
  return isInput(node) && node.type === 'radio';
}

function isNonTabbableRadio(node:any) {
  return isRadio(node) && !isTabbableRadio(node);
}

interface Radio extends Node{
  checked: Boolean
}

function getCheckedRadio(nodes:NodeListOf<Radio>) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].checked) {
      return nodes[i];
    }
  }
  return
}

interface Node extends Element{
  name:string
}

function isTabbableRadio(node:Node) {
  if (!node.name) return true;
  // This won't account for the edge case where you have radio groups with the same
  // in separate forms on the same page.
  var doc = node.ownerDocument
  if(!doc) return false
  var radioSet = doc.querySelectorAll('input[type="radio"][name="' + node.name + '"]');
  var checked = getCheckedRadio((radioSet) as NodeListOf<Radio>);
  return !checked || checked === node;
}

// An element is "untouchable" if *it or one of its ancestors* has
// `visibility: hidden` or `display: none`.
interface UntouchabilityChecker {
  doc: Document
  cache: Array<any>
  hasDisplayNone: (node:Element, nodeComputedStyle:any) => any
  isUntouchable: (node:any) => any
  prototype: any
}

var UntouchabilityChecker = function (this:UntouchabilityChecker, elementDocument:Document) {
  this.doc = elementDocument;
  // Node cache must be refreshed on every check, in case
  // the content of the element has changed. The cache contains tuples
  // mapping nodes to their boolean result.
  this.cache = [];
} as any as  { new (elementDocument:Document): UntouchabilityChecker };

// getComputedStyle accurately reflects `visibility: hidden` of ancestors
// but not `display: none`, so we need to recursively check parents.
UntouchabilityChecker.prototype.hasDisplayNone = function hasDisplayNone(node:Element, nodeComputedStyle:any) {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;

    // Search for a cached result.
    var cached = find(this.cache, function(item:any) {
      return item === node;
    });
    if (cached) return cached[1];

    nodeComputedStyle = nodeComputedStyle || this.doc.defaultView.getComputedStyle(node);

    var result = false;

    if (nodeComputedStyle.display === 'none') {
      result = true;
    } else if (node.parentNode) {
      result = this.hasDisplayNone(node.parentNode);
    }

    this.cache.push([node, result]);

    return result;
}

UntouchabilityChecker.prototype.isUntouchable = function isUntouchable(node:any) {
  if (node === this.doc.documentElement) return false;
  var computedStyle = this.doc.defaultView.getComputedStyle(node);
  if (this.hasDisplayNone(node, computedStyle)) return true;
  return computedStyle.visibility === 'hidden';
}

export default tabbable;
