| Term | Definition | Use When | Avoid |
| --- | --- | --- | --- |
| Payment reminder | A property-linked recurring obligation, such as realty tax, whose due dates and amounts are tracked until paid. | Describing the trackable obligation itself. | "Bill", "subscription" |
| Occurrence | One due date of a payment reminder, carrying an expected amount and a pending, paid, or skipped status. | Referring to a single scheduled due date. | "Instance", "installment" |
| Payment label | A settings-managed name for a kind of payment (for example, Realty Tax) that can map to a ledger category. | Naming the picklist entry or the reminder's kind. | "Tag", "type" (reserved for other meanings) |
| Expected amount | The amount an occurrence is due for on its date; editable per occurrence so 2026 can differ from 2027. | Describing the scheduled price before payment. | "Due price" |
| Paid amount | The amount actually paid for an occurrence, defaulting to the expected amount, recorded with its paid date. | Describing the actual payment in the history. | "Actual price" |
| Recurrence | The rule — monthly, quarterly, annual, or one-off — that generates occurrences from an anchor date and due day. | Describing how dates are generated. | "Schedule" (the schedule is the generated result) |
| Due day | The day of the month an occurrence falls due; it clamps to the month's last day. | Describing the monthly anchor. | "Payment date" |
| Overdue | A pending occurrence whose due date has passed; an in-app state, never a transaction. | Describing the reminder's past-due state. | "Late fee" |
| Skipped occurrence | A due date the landlord decided not to pay, preserved in the history. | Describing a deliberate non-payment. | "Cancelled" |
| Linked expense | The ledger transaction a paid occurrence points to, created from the paid amount and date. | Describing the optional ledger record of a payment. | "Auto-expense" (it is user-confirmed) |
| Last-payment seed | The reminder form's offer of the most recent matching ledger payment as a starting amount. | Describing the prefill convenience. | "Auto-fill" |
| Payment history | The ordered record of a reminder's occurrences, expected and paid amounts, and statuses. | Describing the auditable record. | "Log" |
| Landlord account | A Supabase Auth user who owns a portfolio of properties and payment records. | Describing the identity that signs in. | "User" (too generic) |
| Portfolio | Every property and record owned by one landlord account. | Describing the scope one account sees. | "Tenant" (reserved for rental tenants) |
| Sign-up | Creating a landlord account with an email and password, confirmed by email. | Describing first-time account creation. | "Registration" (prefer the product word) |
| Sign-in | Authenticating an account and starting a cookie-backed session. | Describing login. | "Log on" |
| Session | The cookie-backed Supabase session that keeps a landlord signed in across requests. | Describing persistence of identity. | "Login token" |
| Password reset | The emailed recovery flow that lets a landlord choose a new password. | Describing recovery. | "Forgot password" (the control, not the flow) |
| Bootstrap owner | The landlord account that receives the existing unowned records in the tenancy migration. | Describing the one-time data migration. | "Default user" |
| Owner scope | The rule that every property and record belongs to exactly one landlord account. | Describing tenancy and isolation. | "User filter" |
| Ledger entry | One income or expense line owned by a landlord account and stored on the server. | Describing a transaction row. | "Record" (the ledger is the record) |
| Local ledger | The retired browser-only transaction store; its entries are discarded, not imported. | Describing the pre-server ledger and its retirement. | "Offline ledger" |
