We generate seed phrase, private key etc. in the fronten. This isn't
theoretically optimal because the process could be distrubed by the user closing
the popup.

We could move it to a background worker but this is extremely complicated
because we use ASM but also because the cardano-serialization package uses
certain paradigms that aren't directly supported in a chrome extension.

In short: caradno-serialization isn't built for extensions so we would need to
make workarounds. I lack the deep chrome extension API knowledge to do it. You
probably could use offscreen API, I tried and failed in a timely matter.

So for now, we do it in the frontend.