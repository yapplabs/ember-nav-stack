// Tracks groups of cloned DOM nodes so they can be removed from the document
// as a unit. NavStack creates four groups during its animations:
//
//   - 'stackItems'           — the last item cloned for a slideBack
//   - 'headers'              — the leaving header cloned for slide animations
//   - 'elements'             — the whole NavStack cloned for slideDown
//   - 'gestureBackOverlays'  — target-header snapshot during a back-swipe
//                              (lifecycle described in PR #79's commit body)
//
// The store doesn't know how to CREATE the clones — callers do the
// `.cloneNode(true)` + attach themselves and pass the result to `track()`.
// What the store provides is uniform cleanup (`remove()`, `clear()`,
// `clearAll()`) with a `parentNode?.removeChild` guard so a clone whose
// parent has already been removed from the DOM is dropped silently rather
// than throwing.
export default class CloneStore {
  #groups = new Map();

  // Records `clone` under `groupName`. The same clone can appear in only one
  // group; tracking it twice in the same group is a no-op.
  track(groupName, clone) {
    if (!clone) {
      return;
    }
    let group = this.#groups.get(groupName);
    if (!group) {
      group = [];
      this.#groups.set(groupName, group);
    }
    if (group.indexOf(clone) === -1) {
      group.push(clone);
    }
  }

  // Removes a specific clone from a group AND from the DOM. Safe to call
  // when the clone has already been detached.
  remove(groupName, clone) {
    if (!clone) {
      return;
    }
    let group = this.#groups.get(groupName);
    if (group) {
      let idx = group.indexOf(clone);
      if (idx !== -1) {
        group.splice(idx, 1);
      }
    }
    if (clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
  }

  // Removes every clone in a group from the DOM and empties the group.
  // Safe to call when the group doesn't exist yet.
  clear(groupName) {
    let group = this.#groups.get(groupName);
    if (!group) {
      return;
    }
    let clone;
    while ((clone = group.pop())) {
      if (clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
    }
  }

  // Clears every group. Used in NavStack's willDestroy to sweep anything
  // left over from abandoned transitions.
  clearAll() {
    for (let groupName of this.#groups.keys()) {
      this.clear(groupName);
    }
  }

  // Convenience for reading "the most recently tracked clone in this group"
  // — used by NavStack's slideDown which needs the cloned-NavStack element
  // it just produced. Returns undefined for empty/missing groups.
  last(groupName) {
    let group = this.#groups.get(groupName);
    return group?.[group.length - 1];
  }
}
