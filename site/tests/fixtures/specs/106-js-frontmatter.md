---js
{ budget_usd: 6 * 7 }
---
Fixture spec whose front matter is JavaScript. If gray-matter ran it, the budget would read as
42. The budget reader must refuse to run it and return null instead.
