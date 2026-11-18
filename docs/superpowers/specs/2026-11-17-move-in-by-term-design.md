# Move-in by term and length of stay

Date: 2026-11-17 · Status: design approved by the owner in chat ("yes, i approve, write the spec and plan")

## Why

Students plan housing around school terms, not calendar months, and most stay 4 or 8 months (one or two terms). The first screen asks for a move-in month with a date picker and asks about bedrooms, which belongs with the other filters. A 12-month lease is still an option for a student who needs less time, but it means subletting the rest, and the app should say so.

## Goals

- Move-in is chosen as a term (Winter, Summer, Fall + year), the same terms student profiles already use.
- Students say how long they need: 4 months, 8 months, 8+ months, or Any.
- Listings say when they start and how long the lease is, in terms students recognise, and flag a lease longer than the student needs.
- The first screen asks only budget, term and length; bedrooms move to the side filter only.

## Non-goals

- No change to student profiles (they already use terms), the Students tab or the database.
- Lease lengths stay 4, 8 or 12 months; no new lengths.
- No subletting feature; only the note that subletting would be needed.

## Terms

- Winter = January–April, Summer = May–August, Fall = September–December. The value format is the one profiles use, `YYYY-season` (for example `2027-fall`), with labels from `termLabel` ("Fall 2027").
- The choices offered are `upcomingTerms(today)`: the next six terms, starting with the next one.

## Screens

**First screen (Welcome):** budget (unchanged), then

- "Which term do you move in?": a select with "Not sure yet" and the six terms.
- "For how long?": four chips in this order: "Any", "4 months", "8 months", "8+ months". Default "Any".
- The "How many bedrooms?" question is removed.

**Side filter (results page, laptop sidebar and phone drawer):** the "Moving in" group replaces "Only show places available by [month]" with the same term select (labelled "Term", with "Any term") and the same four length chips (labelled "How long"). Bedrooms stay where they are.

**Filter chips above the results:** "Moving in Fall 2027" and "4 months" / "8 months" / "8+ months", each removable.

**Listings:**

- Card: a line "From Fall 2027 · 12 months".
- Listing page: "Starts" shows "Fall 2027 (September)"; "Lease" shows "12 months (3 terms)".
- Compare: an "Starts" row ("Fall 2027") replaces "Available from"; "Lease" stays.
- When the lease is longer than the student asked for (4 months chosen and an 8- or 12-month lease, or 8 months chosen and a 12-month lease), the card and listing page add: "12-month lease · you'd sublet the last 8 months". No note for "Any" or "8+ months".

## Which listings show

- **Term:** the listing starts in the chosen term (its start month falls in that term). "Not sure yet" / "Any term" shows every start.
- **Length:**

  | Chosen | 4-month lease | 8-month lease | 12-month lease |
  |---|---|---|---|
  | Any | shown | shown | shown |
  | 4 months | shown | shown, sublet note | shown, sublet note |
  | 8 months | hidden | shown | shown, sublet note |
  | 8+ months | hidden | shown | shown |

- Order is unchanged (cheapest first).

## Sample data

The 6 listings that start in December 2026 move to January 2027 (Winter 2027). Every listing then starts in January, May or September. All other listing fields stay exactly the same.

## Saved filters

Filters are kept in the browser and, for signed-in students, in their account (`user_state.filters`, JSON). An old "available by" month is converted to the term containing it (for example `2027-01` → Winter 2027); length starts as "Any". Anything unrecognised is dropped. No database change.

## Testing

- Unit: month → term; term matching; the length table above, including the sublet note text; old saved filters converted; unknown values dropped.
- Component: the Welcome screen has no bedroom question and saves term and length; the side filter changes the results; chips remove each filter; card, listing page and Compare show start and length; the sublet note appears only in the cases above.
- Browser in demo mode at 375 px and 1280 px: the Welcome flow, the side filter on a laptop and in the phone drawer, no sideways scroll, no console errors.
