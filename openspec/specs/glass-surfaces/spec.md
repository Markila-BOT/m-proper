# glass-surfaces Specification

## Purpose

Defines the Liquid Glass material as a bounded, measured property: where glass may appear, what job it carries, how text stays legible over it, and how it degrades when the browser or the reader refuses it.

## Requirements

### Requirement: Glass carries a job at every location

Glass MAY appear only on the shell header and navigation (persistent chrome over content) and on sheets and popovers (occlusion of the surface behind). No glass element MUST contain a scrolling descendant; glass chrome MUST be fixed or sticky with visible overflow, and a scrolling subtree inside a glass sheet or popover MUST sit on an opaque panel.

#### Scenario: A scrolling subtree inside a glass sheet gets an opaque panel

```gherkin
Given a sheet renders glass chrome with a scrolling region inside it
When the region scrolls
Then the scrolling content sits on an opaque panel
And no glass element in the page has a scrolling descendant
```

### Requirement: Text is legible on the surface it lands on

Body copy, table numerals, and ledger figures MUST sit on an opaque content panel and meet 4.5:1 (3:1 for large text) against that panel. Chrome labels and navigation text MAY sit on glass and MUST meet 4.5:1 against the worst-case rendered composite behind the glass. Borders, highlights, and icons MUST meet 3:1 against their surface.

#### Scenario: Every text class meets its floor on its own surface

```gherkin
Given the glass world is rendered with content behind every glass surface
When the rendered pair is measured for body text, chrome labels, and non-text marks
Then body and figure text meets 4.5:1 against its content panel
And chrome labels meet 4.5:1 against the worst-case composite behind the glass
And borders, highlights, and icons meet 3:1
```

### Requirement: Glass degrades legibly when refused

When the reader or the browser refuses the material, the surface MUST remain legible: an opaque tint under reduced transparency, an opaque tint with a solid border where backdrop-filter is unsupported, system colors with preserved borders under forced colors, and gated travel under reduced motion. Under forced colors combined with no backdrop-filter support, the surface MUST render as an opaque panel with a solid system border.

#### Scenario Outline: The surface stays legible under each refusal

```gherkin
Given the reader's environment refuses <condition>
When the glass world renders
Then the surface shows <fallback>
And every text class still meets its floor
Examples:
  | condition                  | fallback                                   |
  | reduced transparency       | an opaque tint, no translucency            |
  | no backdrop-filter support | an opaque tint with a solid border         |
  | forced colors              | system colors with borders preserved       |
  | reduced motion             | travel gated, opacity cross-fade retained  |
  | forced colors and no backdrop-filter | an opaque panel with a solid system border |
```
