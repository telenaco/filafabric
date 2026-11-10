# Pull request template

Copy this into every pull request description. Pull requests go into the `library` branch, never into `main`. It can also be added to the repository as `.github/pull_request_template.md`, in the first PR (T0.0), with the reviewer's agreement.

---

## T<ticket> <title>

**Ticket:** link to the ticket section in the implementation pack.
**Cloudflare preview:** link to the branch preview.

### What this does
<!-- Two or three sentences in plain language: what changed for the user or for the code, and why. -->

### Done in this PR
- [ ] <each item from the ticket's Implementation list>

### Not done, or done differently
<!-- Anything from the ticket left out or changed, with the reason. Decisions taken, including [call] defaults used. -->

### Tests
- New or changed test files:
- `npm test` result (paste the summary line):
- Snapshot changes (`npm run snapshots`): none / list each card and preset, with why it changed:

### Construction report (generation tickets)
<!-- For each new or changed card at default settings on 100 × 100 mm:
     families, lost families, components without ties, ties, crossings by type, Z envelope. -->

### Browser check
- Screenshots: desktop / phone, the card face, the open panel, the side view, the 3D preview
- Console errors: none / list
- Old link checked (if IDs or keys changed): which link, and the result

### Performance
<!-- Generation time for a 100 × 100 mm default swatch, if this PR touches generation. -->

### Reviewer checklist
I have gone through [04_Review/Review_Checklist.md](Review_Checklist.md): yes / exceptions:
