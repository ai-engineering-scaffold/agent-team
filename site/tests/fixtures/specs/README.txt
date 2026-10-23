Fixture specs for site/tests/ledger/spend-line.test.ts, so the budget helper is tested without
depending on the real specs/ folder. 101 has a budget, 102 has none, 103 has one that is not a
number, 105 has a negative one, and 104 has two matching files, so its budget is ambiguous.
