# ember-nav-stack

This addon is used by Yapp to blend mobile-style stack navigation with Ember routing. It draws heavy inspiration from ember-elsewhere.

This addon's current status is "opensource, but unpolished". It lacks tests, docs, and other niceties of a well-maintained Ember addon.

Compatibility
------------------------------------------------------------------------------

* Ember.js v3.24 or above
* Ember CLI v3.24 or above
* Node.js v12 or above


Installation
------------------------------------------------------------------------------

```
ember install ember-nav-stack
```


Usage
------------------------------------------------------------------------------

[Longer description of how to use the addon in apps.]

Testing
------------------------------------------------------------------------------

`ember-nav-stack` registers waiters for stack recomputes and transition animations. Ember's built-in test helpers such as `visit` and `click` wait for these operations automatically, so downstream apps should not need custom "nav stack idle" helpers or manual `waitFor` calls.


Contributing
------------------------------------------------------------------------------

See the [Contributing](CONTRIBUTING.md) guide for details.


License
------------------------------------------------------------------------------

This project is licensed under the [MIT License](LICENSE.md).
